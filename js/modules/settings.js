/**
 * Settings Module — 设置页（同步配置 + 数据管理）
 */
window.Modules = window.Modules || {};
window.Modules.Settings = {
  async render() {
    const syncStatus = Sync.getStatus();
    const isMobile = this._isMobile();

    // 数据统计
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
            <div>设备 ID：<code style="background:var(--border-light);padding:2px 6px;border-radius:4px;font-size:12px">${syncStatus.deviceId || '—'}</code></div>
            <div>自动同步：${syncStatus.autoSync ? '✅ 已开启' : '❌ 已关闭'}</div>
          </div>

          <div class="flex gap-8" style="flex-wrap:wrap">
            <button class="btn btn-primary" id="sync-now">🔄 立即同步</button>
            <button class="btn btn-secondary" id="sync-show-id">📱 显示同步ID</button>
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
            <!-- 登录表单 -->
            <div class="form-group">
              <label class="form-label">同步ID</label>
              <input type="text" class="form-input" id="login-sync-id" placeholder="粘贴同步ID"
                     style="font-family:'SF Mono',Monaco,monospace;font-size:13px">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="login-password" placeholder="输入密码">
            </div>
            <button class="btn btn-primary btn-block btn-lg" id="sync-login-btn" style="margin-bottom:12px">登录同步</button>
            <div style="text-align:center">
              <a href="javascript:void(0)" id="sync-show-create" style="font-size:13px;color:var(--primary)">首次使用？创建新同步 →</a>
            </div>
          </div>

          <!-- 创建表单（默认隐藏） -->
          <div id="sync-create-view" style="display:none">
            <div class="form-group">
              <label class="form-label">GitHub Token</label>
              <input type="password" class="form-input" id="create-token" placeholder="ghp_xxxxxxxx"
                     style="font-family:'SF Mono',Monaco,monospace;font-size:13px">
              <div class="text-muted mt-4" style="font-size:12px">
                GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)，勾选 <code>gist</code> 权限
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">设置密码</label>
              <input type="password" class="form-input" id="create-password" placeholder="至少 6 位">
            </div>
            <div class="form-group">
              <label class="form-label">确认密码</label>
              <input type="password" class="form-input" id="create-password-confirm" placeholder="再次输入">
            </div>
            <button class="btn btn-primary btn-block btn-lg" id="sync-create-btn" style="margin-bottom:12px">创建同步</button>
            <div style="text-align:center">
              <a href="javascript:void(0)" id="sync-back-login" style="font-size:13px;color:var(--primary)">← 返回登录</a>
            </div>
            <div class="text-muted mt-12" style="font-size:12px;line-height:1.6">
              创建后会生成一个「同步ID」，在其他设备上用这个 ID + 密码即可登录。
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
    // 登录/创建切换
    const showCreate = document.getElementById('sync-show-create');
    if (showCreate) showCreate.addEventListener('click', () => {
      document.getElementById('sync-login-view').style.display = 'none';
      document.getElementById('sync-create-view').style.display = '';
    });

    const backLogin = document.getElementById('sync-back-login');
    if (backLogin) backLogin.addEventListener('click', () => {
      document.getElementById('sync-create-view').style.display = 'none';
      document.getElementById('sync-login-view').style.display = '';
    });

    // 登录按钮
    const loginBtn = document.getElementById('sync-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', () => this._login());

    // 创建按钮
    const createBtn = document.getElementById('sync-create-btn');
    if (createBtn) createBtn.addEventListener('click', () => this._create());

    // 已配置状态的操作
    const syncNow = document.getElementById('sync-now');
    if (syncNow) syncNow.addEventListener('click', () => this._doSync());

    const showId = document.getElementById('sync-show-id');
    if (showId) showId.addEventListener('click', () => this._showSyncId());

    const toggleAuto = document.getElementById('sync-toggle-auto');
    if (toggleAuto) toggleAuto.addEventListener('click', () => this._toggleAutoSync());

    const changePwd = document.getElementById('sync-change-pwd');
    if (changePwd) changePwd.addEventListener('click', () => this._showChangePwdDialog());

    const disconnect = document.getElementById('sync-disconnect');
    if (disconnect) disconnect.addEventListener('click', () => this._disconnect());

    // 本地备份按钮
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => App._exportData());

    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) importInput.addEventListener('change', (e) => App._importData(e.target.files[0]));
  },

  // ====== 登录（用同步ID + 密码） ======

  _login() {
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 HTTPS 地址访问');
      return;
    }

    const code = document.getElementById('login-sync-id').value.trim();
    const pwd = document.getElementById('login-password').value;

    if (!code) { App.toast('请输入同步ID'); return; }
    if (!pwd) { App.toast('请输入密码'); return; }

    const parsed = this._parseSyncId(code);
    if (!parsed) { App.toast('同步ID格式错误'); return; }

    App.toast('正在连接...');
    (async () => {
      try {
        await Sync.connectGist(parsed.gistId, parsed.token, pwd);
        App.toast('登录成功！正在同步...');
        await this._doSync();
        this._reload();
      } catch (e) {
        App.toast('登录失败: ' + e.message);
      }
    })();
  },

  // ====== 创建同步（首次使用） ======

  _create() {
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 HTTPS 地址访问');
      return;
    }

    const token = document.getElementById('create-token').value.trim();
    const pwd = document.getElementById('create-password').value;
    const pwdConfirm = document.getElementById('create-password-confirm').value;

    if (!token) { App.toast('请输入 Token'); return; }
    if (pwd.length < 6) { App.toast('密码至少 6 位'); return; }
    if (pwd !== pwdConfirm) { App.toast('两次密码不一致'); return; }

    App.toast('正在创建...');
    (async () => {
      try {
        await Sync.createGist(token, pwd);
        await this._doSync();
        this._showSyncId();
      } catch (e) {
        App.toast('创建失败: ' + e.message);
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
          修改密码后会立即用新密码重新加密并推送数据。
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
    if (!confirm('退出同步登录？本地数据不会丢失，但不再自动同步。')) return;
    Sync.disconnect();
    App.toast('已退出登录');
    this._reload();
  },

  // ====== 同步ID 显示/复制 ======

  _showSyncId() {
    const config = Sync.getConfig();
    if (!config.gistId || !config.token) {
      App.toast('同步未配置');
      return;
    }
    const id = this._generateSyncId(config.gistId, config.token);
    App.openModal({
      title: '📱 你的同步ID',
      body: `
        <div class="text-secondary mb-12" style="font-size:13px;line-height:1.6">
          在其他设备上打开此应用，输入这个同步ID + 密码即可登录。<br>
          <strong>密码就是创建时设置的密码。</strong>
        </div>
        <textarea id="sync-id-display" rows="4" readonly
          style="width:100%;font-family:'SF Mono',Monaco,monospace;font-size:11px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);word-break:break-all;resize:none">${id}</textarea>
        <div class="flex gap-8 mt-12">
          <button class="btn btn-primary" id="copy-sync-id">📋 复制同步ID</button>
        </div>
      `,
      confirmText: '关闭',
      onConfirm: () => {
        App.closeModal();
        this._reload();
      }
    });
    setTimeout(() => {
      const copyBtn = document.getElementById('copy-sync-id');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const textarea = document.getElementById('sync-id-display');
        textarea.select();
        document.execCommand('copy');
        App.toast('已复制到剪贴板');
      });
    }, 100);
  },

  // ====== 同步ID 编解码 ======

  _generateSyncId(gistId, token) {
    return btoa(gistId + '|' + token);
  },

  _parseSyncId(code) {
    try {
      const decoded = atob(code.trim());
      const parts = decoded.split('|');
      if (parts.length !== 2) return null;
      return { gistId: parts[0], token: parts[1] };
    } catch (e) {
      return null;
    }
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
