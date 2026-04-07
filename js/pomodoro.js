import * as utils from '../utils.js';
import { t, initI18n } from '../i18n.js';
import * as notif from './notification.js';

document.addEventListener('DOMContentLoaded', async function () {
    await initI18n();
    if (!utils.TEST){
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
            noneItem.innerHTML = `<span class="task-item-dot"></span> ${t('pomodoro.no_task_selected')}`;
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
            empty.textContent = keyword ? t('pomodoro.no_tasks_found') : t('pomodoro.no_tasks_available');
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
        taskTriggerLabel.textContent = task ? task.name : t('pomodoro.select_active_task');
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
        if (utils.TEST) return;
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

        localStorage.setItem('pomodoro_focus_duration', body.focus_duration);
        localStorage.setItem('pomodoro_short_break', body.short_break);
        localStorage.setItem('pomodoro_long_break', body.long_break);
        localStorage.setItem('pomodoro_long_break_after', body.long_break_after);
        localStorage.setItem('pomodoro_disable_break', body.disable_break);
        localStorage.setItem('pomodoro_auto_focus', body.auto_start_focus);
        localStorage.setItem('pomodoro_auto_break', body.auto_start_break);

        try {
            const res = await utils.fetchWithAuth(
                `${utils.URL_API}/pomodoro/settings`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                },
                { enableQueue: true},
                utils.generateId(), 1
            );
            if (!res.ok) utils.showWarning('PATCH settings failed');
        } catch (err) {
            if (err.message !== 'Unauthorized') utils.showWarning('PATCH settings error');
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
        const focusDur = localStorage.getItem('pomodoro_focus_duration') || 25 * 60;
        const shortDur = localStorage.getItem('pomodoro_short_break') || 5 * 60;
        const longDur = localStorage.getItem('pomodoro_long_break') || 15 * 60;
        const longAfter = localStorage.getItem('pomodoro_long_break_after') || 4;
        const disableBreak = localStorage.getItem('pomodoro_disable_break') === 'true';
        const autoFocus = localStorage.getItem('pomodoro_auto_focus') === 'true';
        const autoBreak = localStorage.getItem('pomodoro_auto_break') === 'true';

        const localData = {
            focus_duration:   parseInt(focusDur),
            short_break:      parseInt(shortDur),
            long_break:       parseInt(longDur),
            long_break_after: parseInt(longAfter),
            disable_break:    disableBreak,
            auto_start_focus: autoFocus,
            auto_start_break: autoBreak,
        }

        applySettingsToUI(localData);

        if (utils.TEST) return;

        try {
            const res  = await utils.fetchWithAuth(
                `${utils.URL_API}/pomodoro/settings`,
                { method: 'GET' },
                {}, utils.generateId(), 1
            );

            if (!res.ok) return;
            const data = await res.json();
            applySettingsToUI(data);

            localStorage.setItem('pomodoro_focus_duration', data.focus_duration);
            localStorage.setItem('pomodoro_short_break', data.short_break);
            localStorage.setItem('pomodoro_long_break', data.long_break);
            localStorage.setItem('pomodoro_long_break_after', data.long_break_after);
            localStorage.setItem('pomodoro_disable_break', data.disable_break);
            localStorage.setItem('pomodoro_auto_focus', data.auto_start_focus);
            localStorage.setItem('pomodoro_auto_break', data.auto_start_break);
        } catch (err) {
            if (err.message !== 'Unauthorized') utils.showWarning('Load settings error');
        }
    }

    async function loadTasks() {
        if (utils.TEST) {
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
            const res  = await utils.fetchWithAuth(`${utils.URL_API}/pomodoro/tasks`);
            if (!res.ok) return;
            tasks = await res.json();
        } catch (err) {
            if (err.message !== 'Unauthorized') utils.showWarning('Load tasks error');
        }
    }

    // --- 8. API: POST SESSION ---

    async function postSession(mode, durationSeconds) {
        if (utils.TEST) return;

        const modeMap = { focus: 'focus', short: 'short_break', long: 'long_break' };
        const body = {
            mode:         modeMap[mode],
            duration:     durationSeconds,
            task_id:      selectedTask ? selectedTask.id : null,
            completed_at: new Date().toISOString(),
        };
        try {
            const res = await utils.fetchWithAuth(`${utils.URL_API}/pomodoro/sessions`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!res.ok) utils.showWarning('POST session failed');
        } catch (err) {
            if (err.message !== 'Unauthorized') utils.showWarning('POST session error');
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
            startLabel.textContent = t('pomodoro.btn_pause');
            startBtn.classList.add('pulsing');
        } else {
            startIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
            startLabel.textContent = t('pomodoro.btn_start');
            startBtn.classList.remove('pulsing');
        }
    }

    // --- 10. TIMER CONTROLS ---

    function setMode(mode, tabEl) {
        currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');

        modeLabel.textContent = t(`pomodoro.mode_${mode}`);

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

            // Notification: phiên focus hoàn thành
        notif.add(
            'pomodoro_done',
            t('notif.pomodoro_done_title'),
            selectedTask ? selectedTask.name : t('notif.pomodoro_done_body')
        );

        if (!s.disableBreak) {
                const nextMode = (completedPomodoros % s.longAfter === 0) ? 'long' : 'short';
                const nextTab  = document.querySelectorAll('.mode-tab')[nextMode === 'short' ? 1 : 2];
                // Notification: bắt đầu nghỉ
                notif.add(
                    'break_start',
                    t('notif.break_start_title'),
                    nextMode === 'long' ? t('notif.break_start_long') : t('notif.break_start_short')
                );
                setMode(nextMode, nextTab);
                if (s.autoBreak) setTimeout(() => toggleTimer(), 500);
            } else {
                const tab = document.querySelectorAll('.mode-tab')[0];
                setMode('focus', tab);
                if (s.autoFocus) setTimeout(() => toggleTimer(), 500);
            }
        } else {
            // Break ended → return to focus
            notif.add('break_end', t('notif.break_end_title'), '');
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

    // =========================================================
    // --- MUSIC FEATURE ---
    // =========================================================

    // Danh sách track mặc định (không thể xóa, không lưu backend)
    // isDefault: true → backend sẽ không cho phép xóa, UI ẩn nút xóa
    const DEFAULT_TRACKS = [
        {
            id: 'default_lofi',
            name: 'Lo-Fi Chill',
            src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
            isDefault: true,
            selected: false,
        },
        {
            id: 'default_rain',
            name: 'Rain & Thunder',
            // Nguồn: orangefreesounds.com — CC Attribution 4.0, free for commercial use
            src: 'https://www.orangefreesounds.com/wp-content/uploads/2016/10/Soothing-rain.mp3',
            isDefault: true,
            selected: false,
        },
        {
            id: 'default_forest',
            name: 'Forest Ambience',
            // Nguồn: orangefreesounds.com — CC Attribution 4.0, free for commercial use
            src: 'https://www.orangefreesounds.com/wp-content/uploads/2016/04/Rainforest-sounds.mp3',
            isDefault: true,
            selected: false,
        },
    ];

    // Trạng thái nhạc — musicList là source of truth, đồng bộ từ backend
    let musicList   = [];
    let audioPlayer = new Audio();
    audioPlayer.loop = true;

    // DOM elements — music
    const musicTrigger      = document.getElementById('musicTrigger');
    const musicTriggerLabel = document.getElementById('musicTriggerLabel');
    const musicEq           = document.getElementById('musicEq');
    const musicVolumeWrap   = document.getElementById('musicVolumeWrap');
    const musicVolumeSlider = document.getElementById('musicVolumeSlider');
    const musicVolumeLabel  = document.getElementById('musicVolumeLabel');
    const musicOverlay      = document.getElementById('musicOverlay');
    const musicModal        = document.getElementById('musicModal');
    const musicModalList    = document.getElementById('musicModalList');
    const musicAddBtn          = document.getElementById('musicAddBtn');
    const musicAddForm         = document.getElementById('musicAddForm');
    const musicAddName         = document.getElementById('musicAddName');
    const musicFileInput       = document.getElementById('musicFileInput');       // file picker ẩn
    const musicDropZone        = document.getElementById('musicDropZone');        // drop zone
    const musicDropZoneFilename = document.getElementById('musicDropZoneFilename'); // tên file hiển thị
    const musicAddCancel       = document.getElementById('musicAddCancel');
    const musicAddConfirm      = document.getElementById('musicAddConfirm');

    // File được chọn hiện tại (qua picker hoặc drag-and-drop)
    let _selectedAudioFile = null;

    // ── GET /pomodoro/music ──────────────────────────────────────
    // Lấy toàn bộ list nhạc từ backend để render.
    // Không dùng offline queue cho GET.
    // Nếu backend lỗi → fallback hiển thị DEFAULT_TRACKS để UI không trống.
    async function loadMusic() {
        // Khởi volume từ localStorage (volume không cần sync backend)
        const savedVol = parseInt(localStorage.getItem('pomodoro_music_volume') ?? '60');
        audioPlayer.volume = savedVol / 100;
        musicVolumeSlider.value = savedVol;
        musicVolumeLabel.textContent = savedVol + '%';

        if (utils.TEST) {
            // TEST mode: dùng default tracks làm dữ liệu mẫu
            musicList = DEFAULT_TRACKS.map(t => ({ ...t }));
            updateMusicTrigger();
            return;
        }

        try {
            const res = await utils.fetchWithAuth(
                `${utils.URL_API}/pomodoro/music`,
                { method: 'GET' },
                {}, // không queue GET
                utils.generateId(),
                1
            );

            if (res.ok) {
                const data = await res.json();
                // Backend trả về mảng track; đảm bảo đúng kiểu dữ liệu
                musicList = Array.isArray(data) ? data : [];
            } else {
                // Backend lỗi → fallback default tracks (chỉ hiển thị, không push lên server)
                console.warn('[Music] GET /pomodoro/music failed, using defaults');
                musicList = DEFAULT_TRACKS.map(t => ({ ...t }));
            }
        } catch (err) {
            if (err.message === 'Unauthorized') return;
            // Mất mạng → fallback tương tự, không cảnh báo (sẽ tự sync khi có mạng)
            console.warn('[Music] GET /pomodoro/music error:', err.message);
            musicList = DEFAULT_TRACKS.map(t => ({ ...t }));
        }

        updateMusicTrigger();

        // Nếu có track đang được chọn → phát lại
        const chosen = musicList.find(tr => tr.selected);
        if (chosen) playTrack(chosen);
    }

    // ── HELPER: đặt file được chọn, cập nhật drop zone UI ─────────
    function _setSelectedFile(file) {
        if (!file || !file.type.startsWith('audio/')) {
            utils.showWarning(t('pomodoro.music.invalidFile'));
            return;
        }
        _selectedAudioFile = file;

        // Hiển thị tên file trong drop zone
        const baseName = file.name.replace(/\.[^.]+$/, ''); // bỏ extension
        musicDropZoneFilename.textContent = file.name;
        musicDropZoneFilename.style.display = 'block';
        musicDropZone.classList.add('has-file');
        musicDropZone.querySelector('span[data-i18n]').style.display = 'none';

        // Nếu ô tên chưa có gì → tự điền tên file làm fallback
        if (!musicAddName.value.trim()) {
            musicAddName.value = baseName;
        }
    }

    // ── POST /pomodoro/music — UPLOAD FILE + THÊM TRACK MỚI ───────
    // Gửi file thực lên backend qua multipart/form-data (không phải JSON).
    // Backend lưu file, trả về URL thật → src dùng được vĩnh viễn qua các session.
    //
    // Không dùng offline queue vì File object không serialize được vào IndexedDB.
    // Nếu mất mạng → báo lỗi trực tiếp, không queue.
    //
    // Optimistic UI:
    //   - Tạo blob URL tạm để phát nhạc ngay lập tức trong session hiện tại
    //   - Sau khi backend trả về URL thật → thay blob URL bằng URL thật
    //   - Blob URL được revoke sau khi thay thế để tránh memory leak
    async function confirmAddTrack() {
        if (!_selectedAudioFile) {
            // Chưa chọn file → pulse drop zone để nhắc người dùng
            musicDropZone.classList.add('drag-over');
            setTimeout(() => musicDropZone.classList.remove('drag-over'), 600);
            return;
        }

        // Tên: dùng input của user, hoặc fallback tên file (không có extension)
        const name = musicAddName.value.trim()
            || _selectedAudioFile.name.replace(/\.[^.]+$/, '');

        musicAddConfirm.disabled = true;

        const tmpId = utils.generateId(); // đã có tiền tố "tmp-" sẵn

        // Tạo blob URL tạm để phát nhạc optimistic ngay trong session này
        const blobSrc = URL.createObjectURL(_selectedAudioFile);

        const optimisticTrack = {
            id:        tmpId,
            name,
            src:       blobSrc, // tạm thời — sẽ được thay bằng URL thật từ backend
            isDefault: false,
            selected:  false,
        };

        if (utils.TEST) {
            // TEST mode: không gọi API, giữ blob URL
            musicList.push(optimisticTrack);
            _resetAddForm();
            renderMusicList();
            return;
        }

        // Optimistic UI: hiển thị và cho phép phát nhạc ngay
        musicList.push(optimisticTrack);
        renderMusicList();
        _resetAddForm();

        // Xây dựng FormData để gửi file thực lên backend
        const formData = new FormData();
        formData.append('file', _selectedAudioFile);
        formData.append('name', name);

        try {
            // Dùng fetchWithAuth nhưng KHÔNG set Content-Type — browser tự set
            // boundary cho multipart/form-data. Nếu set thủ công sẽ thiếu boundary → lỗi.
            const token = localStorage.getItem('access_token');
            const res = await utils.fetchWithRetry(
                `${utils.URL_API}/pomodoro/music`,
                {
                    method:  'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    // Không set Content-Type — để browser tự xử lý với boundary
                    body: formData,
                }
            );

            if (res && res.ok) {
                const data = await res.json();
                const realId  = data.id;
                const realSrc = data.src;

                // Thay thế tmp-id và blob URL bằng id thật + URL thật từ backend
                musicList = musicList.map(tr => {
                    if (tr.id !== tmpId) return tr;
                    return {
                        ...tr,
                        id:  realId  ?? tmpId,
                        src: realSrc ?? blobSrc,
                        name: data.name ?? name,
                    };
                });

                // Nếu track đang phát với blob URL → cập nhật sang URL thật
                // (không cần restart Audio vì đã phát rồi — chỉ cập nhật src trong list)
                URL.revokeObjectURL(blobSrc); // giải phóng memory

                renderMusicList();
                updateMusicTrigger();
            } else {
                // Upload thất bại → xóa optimistic track, thông báo lỗi
                URL.revokeObjectURL(blobSrc);
                musicList = musicList.filter(tr => tr.id !== tmpId);
                renderMusicList();
                updateMusicTrigger();
                utils.showWarning(t('pomodoro.music.uploadError'));
            }
        } catch (err) {
            // Mất mạng hoặc lỗi khác → xóa optimistic track
            URL.revokeObjectURL(blobSrc);
            musicList = musicList.filter(tr => tr.id !== tmpId);
            renderMusicList();
            updateMusicTrigger();
            if (err.message !== 'Unauthorized') {
                utils.showWarning(t('pomodoro.music.uploadError'));
            }
        }
    }

    // ── PATCH /pomodoro/music — THAY ĐỔI SELECTION ──────────────
    // Chọn / bỏ chọn track; id = null nghĩa là "Không phát nhạc".
    // Dùng offline queue vì thay đổi selection cần persist.
    async function selectTrack(id) {
        // Cập nhật state local trước (optimistic)
        musicList = musicList.map(tr => ({ ...tr, selected: tr.id === id }));

        renderMusicList();
        updateMusicTrigger();

        // Phát / dừng nhạc
        const chosen = musicList.find(tr => tr.selected);
        if (chosen) {
            playTrack(chosen);
        } else {
            stopMusic();
        }

        closeMusicModal();

        if (utils.TEST) return;

        // Gọi PATCH để lưu selection lên backend
        // Body: { selected_id } — backend tự xử lý bỏ chọn các track khác
        try {
            await utils.fetchWithAuth(
                `${utils.URL_API}/pomodoro/music`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ selected_id: id }),
                },
                {
                    enableQueue:    true,
                    optimisticData: { selected_id: id },
                },
                utils.generateId(),
                1
            );
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                console.warn('[Music] PATCH selection error:', err.message);
            }
        }
    }

    // ── DELETE /pomodoro/music ───────────────────────────────────
    // - id có tiền tố "tmp-" → track chưa sync lên server:
    //     xóa khỏi offline queue (hủy PATCH đang chờ) + xóa khỏi musicList
    // - id real (không có "tmp-") → gọi DELETE lên backend với offline queue
    // - isDefault → chặn hoàn toàn, không làm gì
    async function deleteTrack(id) {
        const track = musicList.find(tr => tr.id === id);
        if (!track || track.isDefault) return; // an toàn kép: UI đã ẩn nút, nhưng guard lại

        // Nếu track đang phát → dừng trước
        if (track.selected) stopMusic();

        // Xóa khỏi local state ngay (optimistic)
        musicList = musicList.filter(tr => tr.id !== id);
        renderMusicList();
        updateMusicTrigger();

        if (utils.TEST) return;

        const isTmp = String(id).startsWith('tmp-');

        if (isTmp) {
            // Track chưa bao giờ lên server → chỉ cần hủy PATCH đang nằm trong queue
            // idb.js dùng key = tmpId khi enqueue → deleteData(QUEUE_STORE, tmpId) là đủ
            try {
                await import('../idb.js').then(idb =>
                    idb.deleteData('offlinequeue', id)
                );
                console.info(`[Music] Đã hủy queued PATCH cho tmp track: ${id}`);
            } catch (err) {
                // Queue có thể đã được flush rồi — bỏ qua
                console.warn('[Music] Không tìm thấy tmp track trong queue (có thể đã flush):', err.message);
            }
        } else {
            // id thật → gọi DELETE lên backend, queue nếu mất mạng
            try {
                await utils.fetchWithAuth(
                    `${utils.URL_API}/pomodoro/music`,
                    {
                        method: 'DELETE',
                        body: JSON.stringify({ id }),
                    },
                    { enableQueue: true },
                    utils.generateId(),
                    1
                );
            } catch (err) {
                if (err.message !== 'Unauthorized') {
                    console.warn('[Music] DELETE /pomodoro/music error:', err.message);
                }
            }
        }
    }

    // ── PLAYBACK ─────────────────────────────────────────────────
    function playTrack(track) {
        if (audioPlayer.src === track.src && !audioPlayer.paused) return;
        audioPlayer.src = track.src;
        audioPlayer.play().catch(() => {
            utils.showWarning(t('pomodoro.music.playError'));
        });
        musicEq.style.display = 'flex';
        musicTrigger.classList.add('playing');
        musicVolumeWrap.style.display = 'flex';
    }

    function stopMusic() {
        audioPlayer.pause();
        audioPlayer.src = '';
        musicEq.style.display = 'none';
        musicTrigger.classList.remove('playing');
        if (!musicList.some(tr => tr.selected)) {
            musicVolumeWrap.style.display = 'none';
        }
    }

    // ── RENDER DANH SÁCH TRONG MODAL ─────────────────────────────
    function renderMusicList() {
        musicModalList.innerHTML = '';

        // Option "Không có nhạc" ở đầu
        const noneSelected = !musicList.some(tr => tr.selected);
        const noneItem = document.createElement('div');
        noneItem.className = 'music-item music-item-none' + (noneSelected ? ' selected' : '');
        noneItem.innerHTML = `
            <span class="music-item-dot"></span>
            <span class="music-item-name">${t('pomodoro.music.noneOption')}</span>
        `;
        noneItem.addEventListener('click', () => selectTrack(null));
        musicModalList.appendChild(noneItem);

        // Render từng track
        musicList.forEach(track => {
            const item = document.createElement('div');
            item.className = 'music-item' + (track.selected ? ' selected' : '');
            item.dataset.id = track.id;

            // Badge "default" hoặc nút xóa; default track không bao giờ có nút xóa
            const rightEl = track.isDefault
                ? `<span class="music-item-badge">${t('pomodoro.music.defaultBadge')}</span>`
                : `<button class="music-item-delete" title="${t('pomodoro.music.deleteTitle')}" data-id="${track.id}">
                       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                           <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                       </svg>
                   </button>`;

            item.innerHTML = `
                <span class="music-item-dot"></span>
                <span class="music-item-name">${track.name}</span>
                ${rightEl}
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.music-item-delete')) return;
                selectTrack(track.id);
            });

            if (!track.isDefault) {
                item.querySelector('.music-item-delete')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteTrack(track.id);
                });
            }

            musicModalList.appendChild(item);
        });
    }

    // ── CẬP NHẬT TRIGGER BUTTON ──────────────────────────────────
    function updateMusicTrigger() {
        const selected = musicList.find(tr => tr.selected);
        if (selected) {
            musicTriggerLabel.textContent = selected.name;
            musicVolumeWrap.style.display = 'flex';
        } else {
            musicTriggerLabel.textContent = t('pomodoro.music.noneSelected');
            musicVolumeWrap.style.display = 'none';
            musicEq.style.display = 'none';
            musicTrigger.classList.remove('playing');
        }
    }

    // ── MODAL OPEN / CLOSE ────────────────────────────────────────
    function openMusicModal() {
        renderMusicList();
        musicOverlay.classList.add('open');
        requestAnimationFrame(() => musicModal.classList.add('open'));
    }

    function closeMusicModal() {
        musicOverlay.classList.remove('open');
        musicModal.classList.remove('open');
        musicAddForm.style.display = 'none';
        musicAddBtn.style.display  = 'flex';
    }

    // ── VOLUME ───────────────────────────────────────────────────
    // Volume lưu localStorage — không cần sync backend
    function onVolumeChange() {
        const vol = parseInt(musicVolumeSlider.value);
        audioPlayer.volume = vol / 100;
        musicVolumeLabel.textContent = vol + '%';
        localStorage.setItem('pomodoro_music_volume', vol);
    }

    // ── STOP NHẠC KHI RỜI TRANG ─────────────────────────────────
    window.addEventListener('beforeunload', () => {
        audioPlayer.pause();
        audioPlayer.src = '';
    });

    // ── SYNC LẠI SAU KHI CÓ MẠNG TRỞ LẠI ───────────────────────
    // Khi offline, track user thêm vẫn dùng tmp-id trong musicList.
    // Sau khi flushQueue() chạy xong (utils.js tự xử lý), backend đã có
    // id thật — cần loadMusic() lại để đồng bộ id thật vào musicList.
    // Dùng một lần GET sau khi queue trống thay vì polling liên tục.
    window.addEventListener('online', () => {
        // Chờ flushQueue trong utils.js xử lý xong rồi mới reload
        // Dùng isQueueEmpty() kiểm tra thay vì polling mù
        const syncAfterFlush = async () => {
            // Tối đa 10 lần kiểm tra, mỗi lần cách 400ms (tổng ~4s)
            // Nếu vẫn còn queue sau đó → bỏ qua, tránh treo vô hạn
            for (let i = 0; i < 10; i++) {
                if (await utils.isQueueEmpty()) break;
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            // Chỉ reload nếu còn tmp-id trong list (tức có gì cần đồng bộ)
            const hasTmp = musicList.some(tr => String(tr.id).startsWith('tmp-'));
            if (hasTmp) await loadMusic();
        };
        syncAfterFlush();
    });

    // ── HELPER RESET FORM ────────────────────────────────────────
    function _resetAddForm() {
        musicAddName.value = '';
        musicFileInput.value = '';         // reset file picker
        _selectedAudioFile = null;         // xóa file đang giữ

        // Reset drop zone UI về trạng thái ban đầu
        musicDropZone.classList.remove('has-file', 'drag-over');
        musicDropZoneFilename.style.display = 'none';
        musicDropZoneFilename.textContent   = '';
        const hint = musicDropZone.querySelector('span[data-i18n]');
        if (hint) hint.style.display = '';

        musicAddForm.style.display = 'none';
        musicAddBtn.style.display  = 'flex';
        musicAddConfirm.disabled   = false;
    }

    // =========================================================
    // --- 11. UI EVENT BINDINGS ---
    // =========================================================

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

    // Music events
    musicTrigger.addEventListener('click', openMusicModal);
    musicOverlay.addEventListener('click', closeMusicModal);
    musicVolumeSlider.addEventListener('input', onVolumeChange);

    musicAddBtn.addEventListener('click', () => {
        musicAddForm.style.display = 'flex';
        musicAddBtn.style.display  = 'none';
        musicAddName.focus();
    });

    musicAddCancel.addEventListener('click', _resetAddForm);
    musicAddConfirm.addEventListener('click', confirmAddTrack);

    // Enter trong ô tên → xác nhận thêm
    musicAddName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddTrack();
    });

    // ── File picker: click vào drop zone → mở OS file dialog ────
    musicDropZone.addEventListener('click', () => musicFileInput.click());

    musicFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) _setSelectedFile(file);
    });

    // ── Drag-and-drop ────────────────────────────────────────────
    musicDropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // cho phép drop
        musicDropZone.classList.add('drag-over');
    });

    musicDropZone.addEventListener('dragleave', (e) => {
        // Chỉ remove khi rời hẳn khỏi zone (không phải rời sang child element)
        if (!musicDropZone.contains(e.relatedTarget)) {
            musicDropZone.classList.remove('drag-over');
        }
    });

    musicDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        musicDropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files?.[0];
        if (file) _setSelectedFile(file);
    });

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
    window.openMusicModal  = openMusicModal;
    window.closeMusicModal = closeMusicModal;

    // --- 13. INITIALIZATION ---
    await Promise.all([loadSettings(), loadTasks()]);
    totalSeconds     = getDuration(currentMode);
    remainingSeconds = totalSeconds;
    updateDisplay();

    // Khởi tạo music (sau initI18n để t() hoạt động đúng)
    loadMusic();
});