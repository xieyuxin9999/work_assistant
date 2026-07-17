/**
 * Notes Module — 工作笔记（Markdown）
 */
window.Modules = window.Modules || {};
window.Modules.Notes = {
  notes: [],
  currentNoteId: null,
  searchKeyword: '',
  editMode: false,

  async render() {
    this.notes = (await DB.getAll('notes')).filter(n => !n.deleted);
    this._sortNotes();

    return `
      <div class="page-header">
        <div>
          <div class="page-title">工作笔记</div>
          <div class="page-subtitle">${this.notes.length} 篇笔记</div>
        </div>
        <button class="btn btn-primary" id="note-new">+ 新建笔记</button>
      </div>

      ${this.notes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">还没有笔记，点击「新建笔记」开始记录</div>
        </div>
      ` : `
        <div class="split-panel">
          <div class="split-panel-left">
            <div class="search-box mb-8">
              <input type="text" id="note-search" placeholder="搜索笔记..." value="${this.searchKeyword}">
            </div>
            <div id="note-list">
              ${this._renderList()}
            </div>
          </div>
          <div class="split-panel-right" id="note-editor">
            ${this.currentNoteId ? await this._renderEditor() : `
              <div class="empty-state" style="padding-top:80px">
                <div class="empty-state-icon">👈</div>
                <div class="empty-state-text">选择左侧笔记查看，或点击「新建笔记」</div>
              </div>
            `}
          </div>
        </div>
      `}
    `;
  },

  _renderList() {
    let notes = this.notes;
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      notes = notes.filter(n =>
        (n.title||'').toLowerCase().includes(kw) ||
        (n.content||'').toLowerCase().includes(kw) ||
        (n.tags||[]).some(t => t.toLowerCase().includes(kw))
      );
    }

    if (notes.length === 0) {
      return '<div class="text-muted text-center mt-16" style="font-size:13px">未找到笔记</div>';
    }

    return notes.map(n => `
      <div class="note-list-item ${n.id===this.currentNoteId?'active':''}" data-id="${n.id}">
        <div class="note-list-item-title">
          ${n.pinned?'📌 ':''}${this._escape(n.title || '无标题')}
        </div>
        <div class="note-list-item-date">${this._formatDate(n.updatedAt || n.createdAt)}</div>
        ${n.tags && n.tags.length ? `<div class="flex gap-8 mt-8" style="flex-wrap:wrap">${n.tags.map(t=>`<span class="tag" style="font-size:11px">${this._escape(t)}</span>`).join('')}</div>` : ''}
      </div>
    `).join('');
  },

  async _renderEditor() {
    const note = this.notes.find(n => n.id === this.currentNoteId);
    if (!note) return '<div class="text-muted">笔记不存在</div>';

    if (this.editMode) {
      return `
        <div class="flex items-center justify-between mb-16">
          <input type="text" class="form-input form-input-lg" id="note-title-input"
                 value="${this._escape(note.title||'')}" placeholder="笔记标题" style="flex:1;margin-right:12px">
          <div class="flex gap-8">
            <button class="btn btn-secondary" id="note-toggle-preview">预览</button>
            <button class="btn btn-primary" id="note-save">保存</button>
            <button class="btn-icon" id="note-pin" title="${note.pinned?'取消置顶':'置顶'}">${note.pinned?'📌':'📍'}</button>
            <button class="btn-icon" id="note-delete" title="删除">🗑️</button>
          </div>
        </div>
        <div class="form-group">
          <input type="text" class="form-input" id="note-tags-input"
                 value="${(note.tags||[]).join(', ')}" placeholder="标签（逗号分隔）">
        </div>
        <textarea class="form-textarea" id="note-content-input" placeholder="支持 Markdown 语法..."
                  style="min-height:calc(100vh - 280px);font-family:'SF Mono',Monaco,monospace;font-size:14px;line-height:1.7">${this._escape(note.content||'')}</textarea>
      `;
    } else {
      const html = note.content ? marked.parse(note.content) : '<p class="text-muted">暂无内容</p>';
      return `
        <div class="flex items-center justify-between mb-16">
          <h2 style="font-size:22px;font-weight:700;flex:1">${this._escape(note.title || '无标题')}</h2>
          <div class="flex gap-8">
            <button class="btn btn-primary" id="note-edit">编辑</button>
            <button class="btn btn-secondary" id="note-save-preview">保存</button>
            <button class="btn-icon" id="note-pin" title="${note.pinned?'取消置顶':'置顶'}">${note.pinned?'📌':'📍'}</button>
            <button class="btn-icon" id="note-delete" title="删除">🗑️</button>
          </div>
        </div>
        ${(note.tags && note.tags.length) ? `<div class="flex gap-8 mb-16" style="flex-wrap:wrap">${note.tags.map(t=>`<span class="tag">${this._escape(t)}</span>`).join('')}</div>` : ''}
        <div class="text-muted mb-16" style="font-size:12px">
          创建于 ${this._formatDate(note.createdAt)} · 更新于 ${this._formatDate(note.updatedAt || note.createdAt)}
        </div>
        <div class="md-preview">${html}</div>
      `;
    }
  },

  async init() {
    const newBtn = document.getElementById('note-new');
    if (newBtn) newBtn.addEventListener('click', () => this._newNote());

    const search = document.getElementById('note-search');
    if (search) {
      search.addEventListener('input', () => {
        this.searchKeyword = search.value;
        const list = document.getElementById('note-list');
        if (list) list.innerHTML = this._renderList();
        this._bindListEvents();
      });
    }

    this._bindListEvents();
    this._bindEditorEvents();
  },

  _bindListEvents() {
    document.querySelectorAll('.note-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        this.currentNoteId = item.dataset.id;
        this.editMode = false;
        await this._refreshEditor();
        // 更新列表高亮
        document.querySelectorAll('.note-list-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
    });
  },

  _bindEditorEvents() {
    const editBtn = document.getElementById('note-edit');
    if (editBtn) editBtn.addEventListener('click', async () => {
      this.editMode = true;
      await this._refreshEditor();
    });

    const toggleBtn = document.getElementById('note-toggle-preview');
    if (toggleBtn) toggleBtn.addEventListener('click', async () => {
      // 先保存，再切到预览
      await this._saveCurrent();
      this.editMode = false;
      await this._refreshEditor();
    });

    const saveBtn = document.getElementById('note-save');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      await this._saveCurrent();
      this.editMode = false;
      await this._refreshEditor();
      App.toast('已保存');
    });

    const savePreviewBtn = document.getElementById('note-save-preview');
    if (savePreviewBtn) savePreviewBtn.addEventListener('click', async () => {
      await this._saveCurrent();
      App.toast('已保存');
      Sync.autoSync();
    });

    const pinBtn = document.getElementById('note-pin');
    if (pinBtn) pinBtn.addEventListener('click', async () => {
      const note = this.notes.find(n => n.id === this.currentNoteId);
      if (!note) return;
      note.pinned = !note.pinned;
      await DB.put('notes', note);
      await this._reload();
      App.toast(note.pinned ? '已置顶' : '已取消置顶');
    });

    const delBtn = document.getElementById('note-delete');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm('确定删除这篇笔记吗？')) return;
      const note = this.notes.find(n => n.id === this.currentNoteId);
      if (note) {
        note.deleted = true;
        note.deletedAt = Date.now();
        note.updatedAt = Date.now();
        await DB.put('notes', note);
      }
      this.currentNoteId = null;
      this.editMode = false;
      await this._reload();
      App.toast('已移至垃圾箱');
    });
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
    await DB.add('notes', note);
    this.currentNoteId = note.id;
    this.editMode = true;
    await this._reload();
    // 聚焦标题输入框
    setTimeout(() => {
      const titleInput = document.getElementById('note-title-input');
      if (titleInput) titleInput.focus();
    }, 100);
  },

  async _saveCurrent() {
    const note = this.notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    const titleInput = document.getElementById('note-title-input');
    const contentInput = document.getElementById('note-content-input');
    const tagsInput = document.getElementById('note-tags-input');
    if (titleInput) note.title = titleInput.value.trim();
    if (contentInput) note.content = contentInput.value;
    if (tagsInput) {
      note.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    }
    note.updatedAt = Date.now();
    await DB.put('notes', note);
  },

  async _refreshEditor() {
    const editor = document.getElementById('note-editor');
    if (editor) {
      editor.innerHTML = await this._renderEditor();
      this._bindEditorEvents();
    }
  },

  async _reload() {
    this.notes = (await DB.getAll('notes')).filter(n => !n.deleted);
    this._sortNotes();
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _sortNotes() {
    this.notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  },

  _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff/60) + '分钟前';
    if (diff < 86400) return Math.floor(diff/3600) + '小时前';
    if (diff < 86400*7) return Math.floor(diff/86400) + '天前';
    return `${d.getMonth()+1}月${d.getDate()}日`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
