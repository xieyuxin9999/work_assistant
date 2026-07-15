/**
 * Weather Module — 天气预报（Open-Meteo API）
 */
window.Modules = window.Modules || {};
window.Modules.Weather = {
  weatherCodes: {
    0: { desc: '晴', icon: '☀️' },
    1: { desc: '晴间多云', icon: '🌤️' },
    2: { desc: '多云', icon: '⛅' },
    3: { desc: '阴', icon: '☁️' },
    45: { desc: '雾', icon: '🌫️' },
    48: { desc: '冻雾', icon: '🌫️' },
    51: { desc: '小毛毛雨', icon: '🌦️' },
    53: { desc: '毛毛雨', icon: '🌦️' },
    55: { desc: '大毛毛雨', icon: '🌧️' },
    56: { desc: '冻毛毛雨', icon: '🌧️' },
    57: { desc: '强冻毛毛雨', icon: '🌧️' },
    61: { desc: '小雨', icon: '🌦️' },
    63: { desc: '中雨', icon: '🌧️' },
    65: { desc: '大雨', icon: '🌧️' },
    66: { desc: '冻雨', icon: '🌧️' },
    67: { desc: '强冻雨', icon: '🌧️' },
    71: { desc: '小雪', icon: '🌨️' },
    73: { desc: '中雪', icon: '🌨️' },
    75: { desc: '大雪', icon: '❄️' },
    77: { desc: '雪粒', icon: '🌨️' },
    80: { desc: '小阵雨', icon: '🌦️' },
    81: { desc: '阵雨', icon: '🌧️' },
    82: { desc: '强阵雨', icon: '⛈️' },
    85: { desc: '阵雪', icon: '🌨️' },
    86: { desc: '强阵雪', icon: '❄️' },
    95: { desc: '雷阵雨', icon: '⛈️' },
    96: { desc: '雷阵雨伴冰雹', icon: '⛈️' },
    99: { desc: '强雷阵雨伴冰雹', icon: '⛈️' },
  },

  async render() {
    const settings = Store.getSettings();
    const weather = await this._getWeather(settings);
    const isCached = !weather;

    return `
      <div class="page-header">
        <div>
          <div class="page-title">天气预报</div>
          <div class="page-subtitle">${settings.city || '未设置城市'}</div>
        </div>
        <button class="btn btn-secondary" id="weather-refresh">↻ 刷新</button>
      </div>

      ${weather ? this._renderWeather(weather, settings) : `
        <div class="empty-state">
          <div class="empty-state-icon">🌤️</div>
          <div class="empty-state-text">无法获取天气数据，请检查网络连接</div>
          <button class="btn btn-primary mt-16" id="weather-retry">重试</button>
        </div>
      `}

      <div class="card mt-24">
        <div class="card-header">
          <div class="card-title">🏙️ 城市管理</div>
        </div>
        <div class="flex gap-8 mb-16">
          <input type="text" class="form-input" id="city-input" placeholder="搜索城市名（如：北京、上海）">
          <button class="btn btn-primary" id="city-search-btn">搜索</button>
        </div>
        <div id="city-results"></div>
        <div class="divider"></div>
        <div class="text-secondary mb-8" style="font-size:13px">当前城市</div>
        <div class="list-item">
          <span style="font-size:24px">📍</span>
          <span class="flex-1" style="font-weight:500">${settings.city || '未设置'}</span>
          ${settings.city ? `<button class="btn-text" id="city-reset">重置为北京</button>` : ''}
        </div>
      </div>
    `;
  },

  _renderWeather(weather, settings) {
    const cur = weather.current;
    const daily = weather.daily;
    const code = cur.weather_code;
    const wc = this.weatherCodes[code] || { desc: '未知', icon: '❓' };

    return `
      <div class="card mb-16" style="background:linear-gradient(135deg,#e8eef5,#f0f2f5)">
        <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:16px">
          <div>
            <div class="weather-icon">${wc.icon}</div>
            <div class="weather-temp">${Math.round(cur.temperature_2m)}°C</div>
            <div class="weather-desc">${wc.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="text-secondary" style="font-size:13px">💧 湿度 ${cur.relative_humidity_2m}%</div>
            <div class="text-secondary" style="font-size:13px">💨 风速 ${cur.wind_speed_10m} km/h</div>
            <div class="text-muted mt-8" style="font-size:12px">
              ${settings.weatherCacheTime ? '缓存于 ' + this._formatTime(settings.weatherCacheTime) : '刚刚获取'}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-${(daily.time||[]).length > 3 ? '4' : '3'}">
        ${(daily.time||[]).slice(0, 7).map((date, i) => {
          const dc = daily.weather_code[i];
          const dwc = this.weatherCodes[dc] || { desc: '未知', icon: '❓' };
          return `
            <div class="card text-center">
              <div class="text-secondary" style="font-size:13px">${this._formatDay(date, i)}</div>
              <div style="font-size:32px;margin:8px 0">${dwc.icon}</div>
              <div style="font-weight:600">${Math.round(daily.temperature_2m_max[i])}°</div>
              <div class="text-muted" style="font-size:13px">${Math.round(daily.temperature_2m_min[i])}°</div>
              <div class="text-muted" style="font-size:11px;margin-top:4px">${dwc.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async _getWeather(settings) {
    // 检查缓存（30分钟内有效）
    const now = Date.now();
    const cacheTime = settings.weatherCacheTime || 0;
    if (settings.weatherCache && (now - cacheTime) < 30 * 60 * 1000) {
      return settings.weatherCache;
    }

    // 获取新数据
    try {
      const lat = settings.cityLat || 39.9042;
      const lon = settings.cityLon || 116.4074;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&timezone=Asia/Shanghai&forecast_days=7`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();

      // 缓存
      settings.weatherCache = data;
      settings.weatherCacheTime = now;
      Store.setSettings(settings);

      return data;
    } catch (e) {
      console.error('Weather fetch error:', e);
      // 返回缓存（即使过期）
      return settings.weatherCache || null;
    }
  },

  async _searchCity(name) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&language=zh&count=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Geocoding API error');
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      console.error('City search error:', e);
      return [];
    }
  },

  async init() {
    const refreshBtn = document.getElementById('weather-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
      const settings = Store.getSettings();
      settings.weatherCache = null;
      settings.weatherCacheTime = 0;
      Store.setSettings(settings);
      await this._reload();
      App.toast('已刷新');
    });

    const retryBtn = document.getElementById('weather-retry');
    if (retryBtn) retryBtn.addEventListener('click', async () => {
      const settings = Store.getSettings();
      settings.weatherCache = null;
      Store.setSettings(settings);
      await this._reload();
    });

    const searchBtn = document.getElementById('city-search-btn');
    const cityInput = document.getElementById('city-input');
    const resultsDiv = document.getElementById('city-results');

    const doSearch = async () => {
      const name = cityInput.value.trim();
      if (!name) return;
      resultsDiv.innerHTML = '<div class="text-muted text-center mt-8">搜索中...</div>';
      const results = await this._searchCity(name);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="text-muted text-center mt-8">未找到城市</div>';
        return;
      }
      resultsDiv.innerHTML = results.map(r => `
        <div class="list-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}${r.admin1?', '+r.admin1:''}">
          <span>📍</span>
          <span class="flex-1">${r.name}${r.admin1?', '+r.admin1:''}${r.country?', '+r.country:''}</span>
          <button class="btn-text">选择</button>
        </div>
      `).join('');

      resultsDiv.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', async () => {
          const settings = Store.getSettings();
          settings.city = el.dataset.name;
          settings.cityLat = parseFloat(el.dataset.lat);
          settings.cityLon = parseFloat(el.dataset.lon);
          settings.weatherCache = null;
          settings.weatherCacheTime = 0;
          Store.setSettings(settings);
          await this._reload();
          App.toast('已切换城市');
        });
      });
    };

    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (cityInput) cityInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });

    const resetBtn = document.getElementById('city-reset');
    if (resetBtn) resetBtn.addEventListener('click', async () => {
      const settings = Store.getSettings();
      settings.city = '北京';
      settings.cityLat = 39.9042;
      settings.cityLon = 116.4074;
      settings.weatherCache = null;
      settings.weatherCacheTime = 0;
      Store.setSettings(settings);
      await this._reload();
      App.toast('已重置');
    });
  },

  async _reload() {
    const view = document.getElementById('view');
    view.innerHTML = await this.render();
    await this.init();
  },

  _formatDay(dateStr, index) {
    if (index === 0) return '今天';
    if (index === 1) return '明天';
    if (index === 2) return '后天';
    const d = new Date(dateStr);
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return days[d.getDay()];
  },

  _formatTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
};
