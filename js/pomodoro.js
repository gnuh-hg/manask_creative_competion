document.addEventListener('DOMContentLoaded', async function () {
    if (!Config.TEST){
        const token = localStorage.getItem('access_token');
        if (!token) window.location.href = '../account/login.html';
    }

    // --- 1. DOM ELEMENTS ---
    const overlay          = document.getElementById('taskOverlay');
    const taskModal        = document.getElementById('taskModal');
    const taskModalList    = document.getElementById('taskModalList');
    const taskSearchInput  = document.getElementById('taskSearchInput');
    const taskTriggerLabel = document.getElementById('taskTriggerLabel');
    const timerDisplay     = document.getElementById('timerDisplay');
    const timerProgress    = document.getElementById('timerProgress');
    const modeLabel        = document.getElementById('modeLabel');
    const sessionDots      = document.getElementById('sessionDots');
    const startBtn         = document.getElementById('startBtn');
    const startIcon        = document.getElementById('startIcon');
    const startLabel       = document.getElementById('startLabel');

    // --- 2. TASK DATA ---
    let tasks        = [];
    let selectedTask = null;

    // --- 3. TASK MODAL MANAGEMENT ---

    function getSearchKeyword() {
        return taskSearchInput ? taskSearchInput.value.trim().toLowerCase() : '';
    }

    function onTaskSearch() {
        renderTaskList(getSearchKeyword());
    }

    function renderTaskList(keyword = '') {
        taskModalList.innerHTML = '';

        if (!keyword) {
            const noneItem = document.createElement('div');
            noneItem.className = 'task-item task-item-none' + (selectedTask === null ? ' selected' : '');
            noneItem.innerHTML = `<span class="task-item-dot"></span> — No task selected —`;
            noneItem.addEventListener('click', () => selectTask(null));
            taskModalList.appendChild(noneItem);
        }

        const filtered = keyword
            ? tasks.filter(t => t.name.toLowerCase().includes(keyword))
            : tasks;

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'task-item';
            empty.style.color = 'var(--text-tertiary)';
            empty.style.justifyContent = 'center';
            empty.style.pointerEvents = 'none';
            empty.textContent = keyword ? 'No tasks found' : 'No tasks available';
            taskModalList.appendChild(empty);
            return;
        }

        filtered.forEach(t => {
            const item = document.createElement('div');
            item.className = 'task-item' + (selectedTask && selectedTask.id === t.id ? ' selected' : '');
            item.innerHTML = `<span class="task-item-dot"></span> <span class="task-item-name">${t.name}</span>`;
            item.addEventListener('click', () => selectTask(t));
            taskModalList.appendChild(item);
        });
    }

    function selectTask(task) {
        selectedTask = task;
        taskTriggerLabel.textContent = task ? task.name : '— Select active task —';
        taskTriggerLabel.style.color = task ? 'var(--text-primary)' : '';
        closeTaskModal();
    }

    function openTaskModal() {
        if (taskSearchInput) taskSearchInput.value = '';
        renderTaskList();
        overlay.classList.add('open');
        requestAnimationFrame(() => {
            taskModal.style.display = 'block';
            requestAnimationFrame(() => {
                taskModal.classList.add('open');
                if (taskSearchInput) taskSearchInput.focus();
            });
        });
    }

    function closeTaskModal() {
        overlay.classList.remove('open');
        taskModal.classList.remove('open');
        setTimeout(() => { taskModal.style.display = 'none'; }, 150);
    }

    // --- 5. TIMER STATE ---
    let interval           = null;
    let running            = false;
    let currentMode        = 'focus'; // 'focus' | 'short' | 'long'
    let totalSeconds       = 25 * 60;
    let remainingSeconds   = totalSeconds;
    let completedPomodoros = 0;

    const CIRCUMFERENCE = 2 * Math.PI * 100; // ~628

    // --- 6. SETTINGS MANAGEMENT ---

    function getSettings() {
        return {
            focusDur:     parseInt(document.getElementById('focusDur').value)  || 25,
            shortDur:     parseInt(document.getElementById('shortDur').value)  || 5,
            longDur:      parseInt(document.getElementById('longDur').value)   || 15,
            longAfter:    parseInt(document.getElementById('longAfter').value) || 4,
            disableBreak: document.getElementById('disableBreak').checked,
            autoFocus:    document.getElementById('autoFocus').checked,
            autoBreak:    document.getElementById('autoBreak').checked,
        };
    }

    function applySettingsToUI(data) {
        // API trả về giây, UI dùng phút
        document.getElementById('focusDur').value  = Math.round(data.focus_duration / 60);
        document.getElementById('shortDur').value  = Math.round(data.short_break    / 60);
        document.getElementById('longDur').value   = Math.round(data.long_break     / 60);
        document.getElementById('longAfter').value = data.long_break_after;
        document.getElementById('disableBreak').checked = data.disable_break;
        document.getElementById('autoFocus').checked    = data.auto_start_focus;
        document.getElementById('autoBreak').checked    = data.auto_start_break;
    }

    function getDuration(mode) {
        const s = getSettings();
        if (mode === 'focus') return s.focusDur * 60;
        if (mode === 'short') return s.shortDur * 60;
        if (mode === 'long')  return s.longDur  * 60;
    }

    // Debounce PATCH settings — tránh gọi API liên tục khi người dùng bấm +/-
    let settingsPatchTimer = null;
    function schedulePatchSettings() {
        clearTimeout(settingsPatchTimer);
        settingsPatchTimer = setTimeout(() => patchSettings(), 800);
    }

    async function patchSettings() {
        if (Config.TEST) return;
        const s = getSettings();
        const body = {
            focus_duration:   s.focusDur  * 60,
            short_break:      s.shortDur  * 60,
            long_break:       s.longDur   * 60,
            long_break_after: s.longAfter,
            disable_break:    s.disableBreak,
            auto_start_focus: s.autoFocus,
            auto_start_break: s.autoBreak,
        };
        try {
            const res = await Config.fetchWithAuth(`${Config.URL_API}/pomodoro/settings`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            if (!res.ok) Config.showWarning('PATCH settings failed');
        } catch (err) {
            if (err.message !== 'Unauthorized') Config.showWarning('PATCH settings error');
        }
    }
    
    function onSettingChange() {
        if (running) return;
        totalSeconds     = getDuration(currentMode);
        remainingSeconds = totalSeconds;
        updateDisplay();
        schedulePatchSettings();
    }

    function changeVal(id, delta) {
        const el     = document.getElementById(id);
        const newVal = Math.max(
            parseInt(el.min || 1),
            Math.min(parseInt(el.max || 99), (parseInt(el.value) || 0) + delta)
        );
        el.value = newVal;
        onSettingChange();
    }

    // --- 7. API: LOAD ON STARTUP ---

    async function loadSettings() {
        if (Config.TEST) return;
        try {
            const res  = await Config.fetchWithAuth(`${Config.URL_API}/pomodoro/settings`);
            if (!res.ok) return;
            const data = await res.json();
            applySettingsToUI(data);
        } catch (err) {
            if (err.message !== 'Unauthorized') Config.showWarning('Load settings error');
        }
    }

    async function loadTasks() {
        if (Config.TEST) {
            tasks = [
                { id: 1, name: 'Design dashboard UI' },
                { id: 2, name: 'Review backend API code' },
                { id: 3, name: 'Write documentation' },
                { id: 4, name: 'Fix bug in login module' },
                { id: 5, name: 'Meeting planning sprint Q2' },
            ];
            return;
        }
        try {
            const res  = await Config.fetchWithAuth(`${Config.URL_API}/pomodoro/tasks`);
            if (!res.ok) return;
            tasks = await res.json();
        } catch (err) {
            if (err.message !== 'Unauthorized') Config.showWarning('Load tasks error');
        }
    }

    // --- 8. API: POST SESSION ---

    async function postSession(mode, durationSeconds) {
        if (Config.TEST) return;

        const modeMap = { focus: 'focus', short: 'short_break', long: 'long_break' };
        const body = {
            mode:         modeMap[mode],
            duration:     durationSeconds,
            task_id:      selectedTask ? selectedTask.id : null,
            completed_at: new Date().toISOString(),
        };
        try {
            const res = await Config.fetchWithAuth(`${Config.URL_API}/pomodoro/sessions`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!res.ok) Config.showWarning('POST session failed');
        } catch (err) {
            if (err.message !== 'Unauthorized') Config.showWarning('POST session error');
        }
    }

    // --- 9. UI RENDERING & DISPLAY LOGIC ---

    function updateDisplay() {
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        timerDisplay.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

        const ratio = remainingSeconds / totalSeconds;
        timerProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
        timerProgress.setAttribute('class', 'timer-progress' + (currentMode !== 'focus' ? ' break' : ''));

        renderSessionDots();
    }

    function renderSessionDots() {
        const { longAfter } = getSettings();
        sessionDots.innerHTML = '';
        for (let i = 0; i < longAfter; i++) {
            const dot = document.createElement('div');
            dot.className = 'session-dot' + (i < completedPomodoros ? ' done' : '');
            sessionDots.appendChild(dot);
        }
    }

    function updateStartBtn() {
        if (running) {
            startIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            startLabel.textContent = 'Pause';
            startBtn.classList.add('pulsing');
        } else {
            startIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
            startLabel.textContent = 'Start';
            startBtn.classList.remove('pulsing');
        }
    }

    // --- 10. TIMER CONTROLS ---

    function setMode(mode, tabEl) {
        currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');

        const modeNames = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
        modeLabel.textContent = modeNames[mode];

        totalSeconds     = getDuration(mode);
        remainingSeconds = totalSeconds;

        if (running) {
            clearInterval(interval);
            running = false;
            updateStartBtn();
        }
        updateDisplay();
    }

    function toggleTimer() {
        if (running) {
            clearInterval(interval);
            running = false;
        } else {
            interval = setInterval(tick, 1000);
            running  = true;
        }
        updateStartBtn();
    }

    function tick() {
        remainingSeconds--;
        updateDisplay();
        if (remainingSeconds <= 0) {
            clearInterval(interval);
            running = false;
            updateStartBtn();
            onTimerEnd();
        }
    }

    async function onTimerEnd(isSkipped = false) {
        const s              = getSettings();
        const finishedMode   = currentMode;
        const finishedDuration = totalSeconds; // thời lượng đã đặt (giây)

        // Ghi nhận phiên vào backend
        if (!isSkipped) await postSession(finishedMode, finishedDuration);

        if (finishedMode === 'focus') {
            completedPomodoros++;
            updateDisplay();

            if (!s.disableBreak) {
                const nextMode = (completedPomodoros % s.longAfter === 0) ? 'long' : 'short';
                const nextTab  = document.querySelectorAll('.mode-tab')[nextMode === 'short' ? 1 : 2];
                setMode(nextMode, nextTab);
                if (s.autoBreak) setTimeout(() => toggleTimer(), 500);
            } else {
                const tab = document.querySelectorAll('.mode-tab')[0];
                setMode('focus', tab);
                if (s.autoFocus) setTimeout(() => toggleTimer(), 500);
            }
        } else {
            // Break ended → return to focus
            if (completedPomodoros % s.longAfter === 0) completedPomodoros = 0;
            const tab = document.querySelectorAll('.mode-tab')[0];
            setMode('focus', tab);
            if (s.autoFocus) setTimeout(() => toggleTimer(), 500);
        }
    }

    function resetTimer() {
        if (running) {
            clearInterval(interval);
            running = false;
            updateStartBtn();
        }
        remainingSeconds = totalSeconds;
        updateDisplay();
    }

    function skipTimer() {
        if (running) {
            clearInterval(interval);
            running = false;
            updateStartBtn();
        }
        remainingSeconds = 0;
        updateDisplay();
        onTimerEnd(true);
    }

    function closePomodoro() {
        document.body.style.transition = 'opacity 0.3s';
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 300);
    }

    // --- 11. UI EVENT BINDINGS ---

    document.getElementById('taskTrigger').addEventListener('click', openTaskModal);
    overlay.addEventListener('click', closeTaskModal);
    taskSearchInput?.addEventListener('input', onTaskSearch);

    startBtn.addEventListener('click', toggleTimer);

    document.querySelectorAll('.num-btn').forEach(btn => {
        const target = btn.getAttribute('data-target');
        const delta  = parseInt(btn.getAttribute('data-delta'));
        if (!target || isNaN(delta)) return;
        btn.addEventListener('click', () => changeVal(target, delta));
    });

    document.querySelectorAll('.num-input').forEach(input => {
        input.addEventListener('change', onSettingChange);
    });

    document.querySelectorAll('.toggle input').forEach(toggle => {
        toggle.addEventListener('change', onSettingChange);
    });

    document.querySelector('[title="Reset"]')?.addEventListener('click', resetTimer);
    document.querySelector('[title="Skip"]')?.addEventListener('click', skipTimer);
    document.querySelector('.close-btn')?.addEventListener('click', closePomodoro);

    // --- 12. GLOBAL EXPOSE ---
    window.setMode         = setMode;
    window.toggleTimer     = toggleTimer;
    window.resetTimer      = resetTimer;
    window.skipTimer       = skipTimer;
    window.changeVal       = changeVal;
    window.openTaskModal   = openTaskModal;
    window.closeTaskModal  = closeTaskModal;
    window.onTaskSearch    = onTaskSearch;
    window.onSettingChange = onSettingChange;
    window.closePomodoro   = closePomodoro;

    // --- 13. INITIALIZATION ---
    await Promise.all([loadSettings(), loadTasks()]);
    totalSeconds     = getDuration(currentMode);
    remainingSeconds = totalSeconds;
    updateDisplay();
});