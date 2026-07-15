/**
 * Settings Module — 设置页（统一登录 + 数据管理）
 * 登录：用户名 + 密码
 * 注册：用户名 + Token + 密码（一次性）
 */
window.Modules = window.Modules || {};
window.Modules.Settings = {
  async render() {
    const syncStatus = Sync.getStatus();
    const isMobile = this._isMobile();

    const todos = Store.getTodos().filter(t => !t.deleted);
    const habits = Store.getHabits().filter(h => !h.deleted);
    const notes = await DB.getAll('notes');
    const notesActive = notes.filter(n => !n.deleted).length;
    const meetings = await DB.getAll('meetings');
    const meetingsActive = meetings.filter(m => !m.deleted).length;
    const files = await DB.getAll('files');

    return `
      <div class="page-header">
        <div>
          <div class="page-title">设置</div>
          <div class="page-subtitle">同步、数据管理与关于</div>
        </div>
      </div>

      <!-- 同步状态 -->
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title">☁️ 数据同步</div>
          ${syncStatus.configured ?
            `<span class="tag ${syncStatus.lastSyncTime ? 'tag-success' : ''}">${Sync.formatSyncTime(syncStatus.lastSyncTime)}</span>` :
            '<span class="tag tag-warning">未登录</span>'
          }
        </div>

        ${syncStatus.configured ? `
          <div class="text-secondary mb-16" style="font-size:13px;line-height:1.8">
            <div>账号：<strong>${syncStatus.username || '未知'}</strong></div>
            <div>设备 ID：<code style="background:var(--border-light);padding:2px 6px;border-radius:4px;font-size:12px">${syncStatus.deviceId || '—'}</code></div>
            <div>自动同步：${syncStatus.autoSync ? '✅ 已开启' : '❌ 已关闭'}</div>
          </div>

          <div class="flex gap-8" style="flex-wrap:wrap">
            <button class="btn btn-primary" id="sync-now">🔄 立即同步</button>
            <button class="btn btn-secondary" id="sync-show-account">📱 显示账号信息</button>
            <button class="btn btn-secondary" id="sync-toggle-auto">
              ${syncStatus.autoSync ? '关闭自动同步' : '开启自动同步'}
            </button>
            <button class="btn btn-secondary" id="sync-change-pwd">修改密码</button>
            <button class="btn btn-ghost" id="sync-disconnect" style="color:var(--danger)">退出登录</button>
          </div>

          <div class="text-muted mt-12" style="font-size:12px">
            同步范围：待办、笔记、会议记录、习惯打卡、上班物品、设置（不含文件管理）
          </div>
        ` : `
          <div id="sync-login-view">
            <div class="form-group">
              <label class="form-label">GitHub 用户名</label>
              <input type="text" class="form-input" id="login-username" placeholder="你的 GitHub 用户名"
                     autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="login-password" placeholder="输入密码"
                     autocomplete="current-password">
            </div>
            <button class="btn btn-primary btn-block btn-lg" id="sync-login-btn" style="margin-bottom:12px">登录</button>
            <div style="text-align:center">
              <a href="javascript:void(0)" id="sync-show-register" style="font-size:13px;color:var(--primary)">首次使用？注册账号 →</a>
            </div>
          </div>

          <!-- 注册表单（默认隐藏） -->
          <div id="sync-register-view" style="display:none">
            <div class="form-group">
              <label class="form-label">GitHub 用户名</label>
              <input type="text" class="form-input" id="register-username" placeholder="你的 GitHub 用户名"
                     autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">GitHub Token</label>
              <input type="password" class="form-input" id="register-token" placeholder="ghp_xxxxxxxx"
                     style="font-family:'SF Mono',Monaco,monospace;font-size:13px">
              <div class="text-muted mt-4" style="font-size:12px">
               仅需 <code>gist</code> 权限 ·
                <a href="https://github.com/settings/tokens/new?scopes=gist&description=work-assistant" target="_blank" style="color:var(--primary)">点击创建 Token →</a>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">设置密码</label>
              <input type="password" class="form-input" id="register-password" placeholder="至少 6 位"
                     autocomplete="new-password">
            </div>
            <div class="form-group">
              <label class="form-label">确认密码</label>
              <input type="password" class="form-input" id="register-password-confirm" placeholder="再次输入"
                     autocomplete="new-password">
            </div>
            <button class="btn btn-primary btn-block btn-lg" id="sync-register-btn" style="margin-bottom:12px">注册</button>
            <div style="text-align:center">
              <a href="javascript:void(0)" id="sync-back-login" style="font-size:13px;color:var(--primary)">← 返回登录</a>
            </div>
            <div class="text-muted mt-12" style="font-size:12px;line-height:1.6">
              注册后，在其他设备上只需输入<strong>用户名 + 密码</strong>即可登录。Token 仅用于注册，之后不再需要。
            </div>
          </div>
        `}
      </div>

      <!-- 数据统计 -->
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title">📊 数据统计</div>
        </div>
        <div class="grid grid-4">
          <div class="text-center">
            <div style="font-size:24px;font-weight:700">${todos.length}</div>
            <div class="text-muted" style="font-size:12px">待办事项</div>
          </div>
          <div class="text-center">
            <div style="font-size:24px;font-weight:700">${notesActive}</div>
            <div class="text-muted" style="font-size:12px">工作笔记</div>
          </div>
          <div class="text-center">
            <div style="font-size:24px;font-weight:700">${meetingsActive}</div>
            <div class="text-muted" style="font-size:12px">会议记录</div>
          </div>
          <div class="text-center">
            <div style="font-size:24px;font-weight:700">${files.length}</div>
            <div class="text-muted" style="font-size:12px">${isMobile ? '文件（仅电脑端）' : '文件管理'}</div>
          </div>
        </div>
      </div>

      <!-- 本地备份 -->
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title">💾 本地备份</div>
        </div>
        <p class="text-secondary mb-12" style="font-size:13px">
          导出完整数据（含文件）到本地 JSON 文件，用于备份或迁移。
        </p>
        <div class="flex gap-8">
          <button class="btn btn-secondary" id="export-btn">📦 导出数据</button>
          <button class="btn btn-secondary" id="import-btn">📥 导入数据</button>
          <input type="file" id="import-input" accept=".json" style="display:none">
        </div>
      </div>

      <!-- 关于 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">ℹ️ 关于</div>
        </div>
        <div class="text-secondary" style="font-size:13px;line-height:1.8">
          <div>每日助手 v1.0 — 个人生活工作管理工具</div>
          <div>技术栈：原生 HTML/CSS/JS + PWA</div>
          <div>数据存储：localStorage + IndexedDB（纯本地）</div>
          <div>同步：GitHub Gist + AES-GCM 256 加密</div>
        </div>
      </div>
    `;
  },

  async init() {
    // 登录/注册切换
    const showRegister = document.getElementById('sync-show-register');
    if (showRegister) showRegister.addEventListener('click', () => {
      document.getElementById('sync-login-view').style.display = 'none';
      document.getElementById('sync-register-view').style.display = '';
    });

    const backLogin = document.getElementById('sync-back-login');
    if (backLogin) backLogin.addEventListener('click', () => {
      document.getElementById('sync-register-view').style.display = 'none';
      document.getElementById('sync-login-view').style.display = '';
    });

    // 登录按钮
    const loginBtn = document.getElementById('sync-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', () => this._login());

    // 注册按钮
    const registerBtn = document.getElementById('sync-register-btn');
    if (registerBtn) registerBtn.addEventListener('click', () => this._register());

    // 已配置状态的操作
    const syncNow = document.getElementById('sync-now');
    if (syncNow) syncNow.addEventListener('click', () => this._doSync());

    const showAccount = document.getElementById('sync-show-account');
    if (showAccount) showAccount.addEventListener('click', () => this._showAccountInfo());

    const toggleAuto = document.getElementById('sync-toggle-auto');
    if (toggleAuto) toggleAuto.addEventListener('click', () => this._toggleAutoSync());

    const changePwd = document.getElementById('sync-change-pwd');
    if (changePwd) changePwd.addEventListener('click', () => this._showChangePwdDialog());

    const disconnect = document.getElementById('sync-disconnect');
    if (disconnect) disconnect.addEventListener('click', () => this._disconnect());

    // 本地备份
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => App._exportData());

    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) importInput.addEventListener('change', (e) => App._importData(e.target.files[0]));
  },

  // ====== 登录（用户名 + 密码） ======

  _login() {
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 HTTPS 地址访问');
      return;
    }

    const username = document.getElementById('login-username').value.trim();
    const pwd = document.getElementById('login-password').value;

    if (!username) { App.toast('请输入用户名'); return; }
    if (!pwd) { App.toast('请输入密码'); return; }

    App.toast('正在登录...');
    (async () => {
      try {
        await Sync.connectGist(username, pwd);
        App.toast('登录成功！正在同步...');
        await this._doSync();
        this._reload();
      } catch (e) {
        App.toast('登录失败: ' + e.message);
      }
    })();
  },

  // ====== 注册（用户名 + Token + 密码） ======

  _register() {
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 HTTPS 地址访问');
      return;
    }

    const username = document.getElementById('register-username').value.trim();
    const token = document.getElementById('register-token').value.trim();
    const pwd = document.getElementById('register-password').value;
    const pwdConfirm = document.getElementById('register-password-confirm').value;

    if (!username) { App.toast('请输入用户名'); return; }
    if (!token) { App.toast('请输入 Token'); return; }
    if (pwd.length < 6) { App.toast('密码至少 6 位'); return; }
    if (pwd !== pwdConfirm) { App.toast('两次密码不一致'); return; }

    App.toast('正在注册...');
    (async () => {
      try {
        await Sync.createGist(username, token, pwd);
        await this._doSync();
        App.toast('注册成功！🎉');
        this._showAccountInfo();
      } catch (e) {
        App.toast('注册失败: ' + e.message);
      }
    })();
  },

  async _doSync() {
    const config = Sync.getConfig();
    if (!config.savedPassword) {
      App.toast('请先登录同步');
      return;
    }

    App.toast('同步中...');
    const result = await Sync.sync(config.savedPassword);
    if (result.success) {
      App.toast('同步成功 ✅');
      this._reload();
      if (Router.currentRoute && Router.currentRoute !== '/settings') {
        Router.handle();
      }
    } else if (result.skipped) {
      App.toast('同步进行中，请稍候');
    } else {
      App.toast('同步失败: ' + (result.error || '未知错误'));
    }
  },

  _toggleAutoSync() {
    const config = Sync.getConfig();
    config.autoSync = !config.autoSync;
    Sync.setConfig(config);
    App.toast(config.autoSync ? '已开启自动同步' : '已关闭自动同步');
    this._reload();
  },

  _showChangePwdDialog() {
    App.openModal({
      title: '修改同步密码',
      body: `
        <div class="form-group">
          <label class="form-label">当前密码</label>
          <input type="password" class="form-input" id="pwd-old" placeholder="当前密码">
        </div>
        <div class="form-group">
          <label class="form-label">新密码</label>
          <input type="password" class="form-input" id="pwd-new" placeholder="至少 6 位">
        </div>
        <div class="form-group">
          <label class="form-label">确认新密码</label>
          <input type="password" class="form-input" id="pwd-new-confirm" placeholder="再次输入">
        </div>
        <div class="text-muted" style="font-size:12px">
          修改密码后会立即用新密码重新加密并推送数据。其他设备需要用新密码重新登录。
        </div>
      `,
      confirmText: '修改',
      onConfirm: async () => {
        const oldPwd = document.getElementById('pwd-old').value;
        const newPwd = document.getElementById('pwd-new').value;
        const newPwdConfirm = document.getElementById('pwd-new-confirm').value;

        const config = Sync.getConfig();
        if (oldPwd !== config.savedPassword) { App.toast('当前密码错误'); return; }
        if (newPwd.length < 6) { App.toast('新密码至少 6 位'); return; }
        if (newPwd !== newPwdConfirm) { App.toast('两次密码不一致'); return; }

        const { salt } = await Crypto.deriveKey(newPwd);
        config.salt = salt;
        config.savedPassword = newPwd;
        Sync.setConfig(config);

        App.closeModal();
        App.toast('密码已更新，正在重新加密...');
        await this._doSync();
      }
    });
  },

  _disconnect() {
    if (!confirm('退出登录？本地数据不会丢失，但不再自动同步。')) return;
    Sync.disconnect();
    App.toast('已退出登录');
    this._reload();
  },

  // ====== 账号信息显示 ======

  _showAccountInfo() {
    const config = Sync.getConfig();
    if (!config.gistId) {
      App.toast('同步未配置');
      return;
    }

    App.openModal({
      title: '📱 账号信息',
      body: `
        <div class="text-secondary mb-12" style="font-size:13px;line-height:1.6">
          在其他设备上打开此应用，输入以下信息即可登录：
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">用户名</div>
          <div style="font-size:18px;font-weight:600">${config.username || '未知'}</div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">密码</div>
          <div style="font-size:14px;color:var(--text-secondary)">你注册时设置的密码</div>
        </div>
        <div class="text-muted" style="font-size:12px;line-height:1.6">
          ⚠️ 请妥善保管密码。密码用于加密数据，丢失后无法找回，也无法解密已同步的数据。
        </div>
      `,
      confirmText: '关闭',
      onConfirm: () => {
        App.closeModal();
        this._reload();
      }
    });
  },

  _isMobile() {
    return window.innerWidth <= 768;
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },
};
