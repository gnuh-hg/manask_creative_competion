import { t } from '../i18n.js';
import * as utils from '../utils.js';

// ─── SVG ICONS ────────────────────────────────────────────────────────────────

export const ICONS = {
  task_done: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.25" fill="rgba(34,197,94,0.12)" stroke="#22c55e" stroke-width="1.5"/>
    <path d="M7.5 12.5l3 3 6-6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  task_overdue: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="17" rx="2.5" fill="rgba(239,68,68,0.1)" stroke="#ef4444" stroke-width="1.5"/>
    <path d="M3 9.5h18" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8 2.5v3M16 2.5v3" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 13.5v2.5" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="18.5" r="0.9" fill="#ef4444"/>
  </svg>`,

  pomodoro_done: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="13" r="9" fill="rgba(99,102,241,0.12)" stroke="#6366f1" stroke-width="1.5"/>
    <path d="M9.5 4C10 2.5 14 2.5 14.5 4" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M8.5 13.5l2.5 2.5 5-5" stroke="#6366f1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  break_start: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="rgba(6,182,212,0.12)" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16.5 10.5a2.5 2.5 0 0 0-2.5-2.5" stroke="#06b6d4" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  break_end: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4.5" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  streak: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 2.5C9.5 5.5 7.5 8.5 7.5 12c0 2.5 1 4.5 2.5 6-0.5-1.5 0-3 1-4 0.5 1.5 1.5 2.5 2.5 3-0.5-1 0-2.5 0.5-3.5C15 15 16 16.5 16 18c1.5-1.5 2-3.5 2-5.5 0-4-2-7-5.5-10z" fill="rgba(249,115,22,0.15)" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 22c2.5 0 4-1.5 4-3.5 0-1.5-1-2.5-2-3-0.2 1-1 1.8-2 2-1-1-1.5-2.5-1.5-3.5-1 1-1.5 2.5-1.5 4 0 2.2 1.5 4 3 4z" fill="rgba(249,115,22,0.3)"/>
  </svg>`,
};

export const COLORS = {
  task_done:     '#22c55e',
  task_overdue:  '#ef4444',
  pomodoro_done: '#6366f1',
  break_start:   '#06b6d4',
  break_end:     '#f59e0b',
  streak:        '#f97316',
};

// ─── I18N HELPERS ─────────────────────────────────────────────────────────────

function _safeT(key, fallback, vars = {}) {
  try {
    const v = t(key, vars);
    return (v && v !== key) ? v : fallback;
  } catch { return fallback; }
}

/**
 * Build title từ raw data của notification.
 * Backend KHÔNG gửi title — chỉ gửi type, count, task_title.
 * Frontend dùng t() để build đúng ngôn ngữ hiện tại.
 */
function _buildTitle(n) {
  switch (n.type) {
    case 'task_done':
      return n.count > 1
        ? _safeT('notif.task_done_count_plural', `Completed ${n.count} tasks today`, { count: n.count })
        : _safeT('notif.task_done_count', `Completed ${n.count} task today`, { count: n.count });

    case 'pomodoro_done':
      return n.count > 1
        ? _safeT('notif.pomodoro_done_count_plural', `Completed ${n.count} Pomodoros today`, { count: n.count })
        : _safeT('notif.pomodoro_done_count', `Completed ${n.count} Pomodoro today`, { count: n.count });

    case 'task_overdue':
      return _safeT('notif.task_overdue_title', 'Task overdue');

    case 'streak':
      return _safeT('notif.streak_title', `🔥 ${n.count}-day streak!`, { count: n.count });

    case 'break_start':
      return _safeT('notif.break_start_title', 'Break time!');

    case 'break_end':
      return _safeT('notif.break_end_title', "Break's over — back to focus!");

    default:
      return n.type;
  }
}

/**
 * Build body từ raw data.
 * Chỉ task_overdue và streak cần body có vars.
 */
function _buildBody(n) {
  switch (n.type) {
    case 'task_overdue':
      return n.task_title
        ? _safeT('notif.task_overdue_body', `"${n.task_title}" is past due`, { task_title: n.task_title })
        : '';

    case 'streak':
      return _safeT('notif.streak_body', 'Keep it up!');

    case 'break_start':
      // break_type: 'long' | 'short' — backend gửi kèm nếu cần phân biệt
      return n.break_type === 'long'
        ? _safeT('notif.break_start_long', "Long break — you've earned it")
        : _safeT('notif.break_start_short', 'Short break, recharge quickly');

    default:
      return '';
  }
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

// ─── CACHE (stale-while-revalidate) ───────────────────────────────────────────
//
// Cache lưu RAW data từ backend (không lưu title đã build).
// Title được build tại render time → đổi ngôn ngữ không cần fetch lại.

const CACHE_KEY  = 'manask_notif_cache';
const CACHE_META = 'manask_notif_meta';
const MAX_CACHE  = 50;

let _cache = [];
let _meta  = {};

function _loadCache() {
  try { _cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
  catch { _cache = []; }
  try { _meta  = JSON.parse(localStorage.getItem(CACHE_META) || '{}'); }
  catch { _meta  = {}; }
}

function _saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(_cache.slice(0, MAX_CACHE)));
  localStorage.setItem(CACHE_META, JSON.stringify(_meta));
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Báo một sự kiện notification lên backend.
 *
 * Frontend KHÔNG tự tạo ID, KHÔNG tự aggregate, KHÔNG build title để gửi lên.
 * Chỉ gửi payload thô — backend quyết định cách lưu và đếm.
 *
 * @param {'task_done'|'pomodoro_done'|'break_start'|'break_end'} type
 * @param {string} taskTitle  — tên task (backend lưu vào task_title)
 * @param {Object} [extra]    — metadata tùy chọn (task_id, duration_sec, break_type…)
 */
export async function add(type, taskTitle = '', extra = {}) {
  // break_start / break_end: toast ephemeral local, không POST backend
  if (type === 'break_start' || type === 'break_end') {
    const raw = { type, task_title: taskTitle, ...extra };
    _showToast({ type, title: _buildTitle(raw), body: _buildBody(raw) });
    return;
  }

  // task_done / pomodoro_done: toast optimistic ngay + POST backend
  if (type === 'task_done' || type === 'pomodoro_done') {
    // Toast với count tạm = 1 (backend trả count thật sau)
    _showToast({ type, title: _buildTitle({ type, count: 1 }), body: '' });

    try {
      const res = await utils.fetchWithAuth(
        `${utils.URL_API}/notifications/events`,
        {
          method: 'POST',
          body: JSON.stringify({ type, task_title: taskTitle, ...extra }),
        },
        { enableQueue: true }
      );

      if (res?.ok) {
        // Backend trả raw record: { id, type, count, task_title, time, read, toasted }
        // Không có title/body — frontend build khi render
        const record = await res.json();
        _mergeRecord(record);
        _updateBadge();
        _renderList();
      }
    } catch {
      // offline queue tự retry
    }
  }
}

function _mergeRecord(record) {
  _loadCache();
  const idx = _cache.findIndex(n => n.id === record.id);
  if (idx >= 0) _cache[idx] = record;
  else          _cache.unshift(record);
  _saveCache();
}

export function markAllRead() {
  _loadCache();
  _cache.forEach(n => { n.read = true; });
  _saveCache();
  _updateBadge();
  _renderList();

  if (!utils.TEST) {
    utils.fetchWithAuth(
      `${utils.URL_API}/notifications/read-all`,
      { method: 'PATCH' },
      { enableQueue: true }
    ).catch(() => {});
  }
}

export function clearAll() {
  _cache = [];
  _meta  = {};
  _saveCache();
  _updateBadge();
  _renderList();

  if (!utils.TEST) {
    utils.fetchWithAuth(
      `${utils.URL_API}/notifications`,
      { method: 'DELETE' },
      { enableQueue: true }
    ).catch(() => {});
  }
}

export function getUnreadCount() {
  _loadCache();
  return _cache.filter(n => !n.read).length;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

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

  requestAnimationFrame(() => el.classList.add('notif-toast--in'));
}

// ─── BADGE ────────────────────────────────────────────────────────────────────

function _updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  _loadCache();
  const count = _meta.taskDoneToday ?? 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
}

// ─── PANEL ────────────────────────────────────────────────────────────────────

function _renderList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  _loadCache();

  if (_cache.length === 0) {
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

  // Backend đã sort desc theo time — render thẳng, build title tại đây
  list.innerHTML = _cache.map(n => {
    const title = _buildTitle(n);
    const body  = _buildBody(n);
    return `
      <div class="notif-item${n.read ? '' : ' notif-item--unread'}" style="--nc: ${COLORS[n.type] || '#6366f1'}">
        <div class="notif-item__icon">${ICONS[n.type] || ''}</div>
        <div class="notif-item__info">
          <div class="notif-item__title">${title}</div>
          ${body ? `<div class="notif-item__desc">${body}</div>` : ''}
          <div class="notif-item__time">${_relTime(n.time)}</div>
        </div>
        ${!n.read ? '<div class="notif-item__dot"></div>' : ''}
      </div>
    `;
  }).join('');
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
  setTimeout(markAllRead, 800);
}

function _closePanel(panel) {
  panel.classList.remove('notif-panel--open');
}

// ─── BACKEND SYNC ─────────────────────────────────────────────────────────────
//
// Backend trả RAW data — không có title/body:
// {
//   items: [
//     {
//       id:         "uuid-...",
//       type:       "task_done",
//       count:      3,
//       task_title: "Viết unit test",   // cho body của task_overdue
//       break_type: "short" | "long",   // cho body của break_start (optional)
//       time:       "2025-01-15T...",
//       read:       false,
//       toasted:    false,
//     }
//   ],
//   meta: { taskDoneToday: 3 }
// }

async function _syncFromBackend() {
  if (utils.TEST) return;
  try {
    const res = await utils.fetchWithAuth(
      `${utils.URL_API}/notifications`,
      { method: 'GET' },
      { enableQueue: false }
    );
    if (!res?.ok) return;

    const data = await res.json();
    if (!Array.isArray(data.items)) return;

    // Ghi đè cache bằng raw data từ backend
    _cache = data.items;
    _meta  = data.meta ?? {};
    _saveCache();

    // Toast các item backend-owned chưa show (toasted: false)
    // Build title/body theo ngôn ngữ hiện tại của user
    const needToast = data.items.filter(n => !n.toasted);
    if (needToast.length) {
      needToast.forEach(n => _showToast({
        type:  n.type,
        title: _buildTitle(n),
        body:  _buildBody(n),
      }));

      utils.fetchWithAuth(
        `${utils.URL_API}/notifications/toasted`,
        {
          method: 'PATCH',
          body: JSON.stringify({ ids: needToast.map(n => n.id) }),
        },
        { enableQueue: true }
      ).catch(() => {});
    }

    _updateBadge();
    _renderList();
  } catch {
    // Backend chưa ready hoặc offline → dùng cache
  }
}

// ─── LANG CHANGE ──────────────────────────────────────────────────────────────
//
// Khi user đổi ngôn ngữ qua setLang(), i18n.js dispatch event 'langChanged'.
// Raw data vẫn còn trong cache → chỉ cần re-render, title tự build đúng ngôn ngữ mới.

window.addEventListener('langChanged', () => {
  _renderList();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

export function init() {
  _loadCache();
  _updateBadge();
  _renderList();       // render từ cache ngay (stale-while-revalidate)
  _syncFromBackend();  // fetch backend ngầm, update nếu có gì mới

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

// Expose globally
if (typeof window !== 'undefined') {
  window.Notif = { add, init, togglePanel, markAllRead, clearAll, getUnreadCount };
}