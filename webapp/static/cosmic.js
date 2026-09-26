Ghadi.ready.then(() => {
  const $ = (id) => document.getElementById(id);
  const esc = Ghadi.esc;
  const mode = Ghadi.mode;
  const today = Ghadi.today;
  const dateInput = $('date');
  if (dateInput) dateInput.value = today;
  const cityInput = $('city');
  if (cityInput) cityInput.value = Ghadi.city;
  const metricBlock = (items) => items.map((item) => Ghadi.metric(item[0], item[1], item[2] || '', item[3] || '')).join('');
  let currentTimezone = 'UTC';
  let festivalItems = [];
  const northFestivals = new Set(['Rama Navami', 'Hanuman Jayanti', 'Mesha Sankranti', 'Akshaya Tritiya', 'Vata Savitri Purnima', 'Guru Purnima', 'Naga Panchami', 'Raksha Bandhan', 'Janmashtami', 'Rishi Panchami', 'Ananta Chaturdashi', 'Mahalaya Amavasya', 'Durga Ashtami', 'Vijayadashami', 'Karwa Chauth', 'Dhana Trayodashi', 'Deepavali', 'Surya Shashthi / Chhath', 'Gita Jayanti', 'Uttarayana', 'Vasanta Panchami', 'Ratha Saptami', 'VSN Jayanti', 'Maha Shivaratri', 'Kama Dahana (Holi)']);
  const southFestivals = new Set(['Ugadi', 'Vasavi Jayanti', 'Narasimha Jayanti', 'Dakshinayana', 'Varamahalakshmi Vrata', 'Rig Upakarma', 'Yajur Upakarma', 'Sama Upakarma', 'Onam', 'Swarna Gowri Vrata', 'Ganesha Chaturthi', 'Ayudha Puja', 'Naraka Chaturdashi', 'Bali Padyami', 'Vaikuntha Ekadashi', 'Makara Sankranti', 'Vasavi Atmarpana']);
  const festivalRegion = $('festival-region');
  if (festivalRegion) festivalRegion.value = localStorage.getItem('ghadi-festival-region') || 'north';
  function updateClock() { const clock = $('running-clock'); if (!clock) return; clock.textContent = new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: currentTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); }
  function formatFestivalDate(value, year) { const timestamp = Date.parse(`${value} ${year}`); return Number.isNaN(timestamp) ? value : new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { day: '2-digit', month: 'short' }).format(new Date(timestamp)); }
  function renderFestivals(items, locationName, year) { const list = $('running-festivals'); if (!list) return; $('festival-location').textContent = locationName; const region = festivalRegion?.value || 'north'; const allowed = region === 'all' ? null : region === 'north' ? northFestivals : southFestivals; const visible = (items || []).filter((item) => item.name && item.date && item.date !== 'None' && (!allowed || allowed.has(item.name))).sort((a, b) => Date.parse(`${a.date} ${year}`) - Date.parse(`${b.date} ${year}`)).slice(0, 4); list.innerHTML = visible.length ? visible.map((item) => `<div class="festival-mini-item"><strong>${esc(Ghadi.value(item.name))}</strong><span>${esc(formatFestivalDate(item.date, year))}</span></div>`).join('') : `<span class="muted">${esc(Ghadi.t('home.noFestivals'))}</span>`; }
  async function loadFestivals(date, locationName) { try { const [, month, year] = date.split('/'); const data = await Ghadi.get(`/api/cosmic/month/${Number(month)}?year=${year}&city=${encodeURIComponent(Ghadi.city)}`); festivalItems = data.festivals || []; renderFestivals(festivalItems, locationName, year); } catch { festivalItems = []; renderFestivals([], locationName, date.split('/')[2]); } }

  function renderWheel(planets) {
    const wheel = $('wheel');
    if (!wheel) return;
    wheel.innerHTML = `<span class="wheel-center">${esc(Ghadi.t('astronomy.rashi'))}</span>`;
    const signs = ['Mesha', 'Vrsabha', 'Mithuna', 'Karkata', 'Simha', 'Kanya', 'Tula', 'Vrscika', 'Dhanu', 'Makara', 'Kumbha', 'Mina'];
    signs.forEach((sign, index) => { const angle = (index * 30 - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = 'wheel-sign'; node.style = `--x:${Math.cos(angle) * 42}%;--y:${Math.sin(angle) * 42}%`; node.textContent = Ghadi.value(sign); wheel.append(node); });
    planets.forEach((planet) => { const angle = (planet.longitude - 90) * Math.PI / 180; const node = document.createElement('button'); node.type = 'button'; node.className = 'wheel-planet'; node.style = `--x:${Math.cos(angle) * 29}%;--y:${Math.sin(angle) * 29}%`; node.title = `${planet.planet}: ${planet.longitude.toFixed(2)} degrees`; node.textContent = planet.planet.slice(0, 2); node.addEventListener('click', () => showPlanet(planet)); wheel.append(node); });
  }
  function showPlanet(planet) { const panel = $('planet-detail'); if (!panel) return; panel.innerHTML = `<div class="panel-kicker">${esc(Ghadi.value(planet.planet))}</div><strong>${planet.longitude.toFixed(3)}° · ${esc(Ghadi.value(planet.rashi || '—'))}</strong><p class="muted">${esc(Ghadi.value(planet.nakshatra || '—'))} · ${planet.retrograde ? Ghadi.t('common.retrograde') : Ghadi.t('common.direct')}</p>`; }
  function intervalRows(day) { const groups = [['rahu_kala', Ghadi.t('common.rahu')], ['pratah_sandhya', Ghadi.t('common.pratah')]]; day.durmuhurta?.forEach((item, i) => groups.push([null, `${Ghadi.t('common.durmuhurta')} ${i + 1}`, item])); day.varjyam?.forEach((item, i) => groups.push([null, `${Ghadi.t('common.varjyam')} ${i + 1}`, item])); return groups.map(([key, label, value]) => { const item = key ? day[key] : value; return `<div class="timeline-item"><time>${esc(item?.start || Ghadi.t('common.window'))}</time><div><strong>${esc(label)}</strong><div class="muted">${esc(item?.end || '')}</div></div></div>`; }).join(''); }
  function render(data) {
    const p = data.panchanga;
    currentTimezone = data.location.timezone || 'UTC';
    $('running-date').textContent = `${p.date} · ${Ghadi.value(p.vaara)} · ${Ghadi.value(p.masa)}`;
    $('running-location').textContent = data.location.name;
    $('running-paksha').textContent = `${Number(p.tithi?.[0]?.number || 0) <= 15 ? Ghadi.t('home.shuklaPaksha') : Ghadi.t('home.krishnaPaksha')} · ${Ghadi.value(p.tithi?.[0]?.name || Ghadi.t('common.tithi'))}`;
    updateClock();
    loadFestivals(p.date, data.location.name);
    $('primary-value').textContent = `${Ghadi.value(p.tithi?.[0]?.name || Ghadi.t('common.panchanga'))} · ${Ghadi.value(p.nakshatra?.[0]?.name || Ghadi.t('astronomy.sky'))}`;
    $('context-date').textContent = p.date;
    $('context-city').textContent = data.location.name;
    $('metrics').innerHTML = metricBlock([[Ghadi.t('common.tithi'), Ghadi.value(p.tithi?.[0]?.name), p.tithi?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.tithi[0].ends}` : '', 'Tithi'], [Ghadi.t('common.nakshatra'), Ghadi.value(p.nakshatra?.[0]?.name), p.nakshatra?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.nakshatra[0].ends}` : '', 'Nakshatra'], [Ghadi.t('common.yoga'), Ghadi.value(p.yoga?.[0]?.name), p.yoga?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.yoga[0].ends}` : '', 'Yoga'], [Ghadi.t('common.karana'), Ghadi.value(p.karana?.[0]?.name), p.karana?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.karana[0].ends}` : '', 'Karana'], [Ghadi.t('common.vara'), Ghadi.value(p.vaara)], [Ghadi.t('common.masa'), Ghadi.value(p.masa)]]);
    $('clock').innerHTML = metricBlock([['Sunrise', p.sunrise], ['Sunset', p.sunset], ['Moonrise', p.moonrise], ['Moonset', p.moonset], ['Rahu Kalam', `${p.rahu_kala?.start || '—'} – ${p.rahu_kala?.end || '—'}`], ['Ayanamsha', p.ayanamsa_degrees ? `${p.ayanamsa_degrees.toFixed(3)}°` : Ghadi.t('common.tropical')]]);
    $('timeline').innerHTML = intervalRows(p);
    $('planet-count').textContent = Ghadi.t('common.bodies', { count: data.planets.length });
    renderWheel(data.planets);
    $('planets').innerHTML = data.planets.map((planet) => `<tr><td><strong>${esc(Ghadi.value(planet.planet))}</strong></td><td>${planet.longitude.toFixed(3)}°</td><td>${esc(Ghadi.value(planet.rashi))}</td><td>${esc(Ghadi.value(planet.nakshatra))}</td><td>${planet.retrograde ? Ghadi.t('common.retrograde') : Ghadi.t('common.direct')}</td></tr>`).join('');
    Ghadi.setStatus(`${Ghadi.t('common.source')}: ${Ghadi.value(data.engine.name)} · ${Ghadi.value(data.engine.coordinate_mode)} · ${Ghadi.value(data.engine.ayanamsa || Ghadi.t('common.tropical'))}`);
  }
  async function load() { try { Ghadi.setStatus(Ghadi.t('common.readingSky')); const params = { city: Ghadi.city, date: dateInput.value }; const url = mode === 'today' ? `/api/cosmic/current?${Ghadi.query(params)}` : `/api/cosmic/date?${Ghadi.query(params)}`; render(await Ghadi.get(url)); } catch (error) { Ghadi.setStatus(error.message, true); } }
  $('load')?.addEventListener('click', load); $('date')?.addEventListener('change', load); $('city')?.addEventListener('change', load); load();
  festivalRegion?.addEventListener('change', () => { localStorage.setItem('ghadi-festival-region', festivalRegion.value); const year = ($('running-date')?.textContent || '').split(' · ')[0]?.split('/')[2]; renderFestivals(festivalItems, $('festival-location')?.textContent || Ghadi.city, year); });
  setInterval(updateClock, 1000);
  document.addEventListener('ghadi-location-changed', () => { if (cityInput) cityInput.value = Ghadi.city; load(); });
});
