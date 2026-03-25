document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container-task');
    let projectId = null;
    let nameProject = null;
    let activeItem = null;
    let activeData = null;

    // Ẩn h1 và hiện empty state "chưa chọn project" lúc khởi tạo
    if (!Config.TEST) {
        container.querySelector('h1').style.display = 'none';
        showEmptyState('noProject');
    } else {
        showEmptyState('noTask');
    }

    document.addEventListener('projectSelected', function(e) {
        projectId = e.detail.id;
        nameProject = e.detail.name;

        container.querySelector('h1').style.display = '';
        container.querySelector('h1 p').innerHTML = nameProject;
        loadData();
    });

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

            container.querySelectorAll('.task').forEach(el => el.remove());

            const panel = document.querySelector('.task-detail-panel');
            if (panel) panel.classList.remove('active');

            container.querySelector('h1').style.display = 'none';
            showEmptyState('noProject');
        }
    });

    async function loadData() {
        try {
            const response = await Config.fetchWithAuth(`${Config.URL_API}/project/${projectId}/items`);
            if (!response.ok) {
                Config.showWarning("Unable to load data");
                return;
            }
            document.querySelectorAll('.task').forEach(el => el.remove());
            let items = await response.json();
            if (items.length === 0) {
                showEmptyState('noTask');
            } else {
                hideEmptyState();
                items.forEach(item => renderItem(item));
            }
        } catch (err) {
            Config.showWarning("Unable to load data");
        }
    }

    function showEmptyState(type) {
        container.querySelector('.empty-state')?.remove();

        const cfg = type === 'noProject'
            ? {
                title: 'No project selected',
                desc: 'Select a project from the left sidebar to get started',
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
                title: 'No tasks yet',
                desc: 'Click "New task" above to create your first task',
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
                <button class="btn-done">Done</button>
              </div>

              <div class="task-deadline">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="5" width="16" height="16" rx="2" stroke="#6B7280" stroke-width="2" fill="white"/>
                  <line x1="4" y1="9" x2="20" y2="9" stroke="#6B7280" stroke-width="2"/>
                  <line x1="8" y1="3" x2="8" y2="6" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
                  <line x1="16" y1="3" x2="16" y2="6" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>Due: ${showDate(item.due_date)}</span>
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

            this.textContent = '✓ Done';

            setTimeout(async () => {
                if (Config.TEST){
                    item.remove();
                    if (container.querySelectorAll('.task').length === 0) 
                        showEmptyState('noTask');
                    return;
                }
                try {
                    const response = await Config.fetchWithAuth(
                        `${Config.URL_API}/project/${projectId}/items/${data.id}/done`, 
                        { method: 'DELETE' }
                    );
                    
                    if (response.ok) {
                        item.remove();
                        // Nếu không còn task nào thì hiện empty state
                        if (container.querySelectorAll('.task').length === 0) 
                            showEmptyState('noTask');
                    } else {
                        Config.showWarning('Error while deleting task');
                    }
                } catch (err) {
                    Config.showWarning('Error while deleting task');
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
            priority_text.innerHTML = data.priority[0].toUpperCase() + data.priority.slice(1);
        
            // Start date
            if (data.start_date) {
                start_date_text.textContent = showDate(data.start_date);
                start_date_text.classList.remove('placeholder');
                start_date_btn.classList.add('has-date');
                taskDatePicker.startDate = new Date(data.start_date); // đồng bộ với picker
            } else {
                start_date_text.textContent = 'Set date';
                start_date_text.classList.add('placeholder');
                start_date_btn.classList.remove('has-date');
                taskDatePicker.startDate = null;
            }
        
            // Due date
            if (data.due_date) {
                due_date_text.textContent = showDate(data.due_date);
                due_date_text.classList.remove('placeholder');
                due_date_btn.classList.add('has-date');
                taskDatePicker.dueDate = new Date(data.due_date); // đồng bộ với picker
            } else {
                due_date_text.textContent = 'Set date';
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
    container.querySelector('h1 button').addEventListener('click', async (e) => {
        if (!projectId && !Config.TEST) {
            Config.showWarning('Please select a project first!');
            return;
        }

        try {
            if (Config.TEST) {
                cnt++;
                const pri = ['high', 'medium', 'low'];
                const d = new Date();
                const item = {
                    id: cnt, position: cnt, name: `Task ${cnt}`,
                    priority: pri[Math.ceil(Math.random() * 10) % 3],
                    start_date: new Date(d.setHours(0,0,0,0)).toISOString(),
                    due_date: new Date(d.setHours(23,59,59,999)).toISOString(),
                    time_spent: 0,
                    note: ""
                };
                renderItem(item);
                return;
            }

            const response = await Config.fetchWithAuth(`${Config.URL_API}/project/${projectId}/items`, {
                method: 'POST', body: JSON.stringify({})
            });

            if (response.ok) {
                const item = await response.json();
                renderItem(item);
            } else {
                const errorData = await response.json();
                Config.showWarning(`Error creating task`);
            }
        } catch (err) {
            Config.showWarning('Error creating task');
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
        nameInput.addEventListener('input', function () {
            const newName = nameInput.value.trim();
            if (!newName || !activeData) return;
        
            // Cập nhật UI ngay
            if (activeItem) {
                activeItem.querySelector('.task-name').textContent = newName;
            }
            activeData.name = newName;
        
            if (Config.TEST) return;
        
            clearTimeout(nameDebounceTimer);
            nameDebounceTimer = setTimeout(async () => {
                if (Config.TEST) return;
                try {
                    await Config.fetchWithAuth(
                        `${Config.URL_API}/project/${projectId}/items/${activeData.id}`,
                        { method: 'PATCH', body: JSON.stringify({ name: newName }) }
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
            priorityBadge.querySelector('span').textContent = newPriority.charAt(0).toUpperCase() + newPriority.slice(1);
            activeData.priority = newPriority;

            if (Config.TEST) return;

            // Chỉ delay phần gửi backend
            clearTimeout(priorityDebounceTimer);
            priorityDebounceTimer = setTimeout(() => {
                Config.fetchWithAuth(`${Config.URL_API}/project/${projectId}/items/${activeData.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ priority: newPriority })
                }).catch(() => Config.showWarning("Không thể đổi độ quan trọng"));
            }, 500);
        });
    }

    // ========== TASK DETAIL DATE PICKER ==========
    class TaskDatePicker {
        constructor() {
            this.overlay = document.getElementById('taskCalendarOverlay');
            this.popup = document.getElementById('taskCalendarPopup');
            this.calendarDays = document.getElementById('taskCalendarDays');
            this.monthSelect = document.getElementById('taskMonthSelect');

            this.activeTarget = null; // 'start' or 'due'
            this.startDate = null;
            this.dueDate = null;
            this.currentMonth = new Date().getMonth();
            this.currentYear = new Date().getFullYear();

            this.init();
        }

        init() {
            // Populate year select
            // Trong init(), xóa phần populate year select, thêm vào:
            this.yearDisplay = document.getElementById('taskYearDisplay');
            this.yearDisplay.textContent = this.currentYear;

            document.getElementById('taskYearUp').addEventListener('click', () => {
                this.currentYear++;
                this.updateCalendar();
            });

            document.getElementById('taskYearDown').addEventListener('click', () => {
                this.currentYear--;
                this.updateCalendar();
            });
            this.monthSelect.value = this.currentMonth;

            // Open calendar on button click
            document.getElementById('startDateBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeTarget = 'start';
                this.openCalendar();
            });

            document.getElementById('dueDateBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeTarget = 'due';
                this.openCalendar();
            });

            // Close on overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.closeCalendar();
            });

            this.popup.addEventListener('click', (e) => e.stopPropagation());

            document.getElementById('taskPrevMonthBtn').addEventListener('click', () => {
                this.currentMonth--;
                if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
                this.updateCalendar();
            });

            document.getElementById('taskNextMonthBtn').addEventListener('click', () => {
                this.currentMonth++;
                if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
                this.updateCalendar();
            });

            this.monthSelect.addEventListener('change', (e) => {
                this.currentMonth = parseInt(e.target.value);
                this.updateCalendar();
            });

            document.getElementById('taskTodayBtn').addEventListener('click', () => {
                const today = new Date();
                this.selectDate(today.getDate(), today.getMonth(), today.getFullYear());
            });

            document.getElementById('taskClearBtn').addEventListener('click', () => {
                this.clearDate();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                    this.closeCalendar();
                }
            });

            this.updateCalendar();
        }

        openCalendar() {
            // Set current month/year to selected date if exists
            const current = this.activeTarget === 'start' ? this.startDate : this.dueDate;
            if (current) {
                this.currentMonth = current.getMonth();
                this.currentYear = current.getFullYear();
            }
            this.updateCalendar();
            this.overlay.classList.add('active');
        }

        closeCalendar() {
            this.overlay.classList.remove('active');
            this.activeTarget = null;
        }

        updateCalendar() {
            this.monthSelect.value = this.currentMonth;
            this.yearDisplay.textContent = this.currentYear;
            this.calendarDays.innerHTML = '';

            const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
            const lastDate = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            const prevLastDate = new Date(this.currentYear, this.currentMonth, 0).getDate();
            const today = new Date();

            const selectedDate = this.activeTarget === 'start' ? this.startDate : this.dueDate;

            for (let i = firstDay; i > 0; i--) {
                this.calendarDays.appendChild(this.createDay(prevLastDate - i + 1, this.currentMonth - 1, this.currentYear, true, selectedDate, today));
            }
            for (let i = 1; i <= lastDate; i++) {
                this.calendarDays.appendChild(this.createDay(i, this.currentMonth, this.currentYear, false, selectedDate, today));
            }
            const total = this.calendarDays.children.length;
            for (let i = 1; i <= 42 - total; i++) {
                this.calendarDays.appendChild(this.createDay(i, this.currentMonth + 1, this.currentYear, true, selectedDate, today));
            }
        }

        createDay(day, month, year, isOther, selectedDate, today) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = day;
            if (isOther) div.classList.add('other-month');

            let actualMonth = month, actualYear = year;
            if (month < 0) { actualMonth = 11; actualYear = year - 1; }
            else if (month > 11) { actualMonth = 0; actualYear = year + 1; }

            if (day === today.getDate() && actualMonth === today.getMonth() && actualYear === today.getFullYear()) {
                div.classList.add('today');
            }
            if (selectedDate && day === selectedDate.getDate() && actualMonth === selectedDate.getMonth() && actualYear === selectedDate.getFullYear()) {
                div.classList.add('selected');
            }

            div.addEventListener('click', () => this.selectDate(day, actualMonth, actualYear));
            return div;
        }

        selectDate(day, month, year) {
            const date = new Date(year, month, day);
            const dd = String(day).padStart(2, '0');
            const mm = String(month + 1).padStart(2, '0');
            const formatted = `${dd}/${mm}/${year}`;
        
            if (this.activeTarget === 'start') {
                this.startDate = date;
                activeData.start_date = date.toISOString(); // ← sync data
                const btn = document.getElementById('startDateBtn');
                const text = document.getElementById('startDateText');
                text.textContent = formatted;
                text.classList.remove('placeholder');
                btn.classList.add('has-date');
            } else {
                this.dueDate = date;
                activeData.due_date = date.toISOString(); // ← sync data
                const btn = document.getElementById('dueDateBtn');
                const text = document.getElementById('dueDateText');
                const item = document.querySelector(`.task[data-id="${activeData.id}"]`);
                item.querySelector('.task-deadline span').innerHTML = `Due: ${formatted}`;
                text.textContent = formatted;
                text.classList.remove('placeholder');
                btn.classList.add('has-date');
            }
        
            // Tính lại progress sau khi đổi ngày
            const start = this.startDate;
            const due = this.dueDate;
            const now = new Date();
            let progress = 0;
        
            if (start && due) {
                if (now < start) progress = 0;
                else if (now > due) progress = 100;
                else progress = Math.round(((now - start) / (due - start)) * 100);
            }
        
            // Cập nhật progress trên task card
            if (activeItem) {
                const fill = activeItem.querySelector('.progress-bar-fill');
                const percent = activeItem.querySelector('.progress-percent');
                if (fill) fill.style.width = `${progress}%`;
                if (percent) percent.textContent = `${progress}%`;
            }
        
            // Cập nhật progress trên panel detail
            const panel = document.querySelector('.task-detail-panel');
            if (panel) {
                const fill = panel.querySelector('.progress-bar-fill');
                const percent = panel.querySelector('.progress-percent');
                if (fill) fill.style.width = `${progress}%`;
                if (percent) percent.textContent = `${progress}%`;
            }
        
            this.closeCalendar();
        }

        clearDate() {
            if (this.activeTarget === 'start') {
                this.startDate = null;
                const text = document.getElementById('startDateText');
                text.textContent = 'Set date';
                text.classList.add('placeholder');
                document.getElementById('startDateBtn').classList.remove('has-date');
            } else {
                this.dueDate = null;
                const text = document.getElementById('dueDateText');
                text.textContent = 'Set date';
                text.classList.add('placeholder');
                document.getElementById('dueDateBtn').classList.remove('has-date');
            }
            this.closeCalendar();
        }
    }

    // Khởi tạo
    const taskDatePicker = new TaskDatePicker();

    // ========== NOTES ==========
    const notesTextarea = document.querySelector('.notes-textarea');
    let notesDebounceTimer = null;

    if (notesTextarea) {
        notesTextarea.addEventListener('input', function () {
            const newNotes = notesTextarea.value;

            // Cập nhật UI ngay
            activeData.notes = newNotes;

            // Chỉ delay phần gửi backend
            clearTimeout(notesDebounceTimer);
            notesDebounceTimer = setTimeout(() => {
                if (Config.TEST) return;
                Config.fetchWithAuth(`${Config.URL_API}/project/${projectId}/items/${activeData.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ notes: newNotes })
                }).catch(() => Config.showWarning("Unable to save notes"));
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

            if (Config.TEST) {
                activeItem.remove();
                if (container.querySelectorAll('.task').length === 0) 
                    showEmptyState('noTask');
                if (panel) panel.classList.remove('active');
                return;
            }

            try {
                const response = await Config.fetchWithAuth(
                    `${Config.URL_API}/project/${projectId}/items/${activeData.id}`, 
                    { method: 'DELETE' }
                );

                if (response.ok) {
                    activeItem.remove();
                    if (container.querySelectorAll('.task').length === 0) 
                        showEmptyState('noTask');
                    if (panel) panel.classList.remove('active');
                } else Config.showWarning('Error while deleting task');
            } catch (err) {
                Config.showWarning('Error while deleting task');
            }
        });
    }

    // ========== DRAG & DROP ==========
    let reorderDebounceTimer = null;
    
    function sendReorder() {
        clearTimeout(reorderDebounceTimer);
        reorderDebounceTimer = setTimeout(async () => {
            if (Config.TEST) return;
            const tasks = [...taskList.querySelectorAll('.task')];
            const body = tasks.map((el, index) => ({
                id: parseInt(el.dataset.id),
                position: index + 1
            }));
        
    Config.fetchWithAuth(`${Config.URL_API}/project/${projectId}/items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            console.error('[REORDER]', res.status, err);
        }
    }).catch(() => Config.showWarning("Unable to update location"));
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
});
