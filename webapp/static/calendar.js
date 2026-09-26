Ghadi.ready.then(() => {
  const $ = (id) => document.getElementById(id); const esc = Ghadi.esc; const now = new Date();
  $('city').value = Ghadi.city; $('date').value = new URLSearchParams(location.search).get('date') || now.toISOString().slice(0, 10); $('start').value = now.toISOString().slice(0, 7);
  function dateText(value) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
  function segments(values) { return (values || []).map((item) => `${esc(item.name)} <span class="muted">${esc(Ghadi.t('common.until'))} ${esc(item.ends)}</span>`).join('<br>'); }
  function render(data) {
    const p = data;
    $('results').hidden = false;
    $('day-title').textContent = `${p.date} · ${p.city}`;
    $('metrics').innerHTML = [Ghadi.metric('Tithi', p.tithi?.[0]?.name, p.tithi?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.tithi[0].ends}` : '', 'Tithi'), Ghadi.metric('Nakshatra', p.nakshatra?.[0]?.name, '', 'Nakshatra'), Ghadi.metric('Yoga', p.yoga?.[0]?.name, '', 'Yoga'), Ghadi.metric('Karana', p.karana?.[0]?.name, '', 'Karana'), Ghadi.metric('Vara', p.vaara), Ghadi.metric('Masa', p.masa)].join('');
    $('clock').innerHTML = [Ghadi.metric('Sunrise', p.sunrise), Ghadi.metric('Sunset', p.sunset), Ghadi.metric('Moonrise', p.moonrise), Ghadi.metric('Moonset', p.moonset), Ghadi.metric('Rahu Kalam', `${p.rahu_kala?.start || '—'} – ${p.rahu_kala?.end || '—'}`), Ghadi.metric('Day duration', p.day_duration)].join('');
    const transitionGroups = [['Tithi', p.tithi], ['Nakshatra', p.nakshatra], ['Yoga', p.yoga], ['Karana', p.karana]];
    const rows = transitionGroups.flatMap(([label, items]) => (items || []).map((item) => `<div class="timeline-item"><time>${esc(item.ends)}</time><div><strong>${esc(Ghadi.label(label))} · ${esc(item.name)}</strong><div class="muted">${esc(Ghadi.t('common.transition'))}</div></div></div>`));
    $('transitions').innerHTML = rows.join('');
    $('pdf-city').value = Ghadi.city; $('pdf-month').value = $('month').value; $('pdf-ayanamsa').value = $('ayanamsa').value;
    Ghadi.setStatus(`${Ghadi.t('common.reading')} ${p.date} · ${p.city} · ${p.coordinate_label || p.coordinate_mode}`);
  }
  async function load() { try { Ghadi.setStatus(Ghadi.t('common.calculatingDay')); const query = Ghadi.query({ city: Ghadi.city, date: dateText($('date').value), month: $('month').value, ayanamsa: $('ayanamsa').value }); render(await Ghadi.get(`/api/panchanga?${query}`)); } catch (error) { Ghadi.setStatus(error.message, true); } }
  $('load').onclick = load; $('date').onchange = load; $('month').onchange = load; $('ayanamsa').onchange = load; $('ics-btn').onclick = () => { const params = Ghadi.query({ city: Ghadi.city, start: $('start').value, month: $('month').value, ayanamsa: $('ayanamsa').value }); window.location.href = `/api/panchanga.ics?${params}`; }; load();
  let overviewItems = [];
  async function loadOverview(view) { const year = Number(($('date').value || Ghadi.today).slice(0, 4)); const month = Number(($('date').value || Ghadi.today).slice(5, 7)); const endpoint = view === 'year' ? `/api/cosmic/year/${year}?city=${encodeURIComponent(Ghadi.city)}` : `/api/cosmic/month/${month}?year=${year}&city=${encodeURIComponent(Ghadi.city)}`; try { Ghadi.setLoading('overview-results'); const data = await Ghadi.get(endpoint); overviewItems = data.festivals || []; renderOverview(view); } catch (error) { $('overview-results').innerHTML = `<div class="status error">${esc(error.message)}</div>`; } }
  function renderOverview(view) { const filter = $('festival-filter').value; const items = overviewItems.filter((item) => filter === 'all' || String(item.marker) === filter); $('overview-title').textContent = view === 'year' ? `${$('date').value.slice(0, 4)} ${Ghadi.t('calendar.observances')}` : `${$('date').value.slice(0, 7)} ${Ghadi.t('calendar.observances')}`; $('overview-results').innerHTML = items.length ? items.map((item) => `<a class="list-item" href="/?date=${item.iso_date || ''}"><div><span class="badge">${esc(item.marker || Ghadi.t('calendar.observance'))}</span><strong>${esc(item.name)}</strong></div><span>${esc(item.date || Ghadi.t('calendar.calculatedDate'))}</span></a>`).join('') : `<div class="empty">${Ghadi.t('calendar.noEvents')}</div>`; }
  document.querySelectorAll('[data-calendar-view]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-calendar-view]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); const view = button.dataset.calendarView; $('results').hidden = view !== 'day'; $('calendar-overview').hidden = view === 'day'; if (view !== 'day') loadOverview(view); }));
  $('festival-filter')?.addEventListener('change', () => renderOverview(document.querySelector('[data-calendar-view].active')?.dataset.calendarView || 'month'));
  document.addEventListener('ghadi-location-changed', () => { $('city').value = Ghadi.city; load(); });
});
