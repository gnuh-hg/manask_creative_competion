const URL_API = "https://backend-u1p2.onrender.com";
const TEST = false;
const DB_NAME = 'AppOfflineDB';
const STORE_NAME = 'sync_queue';
let _lastWarningTime = 0;
let _loadingCount = 0;
let _loadingTimer = null;

// --- INDEXEDDB CORE (Dùng cho Offline-first) ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function addToOfflineQueue(url, method, body) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const allItemsReq = store.getAll();
        
        await new Promise((resolve) => {
            allItemsReq.onsuccess = () => {
                const existingQueue = allItemsReq.result;
                const duplicate = existingQueue.find(item => item.url === url && item.method === method);

                if (duplicate) {
                    store.delete(duplicate.id);
                    console.log(`[sync] Ghi đè lệnh cũ cho: ${url}`);
                }

                store.add({
                    url,
                    method,
                    body,
                    timestamp: Date.now()
                });

                resolve();
            };
        });

        console.log(`[Offline] Đã lưu vào IndexedDB: ${method} ${url}`);
    } catch (e) { console.error("IndexedDB Error:", e); }
}

export async function syncOfflineData() {
    if (!navigator.onLine) return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const queue = await new Promise(res => {
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => res(req.result);
        });

        if (queue.length === 0) return;

        for (const item of queue) {
            const token = localStorage.getItem('access_token');
            try {
                const res = await fetch(item.url, {
                    method: item.method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body)
                });
                if (res.ok) {
                    const delTx = db.transaction(STORE_NAME, 'readwrite');
                    await delTx.objectStore(STORE_NAME).delete(item.id);
                }
            } catch (err) { break; }
        }
    } catch (e) { console.error("Sync Error:", e); }
}

export async function updatePendingPostBody(tempId, newData) {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    const allRequests = await store.getAll();
    
    const target = allRequests.find(req => 
        req.method === 'POST' && req.body && String(req.body.id) === String(tempId)
    );

    if (target) {
        target.body = { ...target.body, ...newData };
        await store.put(target); 
    }
    
    await tx.done;
}

export async function removeFromOfflineQueue(tempId) {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const all = await store.getAll();

    // Tìm và xóa lệnh POST của item này khỏi hàng đợi
    const target = all.find(req => req.method === 'POST' && req.body && req.body.id === tempId);
    if (target) {
        await store.delete(target.id);
        console.log(`[Sync] Cancelled pending POST for ${tempId}`);
    }
    await tx.done;
}

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
    const safeHideLoading = () => { if (!didHideLoading) { didHideLoading = true; hideLoading(); } };

    for (let i = 0; i < retries; i++) {
        const token = localStorage.getItem('access_token');
        const controller = new AbortController();
        const timeoutMs = i === 0 ? 10000 : 60000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
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
                // Nếu lỗi mạng và là tác vụ thay đổi dữ liệu (PATCH/POST/DELETE)
                if (options.method && options.method !== 'GET') {
                    let bodyData = options.body;
                    if (typeof bodyData === 'string') {
                        try { bodyData = JSON.parse(bodyData); } catch(e) { /* giữ nguyên */ }
                    }
                    try {
                        await addToOfflineQueue(url, options.method, bodyData);
                        showWarning("Saved offline. Will sync when online.");
                    } catch (queueError) {
                        console.error("Failed to save to offline queue:", queueError);
                    }
                    // trả về response giả nhưng an toàn hơn
                    return new Response(JSON.stringify({ message: "Offline" }), {
                        status: 202,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                showWarning("Connection error");
                throw error;
            }
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
        }
    }
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

// Tự động kích hoạt khi có mạng hoặc load trang
if (typeof window !== 'undefined') {
    window.addEventListener('online', syncOfflineData);
    window.addEventListener('load', syncOfflineData);
}

export { URL_API, TEST };