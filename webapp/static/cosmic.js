Ghadi.ready.then(() => {
  const $ = (id) => document.getElementById(id);
  const esc = Ghadi.esc;
  const mode = Ghadi.mode;
  const today = Ghadi.today;
  const dateInput = $('date');
  if (dateInput) dateInput.value = today;
  const cityInput = $('city');
  if (cityInput) cityInput.value = Ghadi.city;
  if (mode === 'today') { const masthead = document.querySelector('.cosmic-masthead'); const overline = masthead?.querySelector('.cosmic-overline'); const title = masthead?.querySelector('h1'); if (overline) overline.textContent = Ghadi.t('home.todayOverline'); if (title) title.textContent = Ghadi.t('home.todayTitle'); }
  const metricBlock = (items) => items.map((item) => Ghadi.metric(item[0], item[1], item[2] || '', item[3] || '')).join('');
  let currentTimezone = 'UTC';
  let festivalItems = [];
  let festivalYearItems = [];
  const northFestivals = new Set(['Rama Navami', 'Hanuman Jayanti', 'Mesha Sankranti', 'Akshaya Tritiya', 'Vata Savitri Purnima', 'Guru Purnima', 'Naga Panchami', 'Raksha Bandhan', 'Janmashtami', 'Rishi Panchami', 'Ananta Chaturdashi', 'Mahalaya Amavasya', 'Durga Ashtami', 'Vijayadashami', 'Karwa Chauth', 'Dhana Trayodashi', 'Deepavali', 'Surya Shashthi / Chhath', 'Gita Jayanti', 'Uttarayana', 'Vasanta Panchami', 'Ratha Saptami', 'VSN Jayanti', 'Maha Shivaratri', 'Kama Dahana (Holi)']);
  const southFestivals = new Set(['Ugadi', 'Vasavi Jayanti', 'Narasimha Jayanti', 'Dakshinayana', 'Varamahalakshmi Vrata', 'Rig Upakarma', 'Yajur Upakarma', 'Sama Upakarma', 'Onam', 'Swarna Gowri Vrata', 'Ganesha Chaturthi', 'Ayudha Puja', 'Naraka Chaturdashi', 'Bali Padyami', 'Vaikuntha Ekadashi', 'Makara Sankranti', 'Vasavi Atmarpana']);
  const festivalRegion = $('festival-region');
  if (festivalRegion) festivalRegion.value = 'north';
  function updateClock() { const clock = $('running-clock'); if (!clock) return; clock.textContent = new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: currentTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); }
  function formatFestivalDate(value, year) { const timestamp = Date.parse(`${value} ${year}`); return Number.isNaN(timestamp) ? value : new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { day: '2-digit', month: 'short' }).format(new Date(timestamp)); }
  function regionAllowsFestival(item) { const region = festivalRegion?.value || 'north'; return region === 'all' || (region === 'north' ? northFestivals : southFestivals).has(item.name); }
  function renderFestivals(items, locationName, year, currentDate = '', yearItems = items) { const list = $('running-festivals'); if (!list) return; $('festival-location').textContent = locationName; const sortItems = (source) => (source || []).filter((item) => item.name && item.date && item.date !== 'None' && regionAllowsFestival(item)).sort((a, b) => Date.parse(`${a.date} ${year}`) - Date.parse(`${b.date} ${year}`)); const sorted = sortItems(items); const visible = sorted.slice(0, 4); list.innerHTML = visible.length ? visible.map((item) => `<div class="festival-mini-item"><strong>${esc(Ghadi.value(item.name))}</strong><span>${esc(formatFestivalDate(item.date, year))}</span></div>`).join('') : `<span class="muted">${esc(Ghadi.t('home.noFestivals'))}</span>`; if (mode === 'today') { const upcoming = document.getElementById('upcoming-festival') || document.createElement('div'); upcoming.id = 'upcoming-festival'; upcoming.className = 'upcoming-festival'; const todayStamp = currentDate ? Date.parse(`${currentDate.split('/')[2]}-${currentDate.split('/')[1]}-${currentDate.split('/')[0]}`) : Date.now(); const next = sortItems(yearItems).find((item) => Date.parse(`${year}-${item.date}`) >= todayStamp); upcoming.innerHTML = `<strong>${esc(Ghadi.t('home.upcomingFestival'))}</strong><span>${next ? `${esc(Ghadi.value(next.name))} · ${esc(formatFestivalDate(next.date, year))}` : esc(Ghadi.t('home.noUpcomingFestival'))}</span>`; if (!upcoming.parentElement) list.parentElement.append(upcoming); } }
  async function loadFestivals(date, locationName) { try { const [, month, year] = date.split('/'); const [data, yearData] = await Promise.all([Ghadi.get(`/api/cosmic/month/${Number(month)}?year=${year}&city=${encodeURIComponent(Ghadi.city)}`), Ghadi.get(`/api/cosmic/year/${year}?city=${encodeURIComponent(Ghadi.city)}`)]); festivalItems = data.festivals || []; festivalYearItems = yearData.festivals || festivalItems; renderFestivals(festivalItems, locationName, year, date, festivalYearItems); renderCalendar(festivalItems, year, month); } catch { festivalItems = []; festivalYearItems = []; renderFestivals([], locationName, date.split('/')[2], date); } }

  const chartState = { mode: 'rashi', days: 0, playing: false, labels: true, heliocentric: false, zoom: 1, planets: [], timer: null };
  const planetIcons = { Surya: '☉', Candra: '☾', Mangala: '♂', Budha: '☿', Guru: '♃', Sukra: '♀', Sani: '♄', Rahu: '☊', Ketu: '☋', Uranus: '♅', Neptune: '♆' };
  const chartPlanetKey = (name) => ({ Surya: 'surya', Candra: 'chandra', Mangala: 'mangala', Budha: 'budha', Guru: 'guru', Sukra: 'shukra', Sani: 'shani', Rahu: 'rahu', Ketu: 'ketu', Uranus: 'uranus', Neptune: 'neptune' }[name] || 'other');
  const chartText = (key, fallback) => Ghadi.t(`chart.${key}`, { fallback });
  function showInteractivePlanet(planet) {
    const panel = $('planet-detail');
    if (!panel) return;
    const distance = planet.distance_au == null ? chartText('calculatedPoint', 'Calculated point') : `${planet.distance_au.toFixed(6)} AU · ${(planet.distance_au * 149597870.7).toLocaleString(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { maximumFractionDigits: 0 })} km`;
    panel.innerHTML = `<div class="panel-kicker">${esc(Ghadi.value(planet.planet))}</div><strong>${planet.longitude.toFixed(3)}° · ${esc(Ghadi.value(planet.rashi || '—'))}</strong><p class="muted">${esc(Ghadi.value(planet.nakshatra || '—'))} · ${planet.retrograde ? Ghadi.t('common.retrograde') : Ghadi.t('common.direct')}</p><small class="chart-distance-value">${esc(distance)}</small>`;
  }
  function chartRadius(planet, minDistance, maxDistance) {
    if (planet.distance_au == null) return 30;
    const min = Math.log10(Math.max(minDistance, 0.0001));
    const max = Math.log10(Math.max(maxDistance, 0.0002));
    return 22 + ((Math.log10(planet.distance_au) - min) / (max - min)) * 24;
  }
  function renderInteractiveChart(planets) {
    const wheel = $('wheel');
    if (!wheel) return;
    chartState.planets = planets;
    const useHelio = chartState.heliocentric && chartState.mode !== 'rashi';
    const visible = planets.map((planet) => ({ ...planet, chartLongitude: (useHelio && planet.heliocentric_longitude != null ? planet.heliocentric_longitude : planet.longitude) + planet.speed * chartState.days })).filter((planet) => Number.isFinite(planet.chartLongitude));
    const signs = ['Mesha', 'Vrsabha', 'Mithuna', 'Karkata', 'Simha', 'Kanya', 'Tula', 'Vrscika', 'Dhanu', 'Makara', 'Kumbha', 'Mina'];
    const nakshatras = [['Ashwini', 'Ash'], ['Bharani', 'Bha'], ['Krittika', 'Kri'], ['Rohini', 'Roh'], ['Mrigashira', 'Mri'], ['Ardra', 'Ard'], ['Punarvasu', 'Pun'], ['Pushya', 'Pus'], ['Ashlesha', 'Ash'], ['Magha', 'Mag'], ['Purva Phalguni', 'Pha'], ['Uttara Phalguni', 'UPh'], ['Hasta', 'Has'], ['Chitra', 'Chi'], ['Swati', 'Swa'], ['Vishakha', 'Vis'], ['Anuradha', 'Anu'], ['Jyeshtha', 'Jye'], ['Mula', 'Mul'], ['Purva Ashadha', 'PAs'], ['Uttara Ashadha', 'UAs'], ['Shravana', 'Shr'], ['Dhanishtha', 'Dha'], ['Shatabhisha', 'Sha'], ['Purva Bhadrapada', 'PBh'], ['Uttara Bhadrapada', 'UBh'], ['Revati', 'Rev']];
    const currentSign = Math.floor((((visible.find((planet) => planet.planet === 'Surya') || visible[0])?.chartLongitude || 0) + 360) % 360 / 30);
    const minDistance = Math.min(...planets.filter((planet) => planet.distance_au).map((planet) => planet.distance_au));
    const maxDistance = Math.max(...planets.filter((planet) => planet.distance_au).map((planet) => planet.distance_au));
    wheel.className = `wheel chart-${chartState.mode}${chartState.labels ? '' : ' hide-chart-labels'}`;
    wheel.style.setProperty('--chart-scale', chartState.zoom);
    wheel.innerHTML = `<span class="wheel-center">${esc(chartText('earth', 'Earth'))}</span>`;
    if (chartState.mode === 'distance' || chartState.mode === 'orbit') {
      [22, 32, 42].forEach((radius) => { const ring = document.createElement('span'); ring.className = 'chart-distance-ring'; ring.style.setProperty('--ring-radius', `${radius}%`); ring.title = chartText('logScale', 'Logarithmic distance scale'); wheel.append(ring); });
    } else {
      nakshatras.forEach(([name, short], index) => { const angle = (index * (360 / nakshatras.length) - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = 'wheel-nakshatra'; node.style = `--x:${Math.cos(angle) * 46}%;--y:${Math.sin(angle) * 46}%`; node.title = Ghadi.value(name); node.textContent = Ghadi.value(name).slice(0, Ghadi.locale === 'hi' ? 3 : short.length); wheel.append(node); });
      signs.forEach((sign, index) => { const angle = (index * 30 - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = `wheel-sign${index === currentSign ? ' is-current' : ''}`; node.style = `--x:${Math.cos(angle) * 42}%;--y:${Math.sin(angle) * 42}%`; node.textContent = Ghadi.value(sign); wheel.append(node); });
    }
    visible.forEach((planet) => { const angle = ((planet.chartLongitude % 360) - 90) * Math.PI / 180; const radius = chartState.mode === 'rashi' ? 29 : chartRadius(planet, minDistance, maxDistance); const node = document.createElement('button'); node.type = 'button'; node.className = `wheel-planet planet-${chartPlanetKey(planet.planet)}`; node.style = `--x:${Math.cos(angle) * radius}%;--y:${Math.sin(angle) * radius}%`; node.title = `${Ghadi.value(planet.planet)}: ${planet.longitude.toFixed(2)}°`; node.innerHTML = `<span class="planet-glyph">${planetIcons[planet.planet] || '✦'}</span><span class="planet-label">${esc(Ghadi.value(planet.planet))}</span>`; node.addEventListener('click', () => showInteractivePlanet(planet)); wheel.append(node); });
    const scale = $('chart-scale');
    if (scale) scale.textContent = chartState.mode === 'rashi' ? chartText('siderealScale', 'Sidereal longitude · 12 Rashis · 27 Nakshatras') : `${chartText('logScale', 'Logarithmic distance scale')} · ${chartText('au', 'AU')} · ${chartState.heliocentric ? chartText('heliocentric', 'Heliocentric') : chartText('geocentric', 'Geocentric')}`;
  }
  function setupChartControls() {
    const panel = document.querySelector('.cosmic-wheel-panel');
    const anchor = panel?.querySelector('.cosmic-wheel-wrap');
    if (!panel || !anchor || document.getElementById('chart-controls')) return;
    const controls = document.createElement('div');
    controls.id = 'chart-controls';
    controls.className = 'chart-controls';
    controls.innerHTML = `<div class="chart-mode" role="tablist"><button type="button" class="active" data-chart-mode="rashi">${chartText('rashi', 'Rashi')}</button><button type="button" data-chart-mode="distance">${chartText('distance', 'Distance')}</button><button type="button" data-chart-mode="orbit">${chartText('orbit', 'Orbit')}</button></div><div class="chart-actions"><button type="button" id="chart-play" title="${chartText('play', 'Play')}">▶</button><button type="button" id="chart-reset" title="${chartText('reset', 'Reset')}">↺</button><button type="button" id="chart-zoom-out" aria-label="Zoom out">−</button><button type="button" id="chart-zoom-in" aria-label="Zoom in">+</button><label><input id="chart-labels" type="checkbox" checked> ${chartText('labels', 'Labels')}</label><label><input id="chart-heliocentric" type="checkbox"> ${chartText('heliocentric', 'Heliocentric')}</label></div><label class="chart-time"><span>${chartText('time', 'Time offset')}</span><input id="chart-time" type="range" min="-30" max="30" step="0.25" value="0"><output id="chart-time-value">${chartText('now', 'Now')}</output></label>`;
    const scale = document.createElement('div');
    scale.id = 'chart-scale';
    scale.className = 'cosmic-chart-scale';
    panel.insertBefore(controls, anchor);
    panel.insertBefore(scale, anchor);
    controls.addEventListener('click', (event) => { const mode = event.target.closest('[data-chart-mode]')?.dataset.chartMode; if (!mode) return; chartState.mode = mode; controls.querySelectorAll('[data-chart-mode]').forEach((button) => button.classList.toggle('active', button.dataset.chartMode === mode)); renderInteractiveChart(chartState.planets); });
    $('chart-play').onclick = () => { chartState.playing = !chartState.playing; $('chart-play').textContent = chartState.playing ? '❚❚' : '▶'; if (chartState.playing && !chartState.timer) chartState.timer = setInterval(() => { chartState.days = (chartState.days + .25) % 31; $('chart-time').value = chartState.days; $('chart-time-value').textContent = chartState.days ? `${chartState.days > 0 ? '+' : ''}${chartState.days}d` : chartText('now', 'Now'); renderInteractiveChart(chartState.planets); }, 500); if (!chartState.playing && chartState.timer) { clearInterval(chartState.timer); chartState.timer = null; } };
    $('chart-reset').onclick = () => { chartState.days = 0; chartState.zoom = 1; chartState.heliocentric = false; $('chart-time').value = 0; $('chart-time-value').textContent = chartText('now', 'Now'); $('chart-heliocentric').checked = false; renderInteractiveChart(chartState.planets); };
    $('chart-time').oninput = (event) => { chartState.days = Number(event.target.value); $('chart-time-value').textContent = chartState.days ? `${chartState.days > 0 ? '+' : ''}${chartState.days}d` : chartText('now', 'Now'); renderInteractiveChart(chartState.planets); };
    $('chart-labels').onchange = (event) => { chartState.labels = event.target.checked; renderInteractiveChart(chartState.planets); };
    $('chart-heliocentric').onchange = (event) => { chartState.heliocentric = event.target.checked; renderInteractiveChart(chartState.planets); };
    $('chart-zoom-in').onclick = () => { chartState.zoom = Math.min(1.35, chartState.zoom + .1); renderInteractiveChart(chartState.planets); };
    $('chart-zoom-out').onclick = () => { chartState.zoom = Math.max(.75, chartState.zoom - .1); renderInteractiveChart(chartState.planets); };
  }
  setupChartControls();
  function renderWheel(planets) {
    renderInteractiveChart(planets);
  }
  function renderLegacyWheel(planets) {
    const wheel = $('wheel');
    if (!wheel) return;
    const planetKey = (name) => ({ Surya: 'surya', Candra: 'chandra', Mangala: 'mangala', Budha: 'budha', Guru: 'guru', Sukra: 'shukra', Sani: 'shani', Rahu: 'rahu', Ketu: 'ketu', Uranus: 'uranus', Neptune: 'neptune' }[name] || 'other');
    wheel.innerHTML = `<span class="wheel-center">${esc(Ghadi.t('astronomy.rashi'))}</span>`;
    const nakshatras = [['Ashwini', 'Ash'], ['Bharani', 'Bha'], ['Krittika', 'Kri'], ['Rohini', 'Roh'], ['Mrigashira', 'Mri'], ['Ardra', 'Ard'], ['Punarvasu', 'Pun'], ['Pushya', 'Pus'], ['Ashlesha', 'Ash'], ['Magha', 'Mag'], ['Purva Phalguni', 'Pha'], ['Uttara Phalguni', 'UPh'], ['Hasta', 'Has'], ['Chitra', 'Chi'], ['Swati', 'Swa'], ['Vishakha', 'Vis'], ['Anuradha', 'Anu'], ['Jyeshtha', 'Jye'], ['Mula', 'Mul'], ['Purva Ashadha', 'PAs'], ['Uttara Ashadha', 'UAs'], ['Shravana', 'Shr'], ['Dhanishtha', 'Dha'], ['Shatabhisha', 'Sha'], ['Purva Bhadrapada', 'PBh'], ['Uttara Bhadrapada', 'UBh'], ['Revati', 'Rev']];
    nakshatras.forEach(([name, short], index) => { const angle = (index * (360 / nakshatras.length) - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = 'wheel-nakshatra'; node.style = `--x:${Math.cos(angle) * 46}%;--y:${Math.sin(angle) * 46}%`; node.title = Ghadi.value(name); node.textContent = Ghadi.value(name).slice(0, Ghadi.locale === 'hi' ? 3 : short.length); wheel.append(node); });
    const signs = ['Mesha', 'Vrsabha', 'Mithuna', 'Karkata', 'Simha', 'Kanya', 'Tula', 'Vrscika', 'Dhanu', 'Makara', 'Kumbha', 'Mina'];
    signs.forEach((sign, index) => { const angle = (index * 30 - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = 'wheel-sign'; node.style = `--x:${Math.cos(angle) * 42}%;--y:${Math.sin(angle) * 42}%`; node.textContent = Ghadi.value(sign); wheel.append(node); });
    planets.forEach((planet) => { const angle = (planet.longitude - 90) * Math.PI / 180; const node = document.createElement('button'); node.type = 'button'; node.className = `wheel-planet planet-${planetKey(planet.planet)}`; node.style = `--x:${Math.cos(angle) * 29}%;--y:${Math.sin(angle) * 29}%`; node.title = `${Ghadi.value(planet.planet)}: ${planet.longitude.toFixed(2)} ${Ghadi.t('common.degrees')}`; node.textContent = Ghadi.value(planet.planet).slice(0, Ghadi.locale === 'hi' ? 2 : 2); node.addEventListener('click', () => showPlanet(planet)); wheel.append(node); });
  }
  function showPlanet(planet) { const panel = $('planet-detail'); if (!panel) return; panel.innerHTML = `<div class="panel-kicker">${esc(Ghadi.value(planet.planet))}</div><strong>${planet.longitude.toFixed(3)}° · ${esc(Ghadi.value(planet.rashi || '—'))}</strong><p class="muted">${esc(Ghadi.value(planet.nakshatra || '—'))} · ${planet.retrograde ? Ghadi.t('common.retrograde') : Ghadi.t('common.direct')}</p>`; }
  function intervalRows(day) { const groups = [['rahu_kala', Ghadi.t('common.rahu')], ['pratah_sandhya', Ghadi.t('common.pratah')]]; day.durmuhurta?.forEach((item, i) => groups.push([null, `${Ghadi.t('common.durmuhurta')} ${i + 1}`, item])); day.varjyam?.forEach((item, i) => groups.push([null, `${Ghadi.t('common.varjyam')} ${i + 1}`, item])); return groups.map(([key, label, value]) => { const item = key ? day[key] : value; return `<div class="timeline-item"><time>${esc(item?.start || Ghadi.t('common.window'))}</time><div><strong>${esc(label)}</strong><div class="muted">${esc(item?.end || '')}</div></div></div>`; }).join(''); }
  function renderTransitions(day) { const groups = [[Ghadi.t('common.tithi'), day.tithi], [Ghadi.t('common.nakshatra'), day.nakshatra], [Ghadi.t('common.yoga'), day.yoga], [Ghadi.t('common.karana'), day.karana]]; const rows = groups.flatMap(([label, values]) => (values || []).slice(0, 1).map((item) => `<div class="cosmic-event"><span class="event-mark">✦</span><div><strong>${esc(label)} · ${esc(Ghadi.value(item.name))}</strong><small>${esc(item.ends || Ghadi.t('common.unavailable'))}</small></div></div>`)); $('transitions').innerHTML = rows.join('') || `<div class="cosmic-muted">${esc(Ghadi.t('home.noTransitions'))}</div>`; }
  function renderInsights(day) { const insights = [['☾', Ghadi.t('common.tithi'), `${Ghadi.value(day.tithi?.[0]?.name)} · ${Ghadi.t('home.tithiInsight')}`], ['✦', Ghadi.t('common.nakshatra'), `${Ghadi.value(day.nakshatra?.[0]?.name)} · ${Ghadi.t('home.nakshatraInsight')}`], ['◈', Ghadi.t('common.yoga'), `${Ghadi.value(day.yoga?.[0]?.name)} · ${Ghadi.t('home.yogaInsight')}`]]; $('cosmic-insights').innerHTML = insights.map((item) => `<div class="insight-row"><span>${item[0]}</span><div><strong>${esc(item[1])}</strong><p>${esc(item[2])}</p></div></div>`).join(''); }
  function renderTodayCelestial(planets) { if (mode !== 'today') return; const container = $('cosmic-insights'); if (!container) return; const node = document.getElementById('today-celestial') || document.createElement('div'); node.id = 'today-celestial'; node.className = 'today-celestial'; const find = (name) => planets.find((planet) => planet.planet === name); const sun = find('Surya'); const moon = find('Candra'); node.innerHTML = `<div class="panel-kicker">${esc(Ghadi.t('home.currentCelestial'))}</div><div class="today-celestial-grid">${[['home.sunPosition', sun], ['home.moonPosition', moon]].map(([label, planet]) => `<div><span>${esc(Ghadi.t(label))}</span><strong>${planet ? `${esc(Ghadi.value(planet.rashi))} · ${esc(Ghadi.value(planet.nakshatra))}` : esc(Ghadi.t('common.unavailable'))}</strong></div>`).join('')}</div>`; if (!node.parentElement) container.append(node); }
  function renderLunarPhase(tithi) { if (mode !== 'today') return; const card = document.querySelector('.cosmic-date-card'); if (!card) return; const node = document.getElementById('cosmic-lunar-phase') || document.createElement('span'); node.id = 'cosmic-lunar-phase'; const number = Number(tithi?.number || 0); const phase = number === 15 ? Ghadi.t('common.fullMoon') : number === 30 ? Ghadi.t('common.newMoon') : number < 15 ? Ghadi.t('common.waxingMoon') : Ghadi.t('common.waningMoon'); node.textContent = `${Ghadi.t('common.lunarPhase')}: ${phase}`; if (!node.parentElement) card.append(node); }
  function renderCalendar(items, year, month) { const calendar = $('cosmic-calendar'); if (!calendar) return; const first = new Date(Number(year), Number(month) - 1, 1); const days = new Date(Number(year), Number(month), 0).getDate(); const start = first.getDay(); const formatter = new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { month: 'long', year: 'numeric' }); $('cosmic-month-title').textContent = formatter.format(first); const weekFormatter = new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' }); const weekdays = Array.from({ length: 7 }, (_, index) => weekFormatter.format(new Date(2024, 0, 7 + index))); const marks = new Set((items || []).filter((item) => item.date && item.date !== 'None' && regionAllowsFestival(item)).map((item) => Number(item.date.match(/\d+/)?.[0]))); const cells = weekdays.map((day) => `<span class="calendar-weekday">${esc(day)}</span>`).join('') + Array.from({ length: start }, () => '<span class="calendar-day empty-day"></span>').join('') + Array.from({ length: days }, (_, index) => { const day = index + 1; return `<span class="calendar-day${marks.has(day) ? ' has-event' : ''}">${day}${marks.has(day) ? '<i></i>' : ''}</span>`; }).join(''); calendar.innerHTML = cells; }
  function render(data) {
    const p = data.panchanga;
    currentTimezone = data.location.timezone || 'UTC';
    $('running-date').textContent = `${p.date} · ${Ghadi.value(p.vaara)} · ${Ghadi.value(p.masa)}`;
    $('running-location').textContent = data.location.name;
    $('context-date').textContent = p.date;
    $('context-city').textContent = data.location.name;
    $('running-paksha').textContent = `${Number(p.tithi?.[0]?.number || 0) <= 15 ? Ghadi.t('home.shuklaPaksha') : Ghadi.t('home.krishnaPaksha')} · ${Ghadi.value(p.tithi?.[0]?.name || Ghadi.t('common.tithi'))}`;
    renderLunarPhase(p.tithi?.[0]);
    updateClock();
    loadFestivals(p.date, data.location.name);
    $('cosmic-tithi').textContent = Ghadi.value(p.tithi?.[0]?.name); $('cosmic-tithi-end').textContent = p.tithi?.[0]?.ends || '—'; $('cosmic-nakshatra').textContent = Ghadi.value(p.nakshatra?.[0]?.name); $('cosmic-nakshatra-end').textContent = p.nakshatra?.[0]?.ends || '—'; $('cosmic-yoga').textContent = Ghadi.value(p.yoga?.[0]?.name); $('cosmic-yoga-end').textContent = p.yoga?.[0]?.ends || '—'; $('cosmic-karana').textContent = Ghadi.value(p.karana?.[0]?.name); $('cosmic-karana-end').textContent = p.karana?.[0]?.ends || '—'; $('cosmic-vara').textContent = Ghadi.value(p.vaara);
    $('clock').innerHTML = metricBlock([['Sunrise', p.sunrise], ['Sunset', p.sunset], ['Moonrise', p.moonrise], ['Moonset', p.moonset], ['Rahu Kalam', `${p.rahu_kala?.start || '—'} – ${p.rahu_kala?.end || '—'}`], ['Ayanamsha', p.ayanamsa_degrees ? `${p.ayanamsa_degrees.toFixed(3)}°` : Ghadi.t('common.tropical')]]);
    $('timeline').innerHTML = intervalRows(p);
    renderTransitions(p); renderInsights(p); renderTodayCelestial(data.planets);
    $('planet-count').textContent = Ghadi.t('common.bodies', { count: data.planets.length });
    renderWheel(data.planets);
    $('planets').innerHTML = data.planets.map((planet) => `<tr><td><strong>${esc(Ghadi.value(planet.planet))}</strong></td><td>${esc(Ghadi.value(planet.rashi))}</td><td>${esc(Ghadi.value(planet.nakshatra))}</td><td>${planet.longitude.toFixed(3)}°</td></tr>`).join('');
    Ghadi.setStatus(`${Ghadi.t('common.source')}: ${Ghadi.value(data.engine.name)} · ${Ghadi.value(data.engine.coordinate_mode)} · ${Ghadi.value(data.engine.ayanamsa || Ghadi.t('common.tropical'))}`);
  }
  async function load() { try { Ghadi.setStatus(Ghadi.t('common.readingSky')); const params = { city: Ghadi.city, date: dateInput.value }; const url = mode === 'today' ? `/api/cosmic/current?${Ghadi.query(params)}` : `/api/cosmic/date?${Ghadi.query(params)}`; render(await Ghadi.get(url)); } catch (error) { Ghadi.setStatus(error.message, true); } }
  $('load')?.addEventListener('click', load); $('date')?.addEventListener('change', load); $('city')?.addEventListener('change', load); load();
  festivalRegion?.addEventListener('change', () => { localStorage.setItem('ghadi-festival-region', festivalRegion.value); const date = ($('running-date')?.textContent || '').split(' · ')[0] || ''; const year = date.split('/')[2]; renderFestivals(festivalItems, $('festival-location')?.textContent || Ghadi.city, year, date, festivalYearItems); renderCalendar(festivalItems, year, date.split('/')[1]); });
  setInterval(updateClock, 1000);
  document.addEventListener('ghadi-location-changed', () => { if (cityInput) cityInput.value = Ghadi.city; load(); });
});
