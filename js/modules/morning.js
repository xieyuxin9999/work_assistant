/**
 * Morning Module — 上班准备（天气 + 物品检查合并）
 */
window.Modules = window.Modules || {};
window.Modules.Morning = {
  async render() {
    const settings = Store.getSettings();
    const weather = await Modules.Weather._getWeather(settings);
    const checklist = Modules.Checklist._getData();
    const items = checklist.items || [];
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
          <div class="page-title">🌞 上班准备</div>
          <div class="page-subtitle">${settings.city || '未设置城市'} · ${checkedCount}/${items.length} 物品已检查</div>
        </div>
        <button class="btn btn-secondary" id="morning-refresh">↻ 刷新天气</button>
      </div>

      <!-- 天气区域 -->
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title">🌤️ 今日天气</div>
        </div>
        ${weather ? Modules.Weather._renderWeather(weather, settings) : `
          <div class="text-center text-muted py-16">
            无法获取天气数据，请检查网络
          </div>
        `}
      </div>

      <!-- 城市管理（折叠） -->
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title">🏙️ 城市管理</div>
        </div>
        <div class="flex gap-8 mb-16">
          <input type="text" class="form-input" id="city-input" placeholder="搜索城市名（如：北京、上海）">
          <button class="btn btn-primary" id="city-search-btn">搜索</button>
        </div>
        <div id="city-results"></div>
        <div class="divider"></div>
        <div class="text-secondary mb-8" style="font-size:13px">当前城市</div>
        <div class="list-item">
          <span style="font-size:24px">📍</span>
          <span class="flex-1" style="font-weight:500">${settings.city || '未设置'}</span>
          ${settings.city ? `<button class="btn-text" id="city-reset">重置为北京</button>` : ''}
        </div>
      </div>

      <!-- 检查单区域 -->
      <div class="page-header" style="margin-top:8px">
        <div>
          <div class="page-title" style="font-size:18px">🎒 上班物品</div>
          <div class="page-subtitle">${allChecked ? '✅ 全部带齐！' : '继续检查...'}</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" id="checklist-reset">↻ 重置</button>
          <button class="btn btn-primary btn-sm" id="checklist-add">+ 添加</button>
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎒</div>
          <div class="empty-state-text">还没有检查项目，点击「添加」开始</div>
        </div>
      ` : `
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
      `}
    `;
  },

  async init() {
    // 天气刷新
    const refreshBtn = document.getElementById('morning-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
      const settings = Store.getSettings();
      settings.weatherCache = null;
      settings.weatherCacheTime = 0;
      Store.setSettings(settings);
      await this._reload();
      App.toast('天气已刷新');
    });

    // 城市搜索
    const searchBtn = document.getElementById('city-search-btn');
    const cityInput = document.getElementById('city-input');
    const resultsDiv = document.getElementById('city-results');

    const doSearch = async () => {
      const name = cityInput.value.trim();
      if (!name) return;
      resultsDiv.innerHTML = '<div class="text-muted text-center mt-8">搜索中...</div>';
      const results = await Modules.Weather._searchCity(name);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="text-muted text-center mt-8">未找到城市</div>';
        return;
      }
      resultsDiv.innerHTML = results.map(r => `
        <div class="list-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}${r.admin1?', '+r.admin1:''}">
          <span>📍</span>
          <span class="flex-1">${r.name}${r.admin1?', '+r.admin1:''}${r.country?', '+r.country:''}</span>
          <button class="btn-text">选择</button>
        </div>
      `).join('');

      resultsDiv.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', async () => {
          const settings = Store.getSettings();
          settings.city = el.dataset.name;
          settings.cityLat = parseFloat(el.dataset.lat);
          settings.cityLon = parseFloat(el.dataset.lon);
          settings.weatherCache = null;
          settings.weatherCacheTime = 0;
          Store.setSettings(settings);
          await this._reload();
          App.toast('已切换城市');
        });
      });
    };

    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (cityInput) cityInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });

    const resetCityBtn = document.getElementById('city-reset');
    if (resetCityBtn) resetCityBtn.addEventListener('click', async () => {
      const settings = Store.getSettings();
      settings.city = '北京';
      settings.cityLat = 39.9042;
      settings.cityLon = 116.4074;
      settings.weatherCache = null;
      settings.weatherCacheTime = 0;
      Store.setSettings(settings);
      await this._reload();
      App.toast('已重置');
    });

    // 检查单操作
    const checklistReset = document.getElementById('checklist-reset');
    if (checklistReset) checklistReset.addEventListener('click', () => {
      if (!confirm('确定重置所有勾选吗？')) return;
      const data = Store.getChecklist();
      data.items.forEach(i => i.checked = false);
      data.updatedAt = Date.now();
      Store.setChecklist(data);
      this._reload();
      App.toast('已重置');
    });

    const checklistAdd = document.getElementById('checklist-add');
    if (checklistAdd) checklistAdd.addEventListener('click', () => this._showAdd());

    document.querySelectorAll('.list-item[data-id]').forEach(el => {
      el.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === 'toggle') this._toggleItem(id);
        else if (action === 'delete') this._deleteItem(id);
      });
    });
  },

  _toggleItem(id) {
    const data = Store.getChecklist();
    const item = data.items.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      data.updatedAt = Date.now();
      Store.setChecklist(data);
      this._reload();
      if (data.items.every(i => i.checked)) {
        App.toast('全部带齐！🎉');
      }
    }
  },

  _deleteItem(id) {
    if (!confirm('确定删除这个物品吗？')) return;
    const data = Store.getChecklist();
    data.items = data.items.filter(i => i.id !== id);
    data.updatedAt = Date.now();
    Store.setChecklist(data);
    this._reload();
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
        App.closeModal();
        this._reload();
        App.toast('已添加');
      }
    });
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
