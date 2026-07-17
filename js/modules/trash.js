/**
 * Trash Module — 垃圾箱（已删除项管理）
 */
window.Modules = window.Modules || {};
window.Modules.Trash = {
  async render() {
    const items = await this._collectTrash();

    return `
      <div class="page-header">
        <div>
          <div class="page-title">🗑️ 垃圾箱</div>
          <div class="page-subtitle">${items.length} 个已删除项目</div>
        </div>
        ${items.length > 0 ? `
          <button class="btn btn-ghost" id="trash-empty" style="color:var(--danger)">清空垃圾箱</button>
        ` : ''}
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🗑️</div>
          <div class="empty-state-text">垃圾箱是空的</div>
        </div>
      ` : `
        <div id="trash-list">
          ${items.map(item => this._renderItem(item)).join('')}
        </div>
      `}
    `;
  },

  async _collectTrash() {
    const items = [];

    // 待办事项
    const todos = Store.getTodos();
    todos.filter(t => t.deleted && !t.purged).forEach(t => {
      items.push({
        type: 'todo',
        typeLabel: '待办',
        typeIcon: '✅',
        id: t.id,
        title: t.title,
        deletedAt: t.deletedAt || t.updatedAt || 0,
      });
    });

    // 日程
    const schedules = Store.getSchedules();
    schedules.filter(s => s.deleted && !s.purged).forEach(s => {
      items.push({
        type: 'schedule',
        typeLabel: '日程',
        typeIcon: '📅',
        id: s.id,
        title: s.title,
        deletedAt: s.deletedAt || s.updatedAt || 0,
      });
    });

    // 习惯
    const habits = Store.getHabits();
    habits.filter(h => h.deleted && !h.purged).forEach(h => {
      items.push({
        type: 'habit',
        typeLabel: '习惯',
        typeIcon: '💪',
        id: h.id,
        title: h.name,
        deletedAt: h.deletedAt || h.updatedAt || 0,
      });
    });

    // 下班生活待办
    const afterworkTodos = Store.getAfterworkTodos();
    afterworkTodos.filter(t => t.deleted && !t.purged).forEach(t => {
      items.push({
        type: 'afterworkTodo',
        typeLabel: '生活待办',
        typeIcon: '🏠',
        id: t.id,
        title: t.title,
        deletedAt: t.deletedAt || t.updatedAt || 0,
      });
    });

    // 笔记
    const notes = await DB.getAll('notes');
    notes.filter(n => n.deleted && !n.purged).forEach(n => {
      items.push({
        type: 'note',
        typeLabel: '笔记',
        typeIcon: '📝',
        id: n.id,
        title: n.title || '无标题',
        deletedAt: n.deletedAt || n.updatedAt || 0,
      });
    });

    // 会议记录
    const meetings = await DB.getAll('meetings');
    meetings.filter(m => m.deleted && !m.purged).forEach(m => {
      items.push({
        type: 'meeting',
        typeLabel: '会议',
        typeIcon: '👥',
        id: m.id,
        title: m.title || '无标题',
        deletedAt: m.deletedAt || m.updatedAt || 0,
      });
    });

    // 下班生活笔记
    const afterworkNotes = await DB.getAll('afterworkNotes');
    afterworkNotes.filter(n => n.deleted && !n.purged).forEach(n => {
      items.push({
        type: 'afterworkNote',
        typeLabel: '生活笔记',
        typeIcon: '📖',
        id: n.id,
        title: n.title || '无标题',
        deletedAt: n.deletedAt || n.updatedAt || 0,
      });
    });

    // 文件
    const files = await DB.getAll('files');
    files.filter(f => f.deleted && !f.purged).forEach(f => {
      items.push({
        type: 'file',
        typeLabel: '文件',
        typeIcon: '📁',
        id: f.id,
        title: f.name || '无标题',
        deletedAt: f.deletedAt || f.updatedAt || 0,
      });
    });

    // 按删除时间倒序
    items.sort((a, b) => b.deletedAt - a.deletedAt);
    return items;
  },

  _renderItem(item) {
    return `
      <div class="card mb-12 trash-item" data-type="${item.type}" data-id="${item.id}">
        <div class="flex items-center gap-12">
          <span style="font-size:20px">${item.typeIcon}</span>
          <div class="flex-1">
            <div style="font-weight:500">${this._escape(item.title)}</div>
            <div class="text-muted" style="font-size:12px">
              <span class="tag" style="font-size:11px">${item.typeLabel}</span>
              删除于 ${this._formatDate(item.deletedAt)}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="restore" data-type="${item.type}" data-id="${item.id}">
            ↩️ 恢复
          </button>
          <button class="btn-icon" data-action="purge" data-type="${item.type}" data-id="${item.id}" title="永久删除">
            🗑️
          </button>
        </div>
      </div>
    `;
  },

  async init() {
    const emptyBtn = document.getElementById('trash-empty');
    if (emptyBtn) emptyBtn.addEventListener('click', () => this._emptyAll());

    document.querySelectorAll('.trash-item').forEach(el => {
      el.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const type = target.dataset.type;
        const id = target.dataset.id;
        if (action === 'restore') this._restore(type, id);
        else if (action === 'purge') this._purge(type, id);
      });
    });
  },

  _restore(type, id) {
    if (type === 'todo' || type === 'habit') {
      const key = type === 'todo' ? 'todos' : 'habits';
      const items = Store.get(key);
      const item = items.find(i => i.id === id);
      if (item) {
        delete item.deleted;
        delete item.deletedAt;
        item.updatedAt = Date.now();
        Store.set(key, items);
      }
    } else if (type === 'schedule') {
      const items = Store.getSchedules();
      const item = items.find(i => i.id === id);
      if (item) {
        delete item.deleted;
        delete item.deletedAt;
        item.updatedAt = Date.now();
        Store.setSchedules(items);
      }
    } else if (type === 'afterworkTodo') {
      const items = Store.getAfterworkTodos();
      const item = items.find(i => i.id === id);
      if (item) {
        delete item.deleted;
        delete item.deletedAt;
        item.updatedAt = Date.now();
        Store.setAfterworkTodos(items);
      }
    } else if (type === 'note' || type === 'meeting') {
      const store = type === 'note' ? 'notes' : 'meetings';
      DB.get(store, id).then(item => {
        if (item) {
          delete item.deleted;
          delete item.deletedAt;
          item.updatedAt = Date.now();
          DB.put(store, item);
          this._reload();
        }
      });
      App.toast('已恢复');
      return;
    } else if (type === 'afterworkNote') {
      DB.get('afterworkNotes', id).then(item => {
        if (item) {
          delete item.deleted;
          delete item.deletedAt;
          item.updatedAt = Date.now();
          DB.put('afterworkNotes', item);
          this._reload();
        }
      });
      App.toast('已恢复');
      return;
    } else if (type === 'file') {
      DB.get('files', id).then(async (item) => {
        if (!item) { this._reload(); return; }

        // 同步文件恢复：重新上传到 GitHub
        if (item.fromSync && item.content) {
          const config = Sync.getConfig();
          const fileRepo = Store.getFileRepo();
          if (config.token && fileRepo) {
            try {
              // 检查文件是否已存在（获取 sha）
              let sha = null;
              const checkResp = await fetch(
                `https://api.github.com/repos/${config.username}/${fileRepo}/contents/${encodeURIComponent(item.name)}`,
                { headers: { 'Authorization': `token ${config.token}`, 'Accept': 'application/vnd.github.v3+json' } }
              );
              if (checkResp.ok) {
                const checkData = await checkResp.json();
                sha = checkData.sha;
              }

              const uploadResp = await fetch(
                `https://api.github.com/repos/${config.username}/${fileRepo}/contents/${encodeURIComponent(item.name)}`,
                {
                  method: 'PUT',
                  headers: { 'Authorization': `token ${config.token}`, 'Accept': 'application/vnd.github.v3+json' },
                  body: JSON.stringify({ message: `restore ${item.name}`, content: item.content, ...(sha ? { sha } : {}) }),
                }
              );

              if (uploadResp.ok) {
                await DB.delete('files', id);
                App.toast('已恢复到同步仓库');
                this._reload();
                return;
              }
            } catch (e) {
              App.toast('恢复到仓库失败: ' + e.message);
            }
          }
        }

        // 普通文件恢复
        delete item.deleted;
        delete item.deletedAt;
        item.updatedAt = Date.now();
        DB.put('files', item);
        App.toast('已恢复');
        this._reload();
      });
      return;
    }
    Sync.autoSync();
    App.toast('已恢复');
    this._reload();
  },

  _purge(type, id) {
    if (!confirm('永久删除后无法恢复，确定吗？')) return;

    const now = Date.now();

    if (type === 'todo' || type === 'habit') {
      const key = type === 'todo' ? 'todos' : 'habits';
      const items = Store.get(key);
      const item = items.find(i => i.id === id);
      if (item) {
        item.purged = true;
        item.updatedAt = now;
        Store.set(key, items);
      }
    } else if (type === 'schedule') {
      const items = Store.getSchedules();
      const item = items.find(i => i.id === id);
      if (item) {
        item.purged = true;
        item.updatedAt = now;
        Store.setSchedules(items);
      }
    } else if (type === 'afterworkTodo') {
      const items = Store.getAfterworkTodos();
      const item = items.find(i => i.id === id);
      if (item) {
        item.purged = true;
        item.updatedAt = now;
        Store.setAfterworkTodos(items);
      }
    } else if (type === 'note' || type === 'meeting') {
      const store = type === 'note' ? 'notes' : 'meetings';
      DB.get(store, id).then(item => {
        if (item) {
          item.purged = true;
          item.updatedAt = now;
          DB.put(store, item);
        }
        Sync.autoSync();
        this._reload();
      });
      App.toast('已永久删除');
      return;
    } else if (type === 'afterworkNote') {
      DB.get('afterworkNotes', id).then(item => {
        if (item) {
          item.purged = true;
          item.updatedAt = now;
          DB.put('afterworkNotes', item);
        }
        Sync.autoSync();
        this._reload();
      });
      App.toast('已永久删除');
      return;
    } else if (type === 'file') {
      DB.get('files', id).then(item => {
        if (item) {
          item.purged = true;
          item.updatedAt = now;
          DB.put('files', item);
        }
        Sync.autoSync();
        this._reload();
      });
      App.toast('已永久删除');
      return;
    }
    Sync.autoSync();
    App.toast('已永久删除');
    this._reload();
  },

  _emptyAll() {
    if (!confirm('清空垃圾箱将永久删除所有已删除项，确定吗？')) return;

    const now = Date.now();

    // localStorage 项：标记 purged
    const todos = Store.getTodos();
    todos.forEach(t => { if (t.deleted && !t.purged) { t.purged = true; t.updatedAt = now; } });
    Store.setTodos(todos);

    const habits = Store.getHabits();
    habits.forEach(h => { if (h.deleted && !h.purged) { h.purged = true; h.updatedAt = now; } });
    Store.setHabits(habits);

    const schedules = Store.getSchedules();
    schedules.forEach(s => { if (s.deleted && !s.purged) { s.purged = true; s.updatedAt = now; } });
    Store.setSchedules(schedules);

    const afterworkTodos = Store.getAfterworkTodos();
    afterworkTodos.forEach(t => { if (t.deleted && !t.purged) { t.purged = true; t.updatedAt = now; } });
    Store.setAfterworkTodos(afterworkTodos);

    // IDB 项：标记 purged
    (async () => {
      const notes = await DB.getAll('notes');
      for (const n of notes) {
        if (n.deleted && !n.purged) { n.purged = true; n.updatedAt = now; await DB.put('notes', n); }
      }
      const meetings = await DB.getAll('meetings');
      for (const m of meetings) {
        if (m.deleted && !m.purged) { m.purged = true; m.updatedAt = now; await DB.put('meetings', m); }
      }
      const afterworkNotes = await DB.getAll('afterworkNotes');
      for (const n of afterworkNotes) {
        if (n.deleted && !n.purged) { n.purged = true; n.updatedAt = now; await DB.put('afterworkNotes', n); }
      }
      const files = await DB.getAll('files');
      for (const f of files) {
        if (f.deleted && !f.purged) { f.purged = true; f.updatedAt = now; await DB.put('files', f); }
      }
      await Sync.autoSync();
      App.toast('垃圾箱已清空');
      this._reload();
    })();
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
