// js/notification.js — Manask Notification Manager
import { t } from '../i18n.js';
import * as utils from '../utils.js';

// ─── SVG ICONS (custom, 24×24, no external library) ───────────────────────

export const ICONS = {

  // ✓ Xanh — task hoàn thành: checkmark trong circle
  task_done: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.25" fill="rgba(34,197,94,0.12)" stroke="#22c55e" stroke-width="1.5"/>
    <path d="M7.5 12.5l3 3 6-6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 📅 Đỏ — task quá hạn: lịch với dấu chấm than
  task_overdue: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="17" rx="2.5" fill="rgba(239,68,68,0.1)" stroke="#ef4444" stroke-width="1.5"/>
    <path d="M3 9.5h18" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8 2.5v3M16 2.5v3" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 13.5v2.5" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="18.5" r="0.9" fill="#ef4444"/>
  </svg>`,

  // 🍅 Indigo — pomodoro xong: tomato (circle có cuống)
  pomodoro_done: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="13" r="9" fill="rgba(99,102,241,0.12)" stroke="#6366f1" stroke-width="1.5"/>
    <path d="M9.5 4C10 2.5 14 2.5 14.5 4" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M8.5 13.5l2.5 2.5 5-5" stroke="#6366f1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 🌙 Cyan — nghỉ giải lao: mặt trăng lưỡi liềm
  break_start: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="rgba(6,182,212,0.12)" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16.5 10.5a2.5 2.5 0 0 0-2.5-2.5" stroke="#06b6d4" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // ☀️ Vàng — hết giờ nghỉ: mặt trời với tia sáng
  break_end: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4.5" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // 🔥 Cam — streak: ngọn lửa
  streak: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 2.5C9.5 5.5 7.5 8.5 7.5 12c0 2.5 1 4.5 2.5 6-0.5-1.5 0-3 1-4 0.5 1.5 1.5 2.5 2.5 3-0.5-1 0-2.5 0.5-3.5C15 15 16 16.5 16 18c1.5-1.5 2-3.5 2-5.5 0-4-2-7-5.5-10z" fill="rgba(249,115,22,0.15)" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 22c2.5 0 4-1.5 4-3.5 0-1.5-1-2.5-2-3-0.2 1-1 1.8-2 2-1-1-1.5-2.5-1.5-3.5-1 1-1.5 2.5-1.5 4 0 2.2 1.5 4 3 4z" fill="rgba(249,115,22,0.3)"/>
  </svg>`,

  // 📡 Xám — mất kết nối: wifi bị gạch chéo
  offline: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 1.5l21 21" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="20" r="1.2" fill="#9ca3af"/>
  </svg>`,

  // 📶 Xanh lá — khôi phục kết nối: wifi với dấu check
  online: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="20" r="1.2" fill="#22c55e"/>
    <circle cx="19.5" cy="5.5" r="4.5" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="1.3"/>
    <path d="M17.5 5.5l1.5 1.5 2.5-2.5" stroke="#22c55e" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

// Màu accent cho từng loại notification
export const COLORS = {
  task_done:     '#22c55e',
  task_overdue:  '#ef4444',
  pomodoro_done: '#6366f1',
  break_start:   '#06b6d4',
  break_end:     '#f59e0b',
  streak:        '#f97316',
  offline:       '#9ca3af',
  online:        '#22c55e',
};

// ─── STORAGE ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'manask_notifications';
const MAX_STORE   = 50;
let _store = [];

function _load() {
  try { _store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { _store = []; }
}

function _save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_store.slice(0, MAX_STORE)));
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

// Gọi t() an toàn — fallback về chuỗi tiếng Anh nếu key chưa load
function _safeT(key, fallback) {
  try {
    const v = t(key);
    return (v && v !== key) ? v : fallback;
  } catch { return fallback; }
}

function _relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10)  return _safeT('notif.just_now', 'just now');
  if (s < 60)  return `${s}${_safeT('notif.sec', 's')} ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}${_safeT('notif.min', 'm')} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}${_safeT('notif.hr', 'h')} ago`;
  return `${Math.floor(h / 24)}${_safeT('notif.day', 'd')} ago`;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/**
 * Thêm notification mới + hiện toast
 * @param {string} type  — key trong ICONS / COLORS
 * @param {string} title — tiêu đề ngắn
 * @param {string} body  — mô tả (optional)
 */
export function add(type, title, body = '') {
  _load();
  const notif = {
    id:   `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type, title, body,
    time: new Date().toISOString(),
    read: false,
  };
  _store.unshift(notif);
  _save();
  _showToast(notif);
  _updateBadge();
}

export function markAllRead() {
  _load();
  _store.forEach(n => { n.read = true; });
  _save();
  _updateBadge();
  _renderList();
  // Sync to backend (fire-and-forget, offline queue enabled)
  if (!utils.TEST) {
    utils.fetchWithAuth(
      `${utils.URL_API}/notifications/read-all`,
      { method: 'PATCH' },
      { enableQueue: true }
    ).catch(() => {});
  }
}

export function clearAll() {
  _store = [];
  _save();
  _updateBadge();
  _renderList();
  // Sync to backend (fire-and-forget, offline queue enabled)
  if (!utils.TEST) {
    utils.fetchWithAuth(
      `${utils.URL_API}/notifications`,
      { method: 'DELETE' },
      { enableQueue: true }
    ).catch(() => {});
  }
}

export function getUnreadCount() {
  _load();
  return _store.filter(n => !n.read).length;
}

// ─── OVERDUE CHECK (frontend fallback, không cần backend) ─────────────────

const _OVERDUE_SEEN_KEY = 'manask_overdue_seen';

/**
 * Kiểm tra danh sách task có due_date đã qua và tạo notification task_overdue
 * nếu chưa từng notify cho task đó. Gọi sau khi loadData() trả về danh sách task.
 *
 * @param {Array<{id: string|number, name: string, due_date?: string}>} tasks
 */
export function checkOverdue(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return;

  let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(_OVERDUE_SEEN_KEY) || '[]')); }
  catch { seen = new Set(); }

  const now = Date.now();
  let changed = false;

  tasks.forEach(task => {
    if (!task.due_date) return;
    const due = new Date(task.due_date).getTime();
    if (isNaN(due) || due >= now) return;          // chưa overdue
    const key = String(task.id);
    if (seen.has(key)) return;                      // đã notify rồi

    add(
      'task_overdue',
      _safeT('notif.task_overdue_title', 'Task overdue'),
      task.name || ''
    );
    seen.add(key);
    changed = true;
  });

  if (changed) {
    // Giữ tối đa 500 entries để tránh localStorage bloat
    localStorage.setItem(_OVERDUE_SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────

function _showToast(notif) {
  let wrap = document.getElementById('notif-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'notif-toast-wrap';
    document.body.appendChild(wrap);
  }

  const el = document.createElement('div');
  el.className = 'notif-toast';
  el.setAttribute('style', `--nc: ${COLORS[notif.type] || '#6366f1'}`);
  el.innerHTML = `
    <div class="notif-toast__icon">${ICONS[notif.type] || ''}</div>
    <div class="notif-toast__content">
      <div class="notif-toast__title">${notif.title}</div>
      ${notif.body ? `<div class="notif-toast__body">${notif.body}</div>` : ''}
    </div>
    <button class="notif-toast__close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div class="notif-toast__progress"></div>
  `;

  const dismiss = () => {
    el.classList.add('notif-toast--out');
    setTimeout(() => el.remove(), 350);
  };

  el.querySelector('.notif-toast__close').addEventListener('click', dismiss);
  wrap.appendChild(el);

  let timer = setTimeout(dismiss, 5000);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2000); });

  // Trigger enter animation
  requestAnimationFrame(() => el.classList.add('notif-toast--in'));
}

// ─── BADGE ────────────────────────────────────────────────────────────────

function _updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = getUnreadCount();
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
}

// ─── PANEL ────────────────────────────────────────────────────────────────

function _renderList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  _load();

  if (_store.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          <line x1="12" y1="2" x2="12" y2="4" stroke-linecap="round"/>
        </svg>
        <span>${_safeT('notif.empty', 'No notifications')}</span>
      </div>`;
    return;
  }

  list.innerHTML = _store.map(n => `
    <div class="notif-item${n.read ? '' : ' notif-item--unread'}" style="--nc: ${COLORS[n.type] || '#6366f1'}">
      <div class="notif-item__icon">${ICONS[n.type] || ''}</div>
      <div class="notif-item__info">
        <div class="notif-item__title">${n.title}</div>
        ${n.body ? `<div class="notif-item__desc">${n.body}</div>` : ''}
        <div class="notif-item__time">${_relTime(n.time)}</div>
      </div>
      ${!n.read ? '<div class="notif-item__dot"></div>' : ''}
    </div>
  `).join('');
}

export function togglePanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  if (panel.classList.contains('notif-panel--open')) _closePanel(panel);
  else _openPanel(panel);
}

function _openPanel(panel) {
  _renderList();
  panel.classList.add('notif-panel--open');
  // Đánh dấu đã đọc sau 800ms (để user kịp thấy unread dot)
  setTimeout(markAllRead, 800);
}

function _closePanel(panel) {
  panel.classList.remove('notif-panel--open');
}

// ─── BACKEND SYNC ─────────────────────────────────────────────────────────

/**
 * Fetch notifications từ backend và merge vào localStorage.
 * Backend items được ưu tiên (dedup theo id).
 * Silent fail nếu backend chưa có endpoint hoặc offline.
 */
async function _syncFromBackend() {
  if (utils.TEST) return;
  try {
    const res = await utils.fetchWithAuth(
      `${utils.URL_API}/notifications`,
      { method: 'GET' },
      { enableQueue: false }
    );
    if (!res || !res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.items)) return;

    _load();
    const localIds = new Set(_store.map(n => n.id));
    // Thêm các item từ backend chưa có ở local
    for (const item of data.items) {
      if (!localIds.has(item.id)) _store.push(item);
    }
    // Sắp xếp mới nhất trước
    _store.sort((a, b) => new Date(b.time) - new Date(a.time));
    _save();
    _updateBadge();
    _renderList();
  } catch {
    // Backend chưa có endpoint hoặc offline — dùng localStorage
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────

export function init() {
  _load();
  _updateBadge();
  // Fetch từ backend (fire-and-forget, không block UI)
  _syncFromBackend();

  // Đóng panel khi click bên ngoài
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    const wrap  = document.getElementById('notif-bell-wrap');
    const bell  = document.getElementById('notif-bell');
    if (!panel || !wrap) return;
    if (!panel.contains(e.target) && !wrap.contains(e.target)) {
      _closePanel(panel);
      if (bell) bell.classList.remove('active');
    }
  });

  const clearBtn = document.getElementById('notif-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
}

// Expose globally — cho utils.js và các trang không dùng ES module import
if (typeof window !== 'undefined') {
  window.Notif = { add, init, togglePanel, markAllRead, clearAll, getUnreadCount, checkOverdue };
}
