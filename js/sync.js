/**
 * Sync.js — GitHub Gist 加密同步引擎
 * 基于 GitHub 用户名的统一认证模型
 * - 注册：用户名 + Token + 密码 → 创建公开 Gist（数据加密）
 * - 登录：用户名 + 密码 → 查找公开 Gist → 解密拿 Token
 * - 日常：自动同步，无需输入
 */
const Sync = {
  _isSyncing: false,
  GIST_API: 'https://api.github.com/gists',
  GIST_DESCRIPTION: 'work-assistant-sync',

  // ====== 配置管理 ======

  getConfig() {
    return Store.get('syncConfig', {
      username: null,
      gistId: null,
      token: null,
      deviceId: null,
      salt: null,
      savedPassword: null,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
      gistMigrated: false,
    });
  },

  setConfig(config) {
    Store.set('syncConfig', config);
  },

  isConfigured() {
    const c = this.getConfig();
    return !!(c.gistId && c.token && c.savedPassword);
  },

  // ====== 迁移：旧配置补全 username ======

  async migrateConfig() {
    const config = this.getConfig();
    // 旧配置有 gistId + token 但没有 username
    if (config.gistId && config.token && !config.username) {
      try {
        const resp = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        if (resp.ok) {
          const user = await resp.json();
          config.username = user.login;
          this.setConfig(config);
        }
      } catch (e) {
        // 非关键，下次重试
      }
    }
  },

  // ====== 通过用户名查找同步 Gist（无需认证） ======

  async findGistByUsername(username) {
    const resp = await fetch(`https://api.github.com/users/${username}/gists?per_page=100`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    if (resp.status === 404) {
      throw new Error(`GitHub 用户 "${username}" 不存在`);
    }
    if (!resp.ok) {
      throw new Error(`查询失败: HTTP ${resp.status}`);
    }

    const gists = await resp.json();
    // 查找描述匹配的 Gist（兼容旧描述）
    const syncGist = gists.find(g =>
      g.description === this.GIST_DESCRIPTION ||
      g.description === 'Personal Dashboard Sync (Encrypted)'
    );

    if (!syncGist) {
      throw new Error(`用户 "${username}" 没有同步账号，请先注册`);
    }

    return syncGist.id;
  },

  // ====== 注册（首次创建，设备 1） ======

  /**
   * 注册新账号：创建公开 Gist，加密存储数据 + Token
   */
  async createGist(username, token, password) {
    const deviceId = Crypto.generateDeviceId();
    const { salt } = await Crypto.deriveKey(password);

    // 占位数据（随后立即推送加密数据）
    const placeholder = JSON.stringify({
      version: 2,
      placeholder: true,
      createdAt: new Date().toISOString(),
    });

    const resp = await fetch(this.GIST_API, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        description: this.GIST_DESCRIPTION,
        public: true,
        files: { 'sync-data.json': { content: placeholder } },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }

    const gist = await resp.json();

    this.setConfig({
      username,
      gistId: gist.id,
      token,
      deviceId,
      salt,
      savedPassword: password,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
      gistMigrated: true,
    });

    return gist.id;
  },

  // ====== 登录（设备 2+，只需用户名 + 密码） ======

  /**
   * 通过用户名 + 密码登录：
   * 1. 查找用户的公开同步 Gist
   * 2. 拉取 Gist 内容（无需认证）
   * 3. 解密获取数据 + Token
   */
  async connectGist(username, password) {
    // 1. 查找同步 Gist
    const gistId = await this.findGistByUsername(username);

    // 2. 拉取 Gist（公开 Gist 无需认证）
    const resp = await fetch(`${this.GIST_API}/${gistId}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!resp.ok) {
      throw new Error(`无法访问同步数据: HTTP ${resp.status}`);
    }

    const gist = await resp.json();
    const content = gist.files?.['sync-data.json']?.content;
    if (!content) throw new Error('同步数据不存在');

    const parsed = JSON.parse(content);

    // 3. 占位数据（设备 1 还没完成首次同步）
    if (parsed.placeholder) {
      throw new Error('同步数据尚未就绪，请在第一台设备完成同步');
    }

    // 4. 解密获取数据 + Token
    if (!parsed.ciphertext) throw new Error('同步数据格式错误');

    let data;
    try {
      const decrypted = await Crypto.decrypt(parsed, password);
      data = JSON.parse(decrypted);
    } catch (e) {
      throw new Error('密码错误');
    }

    if (!data.syncToken) throw new Error('同步数据中缺少令牌，请在第一台设备重新同步');

    // 5. 存储配置
    const deviceId = Crypto.generateDeviceId();
    const { salt } = await Crypto.deriveKey(password);

    this.setConfig({
      username,
      gistId,
      token: data.syncToken,
      deviceId,
      salt,
      savedPassword: password,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
      gistMigrated: true,
    });

    return true;
  },

  // ====== 数据收集 ======

  async collectSyncData() {
    const config = this.getConfig();
    const settings = Store.getSettings();
    const syncSettings = { ...settings };
    delete syncSettings.weatherCache;
    delete syncSettings.weatherCacheTime;

    const localData = {
      todos: Store.getTodos(),
      checklist: Store.getChecklist(),
      habits: Store.getHabits(),
      settings: syncSettings,
      afterworkTodos: Store.getAfterworkTodos(),
      fileTree: Store.getFileTree(),
      fileRepo: Store.getFileRepo(),
      dashboardInfo: Store.getDashboardInfo(),
      schedules: Store.getSchedules(),
    };

    const notes = await DB.getAll('notes');
    const meetings = await DB.getAll('meetings');
    const afterworkNotes = await DB.getAll('afterworkNotes');

    return {
      version: 2,
      timestamp: Date.now(),
      deviceId: config.deviceId,
      syncToken: config.token,
      localData,
      idbData: { notes, meetings, afterworkNotes },
    };
  },

  // ====== 合并逻辑 ======

  _mergeArrays(local, remote) {
    const map = new Map();
    (local || []).forEach(item => {
      if (item && item.id) map.set(item.id, item);
    });
    (remote || []).forEach(item => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const lTime = existing.updatedAt || existing.createdAt || 0;
        const rTime = item.updatedAt || item.createdAt || 0;
        if (rTime > lTime) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values());
  },

  _mergeChecklist(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    if (!local.items || local.items.length === 0) return remote;
    const lTime = local.updatedAt || 0;
    const rTime = remote.updatedAt || 0;
    return rTime > lTime ? remote : local;
  },

  _mergeSettings(localSettings, remoteSettings) {
    const merged = { ...(remoteSettings || localSettings) };
    if (localSettings.weatherCache) {
      merged.weatherCache = localSettings.weatherCache;
      merged.weatherCacheTime = localSettings.weatherCacheTime;
    }
    return merged;
  },

  _mergeFileTree(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const lTime = local.scannedAt || 0;
    const rTime = remote.scannedAt || 0;
    return rTime > lTime ? remote : local;
  },

  _mergeFileRepo(local, remote) {
    // 仓库名一旦设定就不变，优先取有值的
    return local || remote || null;
  },

  _mergeString(local, remote) {
    // 简单字符串：非空优先，本地优先
    return local || remote || '';
  },

  async mergeData(remoteData) {
    const localData = await this.collectSyncData();

    // 如果远端数据包含 Token 且本地缺失，补全
    if (remoteData?.syncToken) {
      const config = this.getConfig();
      if (!config.token) {
        config.token = remoteData.syncToken;
        this.setConfig(config);
      }
    }

    const mergedTodos = this._mergeArrays(localData.localData.todos, remoteData?.localData?.todos);
    const mergedHabits = this._mergeArrays(localData.localData.habits, remoteData?.localData?.habits);
    const mergedChecklist = this._mergeChecklist(localData.localData.checklist, remoteData?.localData?.checklist);
    const mergedSettings = this._mergeSettings(localData.localData.settings, remoteData?.localData?.settings);
    const mergedAfterworkTodos = this._mergeArrays(localData.localData.afterworkTodos, remoteData?.localData?.afterworkTodos);
    const mergedFileTree = this._mergeFileTree(localData.localData.fileTree, remoteData?.localData?.fileTree);
    const mergedFileRepo = this._mergeFileRepo(localData.localData.fileRepo, remoteData?.localData?.fileRepo);
    const mergedDashboardInfo = this._mergeString(localData.localData.dashboardInfo, remoteData?.localData?.dashboardInfo);
    const mergedSchedules = this._mergeArrays(localData.localData.schedules, remoteData?.localData?.schedules);

    const mergedNotes = this._mergeArrays(localData.idbData.notes, remoteData?.idbData?.notes);
    const mergedMeetings = this._mergeArrays(localData.idbData.meetings, remoteData?.idbData?.meetings);
    const mergedAfterworkNotes = this._mergeArrays(localData.idbData.afterworkNotes, remoteData?.idbData?.afterworkNotes);

    Store.setTodos(mergedTodos);
    Store.setHabits(mergedHabits);
    Store.setChecklist(mergedChecklist);
    Store.setSettings(mergedSettings);
    Store.setAfterworkTodos(mergedAfterworkTodos);
    Store.setFileTree(mergedFileTree);
    Store.setFileRepo(mergedFileRepo);
    Store.setDashboardInfo(mergedDashboardInfo);
    Store.setSchedules(mergedSchedules);

    await DB.importStore('notes', mergedNotes);
    await DB.importStore('meetings', mergedMeetings);
    await DB.importStore('afterworkNotes', mergedAfterworkNotes);

    return {
      version: 2,
      timestamp: Date.now(),
      deviceId: this.getConfig().deviceId,
      syncToken: this.getConfig().token,
      localData: {
        todos: mergedTodos,
        checklist: mergedChecklist,
        habits: mergedHabits,
        settings: mergedSettings,
        afterworkTodos: mergedAfterworkTodos,
        fileTree: mergedFileTree,
        fileRepo: mergedFileRepo,
        dashboardInfo: mergedDashboardInfo,
        schedules: mergedSchedules,
      },
      idbData: { notes: mergedNotes, meetings: mergedMeetings, afterworkNotes: mergedAfterworkNotes },
    };
  },

  // ====== 推送/拉取 ======

  async push(data, password) {
    const config = this.getConfig();
    if (!config.gistId || !config.token) throw new Error('未配置同步');

    const encrypted = await Crypto.encrypt(JSON.stringify(data), password, config.salt);

    const body = {
      files: { 'sync-data.json': { content: JSON.stringify(encrypted) } },
    };

    // 迁移：确保 Gist 公开 + 描述正确（仅第一次）
    if (!config.gistMigrated) {
      body.public = true;
      body.description = this.GIST_DESCRIPTION;
    }

    const resp = await fetch(`${this.GIST_API}/${config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `推送失败: HTTP ${resp.status}`);
    }

    // 标记已迁移
    if (!config.gistMigrated) {
      config.gistMigrated = true;
      this.setConfig(config);
    }

    return true;
  },

  async pull(password) {
    const config = this.getConfig();
    if (!config.gistId || !config.token) throw new Error('未配置同步');

    const resp = await fetch(`${this.GIST_API}/${config.gistId}`, {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!resp.ok) throw new Error(`拉取失败: HTTP ${resp.status}`);

    const gist = await resp.json();
    const content = gist.files?.['sync-data.json']?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    if (parsed.placeholder) return null;

    if (parsed.ciphertext) {
      const decrypted = await Crypto.decrypt(parsed, password);
      return JSON.parse(decrypted);
    }

    return null;
  },

  // ====== 完整同步流程 ======

  async sync(password) {
    if (this._isSyncing) return { skipped: true };
    this._isSyncing = true;

    try {
      const remote = await this.pull(password);
      const merged = await this.mergeData(remote);
      await this.push(merged, password);

      const config = this.getConfig();
      config.lastSyncTime = Date.now();
      this.setConfig(config);

      return { success: true, timestamp: config.lastSyncTime };
    } catch (e) {
      console.error('Sync error:', e);
      return { success: false, error: e.message };
    } finally {
      this._isSyncing = false;
    }
  },

  async autoSync() {
    const config = this.getConfig();
    if (!config.autoSync || !config.gistId || !config.token || !config.savedPassword) {
      return null;
    }
    return await this.sync(config.savedPassword);
  },

  // ====== 状态 ======

  getStatus() {
    const c = this.getConfig();
    return {
      configured: !!(c.gistId && c.token),
      username: c.username,
      deviceId: c.deviceId,
      lastSyncTime: c.lastSyncTime,
      autoSync: c.autoSync,
    };
  },

  formatSyncTime(ts) {
    if (!ts) return '从未同步';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚同步';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前同步';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前同步';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  // ====== 清除本地业务数据（保留 syncConfig） ======

  async clearLocalData() {
    Store.remove('todos');
    Store.remove('checklist');
    Store.remove('habits');
    Store.remove('afterworkTodos');
    Store.remove('settings');
    Store.remove('fileTree');
    Store.remove('fileRepo');
    Store.remove('dashboardInfo');
    Store.remove('schedules');
    await Promise.all([
      DB.clear('notes'),
      DB.clear('meetings'),
      DB.clear('files'),
      DB.clear('localFolders'),
      DB.clear('afterworkNotes'),
    ]);
  },

  // ====== 退出登录（清除一切） ======

  async disconnect() {
    await this.clearLocalData();
    Store.remove('syncConfig');
  },
};
