/**
 * Todo Module — 待办事项
 */
window.Modules = window.Modules || {};
window.Modules.Todo = {
  filter: 'all',
  searchKeyword: '',

  render() {
    const allTodos = Store.getTodos();
    const todos = allTodos.filter(t => !t.deleted);
    const filtered = this._filter(todos);

    return `
      <div class="page-header">
        <div>
          <div class="page-title">待办事项</div>
          <div class="page-subtitle">${this._stats(todos)}</div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="flex gap-8 items-center">
          <input type="text" class="form-input form-input-lg" id="todo-input"
                 placeholder="添加待办...（Enter 确认）" maxlength="200">
          <select class="form-select" id="todo-priority" style="width:auto">
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
          </select>
          <input type="date" class="form-select" id="todo-date" style="width:auto">
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
        <div class="search-box" style="width:200px">
          <input type="text" id="todo-search" placeholder="搜索..." value="${this.searchKeyword}">
        </div>
      </div>

      <div id="todo-list">
        ${this._renderList(filtered)}
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
    const dateInput = document.getElementById('todo-date');

    const addTodo = () => {
      const title = input.value.trim();
      if (!title) return;
      const todos = Store.getTodos();
      todos.push({
        id: Date.now().toString(),
        title,
        completed: false,
        priority: prioritySel.value,
        dueDate: dateInput.value || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      Store.setTodos(todos);
      input.value = '';
      dateInput.value = '';
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
