Ghadi.ready.then(() => {
  if (Ghadi.mode !== 'birth-snapshot') return;
  const esc = Ghadi.esc;
  const planetKey = (name) => ({ Surya: 'surya', Candra: 'chandra', Mangala: 'mangala', Budha: 'budha', Guru: 'guru', Sukra: 'shukra', Sani: 'shani', Rahu: 'rahu', Ketu: 'ketu', Uranus: 'uranus', Neptune: 'neptune' }[name] || 'other');
  const signs = ['Mesha', 'Vrsabha', 'Mithuna', 'Karkata', 'Simha', 'Kanya', 'Tula', 'Vrscika', 'Dhanu', 'Makara', 'Kumbha', 'Mina'];
  const nakshatras = [['Ashwini', 'Ash'], ['Bharani', 'Bha'], ['Krittika', 'Kri'], ['Rohini', 'Roh'], ['Mrigashira', 'Mri'], ['Ardra', 'Ard'], ['Punarvasu', 'Pun'], ['Pushya', 'Pus'], ['Ashlesha', 'Ash'], ['Magha', 'Mag'], ['Purva Phalguni', 'Pha'], ['Uttara Phalguni', 'UPh'], ['Hasta', 'Has'], ['Chitra', 'Chi'], ['Swati', 'Swa'], ['Vishakha', 'Vis'], ['Anuradha', 'Anu'], ['Jyeshtha', 'Jye'], ['Mula', 'Mul'], ['Purva Ashadha', 'PAs'], ['Uttara Ashadha', 'UAs'], ['Shravana', 'Shr'], ['Dhanishtha', 'Dha'], ['Shatabhisha', 'Sha'], ['Purva Bhadrapada', 'PBh'], ['Uttara Bhadrapada', 'UBh'], ['Revati', 'Rev']];

  function sectionMarkup() {
    return `<section id="birth-sidereal" class="panel birth-sidereal"><div class="panel-heading"><div><div class="panel-kicker">${esc(Ghadi.t('birth.siderealEyebrow'))}</div><h2>${esc(Ghadi.t('birth.siderealTitle'))}</h2></div><span class="badge">${esc(Ghadi.t('birth.siderealBadge'))}</span></div><div class="birth-sidereal-layout"><div id="birth-wheel" class="wheel birth-wheel"><span class="wheel-center">${esc(Ghadi.t('astronomy.rashi'))}</span></div><div class="table-wrap"><table><thead><tr><th>${esc(Ghadi.t('astronomy.body'))}</th><th>${esc(Ghadi.t('astronomy.rashiColumn'))}</th><th>${esc(Ghadi.t('common.nakshatra'))}</th><th>${esc(Ghadi.t('astronomy.longitude'))}</th></tr></thead><tbody id="birth-planets"></tbody></table></div></div></section>`;
  }

  const chartState = { mode: 'rashi', days: 0, playing: false, labels: true, heliocentric: false, zoom: 1, planets: [], timer: null };
  const planetIcons = { Surya: '☉', Candra: '☾', Mangala: '♂', Budha: '☿', Guru: '♃', Sukra: '♀', Sani: '♄', Rahu: '☊', Ketu: '☋', Uranus: '♅', Neptune: '♆' };
  const chartText = (key, fallback) => Ghadi.t(`chart.${key}`, { fallback });
  function showDetail(planet) {
    const panel = document.getElementById('birth-planet-detail');
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
  function renderWheel(planets) {
    const wheel = document.getElementById('birth-wheel');
    if (!wheel) return;
    chartState.planets = planets;
    const useHelio = chartState.heliocentric && chartState.mode !== 'rashi';
    const visible = planets.map((planet) => ({ ...planet, chartLongitude: (useHelio && planet.heliocentric_longitude != null ? planet.heliocentric_longitude : planet.longitude) + planet.speed * chartState.days })).filter((planet) => Number.isFinite(planet.chartLongitude));
    const currentSign = Math.floor((((visible.find((planet) => planet.planet === 'Surya') || visible[0])?.chartLongitude || 0) + 360) % 360 / 30);
    const distances = planets.filter((planet) => planet.distance_au);
    const minDistance = Math.min(...distances.map((planet) => planet.distance_au));
    const maxDistance = Math.max(...distances.map((planet) => planet.distance_au));
    wheel.className = `wheel birth-wheel chart-${chartState.mode}${chartState.labels ? '' : ' hide-chart-labels'}`;
    wheel.style.setProperty('--chart-scale', chartState.zoom);
    wheel.innerHTML = `<span class="wheel-center">${esc(chartText('earth', 'Earth'))}</span>`;
    if (chartState.mode === 'distance' || chartState.mode === 'orbit') {
      [22, 32, 42].forEach((radius) => { const ring = document.createElement('span'); ring.className = 'chart-distance-ring'; ring.style.setProperty('--ring-radius', `${radius}%`); ring.title = chartText('logScale', 'Logarithmic distance scale'); wheel.append(ring); });
    } else {
      nakshatras.forEach(([name, short], index) => { const angle = (index * (360 / nakshatras.length) - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = 'wheel-nakshatra'; node.style = `--x:${Math.cos(angle) * 46}%;--y:${Math.sin(angle) * 46}%`; node.title = Ghadi.value(name); node.textContent = Ghadi.value(name).slice(0, Ghadi.locale === 'hi' ? 3 : short.length); wheel.append(node); });
      signs.forEach((sign, index) => { const angle = (index * 30 - 90) * Math.PI / 180; const node = document.createElement('span'); node.className = `wheel-sign${index === currentSign ? ' is-current' : ''}`; node.style = `--x:${Math.cos(angle) * 42}%;--y:${Math.sin(angle) * 42}%`; node.textContent = Ghadi.value(sign); wheel.append(node); });
    }
    visible.forEach((planet) => { const angle = ((planet.chartLongitude % 360) - 90) * Math.PI / 180; const radius = chartState.mode === 'rashi' ? 29 : chartRadius(planet, minDistance, maxDistance); const node = document.createElement('button'); node.type = 'button'; node.className = `wheel-planet planet-${planetKey(planet.planet)}`; node.style = `--x:${Math.cos(angle) * radius}%;--y:${Math.sin(angle) * radius}%`; node.title = `${Ghadi.value(planet.planet)}: ${planet.longitude.toFixed(2)}°`; node.innerHTML = `<span class="planet-glyph">${planetIcons[planet.planet] || '✦'}</span><span class="planet-label">${esc(Ghadi.value(planet.planet))}</span>`; node.addEventListener('click', () => showDetail(planet)); wheel.append(node); });
    const scale = document.getElementById('birth-chart-scale');
    if (scale) scale.textContent = chartState.mode === 'rashi' ? chartText('siderealScale', 'Sidereal longitude · 12 Rashis · 27 Nakshatras') : `${chartText('logScale', 'Logarithmic distance scale')} · ${chartText('au', 'AU')} · ${chartState.heliocentric ? chartText('heliocentric', 'Heliocentric') : chartText('geocentric', 'Geocentric')}`;
  }
  function setupChartControls() {
    const panel = document.querySelector('.birth-sidereal');
    const anchor = document.getElementById('birth-wheel');
    if (!panel || !anchor || document.getElementById('birth-chart-controls')) return;
    const controls = document.createElement('div');
    controls.id = 'birth-chart-controls';
    controls.className = 'chart-controls';
    controls.innerHTML = `<div class="chart-mode" role="tablist"><button type="button" class="active" data-birth-chart-mode="rashi">${chartText('rashi', 'Rashi')}</button><button type="button" data-birth-chart-mode="distance">${chartText('distance', 'Distance')}</button><button type="button" data-birth-chart-mode="orbit">${chartText('orbit', 'Orbit')}</button></div><div class="chart-actions"><button type="button" id="birth-chart-play" title="${chartText('play', 'Play')}">▶</button><button type="button" id="birth-chart-reset" title="${chartText('reset', 'Reset')}">↺</button><button type="button" id="birth-chart-zoom-out" aria-label="Zoom out">−</button><button type="button" id="birth-chart-zoom-in" aria-label="Zoom in">+</button><label><input id="birth-chart-labels" type="checkbox" checked> ${chartText('labels', 'Labels')}</label><label><input id="birth-chart-heliocentric" type="checkbox"> ${chartText('heliocentric', 'Heliocentric')}</label></div><label class="chart-time"><span>${chartText('time', 'Time offset')}</span><input id="birth-chart-time" type="range" min="-30" max="30" step="0.25" value="0"><output id="birth-chart-time-value">${chartText('now', 'Now')}</output></label>`;
    const scale = document.createElement('div'); scale.id = 'birth-chart-scale'; scale.className = 'cosmic-chart-scale';
    const detail = document.createElement('div'); detail.id = 'birth-planet-detail'; detail.className = 'planet-detail';
    panel.insertBefore(controls, anchor.parentElement); panel.insertBefore(scale, anchor.parentElement); panel.append(detail);
    controls.addEventListener('click', (event) => { const mode = event.target.closest('[data-birth-chart-mode]')?.dataset.birthChartMode; if (!mode) return; chartState.mode = mode; controls.querySelectorAll('[data-birth-chart-mode]').forEach((button) => button.classList.toggle('active', button.dataset.birthChartMode === mode)); renderWheel(chartState.planets); });
    document.getElementById('birth-chart-play').onclick = () => { chartState.playing = !chartState.playing; const button = document.getElementById('birth-chart-play'); button.textContent = chartState.playing ? '❚❚' : '▶'; if (chartState.playing && !chartState.timer) chartState.timer = setInterval(() => { chartState.days = (chartState.days + .25) % 31; document.getElementById('birth-chart-time').value = chartState.days; document.getElementById('birth-chart-time-value').textContent = chartState.days ? `${chartState.days > 0 ? '+' : ''}${chartState.days}d` : chartText('now', 'Now'); renderWheel(chartState.planets); }, 500); if (!chartState.playing && chartState.timer) { clearInterval(chartState.timer); chartState.timer = null; } };
    document.getElementById('birth-chart-reset').onclick = () => { chartState.days = 0; chartState.zoom = 1; chartState.heliocentric = false; document.getElementById('birth-chart-time').value = 0; document.getElementById('birth-chart-time-value').textContent = chartText('now', 'Now'); document.getElementById('birth-chart-heliocentric').checked = false; renderWheel(chartState.planets); };
    document.getElementById('birth-chart-time').oninput = (event) => { chartState.days = Number(event.target.value); document.getElementById('birth-chart-time-value').textContent = chartState.days ? `${chartState.days > 0 ? '+' : ''}${chartState.days}d` : chartText('now', 'Now'); renderWheel(chartState.planets); };
    document.getElementById('birth-chart-labels').onchange = (event) => { chartState.labels = event.target.checked; renderWheel(chartState.planets); };
    document.getElementById('birth-chart-heliocentric').onchange = (event) => { chartState.heliocentric = event.target.checked; renderWheel(chartState.planets); };
    document.getElementById('birth-chart-zoom-in').onclick = () => { chartState.zoom = Math.min(1.35, chartState.zoom + .1); renderWheel(chartState.planets); };
    document.getElementById('birth-chart-zoom-out').onclick = () => { chartState.zoom = Math.max(.75, chartState.zoom - .1); renderWheel(chartState.planets); };
  }

  function render(data) {
    setupChartControls();
    renderWheel(data.planets || []);
    const rows = (data.planets || []).map((planet) => `<tr><td><strong>${esc(Ghadi.value(planet.planet))}</strong></td><td>${esc(Ghadi.value(planet.rashi))}</td><td>${esc(Ghadi.value(planet.nakshatra))}</td><td>${planet.longitude.toFixed(3)}°</td></tr>`).join('');
    const table = document.getElementById('birth-planets');
    if (table) table.innerHTML = rows;
  }

  async function load() {
    const birth = document.getElementById('birth');
    const city = document.getElementById('city');
    if (!birth || !city) return;
    try {
      const data = await Ghadi.get(`/api/cosmic/birth?datetime=${encodeURIComponent(birth.value)}&city=${encodeURIComponent(city.value)}`);
      render(data);
    } catch (error) {
      Ghadi.setStatus(error.message, true);
    }
  }

  function ensure() {
    const app = document.getElementById('app');
    const results = document.getElementById('results');
    const button = document.getElementById('load');
    if (!app || !results || !button) return;
    const inserted = !document.getElementById('birth-sidereal');
    if (inserted) results.insertAdjacentHTML('afterend', sectionMarkup());
    if (!button.dataset.siderealBound) {
      button.addEventListener('click', () => window.setTimeout(load, 0));
      button.dataset.siderealBound = 'true';
    }
    if (inserted) load();
  }

  const observer = new MutationObserver(ensure);
  observer.observe(document.getElementById('app'), { childList: true, subtree: true });
  ensure();
});
