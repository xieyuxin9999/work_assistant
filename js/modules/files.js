/**
 * Files Module — 文件管理（重构版 v2）
 * 
 * 区域1: 同步文件 — GitHub 私有仓库，手机和电脑双向同步
 * 区域2: 本地文件树 — 电脑端扫描工作文件夹，手机端只读查看文件树
 */
window.Modules = window.Modules || {};
window.Modules.Files = {
  syncedFiles: [],
  loading: false,
  fsaSupported: false,

  async render() {
    this.fsaSupported = 'showDirectoryPicker' in window;
    const config = Sync.getConfig();
    const isLoggedIn = !!(config.token && config.username);
    const fileRepo = Store.getFileRepo();

    return `
      <div class="page-header">
        <div>
          <div class="page-title">📁 文件管理</div>
          <div class="page-subtitle">${fileRepo ? '仓库: ' + this._escape(fileRepo) : '未配置同步仓库'}</div>
        </div>
      </div>

      ${!isLoggedIn ? `
        <div class="card text-center" style="padding:32px">
          <div style="font-size:40px;margin-bottom:12px">🔐</div>
          <div style="font-weight:500;margin-bottom:8px">请先登录 GitHub 账号</div>
          <div class="text-muted" style="font-size:13px;margin-bottom:16px">文件同步需要 GitHub 账号</div>
          <button class="btn btn-primary" onclick="location.hash='#/settings'">去登录</button>
        </div>
      ` : `
        <!-- 区域1: 同步文件 -->
        <div class="file-section">
          <div class="file-section-header">
            <span class="file-section-title">🔄 同步文件</span>
            <span class="tag-success">GitHub 仓库</span>
          </div>
          <div class="text-muted mb-12" style="font-size:12px">
            轻量文档同步，手机和电脑都能访问。单文件建议 &lt; 5MB。
          </div>
          <div id="synced-files-area">
            ${this._renderSyncedFilesPlaceholder()}
          </div>
        </div>

        <!-- 区域2: 本地文件树 -->
        <div class="file-section" style="margin-top:24px">
          <div class="file-section-header">
            <span class="file-section-title">🖥️ 本地文件树</span>
            ${this.fsaSupported ? '<span class="tag-primary">可扫描</span>' : '<span class="tag-warning">只读</span>'}
          </div>
          <div class="text-muted mb-12" style="font-size:12px">
            电脑端扫描工作文件夹，手机端可查看文件目录结构（只读）。
          </div>
          <div id="file-tree-area">
            ${this._renderFileTreePlaceholder()}
          </div>
        </div>
      `}
    `;
  },

  // ====== 同步文件：GitHub 仓库操作 ======

  _renderSyncedFilesPlaceholder() {
    if (this.loading) {
      return '<div class="card text-center text-muted" style="padding:24px">加载中...</div>';
    }
    return '<div class="card text-center text-muted" style="padding:24px">加载中...</div>';
  },

  async _loadSyncedFiles() {
    const config = Sync.getConfig();
    const fileRepo = Store.getFileRepo();

    // 没有仓库 → 提示创建
    if (!fileRepo) {
      this._renderSyncedFilesSetup();
      return;
    }

    // 加载文件列表
    try {
      this.loading = true;
      const resp = await fetch(
        `https://api.github.com/repos/${config.username}/${fileRepo}/contents`,
        {
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (resp.status === 404) {
        // 仓库不存在（可能被删除），重新设置
        this._renderSyncedFilesSetup(true);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const items = await resp.json();
      // 过滤掉 .gitignore, README 等自动生成的文件
      this.syncedFiles = items.filter(item =>
        item.type === 'file' &&
        !item.name.startsWith('.') &&
        item.name !== 'README.md'
      );

      this._renderSyncedFilesList();
    } catch (e) {
      console.error('Load synced files error:', e);
      this._renderSyncedFilesError(e.message);
    } finally {
      this.loading = false;
    }
  },

  _renderSyncedFilesSetup(repoMissing = false) {
    const area = document.getElementById('synced-files-area');
    if (!area) return;
    area.innerHTML = `
      <div class="card text-center" style="padding:24px">
        <div style="font-size:32px;margin-bottom:8px">${repoMissing ? '⚠️' : '📦'}</div>
        <div style="font-weight:500;margin-bottom:8px">
          ${repoMissing ? '同步仓库不存在，需要重新创建' : '还没有同步仓库'}
        </div>
        <div class="text-muted" style="font-size:13px;margin-bottom:16px">
          点击下方按钮，将在你的 GitHub 账号下创建一个私有仓库<br>
          用于存储需要在手机和电脑间同步的文件
        </div>
        <button class="btn btn-primary" id="create-file-repo">创建同步仓库</button>
      </div>
    `;
    const btn = document.getElementById('create-file-repo');
    if (btn) btn.addEventListener('click', () => this._createFileRepo());
  },

  _renderSyncedFilesError(msg) {
    const area = document.getElementById('synced-files-area');
    if (!area) return;
    area.innerHTML = `
      <div class="card text-center" style="padding:24px">
        <div style="font-size:32px;margin-bottom:8px">❌</div>
        <div style="font-weight:500;margin-bottom:8px">加载失败</div>
        <div class="text-muted" style="font-size:13px;margin-bottom:16px">${this._escape(msg)}</div>
        <button class="btn btn-secondary" id="retry-load-synced">重试</button>
      </div>
    `;
    const btn = document.getElementById('retry-load-synced');
    if (btn) btn.addEventListener('click', () => this._loadSyncedFiles());
  },

  _renderSyncedFilesList() {
    const area = document.getElementById('synced-files-area');
    if (!area) return;

    if (this.syncedFiles.length === 0) {
      area.innerHTML = `
        <div class="card text-center text-muted" style="padding:24px;font-size:13px">
          暂无同步文件，点击下方上传
        </div>
        <input type="file" id="sync-file-input" style="display:none">
        <button class="btn btn-primary btn-sm mt-12" id="upload-sync-file">📤 上传文件</button>
      `;
    } else {
      area.innerHTML = `
        <input type="file" id="sync-file-input" style="display:none">
        <div class="flex gap-8 mb-12">
          <button class="btn btn-primary btn-sm" id="upload-sync-file">📤 上传文件</button>
          <button class="btn btn-secondary btn-sm" id="refresh-sync-files">🔄 刷新</button>
        </div>
        <div class="card">
          ${this.syncedFiles.map(f => `
            <div class="list-item">
              <span style="font-size:20px">${this._fileIcon(f.name)}</span>
              <div class="flex-1">
                <div style="font-weight:500;font-size:13px">${this._escape(f.name)}</div>
                <div class="text-muted" style="font-size:11px">${this._formatSize(f.size)}</div>
              </div>
              <button class="btn-icon" data-action="sync-download" data-name="${this._escape(f.name)}" data-sha="${f.sha}" title="下载">⬇️</button>
              <button class="btn-icon" data-action="sync-delete" data-name="${this._escape(f.name)}" data-sha="${f.sha}" title="删除">🗑️</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 绑定事件
    const uploadBtn = document.getElementById('upload-sync-file');
    const fileInput = document.getElementById('sync-file-input');
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          await this._uploadSyncedFile(file);
        }
        fileInput.value = '';
        await this._loadSyncedFiles();
      });
    }

    const refreshBtn = document.getElementById('refresh-sync-files');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._loadSyncedFiles());

    area.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const name = el.dataset.name;
        const sha = el.dataset.sha;
        if (action === 'sync-download') await this._downloadSyncedFile(name);
        else if (action === 'sync-delete') await this._deleteSyncedFile(name, sha);
      });
    });
  },

  async _createFileRepo() {
    const config = Sync.getConfig();
    const repoName = 'work-assistant-files';

    try {
      App.toast('正在创建仓库...');
      const resp = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          name: repoName,
          private: true,
          description: 'Work Assistant - Synced Files',
          auto_init: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        // 仓库已存在，直接使用
        if (resp.status === 422) {
          Store.setFileRepo(repoName);
          await Sync.autoSync();
          App.toast('已连接到已有仓库');
          await this._loadSyncedFiles();
          return;
        }
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      Store.setFileRepo(repoName);

      // 同步仓库配置到 Gist
      await Sync.autoSync();

      App.toast('仓库创建成功');
      await this._loadSyncedFiles();
    } catch (e) {
      console.error('Create repo error:', e);
      App.toast('创建仓库失败: ' + e.message);
    }
  },

  async _uploadSyncedFile(file) {
    const config = Sync.getConfig();
    const fileRepo = Store.getFileRepo();
    if (!fileRepo) return;

    if (file.size > 5 * 1024 * 1024) {
      App.toast(`${file.name} 超过 5MB，已跳过`);
      return;
    }

    try {
      App.toast(`正在上传 ${file.name}...`);

      // 读取文件为 base64
      const base64 = await this._fileToBase64(file);

      const resp = await fetch(
        `https://api.github.com/repos/${config.username}/${fileRepo}/contents/${encodeURIComponent(file.name)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `upload ${file.name}`,
            content: base64,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      App.toast(`已上传 ${file.name}`);
    } catch (e) {
      console.error('Upload error:', e);
      App.toast(`上传 ${file.name} 失败: ${e.message}`);
    }
  },

  async _downloadSyncedFile(filename) {
    const config = Sync.getConfig();
    const fileRepo = Store.getFileRepo();
    if (!fileRepo) return;

    try {
      App.toast(`正在下载 ${filename}...`);

      const resp = await fetch(
        `https://api.github.com/repos/${config.username}/${fileRepo}/contents/${encodeURIComponent(filename)}`,
        {
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      // content 是 base64 编码（可能有换行符）
      const base64 = data.content.replace(/\n/g, '');
      const blob = this._base64ToBlob(base64, data.encoding);

      // 触发下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      App.toast('已下载');
    } catch (e) {
      console.error('Download error:', e);
      App.toast(`下载失败: ${e.message}`);
    }
  },

  async _deleteSyncedFile(filename, sha) {
    if (!confirm(`确定删除 ${filename} 吗？`)) return;

    const config = Sync.getConfig();
    const fileRepo = Store.getFileRepo();
    if (!fileRepo) return;

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${config.username}/${fileRepo}/contents/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `delete ${filename}`,
            sha: sha,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      App.toast('已删除');
      await this._loadSyncedFiles();
    } catch (e) {
      console.error('Delete error:', e);
      App.toast(`删除失败: ${e.message}`);
    }
  },

  // ====== 本地文件树 ======

  _renderFileTreePlaceholder() {
    return '<div class="card text-center text-muted" style="padding:24px">加载中...</div>';
  },

  async _loadFileTree() {
    const fileTree = Store.getFileTree();
    this._renderFileTree(fileTree);
  },

  _renderFileTree(fileTree) {
    const area = document.getElementById('file-tree-area');
    if (!area) return;

    const hasTree = fileTree && fileTree.tree;
    const fsa = this.fsaSupported;

    if (!hasTree && !fsa) {
      // 手机端 / Safari：没有树数据
      area.innerHTML = `
        <div class="card text-center" style="padding:24px">
          <div style="font-size:32px;margin-bottom:8px">📱</div>
          <div class="text-muted" style="font-size:13px">
            请在电脑端 Chrome 浏览器扫描工作文件夹<br>扫描后文件树会自动同步到此设备
          </div>
        </div>
      `;
      return;
    }

    if (!hasTree && fsa) {
      // 电脑端 Chrome：还没选过文件夹
      area.innerHTML = `
        <div class="card text-center" style="padding:24px">
          <div style="font-size:32px;margin-bottom:8px">📂</div>
          <div style="font-weight:500;margin-bottom:8px">选择工作文件夹</div>
          <div class="text-muted" style="font-size:13px;margin-bottom:16px">
            选择你存放工作文件的文件夹，将扫描生成文件树并同步到手机端
          </div>
          <button class="btn btn-primary" id="pick-work-folder">选择文件夹</button>
        </div>
      `;
      const btn = document.getElementById('pick-work-folder');
      if (btn) btn.addEventListener('click', () => this._pickWorkFolder());
      return;
    }

    // 有树数据：渲染文件树
    const scannedDate = fileTree.scannedAt ? this._formatDate(fileTree.scannedAt) : '';
    area.innerHTML = `
      <div class="flex items-center justify-between mb-12" style="flex-wrap:wrap;gap:8px">
        <div class="text-muted" style="font-size:12px">
          📂 ${this._escape(fileTree.folderName || '工作文件夹')} · 最后扫描: ${scannedDate}
        </div>
        <div class="flex gap-8">
          ${fsa ? '<button class="btn btn-secondary btn-sm" id="rescan-folder">🔄 重新扫描</button>' : ''}
          ${fsa ? '<button class="btn btn-ghost btn-sm" id="change-folder">更换文件夹</button>' : ''}
        </div>
      </div>
      <div class="card" style="padding:8px;max-height:500px;overflow-y:auto">
        <div id="file-tree-container">
          ${this._renderTreeNodes(fileTree.tree, 0)}
        </div>
      </div>
    `;

    // 绑定折叠事件
    area.querySelectorAll('.tree-collapse').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const children = el.parentElement.nextElementSibling;
        if (children) {
          children.style.display = children.style.display === 'none' ? 'block' : 'none';
          el.textContent = children.style.display === 'none' ? '▸' : '▾';
        }
      });
    });

    // 绑定重新扫描
    const rescanBtn = document.getElementById('rescan-folder');
    if (rescanBtn) rescanBtn.addEventListener('click', () => this._rescanFolder());

    // 绑定更换文件夹
    const changeBtn = document.getElementById('change-folder');
    if (changeBtn) changeBtn.addEventListener('click', () => this._pickWorkFolder());
  },

  _renderTreeNodes(node, depth) {
    if (!node) return '';
    const indent = depth * 20;

    if (node.type === 'folder') {
      const childHtml = (node.children || [])
        .map(child => this._renderTreeNodes(child, depth + 1))
        .join('');
      return `
        <div class="tree-node" style="padding-left:${indent}px">
          <span class="tree-collapse">▾</span>
          <span style="font-size:14px">📂</span>
          <span style="font-size:13px;font-weight:500">${this._escape(node.name)}</span>
          <span class="text-muted" style="font-size:11px;margin-left:4px">${(node.children || []).length} 项</span>
        </div>
        <div class="tree-children">
          ${childHtml}
        </div>
      `;
    } else {
      return `
        <div class="tree-node" style="padding-left:${indent + 20}px">
          <span style="font-size:14px">${this._fileIcon(node.name)}</span>
          <span style="font-size:13px">${this._escape(node.name)}</span>
          ${node.size ? `<span class="text-muted" style="font-size:11px;margin-left:4px">${this._formatSize(node.size)}</span>` : ''}
        </div>
      `;
    }
  },

  async _pickWorkFolder() {
    if (!this.fsaSupported) return;

    try {
      const handle = await window.showDirectoryPicker();

      // 存 handle 到 IndexedDB（handle 不能 JSON 序列化）
      await DB.put('localFolders', {
        id: 'work-folder',
        name: handle.name,
        handle: handle,
        lastAccess: Date.now(),
      });

      // 扫描文件夹
      await this._scanAndSaveTree(handle);

      App.toast('文件夹已绑定并扫描完成');
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Pick folder error:', e);
        App.toast('选择文件夹失败');
      }
    }
  },

  async _rescanFolder() {
    try {
      const stored = await DB.get('localFolders', 'work-folder');
      if (!stored || !stored.handle) {
        App.toast('请重新选择文件夹');
        return;
      }

      // 请求权限
      const perm = await stored.handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        const requested = await stored.handle.requestPermission({ mode: 'read' });
        if (requested !== 'granted') {
          App.toast('需要授权访问文件夹');
          return;
        }
      }

      App.toast('正在扫描...');
      await this._scanAndSaveTree(stored.handle);
      App.toast('扫描完成');
    } catch (e) {
      console.error('Rescan error:', e);
      App.toast('扫描失败: ' + e.message);
    }
  },

  async _scanAndSaveTree(handle) {
    const tree = await this._scanDirectory(handle, handle.name);
    const fileTree = {
      tree: tree,
      scannedAt: Date.now(),
      folderName: handle.name,
    };
    Store.setFileTree(fileTree);

    // 触发 Gist 同步
    await Sync.autoSync();

    // 刷新 UI
    this._renderFileTree(fileTree);
  },

  async _scanDirectory(handle, name) {
    const node = {
      name: name,
      type: 'folder',
      children: [],
    };

    try {
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
          // 递归扫描子目录
          try {
            const subHandle = await handle.getDirectoryHandle(entry.name);
            const childNode = await this._scanDirectory(subHandle, entry.name);
            // 只添加非空文件夹
            if (childNode.children.length > 0) {
              node.children.push(childNode);
            }
          } catch (e) {
            // 跳过无权限的子目录
          }
        } else {
          // 文件
          try {
            const fileHandle = await handle.getFileHandle(entry.name);
            const file = await fileHandle.getFile();
            node.children.push({
              name: entry.name,
              type: 'file',
              size: file.size,
            });
          } catch (e) {
            // 跳过无法读取的文件
            node.children.push({
              name: entry.name,
              type: 'file',
              size: 0,
            });
          }
        }
      }
    } catch (e) {
      console.error('Scan directory error:', e);
    }

    return node;
  },

  // ====== 初始化 ======

  async init() {
    const config = Sync.getConfig();
    const isLoggedIn = !!(config.token && config.username);

    if (!isLoggedIn) return;

    // 加载同步文件列表
    await this._loadSyncedFiles();

    // 加载文件树
    await this._loadFileTree();
  },

  // ====== 工具方法 ======

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result = "data:...;base64,XXXX"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _base64ToBlob(base64, encoding) {
    const byteChars = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteChars.length; i += 512) {
      const slice = byteChars.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays);
  },

  _fileIcon(name) {
    if (!name) return '📦';
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'flac'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z', 'gz'].includes(ext)) return '🗜️';
    if (['js', 'ts', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(ext)) return '📜';
    if (['md', 'txt'].includes(ext)) return '📄';
    return '📦';
  },

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  },

  _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
