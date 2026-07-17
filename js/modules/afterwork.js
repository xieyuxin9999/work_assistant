/**
 * Afterwork Module — 下班生活（待办 + 笔记）
 */
window.Modules = window.Modules || {};
window.Modules.Afterwork = {
  todos: [],
  notes: [],
  currentNoteId: null,
  editMode: false,

  async render() {
    this.todos = Store.getAfterworkTodos().filter(t => !t.deleted);
    this.notes = (await DB.getAll('afterworkNotes')).filter(n => !n.deleted);
    this.notes.sort((a, b) => b.updatedAt - a.updatedAt);

    const activeTodos = this.todos.filter(t => !t.completed);
    const doneTodos = this.todos.filter(t => t.completed);

    return `
      <div class="page-header">
        <div>
          <div class="page-title">🌙 下班生活</div>
          <div class="page-subtitle">兴趣爱好 · 副业 · 杂事</div>
        </div>
      </div>

      <div class="afterwork-panel">
        <!-- 左侧：生活待办 -->
        <div class="afterwork-todos">
          <div class="card">
            <div class="card-header">
              <div class="card-title">📋 生活待办</div>
              <button class="btn btn-primary btn-sm" id="afterwork-todo-add">+ 新建</button>
            </div>
            <div class="flex gap-8 mb-12">
              <input type="text" class="form-input" id="afterwork-todo-input" placeholder="输入待办，回车添加..." maxlength="50">
            </div>
            ${activeTodos.length === 0 && doneTodos.length === 0 ? `
              <div class="text-center text-muted py-16" style="font-size:13px">
                还没有待办，享受生活吧 🎉
              </div>
            ` : ''}
            ${activeTodos.map(t => this._renderTodo(t)).join('')}
            ${doneTodos.length > 0 ? `
              <div class="divider"></div>
              <div class="text-muted mb-8" style="font-size:12px">已完成 (${doneTodos.length})</div>
              ${doneTodos.map(t => this._renderTodo(t)).join('')}
            ` : ''}
          </div>
        </div>

        <!-- 右侧：生活笔记 -->
        <div class="afterwork-notes">
          ${this.currentNoteId ? await this._renderEditor() : this._renderNoteList()}
        </div>
      </div>
    `;
  },

  _renderTodo(t) {
    const priorityColors = { high: '#e74c3c', medium: '#f39c12', low: '#27ae60' };
    return `
      <div class="list-item ${t.completed?'completed':''}" data-id="${t.id}">
        <div class="checkbox ${t.completed?'checked':''}" data-action="toggle-todo" data-id="${t.id}"></div>
        ${t.priority ? `<span style="width:8px;height:8px;border-radius:50%;background:${priorityColors[t.priority]||'#ccc'};flex-shrink:0"></span>` : ''}
        <span class="flex-1">${this._escape(t.title)}</span>
        <button class="btn-icon" data-action="delete-todo" data-id="${t.id}" title="删除">🗑️</button>
      </div>
    `;
  },

  _renderNoteList() {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📝 生活笔记</div>
          <button class="btn btn-primary btn-sm" id="afterwork-note-new">+ 新建</button>
        </div>
        <div class="flex gap-8 mb-12">
          <input type="text" class="form-input" id="afterwork-note-quick-input" placeholder="快速记录，回车新建..." maxlength="50">
        </div>
        ${this.notes.length === 0 ? `
          <div class="text-center text-muted py-16" style="font-size:13px">
            还没有笔记，记录你的灵感吧
          </div>
        ` : `
          ${this.notes.map(n => `
            <div class="list-item card-hover" data-action="open-note" data-id="${n.id}" style="cursor:pointer">
              <div class="flex-1">
                <div style="font-weight:500">${this._escape(n.title || '无标题')}</div>
                <div class="text-muted" style="font-size:12px">
                  ${(n.content || '').slice(0, 50)}${n.content && n.content.length > 50 ? '...' : ''}
                </div>
              </div>
              <span class="text-muted" style="font-size:12px">${this._formatDate(n.updatedAt)}</span>
            </div>
          `).join('')}
        `}
      </div>
    `;
  },

  async _renderEditor() {
    const note = this.notes.find(n => n.id === this.currentNoteId);
    if (!note) {
      this.currentNoteId = null;
      return this._renderNoteList();
    }

    return `
      <div class="card">
        <div class="card-header">
          <input type="text" class="form-input" id="note-title" value="${this._escape(note.title || '')}" placeholder="笔记标题" style="flex:1;border:none;font-size:16px;font-weight:600;background:transparent">
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" id="note-back">← 返回</button>
            <button class="btn-icon" id="note-delete" title="删除">🗑️</button>
          </div>
        </div>
        <textarea class="form-textarea" id="note-content" placeholder="写点什么..." style="min-height:calc(100vh - 320px)">${this._escape(note.content || '')}</textarea>
      </div>
    `;
  },

  async init() {
    // 待办输入
    const todoInput = document.getElementById('afterwork-todo-input');
    if (todoInput) {
      todoInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') this._addTodo();
      });
    }

    // 新建待办按钮
    const addBtn = document.getElementById('afterwork-todo-add');
    if (addBtn) addBtn.addEventListener('click', () => this._addTodo());

    // 待办操作
    document.querySelectorAll('[data-action="toggle-todo"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._toggleTodo(el.dataset.id);
      });
    });
    document.querySelectorAll('[data-action="delete-todo"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._deleteTodo(el.dataset.id);
      });
    });

    // 笔记列表
    document.querySelectorAll('[data-action="open-note"]').forEach(el => {
      el.addEventListener('click', () => {
        this.currentNoteId = el.dataset.id;
        this._reload();
      });
    });

    // 新建笔记
    const newNoteBtn = document.getElementById('afterwork-note-new');
    if (newNoteBtn) newNoteBtn.addEventListener('click', () => this._newNote());

    // 快速新建笔记（回车）
    const quickInput = document.getElementById('afterwork-note-quick-input');
    if (quickInput) {
      quickInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') this._quickNewNote();
      });
    }

    // 编辑器
    const backBtn = document.getElementById('note-back');
    if (backBtn) backBtn.addEventListener('click', () => this._saveAndBack());

    const deleteBtn = document.getElementById('note-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteNote());

    // 自动保存
    const contentEl = document.getElementById('note-content');
    if (contentEl) {
      let saveTimer;
      contentEl.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => this._saveNote(), 1000);
      });
    }
    const titleEl = document.getElementById('note-title');
    if (titleEl) {
      titleEl.addEventListener('input', () => {
        clearTimeout(this._titleTimer);
        this._titleTimer = setTimeout(() => this._saveNote(), 500);
      });
    }
  },

  _addTodo() {
    const input = document.getElementById('afterwork-todo-input');
    const title = input.value.trim();
    if (!title) return;
    const todos = Store.getAfterworkTodos();
    todos.push({
      id: Date.now().toString(),
      title,
      completed: false,
      priority: 'medium',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    Store.setAfterworkTodos(todos);
    this._reload();
  },

  _toggleTodo(id) {
    const todos = Store.getAfterworkTodos();
    const t = todos.find(i => i.id === id);
    if (t) {
      t.completed = !t.completed;
      t.updatedAt = Date.now();
      Store.setAfterworkTodos(todos);
      this._reload();
    }
  },

  _deleteTodo(id) {
    const todos = Store.getAfterworkTodos();
    const t = todos.find(i => i.id === id);
    if (t) {
      t.deleted = true;
      t.deletedAt = Date.now();
      t.updatedAt = Date.now();
      Store.setAfterworkTodos(todos);
      this._reload();
      App.toast('已删除');
    }
  },

  async _newNote() {
    const note = {
      id: Date.now().toString(),
      title: '',
      content: '',
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await DB.put('afterworkNotes', note);
    this.currentNoteId = note.id;
    this._reload();
  },

  async _quickNewNote() {
    const input = document.getElementById('afterwork-note-quick-input');
    const title = input.value.trim();
    if (!title) return;
    const note = {
      id: Date.now().toString(),
      title,
      content: '',
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await DB.put('afterworkNotes', note);
    this._reload();
    App.toast('已添加');
  },

  async _saveNote() {
    const note = this.notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    const titleEl = document.getElementById('note-title');
    const contentEl = document.getElementById('note-content');
    if (titleEl) note.title = titleEl.value;
    if (contentEl) note.content = contentEl.value;
    note.updatedAt = Date.now();
    await DB.put('afterworkNotes', note);
  },

  async _saveAndBack() {
    await this._saveNote();
    this.currentNoteId = null;
    this._reload();
  },

  async _deleteNote() {
    if (!confirm('确定删除这个笔记吗？')) return;
    const note = this.notes.find(n => n.id === this.currentNoteId);
    if (note) {
      note.deleted = true;
      note.deletedAt = Date.now();
      note.updatedAt = Date.now();
      await DB.put('afterworkNotes', note);
    }
    this.currentNoteId = null;
    this._reload();
    App.toast('已删除');
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()}`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
