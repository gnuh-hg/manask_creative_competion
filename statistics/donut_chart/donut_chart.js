/* ── donut.js ── */

const DONUT_R = 56;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;
const DONUT_GAP  = (2.2 / 360) * DONUT_CIRC;
const DONUT_MAX_SHOWN = 4;
const DONUT_COLOR_OTHERS = '#3f3f46';
let DONUT_DATA;

async function initDonut() {
  if (Config.TEST) DONUT_DATA = {
    week: {
      tasks: [
        { name: 'Website Redesign', value: 14, color: '#6366f1' },
        { name: 'Backend API',      value: 11, color: '#22c55e' },
        { name: 'Mobile App',       value: 9,  color: '#7c3aed' },
        { name: 'Internal Tools',   value: 9,  color: '#8b5cf6' },
        { name: 'Marketing',        value: 6,  color: '#ef4444' },
        { name: 'DevOps',           value: 5,  color: '#10b981' },
        { name: 'Analytics',        value: 4,  color: '#f59e0b' },
        { name: 'Design System',    value: 3,  color: '#3b82f6' },
        { name: 'Customer Portal',  value: 2,  color: '#f97316' }
      ],
      focus: [
        { name: 'Website Redesign', value: 5.5, color: '#6366f1' },
        { name: 'Backend API',      value: 4.5, color: '#22c55e' },
        { name: 'Mobile App',       value: 3.5, color: '#7c3aed' },
        { name: 'Marketing',        value: 2.0, color: '#ef4444' },
        { name: 'DevOps',           value: 2.0, color: '#10b981' },
        { name: 'Analytics',        value: 1.5, color: '#f59e0b' },
        { name: 'Design System',    value: 1.0, color: '#3b82f6' },
        { name: 'Internal Tools',   value: 0.5, color: '#8b5cf6' },
        { name: 'Customer Portal',  value: 0.5, color: '#f97316' }
      ]
    },
    month: {
      tasks: [
        { name: 'Website Redesign', value: 52, color: '#6366f1' },
        { name: 'Backend API',      value: 44, color: '#22c55e' },
        { name: 'Mobile App',       value: 38, color: '#7c3aed' },
        { name: 'Marketing',        value: 21, color: '#ef4444' },
        { name: 'DevOps',           value: 19, color: '#10b981' },
        { name: 'Analytics',        value: 17, color: '#f59e0b' },
        { name: 'Design System',    value: 12, color: '#3b82f6' },
        { name: 'Customer Portal',  value: 8,  color: '#f97316' },
        { name: 'Internal Tools',   value: 6,  color: '#8b5cf6' }
      ],
      focus: [
        { name: 'Website Redesign', value: 21.0, color: '#6366f1' },
        { name: 'Backend API',      value: 18.0, color: '#22c55e' },
        { name: 'Mobile App',       value: 15.5, color: '#7c3aed' },
        { name: 'Marketing',        value: 8.0,  color: '#ef4444' },
        { name: 'DevOps',           value: 7.5,  color: '#10b981' },
        { name: 'Analytics',        value: 6.5,  color: '#f59e0b' },
        { name: 'Design System',    value: 5.0,  color: '#3b82f6' },
        { name: 'Customer Portal',  value: 3.0,  color: '#f97316' },
        { name: 'Internal Tools',   value: 2.5,  color: '#8b5cf6' }
      ]
    },
    year: {
      tasks: [
        { name: 'Website Redesign', value: 310, color: '#6366f1' },
        { name: 'Backend API',      value: 280, color: '#22c55e' },
        { name: 'Mobile App',       value: 240, color: '#7c3aed' },
        { name: 'Marketing',        value: 120, color: '#ef4444' },
        { name: 'DevOps',           value: 110, color: '#10b981' },
        { name: 'Analytics',        value: 95,  color: '#f59e0b' },
        { name: 'Design System',    value: 74,  color: '#3b82f6' },
        { name: 'Customer Portal',  value: 48,  color: '#f97316' },
        { name: 'Internal Tools',   value: 36,  color: '#8b5cf6' }
      ],
      focus: [
        { name: 'Website Redesign', value: 124, color: '#6366f1' },
        { name: 'Backend API',      value: 112, color: '#22c55e' },
        { name: 'Mobile App',       value: 96,  color: '#7c3aed' },
        { name: 'Marketing',        value: 48,  color: '#ef4444' },
        { name: 'DevOps',           value: 44,  color: '#10b981' },
        { name: 'Analytics',        value: 38,  color: '#f59e0b' },
        { name: 'Design System',    value: 30,  color: '#3b82f6' },
        { name: 'Customer Portal',  value: 19,  color: '#f97316' },
        { name: 'Internal Tools',   value: 14,  color: '#8b5cf6' }
      ]
    }
  };
  else {
    try {
      const res = await Config.fetchWithAuth(
        `${Config.URL_API}/statistic/donut_chart`
      );

      if (!res.ok) throw new Error(res.status);

      DONUT_DATA = await res.json();
      console.log('donut', DONUT_DATA);
    } catch (err) {
      console.error(err);
    }
  }
  if (DONUT_DATA) renderDonut();
};

const DONUT_PERIOD_LABEL = { week: 'Last 7 days', month: 'Last 30 days', year: 'Last 12 months' };
const DONUT_METRIC_LABEL = { tasks: 'Tasks', focus: 'Hours' };
const DONUT_METRIC_UNIT  = { tasks: ' tasks', focus: 'h' };
const DONUT_METRIC_CLASS = { tasks: 'active-tasks', focus: 'active-focus' };

let donutPeriod = 'week';
let donutMetric = 'tasks';
let donutCircles  = [];
let donutLegItems = [];

setDonutPeriod(donutPeriod, document.querySelector('.donut-period-tab'));

function setDonutPeriod(p, btn) {
  donutPeriod = p;
  document.querySelectorAll('.donut-period-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDonut();
}

function setDonutMetric(m, btn) {
  donutMetric = m;
  document.getElementById('donutBtnTasks').className = 'metric-btn';
  document.getElementById('donutBtnFocus').className = 'metric-btn';
  btn.classList.add(DONUT_METRIC_CLASS[m]);
  renderDonut();
}

function donutFmtVal(v) {
  return donutMetric === 'focus' ? v.toFixed(2) + 'h' : v + ' tasks';
}

function donutSetCenter(num, color) {
  const unit = donutMetric === 'focus' ? 'hours' : 'tasks';
  const el   = document.getElementById('donutCenterValue');
  el.innerHTML = `${num}<span class="unit">${unit}</span>`;
  el.style.color = color || '';
}

function donutBuildSegments(dataArray) {
  if (dataArray.length <= DONUT_MAX_SHOWN) {
    return dataArray.map(item => ({ ...item, isOthers: false }));
  }

  const top = dataArray.slice(0, DONUT_MAX_SHOWN);
  const rest = dataArray.slice(DONUT_MAX_SHOWN);

  const segs = top.map(item => ({ ...item, isOthers: false }));
  
  segs.push({
    name: `Others (${rest.length})`,
    value: rest.reduce((a, b) => a + b.value, 0),
    color: DONUT_COLOR_OTHERS,
    isOthers: true,
    children: rest
  });
  
  return segs;
}

function donutActivate(i, segs) {
  const seg = segs[i];
  const svg = document.getElementById('donutSvg');
  svg.classList.add('has-hover');
  donutCircles[i].classList.add('hovered');
  const num = donutMetric === 'focus' ? seg.value.toFixed(2) : seg.value;
  donutSetCenter(num, seg.color);
  document.getElementById('donutCenterLabel').textContent = seg.isOthers ? 'Others' : seg.name;
  donutLegItems.forEach((el,j) => {
    el.classList.toggle('active', j === i);
    el.querySelector('.donut-legend-dot').style.boxShadow = j === i ? `0 0 8px ${seg.color}` : 'none';
  });
}

function donutDeactivate(total) {
  document.getElementById('donutSvg').classList.remove('has-hover');
  donutCircles.forEach(c => c.classList.remove('hovered'));
  const num = donutMetric === 'focus' ? total.toFixed(2) : total;
  donutSetCenter(num, '');
  document.getElementById('donutCenterLabel').textContent = 'Total';
  donutLegItems.forEach(el => {
    el.classList.remove('active');
    el.querySelector('.donut-legend-dot').style.boxShadow = 'none';
  });
}

function renderDonut() {
  const currentData = DONUT_DATA[donutPeriod][donutMetric];
  // Thay đổi 1: Tính tổng dựa trên thuộc tính .value của object
  const total = currentData.reduce((acc, item) => acc + item.value, 0);
  // Thay đổi 2: Truyền mảng object vào hàm build (hàm build này sẽ tự sort như đã nói ở bước trước)
  const segs  = donutBuildSegments(currentData);
  
  const svg   = document.getElementById('donutSvg');
  const legEl = document.getElementById('donutLegend');

  document.getElementById('donutSubtitle').textContent    = `${DONUT_PERIOD_LABEL[donutPeriod]} · ${DONUT_METRIC_LABEL[donutMetric]}`;
  document.getElementById('donutFooterValue').textContent = donutFmtVal(total);
  document.getElementById('donutFooterValue').style.color = donutMetric === 'tasks' ? '#818cf8' : 'var(--accent-green)';

  donutSetCenter(donutMetric === 'focus' ? total.toFixed(2) : total, '');
  document.getElementById('donutCenterLabel').textContent = 'Total';

  donutCircles.forEach(c => c.remove());
  donutCircles  = [];
  legEl.innerHTML = '';
  donutLegItems   = [];

  let offset = 0;

  segs.forEach((seg, i) => {
    // Thay đổi 3: Sử dụng seg.value trực tiếp từ object trong segs
    const pct = seg.value / total;
    const len = pct * DONUT_CIRC - DONUT_GAP;

    const ns  = 'http://www.w3.org/2000/svg';
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', 74);
    circle.setAttribute('cy', 74);
    circle.setAttribute('r', DONUT_R);
    circle.classList.add('donut-segment');
    circle.style.stroke = seg.color;
    circle.style.strokeDasharray  = `0 ${DONUT_CIRC}`;
    circle.style.strokeDashoffset = -offset;
    svg.appendChild(circle);
    donutCircles.push(circle);

    requestAnimationFrame(() => {
      setTimeout(() => { circle.style.strokeDasharray = `${len} ${DONUT_CIRC}`; }, 30 + i * 80);
    });

    offset += pct * DONUT_CIRC;

    circle.addEventListener('mouseenter', () => donutActivate(i, segs));
    circle.addEventListener('mouseleave', () => donutDeactivate(total));

    // Legend row
    const item = document.createElement('div');
    item.className = 'donut-legend-item' + (seg.isOthers ? ' others-row' : '');
    item.innerHTML = `
      <div class="donut-legend-dot" style="background:${seg.color}"></div>
      <div class="donut-legend-name">${seg.name}</div>
      <div class="donut-legend-val">${donutFmtVal(seg.value)}</div>
    `;

    legEl.appendChild(item);
    donutLegItems.push(item);

    item.addEventListener('mouseenter', () => donutActivate(i, segs));
    item.addEventListener('mouseleave', () => donutDeactivate(total));
  });
}