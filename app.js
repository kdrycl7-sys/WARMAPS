(() => {
  'use strict';
  const conflicts = [
    { id:'ukraine-russia', label:'Ukrayna–Rusya', center:[49.2,31.2], zoom:5, query:'Ukraine Russia conflict', feeds:[['BBC News','https://feeds.bbci.co.uk/news/world/europe/rss.xml','en'],['The Guardian','https://www.theguardian.com/world/europe-news/rss','en']], social:[['Reuters','https://x.com/Reuters','İngilizce haber'],['BBC World','https://x.com/BBCWorld','İngilizce haber'],['ВВС News Russian','https://x.com/bbcrussian','Rusça haber'],['X araması','https://x.com/search?q=Ukraine%20Russia%20conflict&src=typed_query','Kamuya açık arama']], videos:[['YouTube araması','https://www.youtube.com/results?search_query=Ukraine+Russia+latest+news'],['BBC News Europe','https://www.youtube.com/@BBCNews'] ], demo:[['Kyiv',50.45,30.52],['Donetsk',48.0,37.8],['Kharkiv',49.99,36.23]] },
    { id:'iran-us', label:'İran–ABD', center:[32.2,53.7], zoom:5, query:'Iran United States conflict', feeds:[['Reuters World','https://feeds.reuters.com/reuters/worldNews','en'],['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml','ar']], social:[['Reuters','https://x.com/Reuters','İngilizce haber'],['Al Jazeera English','https://x.com/AJEnglish','İngilizce haber'],['Al Jazeera Arabic','https://x.com/AJArabic','Arapça haber'],['Iran International','https://x.com/IranIntl_En','İngilizce haber']], videos:[['YouTube araması','https://www.youtube.com/results?search_query=Iran+US+latest+news'],['Al Jazeera English','https://www.youtube.com/@aljazeeraenglish']], demo:[] },
    { id:'saudi-yemen', label:'Suudi Arabistan–Yemen', center:[18.5,44.5], zoom:5, query:'Saudi Arabia Yemen conflict', feeds:[['UN News','https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml','en'],['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml','ar']], social:[['UN News','https://x.com/UN_News_Centre','İngilizce haber'],['Al Jazeera Arabic','https://x.com/AJArabic','Arapça haber'],['Arab News','https://x.com/arabnews','İngilizce haber'],['X araması','https://x.com/search?q=Saudi%20Yemen%20conflict&src=typed_query','Kamuya açık arama']], videos:[['YouTube araması','https://www.youtube.com/results?search_query=Saudi+Arabia+Yemen+latest+news'],['Al Jazeera English','https://www.youtube.com/@aljazeeraenglish']], demo:[['Sana',15.37,44.19],['Hudaydah',14.8,42.95],['Jizan',16.89,42.55]] }
  ];
  let selected = conflicts[0], map, layer, busy = false, feedItems = [];
  const $ = id => document.getElementById(id);
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function formatDate(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}) : 'Zaman bilgisi yok'; }
  function renderTabs() { $('tabs').innerHTML = conflicts.map(c => `<button class="tab" type="button" aria-selected="${c.id === selected.id}" data-id="${c.id}">${escape(c.label)}</button>`).join(''); $('tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { selected = conflicts.find(c => c.id === button.dataset.id); feedItems = []; render(); loadFeed(); })); }
  function renderMap() {
    if (!map) { map = L.map('map', { minZoom:2, maxZoom:12 }).setView(selected.center, selected.zoom); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap katkıcıları' }).addTo(map); layer = L.layerGroup().addTo(map); } else { map.setView(selected.center, selected.zoom); layer.clearLayers(); }
    const points = selected.demo.map(([name,lat,lng]) => ({name,lat,lng,kind:'demo',detail:'Arşiv/demo konumu; canlı olay değildir.'}));
    if (selected.id === 'iran-us' && window.WARMAPS_DATA && Array.isArray(window.WARMAPS_DATA.strikes)) window.WARMAPS_DATA.strikes.slice(0,8).forEach(item => points.push({name:item.city,lat:item.lat,lng:item.lng,kind:'demo',detail:'WARMAPS arşiv kaydı; iddia bağımsız doğrulanmalıdır.',source:item.misc}));
    points.forEach(point => L.circleMarker([point.lat,point.lng], { radius:8, color:point.kind === 'live' ? '#ff6b6b' : '#ffc857', fillColor:point.kind === 'live' ? '#ff6b6b' : '#ffc857', fillOpacity:.75, weight:2 }).bindPopup(`<strong>${escape(point.name)}</strong><br><span class="small">${escape(point.detail)}</span>`).addTo(layer));
    $('map-title').textContent = `${selected.label} — harita`; $('map-status').textContent = `${points.length} arşiv/demo nokta`;
    $('metric-sources').textContent = selected.feeds.length;
    $('metric-points').textContent = points.length;
    setTimeout(() => map.invalidateSize(), 0);
  }
  function renderVideos() { $('videos').innerHTML = selected.videos.map(([name,url]) => `<div class="video"><strong>${escape(name)}</strong><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}</a><div class="small">Bağlantı dış kaynağa aittir; WARMAPS video içeriğini barındırmaz.</div></div>`).join(''); }
  function renderSocial() { $('social').innerHTML = selected.social.map(([name,url,note]) => `<div class="social"><strong>𝕏 ${escape(name)}</strong><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(note)}</a><div class="small">Profil veya arama bağlantısı; gönderi doğrulaması size aittir.</div></div>`).join(''); }
  function sourceUrl(feedUrl) { const proxy = localStorage.getItem('warmapsProxy'); return proxy ? `${proxy}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(feedUrl)}` : `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`; }
  function parseItems(payload, source, language) {
    if (payload && Array.isArray(payload.items)) return payload.items.map(item => ({title:item.title,link:item.link || item.guid,source,language:item.language || language || 'en',description:item.description,published:item.pubDate || item.isoDate}));
    const xml = new DOMParser().parseFromString(payload, 'text/xml'); return [...xml.querySelectorAll('item, entry')].map(item => ({ title:item.querySelector('title')?.textContent, link:item.querySelector('link')?.getAttribute('href') || item.querySelector('link')?.textContent, source, language:language || 'en', description:item.querySelector('description,summary,content')?.textContent, published:item.querySelector('pubDate,updated,published')?.textContent }));
  }
  async function translateItems(items) {
    const proxy = localStorage.getItem('warmapsTranslateProxy');
    $('translation-status').textContent = proxy ? 'Çeviri: hazırlanıyor…' : 'Çeviri: proxy yok';
    if (!proxy) return items;
    const translated = await Promise.all(items.map(async item => { if (!item.title || item.language === 'tr') return item; try { const response = await fetch(proxy, {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({text:item.title,source:item.language,target:'tr'})}); if (!response.ok) throw new Error(`${response.status}`); const data = await response.json(); return {...item,translatedTitle:data.translation || data.translatedText || ''}; } catch (_) { return item; } }));
    $('translation-status').textContent = translated.some(item => item.translatedTitle) ? 'Çeviri: proxy aktif' : 'Çeviri: özgün başlık';
    return translated;
  }
  function renderFeed() {
    const search = $('feed-search').value.trim().toLocaleLowerCase('tr-TR');
    const source = $('feed-source').value;
    const filtered = feedItems.filter(item => (!search || `${item.title} ${item.source}`.toLocaleLowerCase('tr-TR').includes(search)) && (!source || item.source === source));
    $('metric-items').textContent = filtered.length;
    $('feed').innerHTML = filtered.length ? filtered.map(item => `<article class="feed-item"><h3><a href="${escape(item.link)}" target="_blank" rel="noopener noreferrer">${escape(item.translatedTitle || item.title)}</a><span class="badge">${item.translatedTitle ? 'TR çeviri' : `${escape(item.language || 'en')} kaynak`}</span></h3>${item.translatedTitle ? `<div class="meta original-title">${escape(item.title)}</div>` : ''}<div class="meta">${escape(item.source)} · ${escape(formatDate(item.published))}</div></article>`).join('') : `<div class="state">${feedItems.length ? 'Filtreyle eşleşen haber bulunamadı.' : 'Canlı akış yok.'}</div>`;
  }
  async function loadFeed() {
    if (busy) return; busy = true; $('feed-status').textContent = 'Yükleniyor…'; $('feed').innerHTML = '<div class="state">Kaynaklar okunuyor…</div>';
    const results = await Promise.allSettled(selected.feeds.map(async ([source,url,language]) => { const response = await fetch(sourceUrl(url), {headers:{Accept:'application/json, application/xml, text/xml'}}); if (!response.ok) throw new Error(`${response.status}`); const type = response.headers.get('content-type') || ''; return parseItems(type.includes('json') ? await response.json() : await response.text(), source, language); }));
    feedItems = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(item => item.title && item.link).sort((a,b) => new Date(b.published || 0) - new Date(a.published || 0)).slice(0,20);
    feedItems = await translateItems(feedItems);
    const sources = [...new Set(feedItems.map(item => item.source))];
    $('feed-source').innerHTML = '<option value="">Tüm kaynaklar</option>' + sources.map(source => `<option value="${escape(source)}">${escape(source)}</option>`).join('');
    renderFeed();
    if (!feedItems.length) $('feed').innerHTML = '<div class="state error">Canlı akış alınamadı veya boş döndü. Proxy/CORS ayarlarını ve kaynakları kontrol edin; demo haber üretilmedi.</div>';
    $('feed-status').textContent = feedItems.length ? `${feedItems.length} başlık` : 'Akış yok'; busy = false; $('updated').textContent = `Son güncelleme: ${formatDate(new Date())}`;
  }
  function render() { renderTabs(); renderMap(); renderVideos(); renderSocial(); $('feed-source').innerHTML = '<option value="">Tüm kaynaklar</option>'; $('feed-search').value = ''; }
  $('refresh').addEventListener('click', () => { loadFeed(); }); render(); loadFeed();
  $('feed-search').addEventListener('input', renderFeed);
  $('feed-source').addEventListener('change', renderFeed);
})();
