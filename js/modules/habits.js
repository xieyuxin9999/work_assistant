/**
 * Habits Module — 健康习惯打卡
 */
window.Modules = window.Modules || {};
window.Modules.Habits = {
  render() {
    const habits = Store.getHabits().filter(h => !h.deleted);
    const today = this._todayStr();

    // 初始化默认习惯
    if (habits.length === 0) {
      return `
        <div class="page-header">
          <div>
            <div class="page-title">健康打卡</div>
            <div class="page-subtitle">坚持每一个小习惯</div>
          </div>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">💪</div>
          <div class="empty-state-text">还没有打卡习惯，点击下方按钮添加</div>
        </div>
        <div class="text-center mt-24">
          <button class="btn btn-primary btn-lg" id="habit-add-first">+ 添加第一个习惯</button>
        </div>
      `;
    }

    const doneToday = habits.filter(h => h.logs && h.logs[today]).length;

    return `
      <div class="page-header">
        <div>
          <div class="page-title">健康打卡</div>
          <div class="page-subtitle">今日已完成 ${doneToday}/${habits.length} 个习惯</div>
        </div>
        <button class="btn btn-primary" id="habit-add">+ 添加习惯</button>
      </div>

      <div class="card">
        ${habits.map(h => this._renderListItem(h, today)).join('')}
      </div>
    `;
  },

  _renderListItem(habit, today) {
    const doneToday = habit.logs && habit.logs[today];
    const streak = this._calcStreak(habit.logs);
    const weekData = this._getWeekData(habit.logs);

    return `
      <div class="list-item habit-row" data-habit-id="${habit.id}" style="flex-wrap:wrap;padding:14px 16px">
        <span style="font-size:20px;flex-shrink:0">${habit.icon||'⭐'}</span>
        <div class="flex-1" style="min-width:80px">
          <div style="font-weight:500;font-size:14px">${this._escape(habit.name)}</div>
          <div class="text-muted" style="font-size:12px">
            连续 <span style="color:${streak>0?'var(--success)':'var(--text-muted)'};font-weight:600">${streak}</span> 天
          </div>
        </div>
        <div class="habit-mini-week">
          ${weekData.map(d => `
            <div class="habit-mini-cell ${d.done?'done':''} ${d.today?'today':''}" title="${d.label}">${d.dayLabel}</div>
          `).join('')}
        </div>
        <div class="flex gap-8" style="flex-shrink:0">
          <button class="btn ${doneToday?'btn-secondary':'btn-primary'} btn-sm" data-action="checkin" data-id="${habit.id}">
            ${doneToday?'✓ 取消打卡':'打卡'}
          </button>
          <button class="btn-icon" data-action="edit" data-id="${habit.id}" title="编辑">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${habit.id}" title="删除">🗑️</button>
        </div>
      </div>
    `;
  },

  _getWeekData(logs) {
    const days = [];
    const today = new Date();
    const weekLabels = ['日','一','二','三','四','五','六'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = this._dateToStr(d);
      days.push({
        dateStr,
        done: logs && logs[dateStr],
        today: i === 0,
        dayLabel: weekLabels[d.getDay()],
        label: `${d.getMonth()+1}/${d.getDate()}`,
      });
    }
    return days;
  },

  _calcStreak(logs) {
    if (!logs) return 0;
    let streak = 0;
    const d = new Date();
    // 如果今天没打卡，从昨天开始算
    if (!logs[this._dateToStr(d)]) {
      d.setDate(d.getDate() - 1);
    }
    while (logs[this._dateToStr(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  },

  init() {
    // 添加习惯
    const addBtn = document.getElementById('habit-add') || document.getElementById('habit-add-first');
    if (addBtn) {
      addBtn.addEventListener('click', () => this._showAddEdit());
    }

    // 卡片操作
    document.querySelectorAll('[data-habit-id]').forEach(card => {
      card.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === 'checkin') this._checkin(id);
        else if (action === 'edit') this._showAddEdit(id);
        else if (action === 'delete') this._delete(id);
      });
    });
  },

  _checkin(id) {
    const habits = Store.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!habit.logs) habit.logs = {};
    const today = this._todayStr();
    if (habit.logs[today]) {
      // 取消打卡
      delete habit.logs[today];
      habit.updatedAt = Date.now();
      Store.setHabits(habits);
      Sync.autoSync();
      this._refresh();
      App.toast('已取消打卡');
    } else {
      // 打卡
      habit.logs[today] = true;
      habit.updatedAt = Date.now();
      Store.setHabits(habits);
      Sync.autoSync();
      this._refresh();
      App.toast('打卡成功！💪');
    }
  },

  _showAddEdit(id) {
    const habits = Store.getHabits();
    const habit = id ? habits.find(h => h.id === id) : null;
    const icons = ['💧','🚶','🏃','😴','🥗','📚','🧘','💊','🦷','☀️','📝','🎯'];

    App.openModal({
      title: habit ? '编辑习惯' : '添加习惯',
      body: `
        <div class="form-group">
          <label class="form-label">习惯名称</label>
          <input type="text" class="form-input" id="habit-name" value="${habit?this._escape(habit.name):''}" placeholder="如：喝水8杯" maxlength="20">
        </div>
        <div class="form-group">
          <label class="form-label">选择图标</label>
          <div class="flex gap-8" style="flex-wrap:wrap" id="habit-icon-picker">
            ${icons.map(ic => `
              <button class="btn-icon" data-icon="${ic}" style="font-size:20px;width:40px;height:40px;
                ${habit&&habit.icon===ic?'background:var(--primary-bg);border:2px solid var(--primary)':''}">
                ${ic}
              </button>
            `).join('')}
          </div>
        </div>
      `,
      onConfirm: () => {
        const name = document.getElementById('habit-name').value.trim();
        if (!name) { App.toast('请输入习惯名称'); return; }
        const selectedIcon = document.querySelector('[data-icon].selected');
        const icon = selectedIcon ? selectedIcon.dataset.icon : (habit?habit.icon:'⭐');

        if (habit) {
          habit.name = name;
          habit.icon = icon;
          habit.updatedAt = Date.now();
        } else {
          habits.push({
            id: Date.now().toString(),
            name,
            icon,
            logs: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        Store.setHabits(habits);
        this._refresh();
        App.closeModal();
        App.toast(habit ? '已保存' : '已添加');
      }
    });

    // 图标选择
    document.querySelectorAll('[data-icon]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('[data-icon]').forEach(b => {
          b.classList.remove('selected');
          b.style.background = '';
          b.style.border = '';
        });
        btn.classList.add('selected');
        btn.style.background = 'var(--primary-bg)';
        btn.style.border = '2px solid var(--primary)';
      });
    });
  },

  _delete(id) {
    if (!confirm('确定删除这个习惯吗？打卡记录也会删除。')) return;
    const habits = Store.getHabits();
    const habit = habits.find(h => h.id === id);
    if (habit) {
      habit.deleted = true;
      habit.deletedAt = Date.now();
      habit.updatedAt = Date.now();
      Store.setHabits(habits);
    }
    this._refresh();
    App.toast('已移至垃圾箱');
  },

  _refresh() {
    const view = document.getElementById('view');
    view.innerHTML = this.render();
    this.init();
  },

  _todayStr() {
    return this._dateToStr(new Date());
  },

  _dateToStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _escape(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
