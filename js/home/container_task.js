import * as utils from '../../utils.js';
import * as idb from '../../idb.js';
import { t, initI18n } from '../../i18n.js';
import * as notif from '../notification.js';

document.addEventListener('DOMContentLoaded', async function() {
    await initI18n();
    const container = document.querySelector('.container-task');
    let projectId = null;
    let nameProject = null;
    let activeItem = null;
    let activeData = null;

    // Ẩn h1 và hiện empty state "chưa chọn project" lúc khởi tạo
    if (!utils.TEST) {
        container.querySelector('h1').style.display = 'none';
        showEmptyState('noProject');
    } else {
        showEmptyState('noTask');
    }

    document.addEventListener('projectSelected', function(e) {
        projectId = e.detail.id;
        nameProject = e.detail.name;

        sortConditions = [];
        filterConditions = [];
        filterLogic = 'AND';
        sortIdCtr = 0;
        filterIdCtr = 0;
        updateSFBadge('btn-sort', 'sort-badge', 0);
        updateSFBadge('btn-filter', 'filter-badge', 0);

        container.querySelector('h1').style.display = '';
        container.querySelector('h1 p').innerHTML = nameProject;
        if (!utils.TEST) loadData();
    });

    function restoreSelectedProject() {
        const savedId = localStorage.getItem('selectedProjectId');
        const savedName = localStorage.getItem('selectedProjectName');
        if (!savedId || !savedName) return;

        const event = new CustomEvent('projectSelected', {
            detail: { id: savedId, name: savedName },
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    document.addEventListener('projectUpdated', function(e) {
        const { id, name } = e.detail;

        if (projectId === id) {
            nameProject = name;
            container.querySelector('h1 p').innerHTML = name;
        }
    });

    document.addEventListener('projectDeleted', function(e) {
        const { id } = e.detail;

        if (projectId === id) {
            projectId = null;
            nameProject = null;

            localStorage.removeItem('selectedProjectId');
            localStorage.removeItem('selectedProjectName');

            container.querySelectorAll('.task').forEach(el => el.remove());

            const panel = document.querySelector('.task-detail-panel');
            if (panel) panel.classList.remove('active');

            container.querySelector('h1').style.display = 'none';
            showEmptyState('noProject');
        }
    });

    async function loadData() {
        try {
            const response = await utils.fetchWithAuth(`${utils.URL_API}/project/${projectId}/items`);
            if (!response.ok) {
                utils.showWarning(t('home.msg_load_error'));
                return;
            }
            document.querySelectorAll('.task').forEach(el => el.remove());
            let items = await response.json();
            if (items.length === 0) {
                showEmptyState('noTask');
            } else {
                hideEmptyState();
                items.forEach(item => renderItem(item));
                notif.checkOverdue(items);
            }

            // Load sort & filter settings từ backend
            await loadSortSettings();
            await loadFilterSettings();
        } catch (err) {
            utils.showWarning(t('home.msg_load_error'));
        }
    }

    // ========== LOAD SORT SETTINGS ==========
    // GET /project/${projectId}/sort
    // Response: [{ field, order, ascending }] hoặc []
    async function loadSortSettings() {
        try {
            const res = await utils.fetchWithAuth(`${utils.URL_API}/project/${projectId}/sort`);
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) return;

            // Sắp theo order rồi map sang internal format { id, field, asc }
            const sorted = [...data].sort((a, b) => a.order - b.order);
            sortConditions = sorted.map(item => ({
                id: sortIdCtr++,
                field: item.field,
                asc: item.ascending,
            }));
            updateSFBadge('btn-sort', 'sort-badge', sortConditions.length);

            window.sortState = { conditions: sortConditions.map(s => ({ field: s.field, asc: s.asc })) };
            document.dispatchEvent(new CustomEvent('sortApplied', { detail: window.sortState }));
        } catch (err) {
            // Không block UI nếu lỗi
        }
    }

    // ========== LOAD FILTER SETTINGS ==========
    // GET /project/${projectId}/filter
    // Response: { logic: "and"|"or", filters: [{ field, operator, value }] }
    async function loadFilterSettings() {
        try {
            const res = await utils.fetchWithAuth(`${utils.URL_API}/project/${projectId}/filter`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.filters || data.filters.length === 0) return;

            filterLogic = (data.logic || 'and').toUpperCase(); // nội bộ dùng "AND"/"OR"

            filterConditions = data.filters.map(f => {
                const cond = {
                    id: filterIdCtr++,
                    field: f.field,
                    operator: f.operator,
                    value: '',
                    valueFrom: '',
                    valueTo: '',
                };

                if (f.operator === 'between' && f.value && typeof f.value === 'object') {
                    // between: API trả { from, to }
                    cond.valueFrom = f.value.from || '';
                    cond.valueTo   = f.value.to   || '';
                } else if (f.field === 'priority' && Array.isArray(f.value)) {
                    cond.value = [...f.value];
                } else {
                    // name (string), time_spent (HH:mm:ss), date (ISO) — giữ nguyên
                    cond.value = f.value || '';
                }

                return cond;
            });

            updateSFBadge('btn-filter', 'filter-badge', filterConditions.length);

            window.filterState = {
                logic: filterLogic,
                conditions: filterConditions.map(f => ({
                    field: f.field, operator: f.operator,
                    value: f.value, valueFrom: f.valueFrom, valueTo: f.valueTo,
                }))
            };
            document.dispatchEvent(new CustomEvent('filterApplied', { detail: window.filterState }));
        } catch (err) {
            // Không block UI nếu lỗi
        }
    }

    // ========== BUILD SORT PAYLOAD ==========
    // Internal [{ id, field, asc }] → PUT body [{ field, order, ascending }]
    // order = vị trí trong mảng (1-based), không trùng nhau
    // Truyền [] để tắt sort
    function buildSortPayload(conditions) {
        return conditions.map((s, idx) => ({
            field: s.field,
            order: idx + 1,
            ascending: s.asc,
        }));
    }

    // ========== BUILD FILTER PAYLOAD ==========
    function hoursToHHMMSS(hours) {
        const totalSeconds = Math.round(parseFloat(hours) * 3600);
        const hh = Math.floor(totalSeconds / 3600);
        const mm = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;
        return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }

    function isoToDisplay(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }

    function buildFilterPayload(conditions, logic) {
        const filters = conditions.map(f => {
            const base = { field: f.field, operator: f.operator };

            if (f.operator === 'between') {
                // between → value phải là object { from, to }
                // time_spent: convert từ số giờ sang HH:mm:ss
                const convertTime = (v) =>
                    f.field === 'time_spent' && v !== '' ? hoursToHHMMSS(v) : (v || '');
                base.value = {
                    from: convertTime(f.valueFrom),
                    to:   convertTime(f.valueTo),
                };
            } else if (f.field === 'priority') {
                base.value = Array.isArray(f.value) ? f.value : [];
            } else {
                // name (string), date fields (ISO từ calendar)
                // time_spent: người dùng nhập số giờ → convert sang HH:mm:ss cho backend
                if (f.field === 'time_spent' && f.value !== '' && f.value !== null && f.value !== undefined) {
                    base.value = hoursToHHMMSS(f.value);
                } else {
                    base.value = f.value;
                }
            }

            return base;
        });

        return {
            logic: logic.toLowerCase(), // "and" | "or"
            filters,
        };
    }

    function showEmptyState(type) {
        container.querySelector('.empty-state')?.remove();

        const cfg = type === 'noProject'
            ? {
                title: t('home.empty_no_project_title'),
                desc: t('home.empty_no_project_desc'),
                svg: `
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="tGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <g transform="translate(100, 95)">
                            <rect x="-40" y="-32" width="80" height="64" rx="8"
                                  fill="none" stroke="url(#tGrad1)" stroke-width="3.5"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="-24" y1="-10" x2="24" y2="-10"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>
                            <line x1="-24" y1="2" x2="24" y2="2"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>
                            <line x1="-24" y1="14" x2="10" y2="14"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.2"/>
                        </g>
                        <!-- Arrow pointing left -->
                        <circle cx="68" cy="115" r="16" fill="#6366f1"/>
                        <polyline points="73,108 63,115 73,122"
                                  fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>`
            }
            : {
                title: t('home.empty_no_task_title'),
                desc: t('home.empty_no_task_desc'),
                svg: `
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="tGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <g transform="translate(100, 95)">
                            <rect x="-40" y="-32" width="80" height="64" rx="8"
                                  fill="none" stroke="url(#tGrad2)" stroke-width="3.5"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="-24" y1="-10" x2="24" y2="-10"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>
                            <line x1="-24" y1="2" x2="24" y2="2"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>
                            <line x1="-24" y1="14" x2="10" y2="14"
                                  stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.2"/>
                        </g>
                        <!-- Plus badge -->
                        <circle cx="128" cy="115" r="16" fill="#6366f1"/>
                        <line x1="128" y1="106" x2="128" y2="124"
                              stroke="white" stroke-width="3" stroke-linecap="round"/>
                        <line x1="119" y1="115" x2="137" y2="115"
                              stroke="white" stroke-width="3" stroke-linecap="round"/>
                    </svg>`
            };

        const el = document.createElement('div');
        el.className = 'empty-state';
        el.innerHTML = `${cfg.svg}<h3>${cfg.title}</h3><p>${cfg.desc}</p>`;
        container.querySelector('.task-list').appendChild(el);
    }

    function hideEmptyState() {
        container.querySelector('.empty-state')?.remove();
    }

    function renderItem(item) {
        hideEmptyState();

        let progress = 0;

        const start = new Date(item.start_date);
        const due = new Date(item.due_date);
        const now = new Date();
        
        // Set start to beginning of day, due to end of day
        start.setHours(0, 0, 0, 0);
        due.setHours(23, 59, 59, 999);
        
        if (isNaN(start.getTime()) || isNaN(due.getTime())) progress = 0;
        else if (now < start) progress = 0;
        else if (now > due) progress = 100;
        else {
            const totalMs = due - start;
            const passedMs = now - start;
            progress = Math.round((passedMs / totalMs) * 100);
        }

        const html = `
            <div class="task ${item.priority}" data-id="${item.id}">
              <div class="task-header">
                <div class="task-name">${item.name}</div>
                <button class="btn-done">${t('home.btn_done')}</button>
              </div>
              <div class="task-deadline">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="5" width="16" height="16" rx="2" stroke="#6B7280" stroke-width="2" fill="white"/>
                  <line x1="4" y1="9" x2="20" y2="9" stroke="#6B7280" stroke-width="2"/>
                  <line x1="8" y1="3" x2="8" y2="6" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
                  <line x1="16" y1="3" x2="16" y2="6" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>${t('home.task_due_prefix')} ${showDate(item.due_date)}</span>
              </div>

              <div class="task-progress">
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <span class="progress-percent">${progress}%</span>
              </div>
            </div>
        `;
        const wrapper = container.querySelector('.task-list');
        wrapper.insertAdjacentHTML('beforeend', html);
        attachEvents(wrapper.lastElementChild, item);
    }
    
    function attachEvents(item, data){
        console.log(data);
        item.querySelector('.task-header button').addEventListener('click', async function (e) {
            e.stopPropagation();
            if (item.classList.contains('completed')) return;

            item.classList.add('completed');
            const progressBar = item.querySelector('.progress-bar-fill');
            const progressPercent = item.querySelector('.progress-percent');

            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';

            this.textContent = t('home.btn_done_check');

            notif.add('task_done', t('notif.task_done_title'), data.name);

            setTimeout(async () => {
                if (utils.TEST){
                    item.remove();
                    if (container.querySelectorAll('.task').length === 0) 
                        showEmptyState('noTask');
                    return;
                }
                try {
                    if (data.id.toString().startsWith('tmp-')) {throw new Error('Cannot delete unsynced task');}

                    const response = await utils.fetchWithAuth(
                        `${utils.URL_API}/project/${projectId}/items/${data.id}/done`, 
                        { method: 'DELETE' },
                        {
                            enableQueue: true
                        },
                        utils.generateId(), 1
                    );
                    
                    if (response.ok) {
                        item.remove();
                        // Nếu không còn task nào thì hiện empty state
                        if (container.querySelectorAll('.task').length === 0) 
                            showEmptyState('noTask');
                    } else {
                        utils.showWarning(t('home.msg_task_delete_error'));
                    }
                } catch (err) {
                    item.remove();
                    // Nếu không còn task nào thì hiện empty state
                    if (container.querySelectorAll('.task').length === 0) 
                        showEmptyState('noTask');
                }
            }, 400);
        });

        const panel = document.querySelector('.task-detail-panel');
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!panel) return;
            console.log(data);
            const name = panel.querySelector('.detail-task-name');
            const priority = panel.querySelector('.priority-badge');
            const priority_text = panel.querySelector('.priority-badge span');
            const start_date_text = panel.querySelector('#startDateText');
            const due_date_text = panel.querySelector('#dueDateText');
            const start_date_btn = panel.querySelector('#startDateBtn');
            const due_date_btn = panel.querySelector('#dueDateBtn');
            const time_spent = panel.querySelector('.time-value');
            const notes = panel.querySelector('.notes-textarea');
        
            activeItem = item;
            activeData = data;
            name.value = data.name;
            priority.classList.remove('low', 'medium', 'high');
            priority.classList.add(data.priority);
            priority_text.innerHTML = t(`home.priority_${data.priority}`);
        
            // Start date
            if (data.start_date) {
                start_date_text.textContent = showDate(data.start_date);
                start_date_text.classList.remove('placeholder');
                start_date_btn.classList.add('has-date');
                taskDatePicker.startDate = new Date(data.start_date);
            } else {
                start_date_text.textContent = t('home.date_set');
                start_date_text.classList.add('placeholder');
                start_date_btn.classList.remove('has-date');
                taskDatePicker.startDate = null;
            }
        
            // Due date
            if (data.due_date) {
                due_date_text.textContent = showDate(data.due_date);
                due_date_text.classList.remove('placeholder');
                due_date_btn.classList.add('has-date');
                taskDatePicker.dueDate = new Date(data.due_date);
            } else {
                due_date_text.textContent = t('home.date_set');
                due_date_text.classList.add('placeholder');
                due_date_btn.classList.remove('has-date');
                taskDatePicker.dueDate = null;
            }

            time_spent.innerHTML = `${(data.time_spent / 3600).toFixed(2) } h`;
            notes.value = data.notes ?? '';
        
            panel.classList.add('active');
        });
    }

    let cnt = 0;
    container.querySelector('h1 .h1-actions .btn-done').addEventListener('click', async (e) => {
        if (!projectId && !utils.TEST) {
            utils.showWarning(t('home.msg_select_project'));
            return;
        }

        const tmp_id = utils.generateId();
        cnt++;
        const d = new Date();
        const item = {
            name: `Task`,
            priority: 'low',
            start_date: new Date(d.setHours(0,0,0,0)).toISOString(),
            due_date: new Date(d.setHours(23,59,59,999)).toISOString(),
            note: ""
        };
        const fake_item = {
            ...item,
            id: tmp_id,
            position: cnt
        };

        if (utils.TEST) {
            renderItem(fake_item);
            return;
        }

        try {
            const response = await utils.fetchWithAuth(
                `${utils.URL_API}/project/${projectId}/items`,
                {
                    method: 'POST',
                    body: JSON.stringify(item)
                },
                {
                    enableQueue: true,
                    optimisticData: fake_item
                }, tmp_id, 1
            );

            if (response.ok) {
                const _item = await response.json();
                renderItem(_item);
            } else {
                utils.showWarning(t('home.msg_task_create_error'));
            }
        } catch (err) {
            utils.showWarning(t('home.msg_task_create_error'));
        }
    });

    const closeBtn = document.querySelector('.btn-close-detail');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const panel = document.querySelector('.task-detail-panel');
            if (!panel) return;
            panel.classList.remove('active');
        });
    }

    document.addEventListener('click', function(e) {
        const panel = document.querySelector('.task-detail-panel');
        const overlay_calendar = document.getElementById('taskCalendarOverlay');

        if (!panel || !panel.classList.contains('active')) return;

        // Nếu click vào overlay/calendar thì không đóng panel
        if (overlay_calendar && overlay_calendar.contains(e.target)) return;

        if (panel.contains(e.target)) return;

        panel.classList.remove('active');
    });

    // ========== NAME TASK ==========
    const nameInput = document.querySelector('.detail-task-name');
    let nameDebounceTimer = null;
    
    if (nameInput) {
        nameInput.addEventListener('input', async function () {
            const newName = nameInput.value.trim();
            if (!newName || !activeData) return;
        
            // Cập nhật UI ngay
            if (activeItem) {
                activeItem.querySelector('.task-name').textContent = newName;
            }
            activeData.name = newName;
        
            if (utils.TEST) return;

            if (activeData.id.toString().startsWith('tmp-')) {
                const existing = await idb.getData(utils.QUEUE_STORE, activeData.id);

                await idb.patchData(utils.QUEUE_STORE, activeData.id, {
                    token: localStorage.getItem('access_token'),
                    enqueuedAt: Date.now(),

                    options: {
                        ...existing.options,
                        body: JSON.stringify({
                            ...JSON.parse(existing.options.body),
                            name: newName
                        })
                    }
                });

                return;
            }
        
            clearTimeout(nameDebounceTimer);
            nameDebounceTimer = setTimeout(async () => {
                if (utils.TEST) return;
                try {
                    await utils.fetchWithAuth(
                        `${utils.URL_API}/project/${projectId}/items/${activeData.id}`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({ name: newName })
                        },
                        { enableQueue: true },
                        utils.generateId(), 1
                    );
                } catch {}
            }, 500);
        });
    }

    // ========== PRIORITY BADGE ==========
    const priorityBadge = document.querySelector('.priority-badge');
    const priorities = ['low', 'medium', 'high'];
    let currentPriorityIndex;
    let priorityDebounceTimer = null;

    if (priorityBadge) {
        priorityBadge.addEventListener('click', function(e) {
            e.stopPropagation();

            const item = document.querySelector(`.task[data-id="${activeData.id}"]`);
            if (priorityBadge.classList.contains('low')) currentPriorityIndex = 0;
            if (priorityBadge.classList.contains('medium')) currentPriorityIndex = 1;
            if (priorityBadge.classList.contains('high')) currentPriorityIndex = 2;

            currentPriorityIndex = (currentPriorityIndex + 1) % priorities.length;
            const newPriority = priorities[currentPriorityIndex];
        
            // Cập nhật UI ngay
            priorityBadge.classList.remove('low', 'medium', 'high');
            item.classList.remove('low', 'medium', 'high');
            priorityBadge.classList.add(newPriority);
            item.classList.add(newPriority);
            priorityBadge.querySelector('span').textContent =
            t(`home.priority_${newPriority}`);
            activeData.priority = newPriority;

            if (utils.TEST) return;

            if (activeData.id.toString().startsWith('tmp-')) {
                idb.getData(utils.QUEUE_STORE, activeData.id).then(existing => {
                    idb.patchData(utils.QUEUE_STORE, activeData.id, {
                        token: localStorage.getItem('access_token'),
                        enqueuedAt: Date.now(),
                        options: {
                            ...existing.options,
                            body: JSON.stringify({
                                ...JSON.parse(existing.options.body),
                                priority: newPriority
                            })
                        }
                    });
                });
                return;
            }

            // Chỉ delay phần gửi backend
            clearTimeout(priorityDebounceTimer);
            priorityDebounceTimer = setTimeout(() => {
                utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/items/${activeData.id}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({ priority: newPriority })
                    },
                    { enableQueue: true },
                    utils.generateId(), 1
                ).catch(() => utils.showWarning(t('home.msg_priority_error')))
            }, 500);
        });
    }

    // ========== TASK DATE PICKER (Base Class) ==========
    let dateDebounceTimer = null;

    class TaskDatePicker {
        constructor(ids) {
            this.overlay      = document.getElementById(ids.overlay);
            this.popup        = document.getElementById(ids.popup);
            this.calendarDays = document.getElementById(ids.calendarDays);
            this.monthSelect  = document.getElementById(ids.monthSelect);
            this._ids         = ids;

            this.selectedDate = null;
            this.currentMonth = new Date().getMonth();
            this.currentYear  = new Date().getFullYear();

            this._initBase();
        }

        _initBase() {
            const ids = this._ids;

            this.yearDisplay = document.getElementById(ids.yearDisplay);
            this.yearDisplay.textContent = this.currentYear;

            document.getElementById(ids.yearUp).addEventListener('click', () => {
                this.currentYear++;
                this.updateCalendar();
            });
            document.getElementById(ids.yearDown).addEventListener('click', () => {
                this.currentYear--;
                this.updateCalendar();
            });

            this.monthSelect.value = this.currentMonth;
            this.monthSelect.addEventListener('change', (e) => {
                this.currentMonth = parseInt(e.target.value);
                this.updateCalendar();
            });

            document.getElementById(ids.prevMonth).addEventListener('click', () => {
                this.currentMonth--;
                if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
                this.updateCalendar();
            });
            document.getElementById(ids.nextMonth).addEventListener('click', () => {
                this.currentMonth++;
                if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
                this.updateCalendar();
            });

            document.getElementById(ids.todayBtn).addEventListener('click', () => {
                const today = new Date();
                this.selectDate(today.getDate(), today.getMonth(), today.getFullYear());
            });
            document.getElementById(ids.clearBtn).addEventListener('click', () => {
                this.clearDate();
            });

            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.closeCalendar();
            });
            this.popup.addEventListener('click', (e) => e.stopPropagation());

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                    this.closeCalendar();
                }
            });

            this.updateCalendar();
        }

        openCalendar(currentDate = null) {
            const ref = currentDate ?? this.selectedDate;
            if (ref) {
                this.currentMonth = ref.getMonth();
                this.currentYear  = ref.getFullYear();
            }
            this.updateCalendar();
            this.overlay.classList.add('active');
        }

        closeCalendar() {
            this.overlay.classList.remove('active');
        }

        updateCalendar() {
            this.monthSelect.value          = this.currentMonth;
            this.yearDisplay.textContent    = this.currentYear;
            this.calendarDays.innerHTML     = '';

            const firstDay     = new Date(this.currentYear, this.currentMonth, 1).getDay();
            const lastDate     = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            const prevLastDate = new Date(this.currentYear, this.currentMonth, 0).getDate();
            const today        = new Date();

            for (let i = firstDay; i > 0; i--)
                this.calendarDays.appendChild(this._createDay(prevLastDate - i + 1, this.currentMonth - 1, this.currentYear, true, today));
            for (let i = 1; i <= lastDate; i++)
                this.calendarDays.appendChild(this._createDay(i, this.currentMonth, this.currentYear, false, today));
            const total = this.calendarDays.children.length;
            for (let i = 1; i <= 42 - total; i++)
                this.calendarDays.appendChild(this._createDay(i, this.currentMonth + 1, this.currentYear, true, today));
        }

        _createDay(day, month, year, isOther, today) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = day;
            if (isOther) div.classList.add('other-month');

            let actualMonth = month, actualYear = year;
            if (month < 0)  { actualMonth = 11; actualYear = year - 1; }
            else if (month > 11) { actualMonth = 0; actualYear = year + 1; }

            if (day === today.getDate() && actualMonth === today.getMonth() && actualYear === today.getFullYear())
                div.classList.add('today');

            if (this.selectedDate &&
                day === this.selectedDate.getDate() &&
                actualMonth === this.selectedDate.getMonth() &&
                actualYear  === this.selectedDate.getFullYear())
                div.classList.add('selected');

            div.addEventListener('click', () => this.selectDate(day, actualMonth, actualYear));
            return div;
        }

        selectDate(day, month, year) {
            const date = new Date(year, month, day);
            const formatted = `${String(day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;
            this.selectedDate = date;
            this.onDateSelected(date, formatted);
            this.closeCalendar();
        }

        clearDate() {
            this.selectedDate = null;
            this.onDateCleared();
            this.closeCalendar();
        }

        onDateSelected(date, formatted) {}
        onDateCleared() {}
    }

    // ========== TASK DETAIL DATE PICKER ==========
    class TaskDetailDatePicker extends TaskDatePicker {
        constructor() {
            super({
                overlay:      'taskCalendarOverlay',
                popup:        'taskCalendarPopup',
                calendarDays: 'taskCalendarDays',
                monthSelect:  'taskMonthSelect',
                yearDisplay:  'taskYearDisplay',
                yearUp:       'taskYearUp',
                yearDown:     'taskYearDown',
                prevMonth:    'taskPrevMonthBtn',
                nextMonth:    'taskNextMonthBtn',
                todayBtn:     'taskTodayBtn',
                clearBtn:     'taskClearBtn',
            });

            this.activeTarget = null;
            this.startDate    = null;
            this.dueDate      = null;

            document.getElementById('startDateBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeTarget = 'start';
                this.selectedDate = this.startDate;
                this.openCalendar(this.startDate);
            });
            document.getElementById('dueDateBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeTarget = 'due';
                this.selectedDate = this.dueDate;
                this.openCalendar(this.dueDate);
            });
        }
 
        onDateSelected(date, formatted) {
            if (this.activeTarget === 'start') {
                this.startDate = date;
                activeData.start_date = date.toISOString();
                document.getElementById('startDateText').textContent = formatted;
                document.getElementById('startDateText').classList.remove('placeholder');
                document.getElementById('startDateBtn').classList.add('has-date');
            } else {
                this.dueDate = date;
                activeData.due_date = date.toISOString();
                const item = document.querySelector(`.task[data-id="${activeData.id}"]`);
                if (item) item.querySelector('.task-deadline span').textContent =
                    `${t('home.task_due_prefix')} ${formatted}`;
                document.getElementById('dueDateText').textContent = formatted;
                document.getElementById('dueDateText').classList.remove('placeholder');
                document.getElementById('dueDateBtn').classList.add('has-date');
            }
            this._updateProgress();
            this._syncBackend();
        }

        onDateCleared() {
            const placeholder = t('home.date_set');
            if (this.activeTarget === 'start') {
                this.startDate = null;
                activeData.start_date = null;
                const text = document.getElementById('startDateText');
                text.textContent = placeholder;
                text.classList.add('placeholder');
                document.getElementById('startDateBtn').classList.remove('has-date');
            } else {
                this.dueDate = null;
                activeData.due_date = null;
                const text = document.getElementById('dueDateText');
                text.textContent = placeholder;
                text.classList.add('placeholder');
                document.getElementById('dueDateBtn').classList.remove('has-date');
            }
            this._syncBackend();
        }

        _updateProgress() {
            const start = this.startDate, due = this.dueDate, now = new Date();
            let progress = 0;
            if (start && due) {
                if (now < start) progress = 0;
                else if (now > due) progress = 100;
                else progress = Math.round(((now - start) / (due - start)) * 100);
            }
            if (activeItem) {
                const fill    = activeItem.querySelector('.progress-bar-fill');
                const percent = activeItem.querySelector('.progress-percent');
                if (fill)    fill.style.width    = `${progress}%`;
                if (percent) percent.textContent = `${progress}%`;
            }
            const panel = document.querySelector('.task-detail-panel');
            if (panel) {
                const fill    = panel.querySelector('.progress-bar-fill');
                const percent = panel.querySelector('.progress-percent');
                if (fill)    fill.style.width    = `${progress}%`;
                if (percent) percent.textContent = `${progress}%`;
            }
        }

        _syncBackend() {
            if (utils.TEST) return;
            if (!activeData) return; // ← THÊM DÒNG NÀY

            const updateData = {};

            if (this.activeTarget === 'start') {
                if (activeData.start_date) {
                    const startDate = new Date(activeData.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    updateData.start_date = startDate.toISOString();
                } else {
                    updateData.start_date = null;
                }
            } else {
                if (activeData.due_date) {
                    const dueDate = new Date(activeData.due_date);
                    dueDate.setHours(23, 59, 59, 999);
                    updateData.due_date = dueDate.toISOString();
                } else {
                    updateData.due_date = null;
                }
            }

            if (activeData.id.toString().startsWith('tmp-')) {
                idb.getData(utils.QUEUE_STORE, activeData.id).then(existing => {
                    idb.patchData(utils.QUEUE_STORE, activeData.id, {
                        token: localStorage.getItem('access_token'),
                        enqueuedAt: Date.now(),
                        options: {
                            ...existing.options,
                            body: JSON.stringify({
                                ...JSON.parse(existing.options.body),
                                ...updateData
                            })
                        }
                    });
                });
                return;
            }


            clearTimeout(dateDebounceTimer);
            dateDebounceTimer = setTimeout(() => {
                utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/items/${activeData.id}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify(updateData)
                    },
                    { enableQueue: true },
                    utils.generateId(), 1
                ).catch(() => utils.showWarning(t('home.msg_date_error')));
            }, 500);
        }
    }

    // ========== FILTER DATE PICKER ==========
    class FilterDatePicker extends TaskDatePicker {
        constructor() {
            FilterDatePicker._injectHTML();

            super({
                overlay:      'sf-cal-overlay',
                popup:        'sf-cal-popup',
                calendarDays: 'sf-cal-days',
                monthSelect:  'sf-cal-month-select',
                yearDisplay:  'sf-cal-year-display',
                yearUp:       'sf-cal-year-up',
                yearDown:     'sf-cal-year-down',
                prevMonth:    'sf-cal-prev-month',
                nextMonth:    'sf-cal-next-month',
                todayBtn:     'sf-cal-today-btn',
                clearBtn:     'sf-cal-clear-btn',
            });

            this._onSelect = null;
            this._onClear  = null;
        }

        open(currentDate, onSelect, onClear) {
            this._onSelect = onSelect;
            this._onClear  = onClear;
            this.selectedDate = currentDate ?? null;
            this.openCalendar(currentDate);
        }

        onDateSelected(date, formatted) {
            if (this._onSelect) this._onSelect(date, formatted);
        }

        onDateCleared() {
            if (this._onClear) this._onClear();
        }

        static _injectHTML() {
            if (document.getElementById('sf-cal-overlay')) return;
            const tpl = document.createElement('div');
            tpl.innerHTML = `
            <div class="calendar-overlay" id="sf-cal-overlay" style="z-index:10001">
                <div class="calendar-popup" id="sf-cal-popup">
                    <div class="calendar-header">
                        <button class="calendar-nav-btn" id="sf-cal-prev-month">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <div class="calendar-title">
                            <select class="month-select" id="sf-cal-month-select">
                                <option value="0" data-i18n="home.month_1">January</option><option value="1" data-i18n="home.month_2">February</option>
                                <option value="2" data-i18n="home.month_3">March</option><option value="3" data-i18n="home.month_4">April</option>
                                <option value="4" data-i18n="home.month_5">May</option><option value="5" data-i18n="home.month_6">June</option>
                                <option value="6" data-i18n="home.month_7">July</option><option value="7" data-i18n="home.month_8">August</option>
                                <option value="8" data-i18n="home.month_9">September</option><option value="9" data-i18n="home.month_10">October</option>
                                <option value="10" data-i18n="home.month_11">November</option><option value="11" data-i18n="home.month_12">December</option>
                            </select>
                            <div class="year-stepper">
                                <button class="year-step-btn" id="sf-cal-year-down">-</button>
                                <span class="year-display" id="sf-cal-year-display">2026</span>
                                <button class="year-step-btn" id="sf-cal-year-up">+</button>
                            </div>
                        </div>
                        <button class="calendar-nav-btn" id="sf-cal-next-month">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="calendar-weekdays">
                        <div class="weekday" data-i18n="home.weekday_su">Su</div><div class="weekday" data-i18n="home.weekday_mo">Mo</div>
                        <div class="weekday" data-i18n="home.weekday_tu">Tu</div><div class="weekday" data-i18n="home.weekday_we">We</div>
                        <div class="weekday" data-i18n="home.weekday_th">Th</div><div class="weekday" data-i18n="home.weekday_fr">Fr</div>
                        <div class="weekday" data-i18n="home.weekday_sa">Sa</div>
                    </div>
                    <div class="calendar-days" id="sf-cal-days"></div>
                    <div class="calendar-footer">
                        <button class="btn-clear" id="sf-cal-clear-btn" data-i18n="home.calendar_clear">Clear</button>
                        <button class="btn-today" id="sf-cal-today-btn" data-i18n="home.calendar_today">Today</button>
                    </div>
                </div>
            </div>`;
            document.body.appendChild(tpl.firstElementChild);
            
            // Apply i18n to newly injected elements
            const injectedOverlay = document.getElementById('sf-cal-overlay');
            if (injectedOverlay) {
                injectedOverlay.querySelectorAll('[data-i18n]').forEach(el => {
                    const val = t(el.getAttribute('data-i18n'));
                    if (val) el.textContent = val;
                });
            }
        }
    }

    // Khởi tạo
    const taskDatePicker    = new TaskDetailDatePicker();
    const filterDatePicker  = new FilterDatePicker();

    // ========== NOTES ==========
    const notesTextarea = document.querySelector('.notes-textarea');
    let notesDebounceTimer = null;

    if (notesTextarea) {
        notesTextarea.addEventListener('input', function () {
            const newNotes = notesTextarea.value;

            activeData.notes = newNotes;

            if (activeData.id.toString().startsWith('tmp-')) {
                idb.getData(utils.QUEUE_STORE, activeData.id).then(existing => {
                    idb.patchData(utils.QUEUE_STORE, activeData.id, {
                        token: localStorage.getItem('access_token'),
                        enqueuedAt: Date.now(),
                        options: {
                            ...existing.options,
                            body: JSON.stringify({
                                ...JSON.parse(existing.options.body),
                                notes: newNotes
                            })
                        }
                    });
                });
                return;
            }

            clearTimeout(notesDebounceTimer);
            notesDebounceTimer = setTimeout(() => {
                if (utils.TEST) return;
                utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/items/${activeData.id}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({ notes: newNotes })
                    },
                    { enableQueue: true },
                    utils.generateId(), 1
                ).catch(() => utils.showWarning(t('home.msg_notes_error')));
            }, 500);
        });
    }

    // ========== DELETE TASK ==========
    const btnDeleteTask = document.querySelector('.btn-delete-task');
    const panel = document.querySelector('.task-detail-panel');
    if (btnDeleteTask) {
        btnDeleteTask.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (!activeItem) return;

            if (utils.TEST) {
                activeItem.remove();
                if (container.querySelectorAll('.task').length === 0) 
                    showEmptyState('noTask');
                if (panel) panel.classList.remove('active');
                return;
            }

            if (activeData.id.toString().startsWith('tmp-')) {
                await idb.deleteData(utils.QUEUE_STORE, activeData.id);

                activeItem.remove();
                if (container.querySelectorAll('.task').length === 0) 
                    showEmptyState('noTask');
                if (panel) panel.classList.remove('active');

                return;
            }


            try {
                const response = await utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/items/${activeData.id}`, 
                    { method: 'DELETE' },
                    { enableQueue: true },
                    utils.generateId(), 1
                );

                if (response.ok) {
                    activeItem.remove();
                    if (container.querySelectorAll('.task').length === 0) 
                        showEmptyState('noTask');
                    if (panel) panel.classList.remove('active');
                } else utils.showWarning(t('home.msg_task_delete_error'));
            } catch (err) {
                utils.showWarning(t('home.msg_task_delete_error'));
            }
        });
    }

    // ========== DRAG & DROP ==========
    let reorderDebounceTimer = null;
    
    function sendReorder() {
        clearTimeout(reorderDebounceTimer);
        reorderDebounceTimer = setTimeout(async () => {
            if (utils.TEST) return;
            const tasks = [...taskList.querySelectorAll('.task')];
            const body = tasks.map((el, index) => ({
                id: parseInt(el.dataset.id),
                position: index + 1
            }));

        if (!await utils.isQueueEmpty()) {return;}
        
        utils.fetchWithAuth(`${utils.URL_API}/project/${projectId}/items/reorder`, {
            method: 'PATCH',
            body: JSON.stringify(body)
        }).then(async res => {
            if (!res.ok) {
                const err = await res.json();
                console.error('[REORDER]', res.status, err);
            }
        }).catch(() => utils.showWarning(t('home.msg_reorder_error')));
        }, 500);
    }
    
    const taskList = container.querySelector('.task-list');
    new Sortable(taskList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.empty-state',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onEnd: function() { sendReorder(); }
    });

    function showDate(_date) {
        const date = new Date(_date);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    window.addEventListener('langChanged', function() {
        const h1 = container.querySelector('h1');
        if (h1 && h1.style.display !== 'none') {
            h1.querySelectorAll('[data-i18n]').forEach(el => {
                el.textContent = t(el.getAttribute('data-i18n'));
            });
        }
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            if (!projectId && !utils.TEST) {
                showEmptyState('noProject');
            } else if (container.querySelectorAll('.task').length === 0) {
                showEmptyState('noTask');
            }
        }
    
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });

        // Update calendar overlay i18n elements
        const calendarOverlay = document.getElementById('sf-cal-overlay');
        if (calendarOverlay) {
            calendarOverlay.querySelectorAll('[data-i18n]').forEach(el => {
                el.textContent = t(el.getAttribute('data-i18n'));
            });
        }

        // Update sort condition labels
        document.querySelectorAll('#sf-sort-body .sf-sort-condition').forEach(card => {
            const fieldBtn = card.querySelector('.sf-cycle-btn');
            const id = parseInt(card.dataset.id);
            const cond = draftSortConditions.find(c => c.id === id);
            if (fieldBtn && cond) {
                fieldBtn.textContent = getFieldLabel(cond.field);
            }
        });

        // Update filter condition labels
        document.querySelectorAll('#sf-filter-conditions-list .sf-filter-condition').forEach(card => {
            const fieldBtn = card.querySelector('[class*="field"] .sf-cycle-btn');
            const opBtn = card.querySelector('[class*="op"] .sf-cycle-btn');
            const id = parseInt(card.dataset.id);
            const cond = draftFilterConditions.find(c => c.id === id);
            if (fieldBtn && cond) {
                fieldBtn.textContent = getFieldLabel(cond.field);
            }
            if (opBtn && cond) {
                opBtn.textContent = getOperatorLabel(cond.operator);
            }
        });
    
        container.querySelectorAll('.task').forEach(taskEl => {
            const taskId = taskEl.dataset.id;
            const deadlineSpan = taskEl.querySelector('.task-deadline span');
            if (deadlineSpan) {
                const currentText = deadlineSpan.textContent;
                const datePart = currentText.includes(':') ? currentText.split(':').pop().trim() : currentText.split(' ').pop().trim();
                deadlineSpan.textContent = `${t('home.task_due_prefix')} ${datePart}`;
            }
        
            const btnDone = taskEl.querySelector('.btn-done');
            if (btnDone) {
                btnDone.textContent = taskEl.classList.contains('completed') ? t('home.btn_done_check') : t('home.btn_done');
            }
        });
    
        const panel = document.querySelector('.task-detail-panel');
        if (panel && panel.classList.contains('active') && activeData) {
            
            const priority_text = panel.querySelector('.priority-badge span');
            if (priority_text) {
                priority_text.textContent = t(`home.priority_${activeData.priority}`);
            }
        
            const startText = document.getElementById('startDateText');
            if (startText) {
                if (activeData.start_date) {
                    startText.textContent = showDate(activeData.start_date);
                    startText.classList.remove('placeholder');
                } else {
                    startText.textContent = t('home.date_set');
                    startText.classList.add('placeholder');
                }
            }
        
            const dueText = document.getElementById('dueDateText');
            if (dueText) {
                if (activeData.due_date) {
                    dueText.textContent = showDate(activeData.due_date);
                    dueText.classList.remove('placeholder');
                } else {
                    dueText.textContent = t('home.date_set');
                    dueText.classList.add('placeholder');
                }
            }
        }
    });

    // ========== SORT & FILTER ==========

    // --- State ---
    let sortConditions   = [];
    let filterConditions = [];
    let filterLogic      = 'AND';
    let sortIdCtr        = 0;
    let filterIdCtr      = 0;
    let _sfButtonClicked = false; // cờ ngăn blur validate khi bấm Apply/Cancel

    // SORT_FIELDS: theo spec — "name"|"start_date"|"due_date"|"time_spent"|"create_date"|"priority"
    const SORT_FIELDS = ['name', 'priority', 'start_date', 'due_date', 'time_spent', 'create_date'];

    // FILTER_FIELDS: theo spec — bổ sung create_date
    const FILTER_FIELDS   = ['name', 'priority', 'start_date', 'due_date', 'time_spent', 'create_date'];
    const FIELD_OPERATORS = {
        name:        ['contains', 'not_contains', 'eq', 'not_eq'],
        priority:    ['in', 'not_in'],
        start_date:  ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
        due_date:    ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
        time_spent:  ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
        create_date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
    };
    const OPERATOR_LABELS = {
        eq: 'operator_eq', not_eq: 'operator_not_eq', contains: 'operator_contains', not_contains: 'operator_not_contains',
        in: 'operator_in', not_in: 'operator_not_in',
        gt: 'operator_gt', gte: 'operator_gte', lt: 'operator_lt', lte: 'operator_lte', between: 'operator_between',
    };
    const FIELD_LABELS = {
        name: 'field_name',
        priority: 'field_priority',
        start_date: 'field_start_date',
        due_date: 'field_due_date',
        time_spent: 'field_time_spent',
        create_date: 'field_create_date',
    };
    const FIELD_TYPE = {
        name: 'text', priority: 'priority',
        start_date: 'date', due_date: 'date', time_spent: 'time',
        create_date: 'date',
    };

    // Helper to get field label
    function getFieldLabel(fieldName) {
        const key = FIELD_LABELS[fieldName];
        return key ? t(`home.${key}`) : fieldName;
    }

    // Helper to get operator label
    function getOperatorLabel(operatorName) {
        const key = OPERATOR_LABELS[operatorName];
        return key ? t(`home.${key}`) : operatorName;
    }

    // --- Draft ---
    let draftSortConditions   = [];
    let draftFilterConditions = [];
    let draftFilterLogic      = 'AND';

    function cloneConditions(arr) {
        return arr.map(c => ({ ...c, value: Array.isArray(c.value) ? [...c.value] : c.value }));
    }

    // --- Badge ---
    function updateSFBadge(btnId, badgeId, count) {
        const btn   = document.getElementById(btnId);
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = '';
            if (btn) btn.classList.add('active');
        } else {
            badge.style.display = 'none';
            if (btn) btn.classList.remove('active');
        }
    }

    // --- Open / Close ---
    function sfOpenBox(boxId, btnId) {
        document.getElementById(boxId)?.classList.add('visible');
        document.getElementById('sf-overlay')?.classList.add('visible');
        document.getElementById(btnId)?.classList.add('active');
    }

    function sfCloseAll() {
        ['sf-sort-box', 'sf-filter-box'].forEach(id => document.getElementById(id)?.classList.remove('visible'));
        document.getElementById('sf-overlay')?.classList.remove('visible');
        if (sortConditions.length === 0)   document.getElementById('btn-sort')?.classList.remove('active');
        if (filterConditions.length === 0) document.getElementById('btn-filter')?.classList.remove('active');
    }

    document.getElementById('sf-overlay')?.addEventListener('click', sfCloseAll);
    document.getElementById('sf-sort-close')?.addEventListener('click', sfCloseAll);
    document.getElementById('sf-filter-close')?.addEventListener('click', sfCloseAll);
    document.getElementById('sf-sort-cancel')?.addEventListener('click', sfCloseAll);
    document.getElementById('sf-filter-cancel')?.addEventListener('click', sfCloseAll);

    // Gắn cờ mousedown cho các nút đóng filter
    ['sf-filter-close', 'sf-filter-cancel'].forEach(id => {
        document.getElementById(id)?.addEventListener('mousedown', () => {
            _sfButtonClicked = true;
            setTimeout(() => { _sfButtonClicked = false; }, 200);
        });
    });

    // ── SORT ──
    const DRAG_HANDLE_SVG = `<svg width="12" height="16" viewBox="0 0 12 16" fill="none">
      <circle cx="4" cy="4"  r="1.3" fill="currentColor"/>
      <circle cx="8" cy="4"  r="1.3" fill="currentColor"/>
      <circle cx="4" cy="8"  r="1.3" fill="currentColor"/>
      <circle cx="8" cy="8"  r="1.3" fill="currentColor"/>
      <circle cx="4" cy="12" r="1.3" fill="currentColor"/>
      <circle cx="8" cy="12" r="1.3" fill="currentColor"/>
    </svg>`;

    let sfDragSrc = null;

    function buildSortCard(s, isNew) {
        const card = document.createElement('div');
        card.className = 'sf-sort-condition' + (isNew ? ' is-new' : '');
        card.dataset.id = s.id;
        card.draggable = false;

        const lbl = document.createElement('div');
        lbl.className = 'sf-field-label';
        lbl.textContent = t('home.sort_label_sort_by');
        card.appendChild(lbl);

        const row = document.createElement('div');
        row.className = 'sf-sort-row-inner';

        const handle = document.createElement('div');
        handle.className = 'sf-drag-handle';
        handle.innerHTML = DRAG_HANDLE_SVG;
        handle.addEventListener('mousedown', () => { card.draggable = true; });
        handle.addEventListener('mouseup',   () => { card.draggable = false; });

        card.addEventListener('dragstart', e => {
            sfDragSrc = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.draggable = false;
            card.classList.remove('dragging');
            document.querySelectorAll('.sf-drop-indicator').forEach(el => el.remove());
            sfDragSrc = null;
        });
        card.addEventListener('dragover', e => {
            if (!sfDragSrc || sfDragSrc === card) return;
            e.preventDefault();
            document.querySelectorAll('.sf-drop-indicator').forEach(el => el.remove());
            const rect  = card.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            const ind = document.createElement('div');
            ind.className = 'sf-drop-indicator';
            const wrap = document.getElementById('sf-sort-body');
            wrap.insertBefore(ind, after ? card.nextSibling : card);
        });
        card.addEventListener('drop', e => {
            if (!sfDragSrc || sfDragSrc === card) return;
            e.preventDefault();
            document.querySelectorAll('.sf-drop-indicator').forEach(el => el.remove());
            const rect  = card.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            const wrap = document.getElementById('sf-sort-body');
            wrap.insertBefore(sfDragSrc, after ? card.nextSibling : card);
            syncSortOrder();
        });

        const sel = document.createElement('button');
        sel.type = 'button';
        sel.className = 'sf-cycle-btn';
        sel.textContent = getFieldLabel(s.field);
        sel.addEventListener('click', () => {
            const idx = SORT_FIELDS.indexOf(s.field);
            s.field = SORT_FIELDS[(idx + 1) % SORT_FIELDS.length];
            sel.textContent = getFieldLabel(s.field);
        });

        const grp = document.createElement('div');
        grp.className = 'sf-sort-dir-group';
        const btnAsc  = document.createElement('button');
        const btnDesc = document.createElement('button');
        btnAsc.className  = 'sf-dir-btn' + (s.asc  ? ' active' : '');
        btnDesc.className = 'sf-dir-btn' + (!s.asc ? ' active' : '');
        btnAsc.textContent  = t('home.sort_label_asc');
        btnDesc.textContent = t('home.sort_label_desc');
        btnAsc.addEventListener('click',  () => { s.asc = true;  btnAsc.classList.add('active');  btnDesc.classList.remove('active'); });
        btnDesc.addEventListener('click', () => { s.asc = false; btnDesc.classList.add('active'); btnAsc.classList.remove('active');  });
        grp.append(btnAsc, btnDesc);

        const rm = document.createElement('button');
        rm.className = 'sf-remove-btn';
        rm.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
        rm.addEventListener('click', () => {
            draftSortConditions = draftSortConditions.filter(x => x.id !== s.id);
            card.remove();
            if (draftSortConditions.length === 0) renderSortEmpty();
        });

        row.append(handle, sel, grp, rm);
        card.appendChild(row);
        return card;
    }

    function syncSortOrder() {
        const cards = document.querySelectorAll('#sf-sort-body .sf-sort-condition');
        const newOrder = [];
        cards.forEach(card => {
            const found = draftSortConditions.find(s => s.id === parseInt(card.dataset.id));
            if (found) newOrder.push(found);
        });
        draftSortConditions = newOrder;
    }

    function renderSortEmpty() {
        document.getElementById('sf-sort-body').innerHTML = `
            <div class="sf-empty-state">
                <div class="sf-empty-icon">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <rect width="36" height="36" rx="8" fill="rgba(99,102,241,0.08)"/>
                        <line x1="10" y1="12" x2="26" y2="12" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="13" y1="18" x2="23" y2="18" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="16" y1="24" x2="20" y2="24" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
                ${t('home.sort_empty_title')}<br>${t('home.sort_empty_desc')}
            </div>`;
    }

    function initSortBox() {
        draftSortConditions = cloneConditions(sortConditions);
        const wrap = document.getElementById('sf-sort-body');
        wrap.innerHTML = '';
        if (draftSortConditions.length === 0) { renderSortEmpty(); return; }
        draftSortConditions.forEach(s => wrap.appendChild(buildSortCard(s, false)));
    }

    document.getElementById('btn-sort')?.addEventListener('click', () => {
        initSortBox();
        sfOpenBox('sf-sort-box', 'btn-sort');
    });

    document.getElementById('sf-sort-add')?.addEventListener('click', () => {
        const s = { id: sortIdCtr++, field: 'name', asc: true };
        draftSortConditions.push(s);
        const wrap = document.getElementById('sf-sort-body');
        wrap.querySelector('.sf-empty-state')?.remove();
        wrap.appendChild(buildSortCard(s, true));
    });

    document.getElementById('sf-sort-apply')?.addEventListener('click', async () => {
        const cards = document.querySelectorAll('#sf-sort-body .sf-sort-condition');
        const ordered = [];
        cards.forEach(card => {
            const found = draftSortConditions.find(s => s.id === parseInt(card.dataset.id));
            if (found) ordered.push(found);
        });
        draftSortConditions = ordered;
        sortConditions = cloneConditions(draftSortConditions);
        updateSFBadge('btn-sort', 'sort-badge', sortConditions.length);
        sfCloseAll();
        window.sortState = { conditions: sortConditions.map(s => ({ field: s.field, asc: s.asc })) };
        document.dispatchEvent(new CustomEvent('sortApplied', { detail: window.sortState }));

        // PUT /project/${projectId}/sort
        // Body: [{ field, order, ascending }]  hoặc [] để tắt
        const payload = buildSortPayload(sortConditions);
        console.log('[SORT PAYLOAD]', payload);

        if (!utils.TEST && projectId) {
            try {
                const res = await utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/sort`,
                    { method: 'PUT', body: JSON.stringify(payload) },
                    { enableQueue: true },
                    utils.generateId(), 1
                );
                if (!res.ok) {
                    utils.showWarning(t('home.msg_sort_error'));
                } else {
                    // Reload task list để áp dụng sort
                    await loadData();
                }
            } catch {
                utils.showWarning(t('home.msg_sort_error'));
            }
        }
    });

    // ── FILTER ──
 
    function buildFilterCard(f, isNew) {
        const card = document.createElement('div');
        card.className = 'sf-filter-condition' + (isNew ? ' is-new' : '');
        card.dataset.id = f.id;

        const topRow = document.createElement('div');
        topRow.className = 'sf-filter-top-row';

        const fieldWrap = document.createElement('div');
        const fieldLbl  = document.createElement('div');
        fieldLbl.className = 'sf-field-label';
        fieldLbl.textContent = t('home.filter_label_field');
        const fieldSel = document.createElement('button');
        fieldSel.type = 'button';
        fieldSel.className = 'sf-cycle-btn';
        fieldSel.textContent = getFieldLabel(f.field);
        fieldWrap.append(fieldLbl, fieldSel);

        const opWrap = document.createElement('div');
        const opLbl  = document.createElement('div');
        opLbl.className = 'sf-field-label';
        opLbl.textContent = t('home.filter_label_operator');
        const opSel = document.createElement('button');
        opSel.type = 'button';
        opSel.className = 'sf-cycle-btn';
        opWrap.append(opLbl, opSel);

        const rm = document.createElement('button');
        rm.className = 'sf-remove-btn';
        rm.style.marginBottom = '1px';
        rm.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
        rm.addEventListener('click', () => {
            draftFilterConditions = draftFilterConditions.filter(x => x.id !== f.id);
            card.remove();
            if (draftFilterConditions.length === 0) renderFilterEmpty();
        });

        topRow.append(fieldWrap, opWrap, rm);
        card.appendChild(topRow);

        const valueArea = document.createElement('div');
        valueArea.className = 'sf-filter-value-area';
        card.appendChild(valueArea);

        function populateOperators(field, currentOp) {
            const ops = FIELD_OPERATORS[field];
            f.operator = ops.includes(currentOp) ? currentOp : ops[0];
            opSel.textContent = getOperatorLabel(f.operator);
            opSel.onclick = () => {
                const idx = ops.indexOf(f.operator);
                f.operator  = ops[(idx + 1) % ops.length];
                opSel.textContent = getOperatorLabel(f.operator);
                f.value     = FIELD_TYPE[f.field] === 'priority' ? (f.value || []) : (typeof f.value === 'string' ? f.value : '');
                f.valueFrom = f.valueFrom || '';
                f.valueTo   = f.valueTo   || '';
                renderValueArea(f.field, f.operator);
            };
        }

        function buildValueInput(type, currentVal) {
            if (type === 'date') {
                const wrap = document.createElement('div');
                wrap.className = 'sf-date-btn-wrap';

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'sf-date-btn' + (currentVal ? ' has-date' : '');

                const svgIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="2"/>
                    <line x1="8" y1="3" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="16" y1="3" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`;
                const label = document.createElement('span');
                label.textContent = currentVal || t('home.filter_label_set_date');
                if (!currentVal) label.classList.add('placeholder');
                btn.innerHTML = svgIcon;
                btn.appendChild(label);

                let _currentDate = currentVal ? (() => {
                    if (currentVal.includes('/')) {
                        const [dd, mm, yyyy] = currentVal.split('/');
                        return new Date(+yyyy, +mm - 1, +dd);
                    }
                    return new Date(currentVal);
                })() : null;

                wrap._dateValue = currentVal || '';

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    filterDatePicker.open(
                        _currentDate,
                        (date, formatted) => {
                            // Lưu ISO 8601 đúng theo spec: yyyy-MM-ddTHH:mm:ss.sssZ
                            const iso = date.toISOString();
                            _currentDate = date;
                            wrap._dateValue = iso;
                            label.textContent = formatted;
                            label.classList.remove('placeholder');
                            btn.classList.add('has-date');
                            wrap.dispatchEvent(new CustomEvent('datechange', { detail: iso, bubbles: true }));
                        },
                        () => {
                            _currentDate = null;
                            wrap._dateValue = '';
                            label.textContent = t('home.filter_label_set_date');
                            label.classList.add('placeholder');
                            btn.classList.remove('has-date');
                            wrap.dispatchEvent(new CustomEvent('datechange', { detail: '', bubbles: true }));
                        }
                    );
                });

                wrap.appendChild(btn);

                Object.defineProperty(wrap, 'value', {
                    get: () => wrap._dateValue,
                    set: (v) => { wrap._dateValue = v; },
                });

                const _origAddEventListener = wrap.addEventListener.bind(wrap);
                wrap.addEventListener = (event, handler, ...rest) => {
                    if (event === 'input') {
                        _origAddEventListener('datechange', (e) => handler({ target: { value: e.detail } }), ...rest);
                    } else {
                        _origAddEventListener(event, handler, ...rest);
                    }
                };

                return wrap;
            } else if (type === 'time') {
                // time_spent: nhập số thực đơn vị giờ (vd: 1.5 = 1h30m), convert sang HH:mm:ss khi gửi backend
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = t('home.filter_label_hours');
                inp.min = '0';
                inp.step = 'any';
                // Nếu currentVal là HH:mm:ss thì convert sang số giờ để hiển thị
                if (currentVal && /^\d{2}:\d{2}:\d{2}$/.test(currentVal)) {
                    const [hh, mm, ss] = currentVal.split(':').map(Number);
                    inp.value = parseFloat((hh + mm / 60 + ss / 3600).toFixed(4));
                } else {
                    inp.value = currentVal || '';
                }
                inp._isTimeInput = true;
                inp.addEventListener('blur', () => {
                    if (_sfButtonClicked) return;
                    const v = inp.value.trim();
                    if (v === '') return;
                    const num = parseFloat(v);
                    if (isNaN(num) || num < 0) {
                        utils.showWarning(t('home.filter_error_invalid_hours'));
                        inp.value = '';
                        setTimeout(() => inp.focus(), 0);
                    }
                });
                return inp;
            } else {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = t('home.filter_error_invalid_text');
                inp.value = currentVal || '';
                return inp;
            }
        }

        function renderValueArea(field, operator) {
            valueArea.innerHTML = '';
            const type = FIELD_TYPE[field];

            if (type === 'priority') {
                const lbl = document.createElement('div');
                lbl.className = 'sf-field-label';
                lbl.textContent = t('home.filter_label_value');
                const cg = document.createElement('div');
                cg.className = 'sf-chip-group';
                ['high', 'medium', 'low'].forEach(p => {
                    const colors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
                    const chip = document.createElement('span');
                    const selected = Array.isArray(f.value) && f.value.includes(p);
                    chip.className = 'sf-chip ' + p + (selected ? ' selected' : '');
                    chip.innerHTML = `<svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="${colors[p]}"/></svg>${t(`home.priority_value_${p}`)}`;
                    chip.addEventListener('click', () => {
                        if (!Array.isArray(f.value)) f.value = [];
                        if (f.value.includes(p)) f.value = f.value.filter(v => v !== p);
                        else f.value.push(p);
                        chip.classList.toggle('selected', f.value.includes(p));
                    });
                    cg.appendChild(chip);
                });
                valueArea.append(lbl, cg);

            } else if (operator === 'between') {
                const lbl = document.createElement('div');
                lbl.className = 'sf-field-label';
                lbl.textContent = t('home.filter_label_value_range');
                valueArea.appendChild(lbl);

                const brow = document.createElement('div');
                brow.className = 'sf-between-row';

                const fromWrap = document.createElement('div');
                const fromLbl  = document.createElement('div');
                fromLbl.className = 'sf-field-label';
                fromLbl.textContent = t('home.filter_label_from');
                const fromInp = buildValueInput(type, (type === 'date' && f.valueFrom) ? isoToDisplay(f.valueFrom) : (f.valueFrom || ''));
                fromInp.addEventListener('input',  () => { f.valueFrom = fromInp.value; });
                fromWrap.append(fromLbl, fromInp);

                const toWrap = document.createElement('div');
                const toLbl  = document.createElement('div');
                toLbl.className = 'sf-field-label';
                toLbl.textContent = t('home.filter_label_to');
                const toInp = buildValueInput(type, (type === 'date' && f.valueTo) ? isoToDisplay(f.valueTo) : (f.valueTo || ''));
                toInp.addEventListener('input', () => { f.valueTo = toInp.value; });
                toWrap.append(toLbl, toInp);

                brow.append(fromWrap, toWrap);
                valueArea.appendChild(brow);

            } else {
                const lbl = document.createElement('div');
                lbl.className = 'sf-field-label';
                lbl.textContent = t('home.filter_label_value');
                const displayVal = (type === 'date' && f.value) ? isoToDisplay(f.value) : (typeof f.value === 'string' ? f.value : '');
                const inp = buildValueInput(type, displayVal);
                inp.addEventListener('input', () => { f.value = inp.value; });
                valueArea.append(lbl, inp);
            }
        }

        populateOperators(f.field, f.operator);
        renderValueArea(f.field, f.operator);

        fieldSel.addEventListener('click', () => {
            const idx = FILTER_FIELDS.indexOf(f.field);
            f.field    = FILTER_FIELDS[(idx + 1) % FILTER_FIELDS.length];
            f.operator = FIELD_OPERATORS[f.field][0];
            f.value    = FIELD_TYPE[f.field] === 'priority' ? [] : '';
            f.valueFrom = ''; f.valueTo = '';
            fieldSel.textContent = getFieldLabel(f.field);
            populateOperators(f.field, f.operator);
            renderValueArea(f.field, f.operator);
        });

        return card;
    } 

    function renderFilterEmpty() {
        document.getElementById('sf-filter-conditions-list').innerHTML = `
            <div class="sf-empty-state">
                <div class="sf-empty-icon">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <rect width="36" height="36" rx="8" fill="rgba(99,102,241,0.08)"/>
                        <path d="M10 12h16l-6 7v5l-4-2v-3l-6-7z" stroke="#6366f1" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
                    </svg>
                </div>
                ${t('home.filter_empty_title')}<br>${t('home.filter_empty_desc')}
            </div>`;
    }

    function initFilterBox() {
        draftFilterConditions = cloneConditions(filterConditions);
        draftFilterLogic      = filterLogic;
        document.getElementById('sf-logic-and').classList.toggle('active', draftFilterLogic === 'AND');
        document.getElementById('sf-logic-or').classList.toggle('active',  draftFilterLogic === 'OR');
        const list = document.getElementById('sf-filter-conditions-list');
        list.innerHTML = '';
        if (draftFilterConditions.length === 0) { renderFilterEmpty(); return; }
        draftFilterConditions.forEach(f => list.appendChild(buildFilterCard(f, false)));
    }

    document.getElementById('btn-filter')?.addEventListener('click', () => {
        initFilterBox();
        sfOpenBox('sf-filter-box', 'btn-filter');
    });

    document.getElementById('sf-filter-add')?.addEventListener('click', () => {
        const f = { id: filterIdCtr++, field: 'name', operator: 'contains', value: '', valueFrom: '', valueTo: '' };
        draftFilterConditions.push(f);
        const list = document.getElementById('sf-filter-conditions-list');
        list.querySelector('.sf-empty-state')?.remove();
        list.appendChild(buildFilterCard(f, true));
    });

    document.getElementById('sf-logic-and')?.addEventListener('click', () => {
        draftFilterLogic = 'AND';
        document.getElementById('sf-logic-and').classList.add('active');
        document.getElementById('sf-logic-or').classList.remove('active');
    });
    document.getElementById('sf-logic-or')?.addEventListener('click', () => {
        draftFilterLogic = 'OR';
        document.getElementById('sf-logic-or').classList.add('active');
        document.getElementById('sf-logic-and').classList.remove('active');
    });

    document.getElementById('sf-filter-apply')?.addEventListener('mousedown', () => {
        _sfButtonClicked = true;
        setTimeout(() => { _sfButtonClicked = false; }, 200);
    });

    document.getElementById('sf-filter-apply')?.addEventListener('click', async () => {
        const timeInputs = document.querySelectorAll('#sf-filter-conditions-list input[type="text"]');
        for (const inp of timeInputs) {
            if (!inp._isTimeInput) continue;
            const v = inp.value.trim();
            if (v === '') continue;
            const num = parseFloat(v);
            if (v === '' || isNaN(num) || num < 0) {
                utils.showWarning(t('home.filter_error_invalid_hours'));
                _sfButtonClicked = false;
                inp.focus();
                return;
            }
        }
        
        // Commit draft → state thật
        filterConditions = cloneConditions(draftFilterConditions);
        filterLogic      = draftFilterLogic;
        updateSFBadge('btn-filter', 'filter-badge', filterConditions.length);
        sfCloseAll();
        window.filterState = {
            logic: filterLogic,
            conditions: filterConditions.map(f => ({
                field: f.field, operator: f.operator,
                value: f.value, valueFrom: f.valueFrom, valueTo: f.valueTo,
            }))
        };
        document.dispatchEvent(new CustomEvent('filterApplied', { detail: window.filterState }));

        const payload = buildFilterPayload(filterConditions, filterLogic);
        console.log('[FILTER PAYLOAD]', payload);

        if (!utils.TEST && projectId) {
            try {
                const res = await utils.fetchWithAuth(
                    `${utils.URL_API}/project/${projectId}/filter`,
                    { method: 'PUT', body: JSON.stringify(payload) },
                    { enableQueue: true },
                    utils.generateId(), 1
                );
                if (!res.ok) {
                    utils.showWarning(t('home.msg_filter_error'));
                } else {
                    // Reload task list để áp dụng filter
                    await loadData();
                }
            } catch {
                utils.showWarning(t('home.msg_filter_error'));
            }
        }
    });
 
    // Close sf boxes when task detail calendar is opened
    document.getElementById('taskCalendarOverlay')?.addEventListener('click', () => {
        document.getElementById('sf-sort-box')?.classList.remove('visible');
        document.getElementById('sf-filter-box')?.classList.remove('visible');
        document.getElementById('sf-overlay')?.classList.remove('visible');
    });

    window.addEventListener("online", async () => {
      await waitForQueueEmpty();
      loadData();
    });

    async function waitForQueueEmpty() {
      while (!(await utils.isQueueEmpty())) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    restoreSelectedProject();
});