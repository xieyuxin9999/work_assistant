/**
 * Meetings Module — 会议记录（Markdown）
 */
window.Modules = window.Modules || {};
window.Modules.Meetings = {
  meetings: [],
  searchKeyword: '',

  async render() {
    this.meetings = (await DB.getAll('meetings')).filter(m => !m.deleted);
    this.meetings.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    let filtered = this.meetings;
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = this.meetings.filter(m =>
        (m.title||'').toLowerCase().includes(kw) ||
        (m.content||'').toLowerCase().includes(kw) ||
        (m.attendees||[]).some(a => a.toLowerCase().includes(kw))
      );
    }

    return `
      <div class="page-header">
        <div>
          <div class="page-title">会议记录</div>
          <div class="page-subtitle">${this.meetings.length} 条记录</div>
        </div>
        <button class="btn btn-primary" id="meeting-new">+ 新建记录</button>
      </div>

      <div class="search-box mb-16" style="max-width:300px">
        <input type="text" id="meeting-search" placeholder="搜索会议..." value="${this.searchKeyword}">
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-text">${this.searchKeyword ? '未找到匹配的会议记录' : '还没有会议记录'}</div>
        </div>
      ` : `
        <div id="meeting-list">
          ${filtered.map(m => this._renderCard(m)).join('')}
        </div>
      `}
    `;
  },

  _renderCard(m) {
    const html = m.content ? marked.parse(m.content) : '<p class="text-muted">暂无内容</p>';
    const actionCount = (m.actionItems || []).filter(a => !a.done).length;

    return `
      <div class="card mb-16" data-id="${m.id}">
        <div class="card-header">
          <div class="card-title">${this._escape(m.title || '无标题会议')}</div>
          <div class="flex gap-8">
            <button class="btn-icon" data-action="edit" data-id="${m.id}">✏️</button>
            <button class="btn-icon" data-action="delete" data-id="${m.id}">🗑️</button>
          </div>
        </div>
        <div class="text-muted mb-8" style="font-size:13px">
          📅 ${this._formatDate(m.date)} ${m.attendees && m.attendees.length ? `· 👥 ${this._escape(m.attendees.join('、'))}` : ''}
          ${actionCount ? `· <span class="tag tag-warning">${actionCount} 项待办</span>` : ''}
        </div>
        <div class="md-preview" style="max-height:200px;overflow:hidden;position:relative">
          ${html}
          ${html.length > 500 ? '<div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:linear-gradient(transparent,var(--surface))"></div>' : ''}
        </div>
      </div>
    `;
  },

  async init() {
    const newBtn = document.getElementById('meeting-new');
    if (newBtn) newBtn.addEventListener('click', () => this._showEditor());

    const search = document.getElementById('meeting-search');
    if (search) {
      search.addEventListener('input', async () => {
        this.searchKeyword = search.value;
        const view = document.getElementById('view');
        view.innerHTML = await this.render();
        await this.init();
      });
    }

    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'edit') await this._showEditor(id);
        else if (action === 'delete') await this._delete(id);
      });
    });
  },

  async _showEditor(id) {
    const meeting = id ? this.meetings.find(m => m.id === id) : null;
    const templates = {
      '周会': '## 本周进展\n\n- \n\n## 下周计划\n\n- \n\n## 问题与讨论\n\n- \n',
      '1v1': '## 讨论内容\n\n- \n\n## 反馈\n\n- \n\n## 下一步\n\n- \n',
      '评审': '## 评审议题\n\n- \n\n## 评审结论\n\n- \n\n## 待修改项\n\n- \n',
      '空白': '',
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    App.openModal({
      title: meeting ? '编辑会议记录' : '新建会议记录',
      large: true,
      body: `
        <div class="flex gap-12 mb-16">
          <div class="form-group flex-1">
            <label class="form-label">会议主题</label>
            <input type="text" class="form-input" id="meeting-title" value="${meeting?this._escape(meeting.title):''}" placeholder="如：项目周会">
          </div>
          <div class="form-group" style="width:160px">
            <label class="form-label">日期</label>
            <input type="date" class="form-input" id="meeting-date" value="${meeting?(meeting.date||todayStr):todayStr}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">参会人员（逗号分隔）</label>
          <input type="text" class="form-input" id="meeting-attendees"
                 value="${meeting?(meeting.attendees||[]).join(', '):''}" placeholder="如：张三, 李四">
        </div>
        <div class="form-group">
          <label class="form-label">快速模板</label>
          <div class="flex gap-8">
            ${Object.keys(templates).map(t => `<button class="btn btn-secondary btn-sm" data-template="${t}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">会议内容（Markdown）</label>
          <textarea class="form-textarea" id="meeting-content" placeholder="支持 Markdown 语法..."
                    style="min-height:300px;font-family:'SF Mono',Monaco,monospace;font-size:14px;line-height:1.7">${meeting?(meeting.content||''):''}</textarea>
        </div>
      `,
      onConfirm: async () => {
        const title = document.getElementById('meeting-title').value.trim();
        if (!title) { App.toast('请输入会议主题'); return; }
        const date = document.getElementById('meeting-date').value;
        const attendees = document.getElementById('meeting-attendees').value
          .split(',').map(s => s.trim()).filter(Boolean);
        const content = document.getElementById('meeting-content').value;

        if (meeting) {
          meeting.title = title;
          meeting.date = date;
          meeting.attendees = attendees;
          meeting.content = content;
          meeting.updatedAt = Date.now();
          await DB.put('meetings', meeting);
        } else {
          await DB.add('meetings', {
            id: Date.now().toString(),
            title, date, attendees, content,
            actionItems: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        App.closeModal();
        await this._reload();
        App.toast('已保存');
      }
    });

    // 模板按钮
    document.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = templates[btn.dataset.template];
        const textarea = document.getElementById('meeting-content');
        if (textarea.value.trim()) {
          if (!confirm('当前已有内容，确定要替换为模板吗？')) return;
        }
        textarea.value = tpl;
      });
    });
  },

  async _delete(id) {
    if (!confirm('确定删除这条会议记录吗？')) return;
    const meeting = this.meetings.find(m => m.id === id);
    if (meeting) {
      meeting.deleted = true;
      meeting.deletedAt = Date.now();
      meeting.updatedAt = Date.now();
      await DB.put('meetings', meeting);
    }
    await this._reload();
    App.toast('已移至垃圾箱');
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _formatDate(dateStr) {
    if (!dateStr) return '未设置日期';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 7) return diff + '天前';
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
