/**
 * Crypto.js — Web Crypto API 封装
 * AES-GCM 256 加密 + PBKDF2 密钥派生
 * 纯浏览器原生 API，无外部依赖
 */
const Crypto = {
  /**
   * 从密码派生 AES-GCM 密钥
   * @param {string} password - 用户主密码
   * @param {string} saltBase64 - base64 编码的 salt（首次为空则随机生成）
   * @returns {Promise<{key: CryptoKey, salt: string}>}
   */
  async deriveKey(password, saltBase64) {
    const enc = new TextEncoder();

    // 生成或复用 salt
    let salt;
    if (saltBase64) {
      salt = this._base64ToBuffer(saltBase64);
    } else {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }

    // 导入密码为密钥原料
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // PBKDF2 派生 AES-GCM 密钥
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return { key, salt: this._bufferToBase64(salt) };
  },

  /**
   * 加密明文字符串
   * @param {string} plaintext - 要加密的文本
   * @param {string} password - 主密码
   * @param {string} existingSalt - 已有的 salt（base64），为空则生成新的
   * @returns {Promise<{salt: string, iv: string, ciphertext: string}>}
   */
  async encrypt(plaintext, password, existingSalt) {
    const enc = new TextEncoder();
    const { key, salt } = await this.deriveKey(password, existingSalt);

    // 每次加密生成新 IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(plaintext)
    );

    return {
      salt: salt,
      iv: this._bufferToBase64(iv),
      ciphertext: this._bufferToBase64(ciphertext),
    };
  },

  /**
   * 解密
   * @param {{salt: string, iv: string, ciphertext: string}} encryptedObj
   * @param {string} password - 主密码
   * @returns {Promise<string>} 明文字符串
   */
  async decrypt(encryptedObj, password) {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const { key } = await this.deriveKey(password, encryptedObj.salt);

    const iv = this._base64ToBuffer(encryptedObj.iv);
    const ciphertext = this._base64ToBuffer(encryptedObj.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    return dec.decode(plaintext);
  },

  /**
   * 生成随机设备 ID
   */
  generateDeviceId() {
    return crypto.randomUUID().slice(0, 8);
  },

  // ====== 工具方法 ======

  _bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  _base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },
};
