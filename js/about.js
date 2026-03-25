/* ═══════════════════════════════════════
   about.js — Manask About Us
   ═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── SCROLL REVEAL ──
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => revealObserver.observe(el));

  // ── HEATMAP GENERATOR ──
  const hm = document.getElementById('heatmapMini');
  if (hm) {
    const levels = [
      0, 0, 0, 1, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3,
      1, 2, 3, 4, 2, 1, 0, 0, 3, 2, 1, 4, 2, 1
    ];
    levels.forEach(l => {
      const cell = document.createElement('div');
      cell.className = 'hm-cell' + (l > 0 ? ` l${l}` : '');
      hm.appendChild(cell);
    });
  }

  // ── PROGRESS BAR ANIMATE ON SCROLL ──
  const progressBars = document.querySelectorAll('.task-progress-fill');
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        // Re-trigger CSS transition by briefly setting width to 0 then back
        const targetWidth = e.target.style.width;
        e.target.style.transition = 'none';
        e.target.style.width = '0%';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            e.target.style.transition = 'width 1.2s ease';
            e.target.style.width = targetWidth;
          });
        });
        progressObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });

  progressBars.forEach(b => progressObserver.observe(b));

  // ── CLOSE BUTTON → index.html ──
  const btnClose = document.getElementById('btnCloseAbout');
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      // Fade out page then redirect
      document.body.style.transition = 'opacity .3s ease';
      document.body.style.opacity = '0';
      setTimeout(() => {
        window.location.href = btnClose.dataset.href || '../index.html';
      }, 300);
    });
  }

});