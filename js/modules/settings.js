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
            '<span class="tag tag-warning">未配置</span>'
          }
        </div>

        ${syncStatus.configured ? `
          <div class="text-secondary mb-16" style="font-size:13px;line-height:1.8">
            <div>设备 ID：<code style="background:var(--border-light);padding:2px 6px;border-radius:4px;font-size:12px">${syncStatus.deviceId || '—'}</code></div>
            <div>自动同步：${syncStatus.autoSync ? '✅ 已开启' : '❌ 已关闭'}</div>
          </div>

          <div class="flex gap-8" style="flex-wrap:wrap">
            <button class="btn btn-primary" id="sync-now">🔄 立即同步</button>
            <button class="btn btn-secondary" id="sync-show-code">📱 显示同步码</button>
            <button class="btn btn-secondary" id="sync-toggle-auto">
              ${syncStatus.autoSync ? '关闭自动同步' : '开启自动同步'}
            </button>
            <button class="btn btn-secondary" id="sync-change-pwd">修改密码</button>
            <button class="btn btn-ghost" id="sync-disconnect" style="color:var(--danger)">断开连接</button>
          </div>

          <div class="text-muted mt-12" style="font-size:12px">
            同步范围：待办、笔记、会议记录、习惯打卡、上班物品、设置（不含文件管理）
          </div>
        ` : `
          <p class="text-secondary mb-16" style="font-size:14px;line-height:1.7">
            通过 GitHub Gist 加密同步你的数据。数据用主密码 AES-GCM 加密后上传，
            即使 Token 泄露，数据也是密文。
          </p>

          <div class="flex gap-8 mb-16">
            <button class="btn btn-primary btn-lg" id="sync-create">🆕 创建同步（第一台设备）</button>
            <button class="btn btn-secondary btn-lg" id="sync-connect">🔗 连接同步（其他设备）</button>
          </div>

          <details class="text-muted" style="font-size:13px">
            <summary style="cursor:pointer;color:var(--primary)">使用说明</summary>
            <div style="margin-top:12px;line-height:1.8">
              <p><strong>第一步</strong>：在 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic) 创建一个 Token，勾选 <code>gist</code> 权限。</p>
              <p><strong>第二台设备</strong>：点「连接同步」，输入第一台设备生成的同步码和相同的主密码即可。</p>
              <p><strong>注意</strong>：主密码用于加密，请牢记。丢失密码无法恢复数据。Token 和密码仅存储在本地。</p>
            </div>
          </details>
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
    // 同步操作
    const createBtn = document.getElementById('sync-create');
    if (createBtn) createBtn.addEventListener('click', () => this._showCreateDialog());

    const connectBtn = document.getElementById('sync-connect');
    if (connectBtn) connectBtn.addEventListener('click', () => this._showConnectDialog());

    const syncNow = document.getElementById('sync-now');
    if (syncNow) syncNow.addEventListener('click', () => this._doSync());

    const showCode = document.getElementById('sync-show-code');
    if (showCode) showCode.addEventListener('click', () => this._showSyncCode());

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

  _showCreateDialog() {
    // 检查 Web Crypto API 是否可用（非 HTTPS / 非 localhost 环境下不可用）
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 http://localhost:8080 访问');
      return;
    }

    App.openModal({
      title: '创建同步',
      body: `
        <div class="form-group">
          <label class="form-label">GitHub Personal Access Token</label>
          <input type="password" class="form-input" id="sync-token" placeholder="ghp_xxxxxxxx"
                 style="font-family:'SF Mono',Monaco,monospace;font-size:13px">
          <div class="text-muted mt-4" style="font-size:12px">
            在 GitHub Settings → Developer settings → Personal access tokens 创建，需勾选 <code>gist</code> 权限
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">主密码（用于加密数据）</label>
          <input type="password" class="form-input" id="sync-password" placeholder="至少 6 位">
          <div class="text-muted mt-4" style="font-size:12px">
            此密码用于加密所有同步数据，请牢记。丢失后无法恢复。
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">确认密码</label>
          <input type="password" class="form-input" id="sync-password-confirm" placeholder="再次输入">
        </div>
      `,
      confirmText: '创建',
      onConfirm: async () => {
        const token = document.getElementById('sync-token').value.trim();
        const pwd = document.getElementById('sync-password').value;
        const pwdConfirm = document.getElementById('sync-password-confirm').value;

        if (!token) { App.toast('请输入 Token'); return; }
        if (pwd.length < 6) { App.toast('密码至少 6 位'); return; }
        if (pwd !== pwdConfirm) { App.toast('两次密码不一致'); return; }

        App.closeModal();
        App.toast('正在创建...');
        try {
          const gistId = await Sync.createGist(token, pwd);
          await this._doSync();
          this._showSyncCode();
        } catch (e) {
          App.toast('创建失败: ' + e.message);
        }
      }
    });
  },

  _showConnectDialog() {
    if (!window.crypto || !window.crypto.subtle) {
      App.toast('加密 API 不可用，请通过 http://localhost:8080 访问');
      return;
    }

    App.openModal({
      title: '连接同步',
      body: `
        <div class="form-group">
          <label class="form-label">同步码</label>
          <textarea class="form-input" id="sync-code" rows="3" placeholder="粘贴从第一台设备获取的同步码"
                 style="font-family:'SF Mono',Monaco,monospace;font-size:12px;resize:none"></textarea>
          <div class="text-muted mt-4" style="font-size:12px">
            在第一台设备的「设置 → 显示同步码」中获取
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">主密码（与创建时相同）</label>
          <input type="password" class="form-input" id="sync-password" placeholder="输入主密码">
        </div>
      `,
      confirmText: '连接',
      onConfirm: async () => {
        const code = document.getElementById('sync-code').value.trim();
        const pwd = document.getElementById('sync-password').value;

        if (!code || !pwd) { App.toast('请填写所有字段'); return; }

        const parsed = this._parseSyncCode(code);
        if (!parsed) { App.toast('同步码格式错误'); return; }

        App.closeModal();
        App.toast('正在连接...');
        try {
          await Sync.connectGist(parsed.gistId, parsed.token, pwd);
          App.toast('连接成功！正在同步...');
          await this._doSync();
          this._reload();
        } catch (e) {
          App.toast('连接失败: ' + e.message);
        }
      }
    });
  },

  async _doSync() {
    const config = Sync.getConfig();
    if (!config.savedPassword) {
      App.toast('请先配置同步');
      return;
    }

    App.toast('同步中...');
    const result = await Sync.sync(config.savedPassword);
    if (result.success) {
      App.toast('同步成功 ✅');
      this._reload();
      // 刷新当前视图
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
          <input type="password" class="form-input" id="pwd-old" placeholder="当前主密码">
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

        // 更新密码和 salt
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
    if (!confirm('断开同步连接？本地数据不会丢失，但不再自动同步。')) return;
    Sync.disconnect();
    App.toast('已断开同步');
    this._reload();
  },

  _showSyncCode() {
    const config = Sync.getConfig();
    if (!config.gistId || !config.token) {
      App.toast('同步未配置');
      return;
    }
    const code = this._generateSyncCode(config.gistId, config.token);
    App.openModal({
      title: '📱 同步码',
      body: `
        <div class="text-secondary mb-12" style="font-size:13px;line-height:1.6">
          将以下同步码发给你的其他设备，在「连接同步」中粘贴即可。<br>
          同步码包含 Gist ID 和 Token，但数据已加密，无密码无法解密。
        </div>
        <textarea id="sync-code-display" rows="4" readonly
          style="width:100%;font-family:'SF Mono',Monaco,monospace;font-size:11px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);word-break:break-all;resize:none">${code}</textarea>
        <div class="flex gap-8 mt-12">
          <button class="btn btn-primary" id="copy-sync-code">📋 复制同步码</button>
        </div>
      `,
      confirmText: '关闭',
      onConfirm: () => {
        App.closeModal();
        this._reload();
      }
    });
    setTimeout(() => {
      const copyBtn = document.getElementById('copy-sync-code');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const textarea = document.getElementById('sync-code-display');
        textarea.select();
        document.execCommand('copy');
        App.toast('已复制到剪贴板');
      });
    }, 100);
  },

  _generateSyncCode(gistId, token) {
    return btoa(gistId + '|' + token);
  },

  _parseSyncCode(code) {
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
