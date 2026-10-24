(function () {
  const EVENTS = window.CROATIA_EVENTS || [];
  const REGIONS = [
    { id: 'all', zh: '全部地區', en: 'All Regions', hr: 'Sve regije', x: 50, y: 50, weather: '19°C 晴' },
    { id: 'zagreb', zh: '薩格勒布', en: 'Zagreb', hr: 'Zagreb', x: 55, y: 24, weather: '16°C 晴間多雲' },
    { id: 'istria', zh: '羅維尼・伊斯特拉', en: 'Rovinj & Istria', hr: 'Rovinj i Istra', x: 20, y: 34, weather: '19°C 陽光充沛' },
    { id: 'plitvice', zh: '十六湖國家公園', en: 'Plitvice Lakes', hr: 'Plitvička jezera', x: 48, y: 46, weather: '14°C 秋高氣爽' },
    { id: 'zadar', zh: '扎達爾', en: 'Zadar', hr: 'Zadar', x: 40, y: 63, weather: '20°C 海風晴朗' },
    { id: 'split', zh: '斯普利特', en: 'Split', hr: 'Split', x: 58, y: 74, weather: '21°C 晴朗' },
    { id: 'hvar', zh: '赫瓦爾島', en: 'Hvar Island', hr: 'Otok Hvar', x: 53, y: 84, weather: '22°C 陽光之島' },
    { id: 'dubrovnik', zh: '杜布羅夫尼克', en: 'Dubrovnik', hr: 'Dubrovnik', x: 80, y: 90, weather: '22°C 碧海晴天' }
  ];
  const CATS = [
    { id: 'all', zh: '全部', en: 'All', cls: '' },
    { id: 'food', zh: '松露・美酒美食', en: 'Truffle & Wine', cls: 'cat-food' },
    { id: 'nature', zh: '十六湖・自然絕景', en: 'Nature & Parks', cls: 'cat-nature' },
    { id: 'festival', zh: '節慶・傳統', en: 'Festivals', cls: 'cat-festival' },
    { id: 'market', zh: '農夫・古董市集', en: 'Markets', cls: 'cat-market' },
    { id: 'music', zh: '音樂・海風琴', en: 'Music & Night', cls: 'cat-music' },
    { id: 'art', zh: '藝術・博物館', en: 'Art & Museums', cls: 'cat-art' },
    { id: 'free', zh: '免費活動', en: 'Free Entry', cls: 'cat-free' }
  ];

  const state = {
    tab: 'events',
    lang: localStorage.getItem('hr_lang') || 'zh',
    dark: localStorage.getItem('hr_dark') === '1',
    selectedDate: '2026-10-24',
    region: 'all',
    cat: 'all',
    search: '',
    onlySaved: false,
    saved: JSON.parse(localStorage.getItem('hr_saved') || '["hr-101","hr-102","hr-108","hr-114"]'),
    itinerary: JSON.parse(localStorage.getItem('hr_trip') || '["hr-104","hr-106","hr-107","hr-102","hr-101","hr-108","hr-114"]'),
    visited: JSON.parse(localStorage.getItem('hr_visited') || '["hr-101","hr-102","hr-108","hr-109","hr-114"]'),
    ratings: JSON.parse(localStorage.getItem('hr_ratings') || '{"hr-101":5,"hr-102":5,"hr-108":5}'),
    eurRate: 8.45,
    activeEventId: null
  };

  function saveState() {
    localStorage.setItem('hr_saved', JSON.stringify(state.saved));
    localStorage.setItem('hr_trip', JSON.stringify(state.itinerary));
    localStorage.setItem('hr_visited', JSON.stringify(state.visited));
    localStorage.setItem('hr_ratings', JSON.stringify(state.ratings));
    localStorage.setItem('hr_lang', state.lang);
    localStorage.setItem('hr_dark', state.dark ? '1' : '0');
  }

  function getTitle(ev) {
    if (state.lang === 'en') return ev.title_en;
    if (state.lang === 'hr') return ev.title_hr;
    return ev.title_zh;
  }

  function filteredEvents() {
    return EVENTS.filter(ev => {
      if (state.onlySaved && !state.saved.includes(ev.id)) return false;
      if (state.region !== 'all' && ev.region !== state.region) return false;
      if (state.cat === 'free' && !ev.isFree) return false;
      else if (state.cat !== 'all' && state.cat !== 'free' && ev.category !== state.cat) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        const blob = [ev.title_zh, ev.title_en, ev.title_hr, ev.regionName_zh, ev.venue_zh, ev.summary_zh].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (state.selectedDate && state.selectedDate !== 'all') {
        if (ev.startDate > state.selectedDate || ev.endDate < state.selectedDate) return false;
      }
      return true;
    });
  }

  function renderDateStrip() {
    const strip = document.getElementById('dateStrip');
    if (!strip) return;
    const days = [
      { date: 'all', dow: '全部', dom: '不限' },
      { date: '2026-10-24', dow: '今日', dom: '24' },
      { date: '2026-10-25', dow: '日', dom: '25' },
      { date: '2026-10-26', dow: '一', dom: '26' },
      { date: '2026-10-27', dow: '二', dom: '27' },
      { date: '2026-10-28', dow: '三', dom: '28' },
      { date: '2026-10-29', dow: '四', dom: '29' },
      { date: '2026-10-30', dow: '五', dom: '30' },
      { date: '2026-10-31', dow: '六', dom: '31' },
      { date: '2026-11-07', dow: '11月', dom: '7' },
      { date: '2026-12-05', dow: '聖誕', dom: '12/5' }
    ];
    strip.innerHTML = `<div class="month-label">2026 10–12月</div>` + days.map(d => `
      <div class="date-capsule ${state.selectedDate === d.date ? 'active' : ''}" data-date="${d.date}">
        <span class="dow">${d.dow}</span>
        <span class="dom">${d.dom}</span>
        <span class="dot"></span>
      </div>
    `).join('');
    strip.querySelectorAll('.date-capsule').forEach(el => {
      el.onclick = () => { state.selectedDate = el.dataset.date; renderAll(); };
    });
  }

  function renderFilters() {
    const rWrap = document.getElementById('regionFilters');
    const cWrap = document.getElementById('catFilters');
    if (rWrap) {
      rWrap.innerHTML = REGIONS.map(r => `
        <button class="chip ${state.region === r.id ? 'active' : ''}" data-region="${r.id}">
          📍 ${state.lang === 'en' ? r.en : r.zh}
        </button>
      `).join('');
      rWrap.querySelectorAll('.chip').forEach(b => {
        b.onclick = () => { state.region = b.dataset.region; renderAll(); };
      });
    }
    if (cWrap) {
      cWrap.innerHTML = CATS.map(c => `
        <button class="chip ${c.cls} ${state.cat === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${state.lang === 'en' ? c.en : c.zh}
        </button>
      `).join('');
      cWrap.querySelectorAll('.chip').forEach(b => {
        b.onclick = () => { state.cat = b.dataset.cat; renderAll(); };
      });
    }
  }

  function renderMapClusters() {
    const layer = document.getElementById('mapClusters');
    const wPill = document.getElementById('mapWeatherPill');
    const sPill = document.getElementById('mapStatusPill');
    if (!layer) return;
    const curReg = REGIONS.find(r => r.id === state.region) || REGIONS[0];
    if (wPill) wPill.innerHTML = `☀️ ${curReg.zh} · ${curReg.weather} · 1€ ≈ HK$${state.eurRate.toFixed(2)}`;
    const list = filteredEvents();
    if (sPill) sPill.textContent = `克羅地亞全境共 ${list.length} 個精選活動 · 點擊地圖圈圈篩選地區`;

    layer.innerHTML = REGIONS.filter(r => r.id !== 'all').map(r => {
      const cnt = EVENTS.filter(e => e.region === r.id && (state.selectedDate === 'all' || (e.startDate <= state.selectedDate && e.endDate >= state.selectedDate))).length;
      return `
        <button class="map-cluster ${state.region === r.id ? 'active' : ''}" style="left:${r.x}%;top:${r.y}%" data-region="${r.id}">
          <span class="cname">${r.zh.split('・')[0]}</span>
          <span class="ccount">${cnt}</span>
        </button>
      `;
    }).join('');
    layer.querySelectorAll('.map-cluster').forEach(b => {
      b.onclick = () => {
        state.region = state.region === b.dataset.region ? 'all' : b.dataset.region;
        renderAll();
      };
    });
  }

  function renderEventsTab() {
    const featWrap = document.getElementById('featuredScroll');
    const listWrap = document.getElementById('eventsGrid');
    const countSpan = document.getElementById('eventsCountLabel');
    const savedBtn = document.getElementById('floatingSavedBtn');

    const featured = EVENTS.filter(e => e.featured);
    if (featWrap) {
      featWrap.innerHTML = featured.map(ev => `
        <div class="feat-card" data-open="${ev.id}">
          <div class="feat-img-wrap">
            <img src="${ev.image}" alt="${ev.title_zh}" loading="lazy">
            <span class="feat-badge">${ev.specialTag || '精選特輯'}</span>
          </div>
          <div class="feat-body">
            <div class="feat-title">${getTitle(ev)}</div>
            <div class="feat-meta">📍 ${ev.regionName_zh} · ${ev.isFree ? '免費' : '€' + ev.price_eur}</div>
          </div>
        </div>
      `).join('');
      featWrap.querySelectorAll('.feat-card').forEach(c => {
        c.onclick = () => openDetail(c.dataset.open);
      });
    }

    const list = filteredEvents();
    if (countSpan) countSpan.textContent = `${list.length} 個活動（按熱門及結束日排序）`;
    if (savedBtn) {
      savedBtn.innerHTML = state.onlySaved ? `★ 顯示全部 (${EVENTS.length})` : `♥ 已收藏 ${state.saved.length}`;
      savedBtn.onclick = () => { state.onlySaved = !state.onlySaved; renderAll(); };
    }

    if (listWrap) {
      listWrap.innerHTML = list.map(ev => {
        const isSaved = state.saved.includes(ev.id);
        const inTrip = state.itinerary.includes(ev.id);
        const hkd = Math.round(ev.price_eur * state.eurRate);
        return `
          <article class="ev-card">
            <div class="ev-card-top" data-open="${ev.id}">
              <img class="ev-thumb" src="${ev.image}" alt="${ev.title_zh}" loading="lazy">
              <div class="ev-info">
                <div class="ev-tags">
                  <span class="tag-pill">${ev.regionName_zh}</span>
                  ${ev.specialTag ? `<span class="tag-pill red">${ev.specialTag}</span>` : ''}
                  ${ev.isFree ? `<span class="tag-pill free">免費入場</span>` : `<span class="tag-pill">€${ev.price_eur} (≈HK$${hkd})</span>`}
                </div>
                <h3 class="ev-title">${getTitle(ev)}</h3>
                <div class="ev-sub">🇭🇷 ${ev.title_hr}</div>
                <div class="ev-meta-line">🗓 ${ev.startDate.slice(5)} 至 ${ev.endDate.slice(5)} · ⏰ ${ev.time}</div>
                <div class="ev-meta-line">📍 ${ev.venue_zh}</div>
              </div>
            </div>
            <div class="ev-card-actions">
              <span style="font-size:11.5px;color:var(--muted);font-weight:700">👥 ${ev.votes.length} 人想去</span>
              <div style="display:flex;gap:6px">
                <button class="act-btn ${isSaved ? 'saved' : ''}" data-save="${ev.id}">${isSaved ? '♥ 已收藏' : '♡ 收藏'}</button>
                <button class="act-btn ${inTrip ? 'in-trip' : ''}" data-trip="${ev.id}">${inTrip ? '✓ 已在行程' : '＋ 加入行程'}</button>
              </div>
            </div>
          </article>
        `;
      }).join('');

      listWrap.querySelectorAll('[data-open]').forEach(el => {
        el.onclick = () => openDetail(el.dataset.open);
      });
      listWrap.querySelectorAll('[data-save]').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); toggleSave(btn.dataset.save); };
      });
      listWrap.querySelectorAll('[data-trip]').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); toggleTrip(btn.dataset.trip); };
      });
    }
  }

  function renderTripTab() {
    const wrap = document.getElementById('tripContainer');
    if (!wrap) return;
    const tripEvents = state.itinerary.map(id => EVENTS.find(e => e.id === id)).filter(Boolean);
    const voteSorted = [...EVENTS].sort((a, b) => b.votes.length - a.votes.length).slice(0, 5);

    wrap.innerHTML = `
      <div class="panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="tag-pill red">克羅地亞發展有限公司・專屬功能</span>
            <h3 style="margin-top:4px">🇭🇷 克羅地亞秋日精華之旅（共享時間軸）</h3>
            <div style="font-size:12.5px;color:var(--muted)">同行夥伴：Jessie, Marco, Ana · 專家顧問：Justin Chan & Igor Diminić (WhatsApp 全程支援)</div>
          </div>
          <button class="pill-btn accent" id="btnShareTripLink">🔗 複製行程連結</button>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="pill-btn primary" data-preset="8d">載入：經典克羅地亞 8 天精華遊 ($730起)</button>
          <button class="pill-btn" data-preset="10d">載入：克羅地亞＋斯洛文尼亞 10 天遊</button>
          <button class="pill-btn" id="btnGenVideo">🎬 生成旅程路線回顧短片</button>
        </div>
      </div>

      <div class="panel-card">
        <h3>📅 已排入行程 (${tripEvents.length} 個安排 · 自動計算點對點交通)</h3>
        ${tripEvents.map((ev, idx) => `
          <div class="pkg-card" style="margin-top:10px">
            <img src="${ev.image}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex:none">
            <div style="flex:1;min-width:0;cursor:pointer" data-open="${ev.id}">
              <div style="font-size:11px;font-weight:800;color:var(--accent)">Day ${Math.floor(idx/2)+1} · ${ev.time.split('（')[0]} · ${ev.regionName_zh}</div>
              <div style="font-size:14px;font-weight:800">${getTitle(ev)}</div>
              <div style="font-size:11.5px;color:var(--muted)">🚗 ${ev.transport_zh}</div>
            </div>
            <button class="act-btn" data-rmtrip="${ev.id}">移除</button>
          </div>
        `).join('')}
      </div>

      <div class="panel-card">
        <h3>🗳 大家想去哪裡？一起投票決定（票數最高排最前）</h3>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">把想去的活動放進共享行程，旅伴按「想去」投票，一按排入正式行程！</div>
        ${voteSorted.map((ev, i) => `
          <div class="pkg-card">
            <div style="flex:1">
              ${i === 0 ? `<span class="tag-pill red">👑 最多人想去</span>` : ''}
              <div style="font-size:14px;font-weight:800;margin-top:2px">${getTitle(ev)}</div>
              <div style="font-size:12px;color:var(--muted)">📍 ${ev.regionName_zh} · 👥 ${ev.votes.join(', ')} (${ev.votes.length} 票)</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="act-btn saved" data-vote="${ev.id}">👍 想去 +1</button>
              <button class="act-btn in-trip" data-trip="${ev.id}">${state.itinerary.includes(ev.id) ? '✓ 已排入' : '排入行程'}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    wrap.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openDetail(el.dataset.open));
    wrap.querySelectorAll('[data-rmtrip]').forEach(b => b.onclick = () => toggleTrip(b.dataset.rmtrip));
    wrap.querySelectorAll('[data-trip]').forEach(b => b.onclick = () => toggleTrip(b.dataset.trip));
    wrap.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => {
      const ev = EVENTS.find(e => e.id === b.dataset.vote);
      if (ev) { ev.votes.push('你'); renderTripTab(); }
    });
    wrap.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      state.itinerary = b.dataset.preset === '8d'
        ? ['hr-104','hr-106','hr-121','hr-102','hr-109','hr-108','hr-124','hr-114']
        : ['hr-104','hr-107','hr-101','hr-111','hr-120','hr-102','hr-109','hr-108','hr-119','hr-114'];
      saveState(); renderAll();
    });
    const shareBtn = document.getElementById('btnShareTripLink');
    if (shareBtn) shareBtn.onclick = () => alert('已複製「本日克羅地亞」唯讀共享行程連結！朋友打開即可一鍵複製到自己的行程。');
    const vidBtn = document.getElementById('btnGenVideo');
    if (vidBtn) vidBtn.onclick = () => alert('🎬 已根據你的薩格勒布 → 十六湖 → 扎達爾 → 斯普利特 → 杜布羅夫尼克路線生成 1080p 回顧短片預覽！');
  }

  function renderCardsTab() {
    const wrap = document.getElementById('cardsContainer');
    if (!wrap) return;
    const vList = state.visited.map(id => EVENTS.find(e => e.id === id)).filter(Boolean);
    wrap.innerHTML = `
      <div class="panel-card" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3>🏅 已去過的活動紀念卡（已收集 ${vList.length} 張）</h3>
          <div style="font-size:12px;color:var(--muted)">到達克羅地亞現場自動蓋上「POSJEĆENO 來場」印章，有機會抽中黑金 1% 隱藏卡！</div>
        </div>
      </div>
      ${vList.map((ev, i) => {
        const rarity = i === 0 ? '黑金 1% 隱藏卡' : (i % 2 === 1 ? '金卡 5% 限定' : '典藏紀念卡');
        const stars = state.ratings[ev.id] || 5;
        return `
          <div class="souvenir-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span class="souvenir-rarity">✦ ${rarity}</span>
              <span style="font-size:11.5px;color:#CFCBC2">編號 #HR-2026-0${i+1}</span>
            </div>
            <div style="display:flex;gap:12px">
              <img src="${ev.image}" style="width:92px;height:92px;border-radius:12px;object-fit:cover;border:1px solid #D4AF37">
              <div style="flex:1;padding-right:78px">
                <div style="font-size:11px;color:#FAD46B;font-weight:700">${ev.regionName_zh} · ${ev.venue_zh}</div>
                <div style="font-size:15.5px;font-weight:800;margin:3px 0">${getTitle(ev)}</div>
                <div style="font-size:11.5px;color:#B8B4AA">🇭🇷 ${ev.title_hr}</div>
                <div style="margin-top:6px;font-size:13px;color:#FAD46B">你的評分：${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</div>
              </div>
            </div>
            <div class="visited-stamp">
              <div>POSJEĆENO</div>
              <div style="font-size:13px">来場 VISITED</div>
              <div style="font-size:9px">CROATIA 2026</div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  function renderMoreTab() {
    const wrap = document.getElementById('moreContainer');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="panel-card" style="border-color:var(--accent);background:linear-gradient(180deg,var(--card),var(--bg))">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="assets/icon-192.png" style="width:60px;height:60px;border-radius:15px;box-shadow:0 4px 12px rgba(0,0,0,0.2)">
          <div>
            <span class="tag-pill red">官方出品・香港持牌旅行社 354071</span>
            <h3 style="font-size:18px;margin-top:3px">克羅地亞發展有限公司 (Croatia Travel)</h3>
            <div style="font-size:12px;color:var(--muted)">專注克羅地亞及東歐小眾深度遊 14 年 · 官方網站：<a href="https://croatia.com.hk/" target="_blank" style="color:var(--accent);font-weight:800">https://croatia.com.hk/</a></div>
          </div>
        </div>
        <p style="font-size:13px;line-height:1.65;color:var(--body);margin:10px 0">
          「克羅地亞遊」帶領香港及全球華人旅客深入探索克羅地亞、斯洛文尼亞、波斯尼亞、黑山及意大利。出發前由克羅地亞旅遊專家 <b>Justin Chan</b> 親自教路行程注意事項；旅程期間當地客戶服務同事 <b>Igor Diminić</b> 以 WhatsApp 全程溝通支援，玩得開心又放心！
        </p>
        <div class="pkg-card">
          <div><b>經典克羅地亞 8 天精華遊</b>（2–12人私人小包團 / 自駕遊，隨時出發）</div>
          <a href="https://croatia.com.hk/" target="_blank" class="pill-btn accent" style="text-decoration:none">EUR $730 起 ➔</a>
        </div>
        <div class="pkg-card">
          <div><b>經典克羅地亞、斯洛文尼亞 10 天精華遊</b>（沒有既定日期，隨時出發）</div>
          <a href="https://croatia.com.hk/" target="_blank" class="pill-btn primary" style="text-decoration:none">官網查詢 ➔</a>
        </div>
        <div class="pkg-card">
          <div><b>經典東歐三國 11 天精華遊</b>（學校・企業・教會團體包團訂制）</div>
          <a href="https://croatia.com.hk/" target="_blank" class="pill-btn" style="text-decoration:none">EUR $1,025 起 ➔</a>
        </div>
        <div style="margin-top:12px;font-size:12.5px;color:var(--ink);font-weight:700;display:flex;flex-wrap:wrap;gap:12px">
          <span>📞 電話：<a href="tel:+85223701600" style="color:var(--accent)">(+852) 2370 1600</a></span>
          <span>✉️ 電郵：<a href="mailto:info@croatia.com.hk" style="color:var(--accent)">info@croatia.com.hk</a></span>
          <span>🪪 旅行社牌照：354071</span>
        </div>
      </div>

      <div class="panel-card">
        <h3>💶 歐元 (EUR) ⇄ 港幣 (HKD) 即時換算器</h3>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">克羅地亞於 2023 年 1 月 1 日正式加入歐元區，法定貨幣為歐元 (€)，舊幣 Kuna 已停用。</div>
        <div style="display:flex;gap:10px;align-items:center">
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700">歐元 EUR (€)</label>
            <input type="number" id="inpEur" value="35" class="search-input" style="margin-top:4px">
          </div>
          <div style="font-size:20px;font-weight:800;padding-top:16px">⇄</div>
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700">港幣 HKD ($)</label>
            <input type="text" id="outHkd" value="HK$ 295.75" readonly class="search-input" style="margin-top:4px;font-weight:800;color:var(--accent)">
          </div>
        </div>
      </div>

      <div class="panel-card">
        <h3>🛂 克羅地亞實用旅遊錦囊 & 緊急電話（資料來源：croatia.com.hk）</h3>
        <div class="detail-grid" style="margin-top:8px">
          <div class="d-row"><div class="d-lbl">免簽證</div><div class="d-val">持香港特區護照或 BNO 可於 180 天內免簽證逗留克羅地亞 90 日（神根區）。</div></div>
          <div class="d-row"><div class="d-lbl">氣候穿搭</div><div class="d-val">沿海（杜城/斯普利特）屬地中海氣候陽光充沛；內陸（十六湖/薩格勒布）溫帶氣候，秋季宜備防風外套。即時天氣：meteo.hr</div></div>
          <div class="d-row"><div class="d-lbl">購物退稅</div><div class="d-val">一般商品增值稅 (VAT) 25%。離境前於機場海關出示未開封商品、發票及 PRV-P 退稅表蓋印，即可退稅。</div></div>
          <div class="d-row"><div class="d-lbl">電壓插座</div><div class="d-val">電壓 220V（與香港相同），採用歐洲雙圓腳 F 型插座。</div></div>
          <div class="d-row"><div class="d-lbl">緊急電話</div><div class="d-val">歐盟通用緊急電話：<b>112</b> ｜ 警局：<b>192</b> ｜ 消防：<b>193</b> ｜ 救護車：<b>194</b> ｜ 薩格勒布機場：+385-1-6265222</div></div>
        </div>
      </div>
    `;
    const inp = document.getElementById('inpEur');
    const out = document.getElementById('outHkd');
    if (inp && out) {
      inp.oninput = () => {
        const v = parseFloat(inp.value) || 0;
        out.value = 'HK$ ' + (v * state.eurRate).toFixed(2);
      };
    }
  }

  function openDetail(id) {
    const ev = EVENTS.find(e => e.id === id);
    if (!ev) return;
    state.activeEventId = id;
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    const bottom = document.getElementById('detailBottomBar');
    const isSaved = state.saved.includes(id);
    const inTrip = state.itinerary.includes(id);
    const isVisited = state.visited.includes(id);
    const hkd = Math.round(ev.price_eur * state.eurRate);

    content.innerHTML = `
      <div class="detail-hero">
        <img src="${ev.image}" alt="${ev.title_zh}">
        <button class="detail-close" id="btnCloseModal">✕</button>
        <div class="detail-hero-tags">
          <span class="tag-pill" style="background:var(--accent);color:#fff">${ev.specialTag || ev.regionName_zh}</span>
          <span class="tag-pill" style="background:rgba(0,0,0,0.7);color:#fff">${ev.isFree ? '免費觀賞' : '€' + ev.price_eur}</span>
        </div>
      </div>
      <div class="detail-body">
        <div style="font-size:12px;color:var(--accent);font-weight:800">📍 ${ev.regionName_zh} · ${ev.venue_zh}</div>
        <h2 style="margin:4px 0;font-size:20px;line-height:1.3">${getTitle(ev)}</h2>
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">🇭🇷 原名：${ev.title_hr}</div>
        <p style="font-size:14px;line-height:1.65;color:var(--body);margin:0 0 12px">${ev.description_zh}</p>
        <div class="detail-grid">
          <div class="d-row"><div class="d-lbl">日期</div><div class="d-val">${ev.startDate} 至 ${ev.endDate}</div></div>
          <div class="d-row"><div class="d-lbl">時間</div><div class="d-val">${ev.time}</div></div>
          <div class="d-row"><div class="d-lbl">場地</div><div class="d-val">${ev.venue_zh} (${ev.venue_hr})</div></div>
          <div class="d-row"><div class="d-lbl">地址</div><div class="d-val">${ev.address}</div></div>
          <div class="d-row"><div class="d-lbl">交通距離</div><div class="d-val">${ev.transport_zh}</div></div>
          <div class="d-row"><div class="d-lbl">最近車站</div><div class="d-val">${ev.nearestStation_zh}</div></div>
          <div class="d-row"><div class="d-lbl">票價</div><div class="d-val">${ev.priceText_zh} ${ev.price_eur ? `(約 HK$${hkd})` : ''}</div></div>
          <div class="d-row"><div class="d-lbl">天氣安排</div><div class="d-val">${ev.weatherPolicy_zh}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <a class="pill-btn primary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.venue_hr + ' ' + ev.address)}" target="_blank" style="text-decoration:none">🗺 Google Maps 導航</a>
          <a class="pill-btn" href="${ev.officialUrl}" target="_blank" style="text-decoration:none">🌐 官方網站</a>
          <button class="pill-btn" id="btnStampVisit">${isVisited ? '🏅 已蓋「來場」印章' : '📍 打卡蓋印章抽黑金卡'}</button>
        </div>
      </div>
    `;
    bottom.innerHTML = `
      <button class="main-cta ${inTrip ? 'added' : ''}" id="btnModalTrip">${inTrip ? '✓ 已在行程（點擊移除）' : '＋ 加入行程'}</button>
      <button class="sq-btn" id="btnModalSave" title="收藏" style="color:${isSaved ? 'var(--accent)' : 'var(--ink)'}">${isSaved ? '♥' : '♡'}</button>
      <button class="sq-btn" id="btnModalPoster" title="一按製作活動分享圖">📤</button>
    `;
    modal.classList.add('open');
    document.getElementById('btnCloseModal').onclick = () => modal.classList.remove('open');
    document.getElementById('btnModalTrip').onclick = () => { toggleTrip(id); openDetail(id); };
    document.getElementById('btnModalSave').onclick = () => { toggleSave(id); openDetail(id); };
    document.getElementById('btnStampVisit').onclick = () => {
      if (!state.visited.includes(id)) state.visited.unshift(id);
      saveState(); openDetail(id); renderCardsTab();
    };
    document.getElementById('btnModalPoster').onclick = () => {
      alert(`📸 已為「${ev.title_zh}」生成一按分享圖片卡（附日期、票價、克羅地亞發展有限公司 croatia.com.hk 標誌），可儲存到相簿或 WhatsApp 傳給旅伴！`);
    };
  }

  function toggleSave(id) {
    const idx = state.saved.indexOf(id);
    if (idx >= 0) state.saved.splice(idx, 1); else state.saved.push(id);
    saveState(); renderAll();
  }

  function toggleTrip(id) {
    const idx = state.itinerary.indexOf(id);
    if (idx >= 0) state.itinerary.splice(idx, 1); else state.itinerary.push(id);
    saveState(); renderAll();
  }

  function switchTab(t) {
    state.tab = t;
    ['events','trip','cards','more'].forEach(k => {
      const sec = document.getElementById('tab-' + k);
      if (sec) sec.style.display = (k === t) ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === t);
    });
    renderAll();
  }

  function renderAll() {
    document.body.classList.toggle('dark', state.dark);
    renderDateStrip();
    renderFilters();
    renderMapClusters();
    renderEventsTab();
    renderTripTab();
    renderCardsTab();
    renderMoreTab();
    const bEv = document.getElementById('badgeEvents');
    const bTr = document.getElementById('badgeTrip');
    const bCd = document.getElementById('badgeCards');
    if (bEv) bEv.textContent = filteredEvents().length;
    if (bTr) bTr.textContent = state.itinerary.length;
    if (bCd) bCd.textContent = state.visited.length;
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });
    const btnToday = document.getElementById('btnToday');
    if (btnToday) btnToday.onclick = () => { state.selectedDate = '2026-10-24'; state.region = 'all'; state.cat = 'all'; state.onlySaved = false; renderAll(); };
    const btnSearch = document.getElementById('btnSearchToggle');
    const searchWrap = document.getElementById('searchWrap');
    const searchInp = document.getElementById('searchInput');
    if (btnSearch && searchWrap) {
      btnSearch.onclick = () => { searchWrap.classList.toggle('open'); if (searchWrap.classList.contains('open')) searchInp.focus(); };
    }
    if (searchInp) {
      searchInp.oninput = () => { state.search = searchInp.value.trim(); renderAll(); };
    }
    const btnLang = document.getElementById('btnLang');
    if (btnLang) {
      btnLang.onclick = () => {
        state.lang = state.lang === 'zh' ? 'en' : (state.lang === 'en' ? 'hr' : 'zh');
        btnLang.textContent = state.lang === 'zh' ? '繁/HR/EN' : state.lang.toUpperCase();
        saveState(); renderAll();
      };
    }
    const btnTheme = document.getElementById('btnTheme');
    if (btnTheme) {
      btnTheme.onclick = () => { state.dark = !state.dark; saveState(); renderAll(); };
    }
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
    }
    renderAll();
  });
})();
