/**
 * Sync.js — GitHub Gist 加密同步引擎
 * 数据加密后上传到私有 Gist，支持多设备合并同步
 */
const Sync = {
  _isSyncing: false,
  GIST_API: 'https://api.github.com/gists',

  // ====== 配置管理 ======

  getConfig() {
    return Store.get('syncConfig', {
      gistId: null,
      token: null,
      deviceId: null,
      salt: null,
      savedPassword: null,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
    });
  },

  setConfig(config) {
    Store.set('syncConfig', config);
  },

  isConfigured() {
    const c = this.getConfig();
    return !!(c.gistId && c.token && c.savedPassword);
  },

  // ====== 首次设置 ======

  /**
   * 创建新的同步 Gist（设备 1）
   */
  async createGist(token, password) {
    const deviceId = Crypto.generateDeviceId();
    const { salt } = await Crypto.deriveKey(password);

    // 先用空数据占位创建 Gist
    const placeholder = JSON.stringify({ version: 1, placeholder: true, createdAt: new Date().toISOString() });

    const resp = await fetch(this.GIST_API, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        description: 'Personal Dashboard Sync (Encrypted)',
        public: false,
        files: { 'sync-data.json': { content: placeholder } },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }

    const gist = await resp.json();

    this.setConfig({
      gistId: gist.id,
      token,
      deviceId,
      salt,
      savedPassword: password,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
    });

    return gist.id;
  },

  /**
   * 连接已有 Gist（设备 2+）
   */
  async connectGist(gistId, token, password) {
    // 验证能访问 Gist
    const resp = await fetch(`${this.GIST_API}/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!resp.ok) {
      throw new Error(`无法访问 Gist: HTTP ${resp.status}`);
    }

    const gist = await resp.json();
    const fileContent = gist.files?.['sync-data.json']?.content;
    if (!fileContent) throw new Error('Gist 中没有同步数据文件');

    const parsed = JSON.parse(fileContent);

    // 如果已有加密数据，验证密码
    if (parsed.ciphertext && parsed.salt && parsed.iv) {
      try {
        await Crypto.decrypt(parsed, password);
      } catch (e) {
        throw new Error('密码错误，无法解密同步数据');
      }
    }

    const deviceId = Crypto.generateDeviceId();
    const { salt } = await Crypto.deriveKey(password);

    this.setConfig({
      gistId,
      token,
      deviceId,
      salt,
      savedPassword: password,
      lastSyncTime: null,
      autoSync: true,
      rememberPassword: true,
    });

    return true;
  },

  // ====== 数据收集 ======

  /**
   * 收集所有需要同步的数据（不含文件 Blob）
   */
  async collectSyncData() {
    const settings = Store.getSettings();
    // 排除天气缓存（体积大、时效性强、不需同步）
    const syncSettings = { ...settings };
    delete syncSettings.weatherCache;
    delete syncSettings.weatherCacheTime;

    const localData = {
      todos: Store.getTodos(),
      checklist: Store.getChecklist(),
      habits: Store.getHabits(),
      settings: syncSettings,
    };

    const notes = await DB.getAll('notes');
    const meetings = await DB.getAll('meetings');

    return {
      version: 1,
      timestamp: Date.now(),
      deviceId: this.getConfig().deviceId,
      localData,
      idbData: { notes, meetings },
    };
  },

  // ====== 合并逻辑 ======

  /**
   * 按 ID + updatedAt 合并两个数组
   */
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
        // updatedAt 较新的优先
        const lTime = existing.updatedAt || existing.createdAt || 0;
        const rTime = item.updatedAt || item.createdAt || 0;
        if (rTime > lTime) {
          map.set(item.id, item);
        }
      }
    });
    return Array.from(map.values());
  },

  /**
   * 合并 checklist（单对象，按 updatedAt 取新）
   */
  _mergeChecklist(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const lTime = local.updatedAt || 0;
    const rTime = remote.updatedAt || 0;
    return rTime > lTime ? remote : local;
  },

  /**
   * 合并设置（取远端，但保留本地天气缓存）
   */
  _mergeSettings(localSettings, remoteSettings) {
    const merged = { ...(remoteSettings || localSettings) };
    // 保留本地天气缓存
    if (localSettings.weatherCache) {
      merged.weatherCache = localSettings.weatherCache;
      merged.weatherCacheTime = localSettings.weatherCacheTime;
    }
    return merged;
  },

  /**
   * 全量合并：远端 + 本地 → 合并结果
   */
  async mergeData(remoteData) {
    const localData = await this.collectSyncData();

    // 合并 localStorage 数据
    const mergedTodos = this._mergeArrays(localData.localData.todos, remoteData?.localData?.todos);
    const mergedHabits = this._mergeArrays(localData.localData.habits, remoteData?.localData?.habits);
    const mergedChecklist = this._mergeChecklist(localData.localData.checklist, remoteData?.localData?.checklist);
    const mergedSettings = this._mergeSettings(localData.localData.settings, remoteData?.localData?.settings);

    // 合并 IndexedDB 数据
    const mergedNotes = this._mergeArrays(localData.idbData.notes, remoteData?.idbData?.notes);
    const mergedMeetings = this._mergeArrays(localData.idbData.meetings, remoteData?.idbData?.meetings);

    // 写回 localStorage
    Store.setTodos(mergedTodos);
    Store.setHabits(mergedHabits);
    Store.setChecklist(mergedChecklist);
    Store.setSettings(mergedSettings);

    // 写回 IndexedDB
    await DB.importStore('notes', mergedNotes);
    await DB.importStore('meetings', mergedMeetings);

    return {
      version: 1,
      timestamp: Date.now(),
      deviceId: this.getConfig().deviceId,
      localData: {
        todos: mergedTodos,
        checklist: mergedChecklist,
        habits: mergedHabits,
        settings: mergedSettings,
      },
      idbData: { notes: mergedNotes, meetings: mergedMeetings },
    };
  },

  // ====== 推送/拉取 ======

  async push(data, password) {
    const config = this.getConfig();
    if (!config.gistId || !config.token) throw new Error('未配置同步');

    const encrypted = await Crypto.encrypt(JSON.stringify(data), password, config.salt);

    const resp = await fetch(`${this.GIST_API}/${config.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        files: { 'sync-data.json': { content: JSON.stringify(encrypted) } },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `推送失败: HTTP ${resp.status}`);
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

    // 占位数据（首次创建），还没有实际同步数据
    if (parsed.placeholder) return null;

    // 加密数据
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
      // 1. 拉取远端
      const remote = await this.pull(password);

      // 2. 合并
      const merged = await this.mergeData(remote);

      // 3. 推送合并结果
      await this.push(merged, password);

      // 4. 更新同步时间
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

  /**
   * 自动同步（如果已配置且记住了密码）
   */
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

  /**
   * 断开同步（只清除本地配置，不删 Gist）
   */
  disconnect() {
    Store.remove('syncConfig');
  },
};
