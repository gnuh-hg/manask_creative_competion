/* ── line-chart.js ── */

const LC_H = 220, LC_PT = 16, LC_PB = 4;
const LC_PH = LC_H - LC_PT - LC_PB, LC_STEPS = 5;

let LC_DATASETS;

async function initLineChart() {
  if (Config.TEST) LC_DATASETS = {
  week: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tasks: [8, 12, 5, 18, 10, 4, 6],
    focus: [6.5, 9.0, 11.5, 7.0, 8.5, 2.0, 3.5], 
  },
  month: {
    labels: ['D.1', 'D.5', 'D.10', 'D.15', 'D.20', 'D.25', 'D.30'],
    tasks: [22, 14, 35, 18, 28, 12, 40],
    focus: [15.5, 19.0, 12.0, 24.5, 18.0, 22.0, 14.5],
  },
  year: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    tasks: [45, 82, 60, 110, 75, 130, 85, 95, 145, 100, 120, 160],
    focus: [60, 70, 95, 80, 115, 90, 125, 110, 105, 140, 130, 155],
  },
};
  else {
    try {
      const res = await Config.fetchWithAuth(
        `${Config.URL_API}/statistic/line_chart`
      );
      if (!res.ok) throw new Error(res.status);
      LC_DATASETS = await res.json();
      console.log('line chart', LC_DATASETS);
    } catch (err) {
      console.error(err);
    }
  }
  if (LC_DATASETS) {
    renderLineChart();
    window.addEventListener('resize', () => renderLineChart());
  }
}

let lcPeriod = 'month';

const lcNs = 'http://www.w3.org/2000/svg';
function lcEl(tag, attrs) {
  const e = document.createElementNS(lcNs, tag);
  Object.entries(attrs||{}).forEach(([k,v]) => e.setAttribute(k, v));
  return e;
}

function lcGetWidth() {
  return document.getElementById('lcSvg').getBoundingClientRect().width || 600;
}

function lcNiceMax(val, steps) {
  if (val <= 0) return steps; // fallback

  const raw = val * 1.1;

  // Tính "magnitude" của raw
  const mag = Math.pow(10, Math.floor(Math.log10(raw / steps)));

  // Các mức step đẹp: 1, 2, 2.5, 5, 10 × magnitude
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = mag;
  for (const s of niceSteps) {
    step = s * mag;
    if (step * steps >= raw) break;
  }

  return step * steps;
}

function lcXp(i, n, W)  { return (i / (n - 1)) * W; }
function lcYp(v, yMax)  { return LC_PT + LC_PH - (v / yMax) * LC_PH; }

function lcCurvePath(pts) {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

function lcAnimateLine(pathEl) {
  pathEl.style.transition = 'none';
  pathEl.style.strokeDasharray  = 'none';
  pathEl.style.strokeDashoffset = '0';
  requestAnimationFrame(() => {
    const len = pathEl.getTotalLength();
    pathEl.style.strokeDasharray  = len;
    pathEl.style.strokeDashoffset = len;
    pathEl.getBoundingClientRect();
    pathEl.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)';
    pathEl.style.strokeDashoffset = '0';
  });
}

function switchLcPeriod(p, btn) {
  lcPeriod = p;
  document.querySelectorAll('.lc-period-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderLineChart();
}

function renderLineChart() {
  const W    = lcGetWidth();
  const d    = LC_DATASETS[lcPeriod];
  const n    = d.labels.length;
  const maxT = Math.max(...d.tasks);
  const maxF = Math.max(...d.focus);
  const ymT  = lcNiceMax(maxT, LC_STEPS);
  const ymF  = lcNiceMax(maxF, LC_STEPS);

  // Update viewBox to match real width
  const svg = document.getElementById('lcSvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${LC_H}`);

  // Stats
  document.getElementById('lcTotalTasks').textContent = d.tasks.reduce((a,b)=>a+b,0);
  document.getElementById('lcTotalFocus').textContent = d.focus.reduce((a,b)=>a+b,0).toFixed(2) + 'h';
  ['lcTrendTasks','lcTrendFocus'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '↑ vs previous period';
    el.style.color = '#22c55e';
  });

  // Left Y (tasks)
  const yL = document.getElementById('lcYAxisLeft');
  yL.innerHTML = '';
  for (let i = 0; i <= LC_STEPS; i++) {
    const div = document.createElement('div');
    div.className = 'y-label-left';
    div.textContent = Math.round((ymT / LC_STEPS) * i);
    yL.appendChild(div);
  }

  // Right Y (focus)
  const yR = document.getElementById('lcYAxisRight');
  yR.innerHTML = '';
  for (let i = 0; i <= LC_STEPS; i++) {
    const div = document.createElement('div');
    div.className = 'y-label-right';
    div.textContent = Number.isInteger((ymF / LC_STEPS) * i)
  ? ((ymF / LC_STEPS) * i) + 'h'
  : ((ymF / LC_STEPS) * i).toFixed(2) + 'h';
    yR.appendChild(div);
  }

  // Grid
  const grid = document.getElementById('lcGrid');
  grid.innerHTML = '';
  for (let i = 0; i <= LC_STEPS; i++) {
    const y = lcYp((ymT / LC_STEPS) * i, ymT);
    grid.appendChild(lcEl('line', { x1:0, x2:W, y1:y, y2:y, class:'grid-line' }));
  }

  // Points
  const ptT = d.tasks.map((v,i) => ({ x: lcXp(i,n,W), y: lcYp(v, ymT) - 2 }));
  const ptF = d.focus.map((v,i) => ({ x: lcXp(i,n,W), y: lcYp(v, ymF) }));

  // Areas
  const bot = LC_PT + LC_PH;
  const mkArea = pts => lcCurvePath(pts) + ` L${pts.at(-1).x},${bot} L${pts[0].x},${bot} Z`;
  document.getElementById('lcAreaT').setAttribute('d', mkArea(ptT));
  document.getElementById('lcAreaF').setAttribute('d', mkArea(ptF));

  // Lines
  const lT = document.getElementById('lcLineT');
  const lF = document.getElementById('lcLineF');
  lT.setAttribute('d', lcCurvePath(ptT));
  lF.setAttribute('d', lcCurvePath(ptF));
  lcAnimateLine(lT);
  lcAnimateLine(lF);

  // Dots, rings, hits
  const dotsEl  = document.getElementById('lcDots');
  const ringsEl = document.getElementById('lcRings');
  const hitsEl  = document.getElementById('lcHits');
  dotsEl.innerHTML = ringsEl.innerHTML = hitsEl.innerHTML = '';

  const rT = [], rF = [];
  const stepW = W / (n - 1);

  d.labels.forEach((_, i) => {
    dotsEl.appendChild(lcEl('circle', { cx:ptT[i].x, cy:ptT[i].y, r:3.5, class:'dot-tasks' }));
    dotsEl.appendChild(lcEl('circle', { cx:ptF[i].x, cy:ptF[i].y, r:3.5, class:'dot-focus'  }));

    const rt = lcEl('circle', { cx:ptT[i].x, cy:ptT[i].y, r:7, class:'ring ring-tasks' });
    const rf = lcEl('circle', { cx:ptF[i].x, cy:ptF[i].y, r:7, class:'ring ring-focus'  });
    ringsEl.appendChild(rt); rT.push(rt);
    ringsEl.appendChild(rf); rF.push(rf);

    const hitX = i === 0 ? 0 : ptT[i].x - stepW / 2;
    const hitW = i === 0 || i === n - 1 ? stepW / 2 : stepW;
    const hit = lcEl('rect', { x:hitX, y:0, width:hitW, height:LC_H, fill:'transparent', style:'cursor:crosshair' });
    hit.addEventListener('mouseenter', () => lcShowTip(i, d, ptT, rT, rF));
    hit.addEventListener('mouseleave', lcHideTip);
    hitsEl.appendChild(hit);
  });
}

function lcShowTip(i, d, ptT, rT, rF) {
  const svgEl = document.getElementById('lcSvg');
  const scaleX = svgEl.getBoundingClientRect().width / lcGetWidth();
  const cross  = document.getElementById('lcCross');

  cross.setAttribute('x1', ptT[i].x);
  cross.setAttribute('x2', ptT[i].x);
  cross.style.opacity = 1;

  rT.forEach((r,j) => r.style.opacity = j === i ? 1 : 0);
  rF.forEach((r,j) => r.style.opacity = j === i ? 1 : 0);

  document.getElementById('lcTtLabel').textContent = d.labels[i];
  document.getElementById('lcTtTasks').textContent = d.tasks[i] + ' tasks';
  document.getElementById('lcTtFocus').textContent = Number(d.focus[i]).toFixed(2) + 'h';

  const tip  = document.getElementById('lcTooltip');
  tip.classList.add('show');

  const xPx   = ptT[i].x * scaleX;
  const wrapW = document.getElementById('lcSvgWrap').offsetWidth;
  const tipW  = tip.offsetWidth;
  let left = xPx;
  if (left - tipW/2 < 0) left = tipW/2;
  if (left + tipW/2 > wrapW) left = wrapW - tipW/2;
  tip.style.left = left + 'px';
  tip.style.top  = '0px';
}

function lcHideTip() {
  document.getElementById('lcTooltip').classList.remove('show');
  document.getElementById('lcCross').style.opacity = 0;
  document.querySelectorAll('#lcRings .ring').forEach(r => r.style.opacity = 0);
}