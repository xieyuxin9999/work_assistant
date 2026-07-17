/**
 * Router.js — 简单 Hash 路由
 * 通过 URL hash (#/path) 切换视图
 */
const Router = {
  routes: {},
  currentRoute: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  handle() {
    let hash = window.location.hash.slice(1);
    // 未登录默认去设置页，已登录默认去仪表盘
    if (!hash) {
      hash = (typeof Sync !== 'undefined' && Sync.getStatus().configured) ? '/dashboard' : '/settings';
    }

    // 处理 /more 路由 —— 仅移动端，打开更多菜单
    if (hash === '/more') {
      if (typeof App !== 'undefined' && App.toggleMoreMenu) {
        App.toggleMoreMenu(true);
      }
      // 保持当前路由不变
      return;
    }

    // 关闭更多菜单
    if (typeof App !== 'undefined' && App.toggleMoreMenu) {
      App.toggleMoreMenu(false);
    }

    // 查找匹配的路由
    const handler = this.routes[hash];

    if (handler) {
      this.currentRoute = hash;
      // 更新导航高亮
      this.updateNav(hash);
      // 执行路由处理函数
      handler();
    } else {
      // 未知路由，跳转到仪表盘
      this.navigate('/dashboard');
    }
  },

  updateNav(route) {
    // 更新所有导航项的 active 状态
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemRoute = item.getAttribute('data-route');
      if (itemRoute && '#/' + itemRoute === route) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  },

  init() {
    window.addEventListener('hashchange', () => this.handle());
    this.handle();
  },
};
