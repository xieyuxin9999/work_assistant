/**
 * Checklist Module — 上班物品检查
 */
window.Modules = window.Modules || {};
window.Modules.Checklist = {
  render() {
    const data = this._getData();
    const items = data.items || [];
    const checkedCount = items.filter(i => i.checked).length;
    const allChecked = items.length > 0 && checkedCount === items.length;

    // 按分类分组
    const categories = {};
    items.forEach(item => {
      const cat = item.category || '其他';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    });

    return `
      <div class="page-header">
        <div>
          <div class="page-title">上班物品检查</div>
          <div class="page-subtitle">${checkedCount}/${items.length} 已检查 ${allChecked?'✅ 全部带齐！':''}</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary" id="checklist-reset">↻ 重置</button>
          <button class="btn btn-primary" id="checklist-add">+ 添加物品</button>
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎒</div>
          <div class="empty-state-text">还没有检查项目，点击「添加物品」开始</div>
        </div>
      ` : ''}

      ${Object.entries(categories).map(([cat, catItems]) => `
        <div class="card mb-16">
          <div class="card-header">
            <div class="card-title">${this._escape(cat)}</div>
            <span class="text-muted" style="font-size:13px">
              ${catItems.filter(i=>i.checked).length}/${catItems.length}
            </span>
          </div>
          ${catItems.map(item => `
            <div class="list-item ${item.checked?'completed':''}" data-id="${item.id}">
              <div class="checkbox ${item.checked?'checked':''}" data-action="toggle" data-id="${item.id}"></div>
              <span class="list-item-text flex-1">${this._escape(item.name)}</span>
              <button class="btn-icon" data-action="delete" data-id="${item.id}">🗑️</button>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  },

  _getData() {
    const data = Store.getChecklist();
    const today = this._todayStr();

    // 每日重置
    if (data.lastResetDate !== today) {
      if (data.items) {
        data.items.forEach(item => item.checked = false);
      }
      data.lastResetDate = today;
      data.updatedAt = Date.now();
      Store.setChecklist(data);
    }

    // 首次使用，初始化默认物品
    if (!data.items || data.items.length === 0) {
      data.items = [
        { id: '1', name: '工牌', category: '必带', checked: false },
        { id: '2', name: '钥匙', category: '必带', checked: false },
        { id: '3', name: '手机', category: '必带', checked: false },
        { id: '4', name: '充电器', category: '必带', checked: false },
        { id: '5', name: '水杯', category: '选带', checked: false },
        { id: '6', name: '雨伞', category: '选带', checked: false },
      ];
      data.updatedAt = Date.now();
      Store.setChecklist(data);
    }

    return data;
  },

  init() {
    // 添加
    const addBtn = document.getElementById('checklist-add');
    if (addBtn) addBtn.addEventListener('click', () => this._showAdd());

    // 重置
    const resetBtn = document.getElementById('checklist-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (!confirm('确定重置所有勾选吗？')) return;
      const data = Store.getChecklist();
      data.items.forEach(i => i.checked = false);
      data.updatedAt = Date.now();
      Store.setChecklist(data);
      this._refresh();
      App.toast('已重置');
    });

    // 列表操作
    document.querySelectorAll('[data-id]').forEach(el => {
      if (el.tagName === 'DIV' && el.classList.contains('list-item')) {
        el.addEventListener('click', e => {
          const target = e.target.closest('[data-action]');
          if (!target) return;
          const action = target.dataset.action;
          const id = target.dataset.id;
          if (action === 'toggle') this._toggle(id);
          else if (action === 'delete') this._delete(id);
        });
      }
    });
  },

  _toggle(id) {
    const data = Store.getChecklist();
    const item = data.items.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      data.updatedAt = Date.now();
      Store.setChecklist(data);
      this._refresh();
      if (data.items.every(i => i.checked)) {
        App.toast('全部带齐！🎉');
      }
    }
  },

  _delete(id) {
    if (!confirm('确定删除这个物品吗？')) return;
    const data = Store.getChecklist();
    data.items = data.items.filter(i => i.id !== id);
    data.updatedAt = Date.now();
    Store.setChecklist(data);
    this._refresh();
    App.toast('已删除');
  },

  _showAdd() {
    App.openModal({
      title: '添加物品',
      body: `
        <div class="form-group">
          <label class="form-label">物品名称</label>
          <input type="text" class="form-input" id="item-name" placeholder="如：笔记本电脑" maxlength="20">
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <input type="text" class="form-input" id="item-category" placeholder="如：必带、选带" value="必带" list="category-list">
          <datalist id="category-list">
            <option value="必带">
            <option value="选带">
          </datalist>
        </div>
      `,
      onConfirm: () => {
        const name = document.getElementById('item-name').value.trim();
        const category = document.getElementById('item-category').value.trim() || '其他';
        if (!name) { App.toast('请输入物品名称'); return; }
        const data = Store.getChecklist();
        data.items.push({
          id: Date.now().toString(),
          name,
          category,
          checked: false,
        });
        data.updatedAt = Date.now();
        Store.setChecklist(data);
        this._refresh();
        App.closeModal();
        App.toast('已添加');
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

  _escape(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
