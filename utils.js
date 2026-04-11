import * as idb from './idb.js';
import { t } from './i18n.js';

const URL_API = "https://backend-u1p2.onrender.com";
const QUEUE_STORE = "offlinequeue";
const TEST = false;
let _lastWarningTime = 0;
let _loadingCount = 0;
let _loadingTimer = null;

idb.registerStore(QUEUE_STORE);

// FIX 3: Thêm random component để tránh collision khi nhiều tab chạy song song
// Trước đây: Date.now() * 1e5 + _seq → 2 tab có cùng _seq trong cùng millisecond = collision
let _seq = 0;
let _lastTimestamp = 0;

export const generateId = () => {
  const now = Date.now();

  // Nếu clock bị lùi (NTP, DST...), tăng lastTimestamp thay vì dùng now
  // → đảm bảo timestamp component luôn tăng đơn điệu
  if (now > _lastTimestamp) {
    _lastTimestamp = now;
    _seq = 0;
  } else _seq = (_seq + 1) % 1e4;
  return `tmp-${_lastTimestamp * 1e8 + _seq}`;
};

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
                    ${t('utils.connecting')}
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

// ===== FETCH WITH AUTH (có Optimistic / Offline Queue) =====

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} retries
 * @param {object} queueOptions
 * @param {boolean} queueOptions.enableQueue  - Bật offline queue (default: false)
 *                                              Chỉ bật với các request ghi (POST/PUT/PATCH/DELETE)
 * @param {*}       queueOptions.optimisticData - Dữ liệu trả về ngay khi enqueue
 *                                                (dùng cho Optimistic UI)
 */
export async function fetchWithAuth(url, options = {}, queueOptions = {}, key = generateId(), retries = 1) {
    console.info(`[FetchWithAuth] ${options.method || 'GET'} ${url} ${JSON.stringify(options)} (retries=${retries}, queue=${queueOptions.enableQueue})`);
    console.trace();
    const { enableQueue = false, optimisticData = null } = queueOptions;

    showLoading();
    let didHideLoading = false;

    const safeHideLoading = () => {
        if (!didHideLoading) {
            didHideLoading = true;
            hideLoading();
        }
    };

    for (let i = 0; i < retries; i++) {
        const token = localStorage.getItem("access_token");
        const defaultHeaders = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        const controller = new AbortController();
        const timeoutMs = i === 0 ? 10000 : 30000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers },
                signal: controller.signal,
            });
            clearTimeout(timer);

            if (response.ok) {
                safeHideLoading();
                return response;
            }

            if (response.status === 401) {
                safeHideLoading();
                localStorage.removeItem("access_token");
                window.location.href = "/pages/login.html";
                throw new Error("Unauthorized");
            }

            // Lỗi client 4xx (trừ 429) → không retry, không queue
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                safeHideLoading();
                return response;
            }

            // Lỗi server 5xx / 429 → tiếp tục retry bên dưới
            if (i === retries - 1) throw new Error(`Server Error: ${response.status}`);

        } catch (error) {
            clearTimeout(timer);

            if (error.message === "Unauthorized") throw error;

            if (i === retries - 1) {
                safeHideLoading();

                // ── OFFLINE QUEUE ──────────────────────────────────────────
                // Chỉ queue khi: bật cờ, và thực sự mất mạng (hoặc không thể kết nối)
                const isNetworkError =
                    !navigator.onLine || error.name === "AbortError" || error.name === "TypeError";

        if (enableQueue && isNetworkError) {
            await enqueueRequest(url, key, options);
        
            if (optimisticData !== null) {
                return new Response(JSON.stringify(optimisticData), {
                    status: 202,
                    headers: {
                        "Content-Type": "application/json",
                        "X-Queued": "true",
                        "X-Queue-Key": String(key),
                    },
                });
            }
        
            showWarning(t('utils.offline_queue'));
            throw error;
        }
                // ───────────────────────────────────────────────────────────

                showWarning(t('utils.connection_unstable'));
                throw error;
            }
        }

        const delay = 1000 * Math.pow(2, i);
        console.warn(`Thử lại lần ${i + 1}/${retries} sau ${delay / 1000}s do lỗi tạm thời...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

async function enqueueRequest(url, key, options = {}) {
    await idb.addData(QUEUE_STORE, {
        url, key,
        options: {
            ...options,
            // Không serialize signal vì không clone được
            signal: undefined,
        },
        token: localStorage.getItem("access_token"),
        enqueuedAt: Date.now(),
    }, key); // truyền key làm IDB key → FIFO theo generateId (timestamp-based)
    console.info(`[Queue] Đã lưu request vào hàng chờ, key=${key}`);
    return key;
}

async function flushQueue() {
    let items;
    try {
        items = await idb.getAllDataWithKeys(QUEUE_STORE);
    } catch {
        return;
    }
    if (!items.length) return;

    console.info(`[Queue] Đang xử lý ${items.length} request trong hàng chờ...`);

    for (const item of items) {
        const { _key, url, options, token } = item;
        // FIX 2: Ưu tiên token mới từ localStorage — token lưu lúc enqueue có thể đã expired
        const freshToken = localStorage.getItem("access_token") ?? token;
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    "Authorization": `Bearer ${freshToken}`,
                    "Content-Type": "application/json",
                    ...options?.headers,
                },
            });

            if (response.ok || (response.status >= 400 && response.status < 500)) {
                // Thành công hoặc lỗi client (không retry được) → xóa khỏi queue
                await idb.deleteData(QUEUE_STORE, _key);
                console.info(`[Queue] Đã gửi thành công, key=${_key}`);
            } else {
                console.warn(`[Queue] Server lỗi ${response.status}, sẽ thử lại sau`);
            }
        } catch {
            // Vẫn mất mạng → giữ nguyên trong queue
            console.warn(`[Queue] Vẫn mất mạng, dừng flush`);
            break;
        }
    }
}

//Boolean kiểm tra xem queue có phần tử nào không
export async function isQueueEmpty() {
    try {
        const items = await idb.getAllDataWithKeys(QUEUE_STORE);
        return items.length === 0;
    } catch {
        return true;
    }
}


window.addEventListener("online", () => {
    console.info(`[Queue] ${t('utils.network_recovered')}`);
    flushQueue();
});

if (navigator.onLine) flushQueue();

export { URL_API, TEST, QUEUE_STORE };