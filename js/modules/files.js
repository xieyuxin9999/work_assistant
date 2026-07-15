/**
 * Files Module — 文件管理（IndexedDB）
 */
window.Modules = window.Modules || {};
window.Modules.Files = {
  files: [],

  async render() {
    this.files = await DB.getAll('files');
    this.files.sort((a, b) => b.createdAt - a.createdAt);

    const totalSize = this.files.reduce((sum, f) => sum + (f.size || 0), 0);

    return `
      <div class="page-header">
        <div>
          <div class="page-title">文件管理</div>
          <div class="page-subtitle">${this.files.length} 个文件 · ${this._formatSize(totalSize)}</div>
        </div>
      </div>

      <div class="drop-zone mb-16" id="file-drop-zone">
        <div class="drop-zone-icon">📁</div>
        <div>点击或拖拽文件到此处上传</div>
        <div class="text-muted mt-8" style="font-size:12px">支持任意类型文件，建议单文件不超过 50MB</div>
        <input type="file" id="file-input" multiple style="display:none">
      </div>

      ${this.files.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div class="empty-state-text">还没有上传任何文件</div>
        </div>
      ` : `
        <div class="card">
          <div id="file-list">
            ${this.files.map(f => this._renderItem(f)).join('')}
          </div>
        </div>
      `}
    `;
  },

  _renderItem(f) {
    const icon = this._fileIcon(f.type, f.name);
    return `
      <div class="list-item" data-id="${f.id}">
        <span style="font-size:24px">${icon}</span>
        <div class="flex-1">
          <div style="font-weight:500">${this._escape(f.name)}</div>
          <div class="text-muted" style="font-size:12px">
            ${this._formatSize(f.size)} · ${this._formatDate(f.createdAt)}
            ${f.folder ? `· 📂 ${this._escape(f.folder)}` : ''}
          </div>
        </div>
        ${f.type && f.type.startsWith('image/') ? `
          <button class="btn-icon" data-action="preview" data-id="${f.id}" title="预览">👁️</button>
        ` : ''}
        <button class="btn-icon" data-action="download" data-id="${f.id}" title="下载">⬇️</button>
        <button class="btn-icon" data-action="delete" data-id="${f.id}" title="删除">🗑️</button>
      </div>
    `;
  },

  async init() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone && fileInput) {
      // 点击上传
      dropZone.addEventListener('click', () => fileInput.click());

      // 文件选择
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          await this._upload(file);
        }
        fileInput.value = '';
        await this._reload();
        App.toast(`已上传 ${files.length} 个文件`);
      });

      // 拖拽
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
          await this._upload(file);
        }
        await this._reload();
        App.toast(`已上传 ${files.length} 个文件`);
      });
    }

    // 列表操作
    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'download') await this._download(id);
        else if (action === 'delete') await this._delete(id);
        else if (action === 'preview') await this._preview(id);
      });
    });
  },

  async _upload(file) {
    // 检查大小
    if (file.size > 50 * 1024 * 1024) {
      App.toast(`文件 ${file.name} 超过 50MB，已跳过`);
      return;
    }

    const data = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      folder: '',
      createdAt: Date.now(),
    };

    try {
      await DB.add('files', data);
    } catch (e) {
      console.error('Upload error:', e);
      App.toast(`上传 ${file.name} 失败`);
    }
  },

  async _download(id) {
    const file = await DB.get('files', id);
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.toast('已下载');
  },

  async _delete(id) {
    if (!confirm('确定删除这个文件吗？')) return;
    await DB.delete('files', id);
    await this._reload();
    App.toast('已删除');
  },

  async _preview(id) {
    const file = await DB.get('files', id);
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      App.toast('仅支持图片预览');
      return;
    }
    const url = URL.createObjectURL(file.blob);

    App.openModal({
      title: file.name,
      body: `<img src="${url}" style="width:100%;border-radius:var(--radius-sm)" onload="this.dataset.loaded=1">`,
      onConfirm: () => {
        URL.revokeObjectURL(url);
        App.closeModal();
      }
    });
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _fileIcon(type, name) {
    if (type && type.startsWith('image/')) return '🖼️';
    if (type && type.startsWith('video/')) return '🎬';
    if (type && type.startsWith('audio/')) return '🎵';
    if (type && type.includes('pdf')) return '📄';
    if (type && type.includes('word')) return '📝';
    if (type && type.includes('excel')) return '📊';
    if (type && type.includes('zip')) return '🗜️';
    if (name) {
      const ext = name.split('.').pop().toLowerCase();
      if (['js','ts','py','java','go','rs','c','cpp','html','css','json','xml','yaml','yml'].includes(ext)) return '📜';
      if (['md','txt'].includes(ext)) return '📄';
    }
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
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
