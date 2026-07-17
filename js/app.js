/**
 * App.js — 主应用入口
 * 初始化数据库、注册路由、全局事件处理
 */
const App = {
  async init() {
    // 初始化 IndexedDB
    try {
      await DB.open();
    } catch (e) {
      console.error('DB init error:', e);
    }

    // 注册路由
    Router.register('/dashboard', () => this._loadModule('Dashboard'));
    Router.register('/morning', () => this._loadModule('Morning'));
    Router.register('/todo', () => this._loadModule('Todo'));
    Router.register('/notes', () => this._loadModule('Notes'));
    Router.register('/meetings', () => this._loadModule('Meetings'));
    Router.register('/files', () => this._loadModule('Files'));
    Router.register('/habits', () => this._loadModule('Habits'));
    Router.register('/afterwork', () => this._loadModule('Afterwork'));
    Router.register('/settings', () => this._loadModule('Settings'));
    Router.register('/trash', () => this._loadModule('Trash'));

    // 初始化路由
    Router.init();

    // 全局事件
    this._bindGlobalEvents();

    // 迁移旧配置（补全 username）+ 自动同步
    await Sync.migrateConfig();
    this._updateNavVisibility();
    this._autoSync();

    // 注册 Service Worker
    this._registerSW();
  },

  async _loadModule(name) {
    // 未登录时只允许访问设置页
    if (name !== 'Settings' && !Sync.getStatus().configured) {
      this.toast('请先登录');
      Router.navigate('/settings');
      return;
    }

    const mod = window.Modules[name];
    if (!mod) return;

    const view = document.getElementById('view');
    // 异步渲染（部分模块需要读取数据库）
    view.innerHTML = await mod.render();
    if (mod.init) await mod.init();
  },

  // ====== 导航可见性 ======

  _updateNavVisibility() {
    const loggedIn = Sync.getStatus().configured;
    document.body.classList.toggle('not-logged-in', !loggedIn);
  },

  _bindGlobalEvents() {
    // 导出数据
    const exportBtns = [document.getElementById('export-btn'), document.getElementById('export-btn-mobile')];
    exportBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => this._exportData());
    });

    // 导入数据
    const importBtns = [document.getElementById('import-btn'), document.getElementById('import-btn-mobile')];
    const importInput = document.getElementById('import-input');
    importBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => importInput.click());
    });
    if (importInput) {
      importInput.addEventListener('change', (e) => this._importData(e.target.files[0]));
    }

    // 更多菜单（移动端）
    const moreClose = document.getElementById('more-close');
    const moreOverlay = document.getElementById('more-overlay');
    if (moreClose) moreClose.addEventListener('click', () => this.toggleMoreMenu(false));
    if (moreOverlay) {
      moreOverlay.addEventListener('click', (e) => {
        if (e.target === moreOverlay) this.toggleMoreMenu(false);
      });
    }
  },

  toggleMoreMenu(show) {
    const overlay = document.getElementById('more-overlay');
    if (!overlay) return;
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  },

  // ====== 自动同步 ======

  async _autoSync() {
    try {
      const result = await Sync.autoSync();
      if (result && result.success) {
        // 同步成功后刷新当前视图
        if (Router.currentRoute) {
          Router.handle();
        }
      }
    } catch (e) {
      console.error('Auto sync error:', e);
    }
  },

  // ====== 数据导出/导入 ======

  async _exportData() {
    try {
      // 导出 localStorage 数据
      const localData = Store.exportAll();

      // 导出 IndexedDB 数据
      const dbData = {
        notes: await DB.exportStore('notes'),
        meetings: await DB.exportStore('meetings'),
        files: await DB.exportStore('files'),
      };

      // 文件数据太大，不导出 blob，只导出元信息
      dbData.files = dbData.files.map(f => ({
        id: f.id, name: f.name, type: f.type, size: f.size,
        folder: f.folder, createdAt: f.createdAt,
      }));

      const exportObj = {
        version: 1,
        exportDate: new Date().toISOString(),
        localStorage: localData,
        indexedDB: dbData,
      };

      const json = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dashboard-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.toast('数据已导出');
    } catch (e) {
      console.error('Export error:', e);
      this.toast('导出失败');
    }
  },

  async _importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version) {
        this.toast('文件格式不正确');
        return;
      }

      if (!confirm('导入数据将覆盖当前数据，确定继续吗？')) return;

      // 导入 localStorage
      if (data.localStorage) {
        Store.clear();
        Store.importAll(data.localStorage);
      }

      // 导入 IndexedDB（不含文件 blob）
      if (data.indexedDB) {
        if (data.indexedDB.notes) {
          await DB.clear('notes');
          await DB.importStore('notes', data.indexedDB.notes);
        }
        if (data.indexedDB.meetings) {
          await DB.clear('meetings');
          await DB.importStore('meetings', data.indexedDB.meetings);
        }
        // 文件不导入（没有 blob 数据）
      }

      this.toast('数据已导入');
      // 刷新当前页面
      Router.handle();
    } catch (e) {
      console.error('Import error:', e);
      this.toast('导入失败');
    }
  },

  // ====== Toast 通知 ======

  _toastTimer: null,

  toast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
    }, 2000);
  },

  // ====== Modal ======

  openModal({ title, body, onConfirm, confirmText = '确定', cancelText = '取消', large = false }) {
    const container = document.getElementById('modal-container');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${large?'large':''}">
        <div class="modal-header">
          <div class="modal-title">${title || ''}</div>
          <button class="btn-icon" data-modal-close>✕</button>
        </div>
        <div class="modal-body">${body || ''}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-modal-cancel>${cancelText}</button>
          <button class="btn btn-primary" data-modal-confirm>${confirmText}</button>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    const close = () => {
      container.removeChild(overlay);
    };

    // 关闭按钮
    overlay.querySelector('[data-modal-close]').addEventListener('click', close);
    overlay.querySelector('[data-modal-cancel]').addEventListener('click', close);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // 确认按钮
    overlay.querySelector('[data-modal-confirm]').addEventListener('click', () => {
      if (onConfirm) {
        try {
          const result = onConfirm();
          if (result && typeof result.catch === 'function') {
            result.catch(e => {
              console.error('Modal onConfirm error:', e);
              App.toast('操作失败: ' + (e.message || '未知错误'));
            });
          }
        } catch (e) {
          console.error('Modal onConfirm error:', e);
          App.toast('操作失败: ' + (e.message || '未知错误'));
        }
      }
    });
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    const overlay = container.querySelector('.modal-overlay');
    if (overlay) container.removeChild(overlay);
  },

  // ====== Service Worker ======

  _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }
  },
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
