/**
 * Todo Module — 待办事项 + 日程
 */
window.Modules = window.Modules || {};
window.Modules.Todo = {
  filter: 'all',
  searchKeyword: '',

  render() {
    const allTodos = Store.getTodos();
    const todos = allTodos.filter(t => !t.deleted);
    const filtered = this._filter(todos);

    const schedules = Store.getSchedules().filter(s => !s.deleted);

    return `
      <div class="page-header">
        <div>
          <div class="page-title">待办事项</div>
          <div class="page-subtitle">${this._stats(todos)}</div>
        </div>
      </div>

      <div class="todo-schedule-panel">
        <!-- 左侧：待办列表 -->
        <div class="todo-section">
          <div class="card mb-16">
            <div class="flex gap-8 items-center">
              <input type="text" class="form-input form-input-lg" id="todo-input"
                     placeholder="添加待办...（Enter 确认）" maxlength="200">
              <select class="form-select" id="todo-priority" style="width:auto">
                <option value="low">低</option>
                <option value="medium" selected>中</option>
                <option value="high">高</option>
              </select>
              <button class="btn btn-primary" id="todo-add-btn">添加</button>
            </div>
          </div>

          <div class="flex items-center justify-between mb-16" style="flex-wrap:wrap;gap:12px">
            <div class="filter-tabs" style="margin-bottom:0">
              <span class="filter-tab ${this.filter==='all'?'active':''}" data-filter="all">全部 (${todos.length})</span>
              <span class="filter-tab ${this.filter==='today'?'active':''}" data-filter="today">今日</span>
              <span class="filter-tab ${this.filter==='pending'?'active':''}" data-filter="pending">未完成</span>
              <span class="filter-tab ${this.filter==='completed'?'active':''}" data-filter="completed">已完成</span>
              <span class="filter-tab ${this.filter==='overdue'?'active':''}" data-filter="overdue">逾期</span>
            </div>
            <div class="search-box" style="width:160px">
              <input type="text" id="todo-search" placeholder="搜索..." value="${this.searchKeyword}">
            </div>
          </div>

          <div id="todo-list">
            ${this._renderList(filtered)}
          </div>
        </div>

        <!-- 右侧：日程 -->
        <div class="schedule-section">
          <div class="card">
            <div class="card-header">
              <div class="card-title">📅 日程</div>
            </div>
            <div class="flex gap-8 mb-12" style="flex-wrap:wrap">
              <input type="text" class="form-input" id="schedule-input" placeholder="添加日程..." maxlength="100" style="flex:1;min-width:120px">
              <input type="date" class="form-select" id="schedule-date" style="width:auto">
              <button class="btn btn-primary btn-sm" id="schedule-add">添加</button>
            </div>
            <div id="schedule-list">
              ${this._renderScheduleList(schedules)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderList(todos) {
    if (todos.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">暂无待办事项</div>
        </div>
      `;
    }

    return todos.map(t => `
      <div class="list-item ${t.completed?'completed':''}" data-id="${t.id}">
        <div class="checkbox ${t.completed?'checked':''}" data-action="toggle" data-id="${t.id}"></div>
        <span class="priority-dot priority-${t.priority||'medium'}"></span>
        <span class="list-item-text flex-1">${this._escape(t.title)}</span>
        ${t.dueDate ? `<span class="tag ${this._isOverdue(t)?'tag-danger':''}">${this._formatDate(t.dueDate)}</span>` : ''}
        <button class="btn-icon" data-action="edit" data-id="${t.id}" title="编辑">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${t.id}" title="删除">🗑️</button>
      </div>
    `).join('');
  },

  _renderScheduleList(schedules) {
    const active = schedules.filter(s => !s.completed);
    const done = schedules.filter(s => s.completed);

    // 按日期排序（有日期的在前，无日期的在后）
    active.sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.createdAt - a.createdAt;
    });

    if (active.length === 0 && done.length === 0) {
      return '<div class="text-center text-muted py-16" style="font-size:13px">还没有日程</div>';
    }

    return `
      ${active.map(s => this._renderScheduleItem(s)).join('')}
      ${done.length > 0 ? `
        <div class="divider"></div>
        <div class="text-muted mb-8" style="font-size:12px">已完成 (${done.length})</div>
        ${done.map(s => this._renderScheduleItem(s)).join('')}
      ` : ''}
    `;
  },

  _renderScheduleItem(s) {
    const today = this._todayStr();
    const isOverdue = s.dueDate && !s.completed && s.dueDate < today;
    return `
      <div class="list-item ${s.completed?'completed':''}" data-schedule-id="${s.id}">
        <div class="checkbox ${s.completed?'checked':''}" data-action="toggle-schedule" data-id="${s.id}"></div>
        <span class="flex-1" style="font-size:14px">${this._escape(s.title)}</span>
        ${s.dueDate ? `<span class="tag ${isOverdue?'tag-danger':''}">${this._formatDate(s.dueDate)}</span>` : ''}
        <button class="btn-icon" data-action="delete-schedule" data-id="${s.id}" title="删除">🗑️</button>
      </div>
    `;
  },

  _filter(todos) {
    let result = todos;
    const today = this._todayStr();

    switch (this.filter) {
      case 'today':
        result = result.filter(t => t.dueDate === today && !t.completed);
        break;
      case 'pending':
        result = result.filter(t => !t.completed);
        break;
      case 'completed':
        result = result.filter(t => t.completed);
        break;
      case 'overdue':
        result = result.filter(t => !t.completed && t.dueDate && t.dueDate < today);
        break;
    }

    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(kw));
    }

    // 排序：未完成在前，然后按优先级，最后按创建时间
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.createdAt - a.createdAt;
    });

    return result;
  },

  _stats(todos) {
    const total = todos.length;
    const done = todos.filter(t => t.completed).length;
    const today = this._todayStr();
    const todayCount = todos.filter(t => t.dueDate === today && !t.completed).length;
    return `共 ${total} 项，已完成 ${done} 项${todayCount > 0 ? `，今日待办 ${todayCount} 项` : ''}`;
  },

  init() {
    // 添加待办
    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('todo-add-btn');
    const prioritySel = document.getElementById('todo-priority');

    const addTodo = () => {
      const title = input.value.trim();
      if (!title) return;
      const todos = Store.getTodos();
      todos.push({
        id: Date.now().toString(),
        title,
        completed: false,
        priority: prioritySel.value,
        dueDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      Store.setTodos(todos);
      input.value = '';
      this._refresh();
      App.toast('已添加');
    };

    addBtn.addEventListener('click', addTodo);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') addTodo();
    });

    // 筛选
    document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.filter = tab.dataset.filter;
        this._refresh();
      });
    });

    // 搜索
    const search = document.getElementById('todo-search');
    search.addEventListener('input', () => {
      this.searchKeyword = search.value;
      this._refresh();
    });

    // 列表操作（事件委托）
    document.getElementById('todo-list').addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'toggle') this._toggle(id);
      else if (action === 'delete') this._delete(id);
      else if (action === 'edit') this._edit(id);
    });

    // 日程操作
    const schedInput = document.getElementById('schedule-input');
    const schedDate = document.getElementById('schedule-date');
    const schedAdd = document.getElementById('schedule-add');

    const addSchedule = () => {
      const title = schedInput.value.trim();
      if (!title) return;
      const schedules = Store.getSchedules();
      schedules.push({
        id: Date.now().toString(),
        title,
        dueDate: schedDate.value || null,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      Store.setSchedules(schedules);
      schedInput.value = '';
      schedDate.value = '';
      this._refresh();
      App.toast('已添加');
    };

    if (schedAdd) schedAdd.addEventListener('click', addSchedule);
    if (schedInput) schedInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') addSchedule();
    });

    // 日程列表操作
    const schedList = document.getElementById('schedule-list');
    if (schedList) {
      schedList.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === 'toggle-schedule') this._toggleSchedule(id);
        else if (action === 'delete-schedule') this._deleteSchedule(id);
      });
    }
  },

  _toggle(id) {
    const todos = Store.getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      todo.updatedAt = Date.now();
      Store.setTodos(todos);
      this._refresh();
    }
  },

  _toggleSchedule(id) {
    const schedules = Store.getSchedules();
    const s = schedules.find(i => i.id === id);
    if (s) {
      s.completed = !s.completed;
      s.updatedAt = Date.now();
      Store.setSchedules(schedules);
      Sync.autoSync();
      this._refresh();
    }
  },

  _deleteSchedule(id) {
    const schedules = Store.getSchedules();
    const s = schedules.find(i => i.id === id);
    if (s) {
      s.deleted = true;
      s.deletedAt = Date.now();
      s.updatedAt = Date.now();
      Store.setSchedules(schedules);
      Sync.autoSync();
      this._refresh();
      App.toast('已删除');
    }
  },

  _delete(id) {
    if (!confirm('确定删除这条待办吗？')) return;
    const todos = Store.getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.deleted = true;
      todo.deletedAt = Date.now();
      todo.updatedAt = Date.now();
      Store.setTodos(todos);
    }
    this._refresh();
    App.toast('已移至垃圾箱');
  },

  _edit(id) {
    const todos = Store.getTodos();
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    App.openModal({
      title: '编辑待办',
      body: `
        <div class="form-group">
          <label class="form-label">内容</label>
          <input type="text" class="form-input" id="edit-title" value="${this._escape(todo.title)}">
        </div>
        <div class="flex gap-12">
          <div class="form-group flex-1">
            <label class="form-label">优先级</label>
            <select class="form-select" id="edit-priority">
              <option value="low" ${todo.priority==='low'?'selected':''}>低</option>
              <option value="medium" ${todo.priority==='medium'?'selected':''}>中</option>
              <option value="high" ${todo.priority==='high'?'selected':''}>高</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">截止日期</label>
            <input type="date" class="form-input" id="edit-date" value="${todo.dueDate||''}">
          </div>
        </div>
      `,
      onConfirm: () => {
        const title = document.getElementById('edit-title').value.trim();
        if (!title) return;
        todo.title = title;
        todo.priority = document.getElementById('edit-priority').value;
        todo.dueDate = document.getElementById('edit-date').value || null;
        todo.updatedAt = Date.now();
        Store.setTodos(todos);
        this._refresh();
        App.closeModal();
        App.toast('已保存');
      }
    });
  },

  _refresh() {
    const view = document.getElementById('view');
    view.innerHTML = this.render();
    this.init();
  },

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _isOverdue(t) {
    if (!t.dueDate || t.completed) return false;
    return t.dueDate < this._todayStr();
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    return `${d.getMonth()+1}月${d.getDate()}日`;
  },

  _escape(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
