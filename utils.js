const URL_API = "https://backend-u1p2.onrender.com";
const TEST = false;
let _lastWarningTime = 0;
let _loadingCount = 0;
let _loadingTimer = null;

// --- LOADING ---
export function showLoading() {
    _loadingCount++;
    if (_loadingTimer) return;

    _loadingTimer = setTimeout(() => {
        _loadingTimer = null;
        if (_loadingCount === 0) return;
        if (document.querySelector('.config-loading')) return;

        const overlay = document.createElement('div');
        overlay.className = 'config-loading';
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999;
        `;
        overlay.innerHTML = `
            <div style="
                background: #1a1a20; border: 1px solid #27272a;
                border-radius: 12px; padding: 20px 28px;
                display: flex; align-items: center; gap: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            ">
                <div style="
                    width: 18px; height: 18px; border-radius: 50%;
                    border: 2.5px solid #27272a; border-top-color: #6366f1;
                    animation: config-spin 0.8s linear infinite; flex-shrink: 0;
                "></div>
                <span style="font-size: 13px; font-weight: 500; color: #9494a0;">
                    Connecting...
                </span>
            </div>
        `;

        if (!document.querySelector('#config-loading-style')) {
            const style = document.createElement('style');
            style.id = 'config-loading-style';
            style.textContent = `@keyframes config-spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);
    }, 500);
}

export function hideLoading() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount > 0) return;

    if (_loadingTimer) {
        clearTimeout(_loadingTimer);
        _loadingTimer = null;
    }

    document.querySelector('.config-loading')?.remove();
}

// --- WARNING ---
export function showWarning(...args) {
    const warning_context = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const currentTime = Date.now();
    if (currentTime - _lastWarningTime < 3000) return;
    _lastWarningTime = currentTime;

    const existingWarning = document.querySelector('.warning');
    if (existingWarning) existingWarning.remove();

    const warning = document.createElement('div');
    warning.className = 'warning';
    warning.textContent = warning_context;
    warning.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #ef4444; color: white; padding: 12px 24px;
        border-radius: 8px; font-size: 14px; font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;
    `;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 3000);
}

// --- FETCH WITH RETRY ---
export async function fetchWithRetry(url, options = {}, retries = 4) {
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeoutMs = i === 0 ? 10000 : 60000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timer);
            return response;
        } catch (error) {
            clearTimeout(timer);
            if (i === retries - 1) throw error;
            const delay = 2000 * Math.pow(2, i);
            console.warn(`Retry ${i + 1}/${retries} sau ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- FETCH WITH AUTH ---
export async function fetchWithAuth(url, options = {}, retries = 4) {
    showLoading();
    let didHideLoading = false;

    const safeHideLoading = () => {
        if (!didHideLoading) {
            didHideLoading = true;
            hideLoading();
        }
    };

    for (let i = 0; i < retries; i++) {
        const token = localStorage.getItem('access_token');
        const defaultHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const controller = new AbortController();
        const timeoutMs = i === 0 ? 10000 : 60000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers },
                signal: controller.signal
            });
            clearTimeout(timer);
            safeHideLoading();

            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = "/pages/login.html";
                throw new Error("Unauthorized");
            }

            return response;
        } catch (error) {
            clearTimeout(timer);
            if (error.message === "Unauthorized") throw error;

            if (i === retries - 1) {
                safeHideLoading();
                showWarning("Connection error");
                localStorage.removeItem('access_token');
                window.location.href = "/pages/login.html";
                throw error;
            }

            const delay = 1000 * Math.pow(2, i);
            console.warn(`Retry ${i + 1}/${retries} sau ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export { URL_API, TEST };