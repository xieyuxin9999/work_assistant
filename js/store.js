/**
 * Store.js — localStorage 封装
 * 提供类型安全的 JSON 读写
 */
const Store = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.error('Store.get error:', key, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Store.set error:', key, e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  },

  /* ====== 业务数据快捷方法 ====== */

  // 待办事项
  getTodos() {
    return this.get('todos', []);
  },
  setTodos(todos) {
    this.set('todos', todos);
  },

  // 上班物品
  getChecklist() {
    return this.get('checklist', { items: [], lastResetDate: null });
  },
  setChecklist(data) {
    this.set('checklist', data);
  },

  // 健康习惯
  getHabits() {
    return this.get('habits', []);
  },
  setHabits(habits) {
    this.set('habits', habits);
  },

  // 设置
  getSettings() {
    return this.get('settings', {
      city: '北京',
      cityLat: 39.9042,
      cityLon: 116.4074,
      weatherCache: null,
      weatherCacheTime: null,
    });
  },
  setSettings(settings) {
    this.set('settings', settings);
  },

  // 导出全部数据
  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  },

  // 导入数据
  importAll(data) {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
    });
  },
};
