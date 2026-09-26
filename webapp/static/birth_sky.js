Ghadi.ready.then(() => {
  if (Ghadi.mode !== 'birth-snapshot') return;
  const esc = Ghadi.esc;
  const planetKey = (name) => ({ Surya: 'surya', Candra: 'chandra', Mangala: 'mangala', Budha: 'budha', Guru: 'guru', Sukra: 'shukra', Sani: 'shani', Rahu: 'rahu', Ketu: 'ketu', Uranus: 'uranus', Neptune: 'neptune' }[name] || 'other');
  const signs = ['Mesha', 'Vrsabha', 'Mithuna', 'Karkata', 'Simha', 'Kanya', 'Tula', 'Vrscika', 'Dhanu', 'Makara', 'Kumbha', 'Mina'];
  const nakshatras = [['Ashwini', 'Ash'], ['Bharani', 'Bha'], ['Krittika', 'Kri'], ['Rohini', 'Roh'], ['Mrigashira', 'Mri'], ['Ardra', 'Ard'], ['Punarvasu', 'Pun'], ['Pushya', 'Pus'], ['Ashlesha', 'Ash'], ['Magha', 'Mag'], ['Purva Phalguni', 'Pha'], ['Uttara Phalguni', 'UPh'], ['Hasta', 'Has'], ['Chitra', 'Chi'], ['Swati', 'Swa'], ['Vishakha', 'Vis'], ['Anuradha', 'Anu'], ['Jyeshtha', 'Jye'], ['Mula', 'Mul'], ['Purva Ashadha', 'PAs'], ['Uttara Ashadha', 'UAs'], ['Shravana', 'Shr'], ['Dhanishtha', 'Dha'], ['Shatabhisha', 'Sha'], ['Purva Bhadrapada', 'PBh'], ['Uttara Bhadrapada', 'UBh'], ['Revati', 'Rev']];

  function sectionMarkup() {
    return `<section id="birth-sidereal" class="panel birth-sidereal"><div class="panel-heading"><div><div class="panel-kicker">${esc(Ghadi.t('birth.siderealEyebrow'))}</div><h2>${esc(Ghadi.t('birth.siderealTitle'))}</h2></div><span class="badge">${esc(Ghadi.t('birth.siderealBadge'))}</span></div><div class="birth-sidereal-layout"><div id="birth-wheel" class="wheel birth-wheel"><span class="wheel-center">${esc(Ghadi.t('astronomy.rashi'))}</span></div><div class="table-wrap"><table><thead><tr><th>${esc(Ghadi.t('astronomy.body'))}</th><th>${esc(Ghadi.t('astronomy.rashiColumn'))}</th><th>${esc(Ghadi.t('common.nakshatra'))}</th><th>${esc(Ghadi.t('astronomy.longitude'))}</th></tr></thead><tbody id="birth-planets"></tbody></table></div></div></section>`;
  }

  function renderWheel(planets) {
    const wheel = document.getElementById('birth-wheel');
    if (!wheel) return;
    wheel.querySelectorAll('.wheel-nakshatra, .wheel-sign, .wheel-planet').forEach((node) => node.remove());
    nakshatras.forEach(([name, short], index) => {
      const angle = (index * (360 / nakshatras.length) - 90) * Math.PI / 180;
      const node = document.createElement('span');
      node.className = 'wheel-nakshatra';
      node.style = `--x:${Math.cos(angle) * 46}%;--y:${Math.sin(angle) * 46}%`;
      node.title = Ghadi.value(name);
      node.textContent = Ghadi.value(name).slice(0, Ghadi.locale === 'hi' ? 3 : short.length);
      wheel.append(node);
    });
    signs.forEach((sign, index) => {
      const angle = (index * 30 - 90) * Math.PI / 180;
      const node = document.createElement('span');
      node.className = 'wheel-sign';
      node.style = `--x:${Math.cos(angle) * 42}%;--y:${Math.sin(angle) * 42}%`;
      node.textContent = Ghadi.value(sign);
    wheel.append(node);
    });
    planets.forEach((planet) => {
      const angle = (planet.longitude - 90) * Math.PI / 180;
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `wheel-planet planet-${planetKey(planet.planet)}`;
      node.style = `--x:${Math.cos(angle) * 29}%;--y:${Math.sin(angle) * 29}%`;
      node.title = `${Ghadi.value(planet.planet)}: ${planet.longitude.toFixed(2)} ${Ghadi.t('common.degrees')}`;
      node.textContent = Ghadi.value(planet.planet).slice(0, 2);
      wheel.append(node);
    });
  }

  function render(data) {
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
