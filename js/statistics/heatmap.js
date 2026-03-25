/* ── heatmap.js ── */

import * as utils from '../../utils.js';
import { t, initI18n } from '../../i18n.js';

function hmGenerateData() {
  const today = new Date(); today.setHours(0,0,0,0);
  const tasks = {}, focus = {};

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = hmDateKey(d);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    if (Math.random() < (isWeekend ? 0.3 : 0.12)) { tasks[key] = 0; focus[key] = 0; continue; }

    const baseT = isWeekend ? 4 : 10, varT = isWeekend ? 8 : 16;
    tasks[key] = Math.round(baseT + Math.random() * varT);

    const deepWork = Math.random() > 0.6;
    const baseF = deepWork ? 4 : 1, varF = deepWork ? 5 : 3;
    focus[key] = Math.round((baseF + Math.random() * varF) * 10) / 10;
  }
  return { tasks, focus };
}

function hmDateKey(d) {
  if (utils.TEST) return d.toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let HM_DATA;
async function initHeatmap() {
  await initI18n();
  if (utils.TEST) HM_DATA = hmGenerateData();
  else {
    try {
      const res = await utils.fetchWithAuth(`${utils.URL_API}/statistic/heatmap`);
      if (!res.ok) throw new Error(res.status);
      HM_DATA = await res.json();
      console.log('heatmap', HM_DATA);
    } catch (err) {
      console.error(err);
    }
  }
  if (HM_DATA) renderHeatmap();
}

let hmMetric = 'tasks';

function hmGetLevel(val, metric) {
  if (val === 0) return 0;
  if (metric === 'tasks') {
    if (val <= 4)  return 1;
    if (val <= 9)  return 2;
    if (val <= 16) return 3;
    return 4;
  } else {
    if (val <= 1.5) return 1;
    if (val <= 3.5) return 2;
    if (val <= 6)   return 3;
    return 4;
  }
}

function hmComputeStats(metric) {
  const vals = Object.values(HM_DATA[metric]);
  const total = metric === 'tasks'
      ? vals.reduce((a,b)=>a+b,0)
      : Math.round(vals.reduce((a,b)=>a+b,0) * 100) / 100;
  const best = metric === 'tasks'
    ? Math.max(...vals)
    : Math.round(Math.max(...vals) * 100) / 100;

  const today = new Date(); today.setHours(0,0,0,0);
  let currentStreak = 0, longestStreak = 0, run = 0;
  const keys = Object.keys(HM_DATA[metric]).sort();

  for (const k of keys) {
    if (HM_DATA[metric][k] > 0) { run++; if (run > longestStreak) longestStreak = run; }
    else run = 0;
  }

  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (HM_DATA[metric][hmDateKey(d)] > 0) currentStreak++;
    else break;
  }

  return { total, best, currentStreak, longestStreak };
}

function setHmMetric(m, btn) {
  hmMetric = m;
  document.getElementById('hmBtnTasks').className = 'hm-metric-btn';
  document.getElementById('hmBtnFocus').className = 'hm-metric-btn';
  btn.classList.add(m === 'tasks' ? 'active-tasks' : 'active-focus');
  renderHeatmap();
}

export { initHeatmap, setHmMetric };

function renderHeatmap() {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const isTasks = hmMetric === 'tasks';
  const stats   = hmComputeStats(hmMetric);

  // Stats UI
  document.getElementById('hmStatTotal').textContent    = isTasks ? stats.total + '' : stats.total + 'h';
  document.getElementById('hmStatTotal').className      = 'hm-stat-val ' + (isTasks ? 'tasks-col' : 'focus-col');
  document.getElementById('hmStatTotalLbl').textContent = isTasks ? t('statistics.total_tasks') : t('statistics.total_hours');
  document.getElementById('hmStatLongest').textContent  = t('statistics.n_days', { n: stats.longestStreak });
  document.getElementById('hmStatLongest').className    = 'hm-stat-val ' + (isTasks ? 'tasks-col' : 'focus-col');
  document.getElementById('hmStatCurrent').textContent  = t('statistics.n_days', { n: stats.currentStreak });
  document.getElementById('hmStatCurrent').className    = 'hm-stat-val ' + (isTasks ? 'tasks-col' : 'focus-col');
  document.getElementById('hmStatBest').textContent     = isTasks ? stats.best + ' tasks' : stats.best + 'h';
  document.getElementById('hmStatBest').className       = 'hm-stat-val ' + (isTasks ? 'tasks-col' : 'focus-col');
  document.getElementById('hmStatBestLbl').textContent  = isTasks ? t('statistics.best_day') : t('statistics.best_hours');
  document.getElementById('hmSubtitle').textContent     = t('statistics.last_365_days') + ' · ' + (isTasks ? t('statistics.tasks') : t('statistics.focus_hours_short'));

  const badge = document.getElementById('hmStreakBadge');
  badge.textContent = t('statistics.n_days', { n: stats.currentStreak });
  badge.className   = 'streak-badge' + (isTasks ? '' : ' focus-badge');

  // Legend colors
  const levels = isTasks
    ? ['#1a1a20','#2d2b4e','#4338a0','#6366f1','#818cf8']
    : ['#1a1a20','#1a3a28','#166534','#22c55e','#4ade80'];
  for (let i = 0; i < 5; i++) {
    const el = document.getElementById('hmLeg' + i);
    if (el) el.style.background = levels[i];
  }

  // Build grid
  const grid = document.getElementById('hmGrid');
  grid.innerHTML = '';

  const cur = new Date(start);

  while (cur <= today) {
    const col = document.createElement('div');
    col.className = 'heatmap-col';

    for (let dow = 0; dow < 7; dow++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (hmMetric === 'focus' ? ' focus-mode' : '');

      const isValid = cur >= new Date(today.getTime() - 364 * 86400000) && cur <= today;
      const key = hmDateKey(cur);
      const val = isValid ? (HM_DATA[hmMetric][key] || 0) : -1;

      if (val < 0) {
        cell.setAttribute('data-level', '0');
        cell.style.visibility = 'hidden';
      } else {
        cell.setAttribute('data-level', hmGetLevel(val, hmMetric));
        cell.addEventListener('mouseenter', (e) => hmShowTooltip(e, key, val));
        cell.addEventListener('mouseleave', hmHideTooltip);
        cell.addEventListener('mousemove',  hmMoveTooltip);
      }

      col.appendChild(cell);
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() === 0) break;
    }

    grid.appendChild(col);
  }

  // Stagger animation
  const cells = grid.querySelectorAll('.cell');
  cells.forEach((c, i) => {
    c.style.opacity    = '0';
    c.style.transform  = 'scale(0.6)';
    c.style.transition = `opacity 0.3s ease ${i * 1.2}ms, transform 0.3s ease ${i * 1.2}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      c.style.opacity   = '1';
      c.style.transform = 'scale(1)';
    }));
  });
}

/* ── Tooltip ── */
const HM_DAYS = [
  'home.weekday_su', 'home.weekday_mo', 'home.weekday_tu', 'home.weekday_we',
  'home.weekday_th', 'home.weekday_fr', 'home.weekday_sa'
];
const HM_MONTHS = [
  'home.month_1',  'home.month_2',  'home.month_3',  'home.month_4',
  'home.month_5',  'home.month_6',  'home.month_7',  'home.month_8',
  'home.month_9',  'home.month_10', 'home.month_11', 'home.month_12'
];

function hmShowTooltip(e, key, val) {
  const d   = new Date(key);
  const tip = document.getElementById('hmTooltip');
  const dayName = t(HM_DAYS[d.getDay()]);
  const monthName = t(HM_MONTHS[d.getMonth()]);
  const dateStr = `${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()}`;

  document.getElementById('hmTtDate').textContent = dateStr;

  const isTasks = hmMetric === 'tasks';
  const ttVal   = document.getElementById('hmTtVal');
  const ttSub   = document.getElementById('hmTtSub');

  if (val === 0) {
    ttVal.textContent = t('statistics.no_activity');
    ttVal.className   = 'hm-tt-val';
    ttSub.textContent = '';
  } else {
    ttVal.textContent = isTasks ? t('statistics.tt_tasks_completed', { n: val }) : t('statistics.tt_focused', { n: val });
    ttVal.className   = 'hm-tt-val ' + (isTasks ? 'tasks-col' : 'focus-col');
    const other = isTasks ? HM_DATA.focus[key] : HM_DATA.tasks[key];
    ttSub.textContent = isTasks
      ? (other ? t('statistics.tt_focused', { n: other })       : t('statistics.tt_no_focus'))
      : (other ? t('statistics.tt_tasks_count', { n: other })   : t('statistics.tt_no_tasks'));
  }

  tip.classList.add('show');
  hmPositionTooltip(e.clientX, e.clientY);
}

function hmMoveTooltip(e) { hmPositionTooltip(e.clientX, e.clientY); }
function hmHideTooltip()  { document.getElementById('hmTooltip').classList.remove('show'); }

function hmPositionTooltip(x, y) {
  const tip = document.getElementById('hmTooltip');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x + 12, top = y - h - 8;
  if (left + w > vw - 8) left = x - w - 12;
  if (top < 8) top = y + 16;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}