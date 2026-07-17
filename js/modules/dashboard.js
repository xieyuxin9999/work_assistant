/**
 * Dashboard Module — 仪表盘（首页）
 */
window.Modules = window.Modules || {};
window.Modules.Dashboard = {
  async render() {
    const now = new Date();
    const dateStr = this._formatFullDate(now);
    const greeting = this._greeting(now);

    // 获取各模块数据
    const todos = Store.getTodos().filter(t => !t.deleted);
    const todayStr = this._todayStr();
    const todayTodos = todos.filter(t => !t.completed && (!t.dueDate || t.dueDate <= todayStr));

    const habits = Store.getHabits().filter(h => !h.deleted);
    const habitsDone = habits.filter(h => h.logs && h.logs[todayStr]).length;

    const checklist = Modules.Checklist._getData();
    const checklistItems = checklist.items || [];
    const checklistDone = checklistItems.filter(i => i.checked).length;

    // 天气
    const settings = Store.getSettings();
    const weather = settings.weatherCache;
    let weatherHtml = '';
    if (weather && weather.current) {
      const wc = Modules.Weather.weatherCodes[weather.current.weather_code] || { desc:'', icon:'❓' };
      weatherHtml = `
        <div class="flex items-center gap-12">
          <span style="font-size:36px">${wc.icon}</span>
          <div>
            <div style="font-size:28px;font-weight:300">${Math.round(weather.current.temperature_2m)}°C</div>
            <div class="text-secondary" style="font-size:13px">${wc.desc} · ${settings.city||''}</div>
          </div>
        </div>
      `;
    } else {
      weatherHtml = `
        <div class="flex items-center gap-12">
          <span style="font-size:36px;opacity:0.5">🌤️</span>
          <div>
            <div class="text-muted">天气加载中</div>
            <button class="btn-text" id="dashboard-weather-load">点击加载</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <div>
          <div class="page-title">${greeting}，${this._getUsername()}</div>
          <div class="page-subtitle">${dateStr}</div>
        </div>
      </div>

      <!-- 天气 + 进度概览 -->
      <div class="grid grid-3 mb-24">
        <div class="card card-hover">
          <div class="text-secondary mb-8" style="font-size:13px">🌤️ 天气</div>
          ${weatherHtml}
        </div>

        <div class="card card-hover" onclick="Router.navigate('/morning')" style="cursor:pointer">
          <div class="text-secondary mb-8" style="font-size:13px">🎒 上班物品</div>
          <div class="flex items-center gap-12">
            <span style="font-size:36px">${checklistDone === checklistItems.length && checklistItems.length > 0 ? '✅' : '🎒'}</span>
            <div>
              <div style="font-size:28px;font-weight:300">${checklistDone}/${checklistItems.length}</div>
              <div class="text-secondary" style="font-size:13px">
                ${checklistDone === checklistItems.length && checklistItems.length > 0 ? '全部带齐！' : '待检查'}
              </div>
            </div>
          </div>
          <div class="progress-bar mt-16">
            <div class="progress-fill" style="width:${checklistItems.length > 0 ? (checklistDone/checklistItems.length*100) : 0}%"></div>
          </div>
        </div>

        <div class="card card-hover" onclick="Router.navigate('/habits')" style="cursor:pointer">
          <div class="text-secondary mb-8" style="font-size:13px">💪 健康打卡</div>
          <div class="flex items-center gap-12">
            <span style="font-size:36px">${habitsDone === habits.length && habits.length > 0 ? '🎉' : '💪'}</span>
            <div>
              <div style="font-size:28px;font-weight:300">${habitsDone}/${habits.length}</div>
              <div class="text-secondary" style="font-size:13px">
                ${habits.length === 0 ? '去添加习惯' : habitsDone === habits.length ? '今日完成！' : '继续加油'}
              </div>
            </div>
          </div>
          <div class="progress-bar mt-16">
            <div class="progress-fill" style="width:${habits.length > 0 ? (habitsDone/habits.length*100) : 0}%"></div>
          </div>
        </div>
      </div>

      <!-- 今日待办 -->
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title">📋 今日待办</div>
          <button class="btn-text" onclick="Router.navigate('/todo')">查看全部 →</button>
        </div>
        ${todayTodos.length === 0 ? `
          <div class="text-center text-muted py-16">
            🎉 今日无待办，轻松一下！
          </div>
        ` : `
          ${todayTodos.slice(0, 5).map(t => `
            <div class="list-item" data-todo-id="${t.id}">
              <div class="checkbox" data-action="toggle-todo" data-id="${t.id}"></div>
              <span class="priority-dot priority-${t.priority||'medium'}"></span>
              <span class="flex-1">${this._escape(t.title)}</span>
              ${t.dueDate ? `<span class="tag">${Modules.Todo._formatDate(t.dueDate)}</span>` : ''}
            </div>
          `).join('')}
          ${todayTodos.length > 5 ? `<div class="text-center text-muted mt-8" style="font-size:13px">还有 ${todayTodos.length - 5} 项...</div>` : ''}
        `}
      </div>

      <!-- 快捷操作 -->
      <div class="grid grid-4">
        <button class="card card-hover text-center" onclick="Router.navigate('/todo')">
          <div style="font-size:28px">✅</div>
          <div class="mt-8" style="font-size:14px;font-weight:500">新建待办</div>
        </button>
        <button class="card card-hover text-center" onclick="Router.navigate('/notes')">
          <div style="font-size:28px">📝</div>
          <div class="mt-8" style="font-size:14px;font-weight:500">写笔记</div>
        </button>
        <button class="card card-hover text-center" onclick="Router.navigate('/meetings')">
          <div style="font-size:28px">👥</div>
          <div class="mt-8" style="font-size:14px;font-weight:500">会议记录</div>
        </button>
        <button class="card card-hover text-center" onclick="Router.navigate('/settings')">
          <div style="font-size:28px">⚙️</div>
          <div class="mt-8" style="font-size:14px;font-weight:500">设置同步</div>
        </button>
      </div>
    `;
  },

  async init() {
    // 加载天气
    const loadBtn = document.getElementById('dashboard-weather-load');
    if (loadBtn) {
      loadBtn.addEventListener('click', async () => {
        loadBtn.textContent = '加载中...';
        const settings = Store.getSettings();
        await Modules.Weather._getWeather(settings);
        await this._reload();
      });
    }

    // 如果没有天气缓存，自动加载
    const settings = Store.getSettings();
    if (!settings.weatherCache) {
      // 延迟加载，不阻塞页面
      setTimeout(async () => {
        await Modules.Weather._getWeather(settings);
        // 只在仍在仪表盘时刷新
        if (Router.currentRoute === '/dashboard') {
          await this._reload();
        }
      }, 500);
    }

    // 仪表盘上的待办切换
    document.querySelectorAll('[data-action="toggle-todo"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const todos = Store.getTodos();
        const todo = todos.find(t => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
          todo.updatedAt = Date.now();
          Store.setTodos(todos);
          this._reload();
          if (todo.completed) App.toast('已完成 ✅');
        }
      });
    });
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _formatFullDate(d) {
    const days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
  },

  _greeting(d) {
    const h = d.getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '晚上好';
    return '夜深了';
  },

  _getUsername() {
    const config = Sync.getConfig();
    return config.username || '用户';
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
