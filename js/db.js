/**
 * DB.js — IndexedDB 封装
 * 用于存储笔记、会议记录、文件等较大数据
 */
const DB = {
  _db: null,
  _dbName: 'personal-dashboard',
  _version: 1,

  // 数据库配置
  _stores: {
    notes: { keyPath: 'id' },
    meetings: { keyPath: 'id' },
    files: { keyPath: 'id' },
  },

  async open() {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, this._version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // 创建 object stores
        Object.entries(this._stores).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: config.keyPath });
          }
        });
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };

      req.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };
    });
  },

  async _tx(storeName, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(storeName, mode).objectStore(storeName);
  },

  async add(storeName, data) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, data) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    const store = await this._tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    const store = await this._tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  // 导出某个 store 的全部数据
  async exportStore(storeName) {
    return await this.getAll(storeName);
  },

  // 批量导入
  async importStore(storeName, items) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      items.forEach(item => store.put(item));
      store.transaction.oncomplete = () => resolve(true);
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  },
};
