/**
 * Weather Module — 天气预报（Open-Meteo API）
 * 支持 24 小时预报 + 地理定位
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

  /**
   * 获取天气数据（24小时预报）
   * 缓存 30 分钟
   */
  async _getWeather(settings) {
    const now = Date.now();
    const cacheTime = settings.weatherCacheTime || 0;
    if (settings.weatherCache && (now - cacheTime) < 30 * 60 * 1000) {
      return settings.weatherCache;
    }

    try {
      const lat = settings.cityLat || 39.9042;
      const lon = settings.cityLon || 116.4074;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
        `&hourly=temperature_2m,weather_code` +
        `&timezone=Asia/Shanghai&forecast_hours=24`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();

      settings.weatherCache = data;
      settings.weatherCacheTime = now;
      Store.setSettings(settings);

      return data;
    } catch (e) {
      console.error('Weather fetch error:', e);
      return settings.weatherCache || null;
    }
  },

  /**
   * 渲染 24 小时天气（用于上班准备页面）
   */
  renderHourlyWeather(weather, settings) {
    const cur = weather.current;
    const hourly = weather.hourly;
    const code = cur.weather_code;
    const wc = this.weatherCodes[code] || { desc: '未知', icon: '❓' };

    // 当前时间的小时
    const nowHour = new Date().getHours();

    // 构建从当前小时开始的 24 小时数据
    const hours = [];
    if (hourly && hourly.time) {
      // 找到当前小时开始的索引
      let startIdx = 0;
      const nowStr = this._todayStr() + 'T' + String(nowHour).padStart(2, '0');
      startIdx = hourly.time.findIndex(t => t === nowStr);
      if (startIdx < 0) startIdx = 0;

      for (let i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
        const hCode = hourly.weather_code[i];
        const hWc = this.weatherCodes[hCode] || { desc: '未知', icon: '❓' };
        const time = new Date(hourly.time[i]);
        hours.push({
          hour: time.getHours(),
          temp: Math.round(hourly.temperature_2m[i]),
          icon: hWc.icon,
          desc: hWc.desc,
          isNow: i === startIdx,
        });
      }
    }

    return `
      <div class="weather-current-row">
        <div class="weather-current-main">
          <span class="weather-icon">${wc.icon}</span>
          <span class="weather-temp">${Math.round(cur.temperature_2m)}°</span>
          <span class="weather-desc">${wc.desc}</span>
        </div>
        <div class="weather-current-extra">
          <span class="text-muted" style="font-size:12px">💧 ${cur.relative_humidity_2m}%</span>
          <span class="text-muted" style="font-size:12px">💨 ${cur.wind_speed_10m}km/h</span>
        </div>
        <div class="weather-city-btn" id="weather-city-btn" title="切换城市或定位">
          📍 ${this._escape(settings.city || '未设置')}
        </div>
      </div>
      <div class="weather-hourly-scroll">
        ${hours.map(h => `
          <div class="weather-hour-cell ${h.isNow?'now':''}">
            <div class="weather-hour-label">${h.isNow?'现在':h.hour+':00'}</div>
            <div class="weather-hour-icon">${h.icon}</div>
            <div class="weather-hour-temp">${h.temp}°</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * 获取当前地理位置
   */
  _getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          // 逆地理编码获取城市名
          try {
            const resp = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=zh&count=1`
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.results && data.results.length > 0) {
                const r = data.results[0];
                resolve({
                  city: r.name,
                  lat: latitude,
                  lon: longitude,
                });
                return;
              }
            }
          } catch (e) {
            // 逆地理编码失败，用坐标
          }
          resolve({
            city: '当前位置',
            lat: latitude,
            lon: longitude,
          });
        },
        (err) => {
          reject(new Error(err.message || '定位失败'));
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
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

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _escape(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },
};
