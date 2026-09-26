Ghadi.ready.then(() => {
  const $ = (id) => document.getElementById(id);
  const esc = Ghadi.esc;
  const state = { view: 'day', month: null, yearItems: [] };
  const dateInput = $('date');
  const isoDate = () => dateInput.value || Ghadi.today;
  const dateText = (value) => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; };
  const query = (extra = {}) => Ghadi.query({ city: Ghadi.city, ...extra });
  const filters = () => new Set([...document.querySelectorAll('.calendar-filters input:checked')].map((input) => input.value));
  const monthName = (year, month) => new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  const tithiName = (code) => {
    const match = String(code || '').match(/^([KS])(\d+)$/);
    if (!match) return code || '';
    const paksha = match[1] === 'S' ? Ghadi.t('home.shuklaPaksha') : Ghadi.t('home.krishnaPaksha');
    const number = Number(match[2]);
    const name = number === 15 && match[1] === 'K' ? Ghadi.t('tithi.amavasya') : Ghadi.t(`tithi.${number}`);
    return `${paksha} ${name}`;
  };
  const eventLabel = (event) => event.category === 'festival' || event.category === 'regional' || event.category === 'national' || event.category === 'sankranti' ? Ghadi.value(event.name) : event.category === 'ekadashi' ? Ghadi.t('calendar.ekadashi') : event.category === 'purnima' ? Ghadi.t('calendar.purnima') : event.category === 'amavasya' ? Ghadi.t('calendar.amavasya') : event.name;

  function renderDay(data) {
    const p = data;
    $('results').hidden = false;
    $('day-title').textContent = `${p.date} · ${p.city}`;
    $('metrics').innerHTML = [Ghadi.metric('Tithi', Ghadi.value(p.tithi?.[0]?.name), p.tithi?.[0]?.ends ? `${Ghadi.t('common.until')} ${p.tithi[0].ends}` : '', 'Tithi'), Ghadi.metric('Nakshatra', Ghadi.value(p.nakshatra?.[0]?.name), '', 'Nakshatra'), Ghadi.metric('Yoga', Ghadi.value(p.yoga?.[0]?.name), '', 'Yoga'), Ghadi.metric('Karana', Ghadi.value(p.karana?.[0]?.name), '', 'Karana'), Ghadi.metric('Vara', Ghadi.value(p.vaara)), Ghadi.metric('Masa', Ghadi.value(p.masa))].join('');
    $('clock').innerHTML = [Ghadi.metric('Sunrise', p.sunrise), Ghadi.metric('Sunset', p.sunset), Ghadi.metric('Moonrise', p.moonrise), Ghadi.metric('Moonset', p.moonset), Ghadi.metric('Rahu Kalam', `${p.rahu_kala?.start || '—'} – ${p.rahu_kala?.end || '—'}`), Ghadi.metric('Day duration', p.day_duration)].join('');
    const transitionGroups = [['Tithi', p.tithi], ['Nakshatra', p.nakshatra], ['Yoga', p.yoga], ['Karana', p.karana]];
    $('transitions').innerHTML = transitionGroups.flatMap(([label, items]) => (items || []).map((item) => `<div class="timeline-item"><time>${esc(item.ends)}</time><div><strong>${esc(Ghadi.label(label))} · ${esc(Ghadi.value(item.name))}</strong><div class="muted">${esc(Ghadi.t('common.transition'))}</div></div></div>`)).join('');
    Ghadi.setStatus(`${Ghadi.t('common.reading')} ${p.date} · ${p.city} · ${Ghadi.value(p.coordinate_label || p.coordinate_mode)}`);
  }

  async function loadDay() {
    try {
      Ghadi.setStatus(Ghadi.t('common.calculatingDay'));
      const data = await Ghadi.get(`/api/panchanga?${query({ date: dateText(isoDate()), month: $('month').value, ayanamsa: $('ayanamsa').value })}`);
      renderDay(data);
    } catch (error) { Ghadi.setStatus(error.message, true); }
  }

  function renderMonth() {
    const data = state.month;
    if (!data) return;
    const active = filters();
    $('calendar-period-title').textContent = monthName(data.year, data.month);
    const weekdayFormatter = new Intl.DateTimeFormat(Ghadi.locale === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
    const weekdays = Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(2024, 0, 7 + index)));
    const first = new Date(data.year, data.month - 1, 1);
    const blanks = Array.from({ length: first.getDay() }, () => '<span class="calendar-date calendar-date-empty"></span>').join('');
    const cells = data.days.map((day) => {
      const visible = day.events.filter((event) => active.has(event.category) || (['regional', 'national'].includes(event.category) && active.has('festival')));
      const labels = visible.slice(0, 2).map((event) => `<span class="calendar-event calendar-event-${esc(event.category)}">${esc(eventLabel(event))}</span>`).join('');
      return `<button class="calendar-date${day.date === isoDate() ? ' is-selected' : ''}" type="button" data-calendar-date="${day.date}"><strong>${day.day}</strong><span class="calendar-tithi">${esc(tithiName(day.tithi))}</span><span class="calendar-events">${labels}</span></button>`;
    }).join('');
    $('calendar-month-view').innerHTML = `<div class="calendar-weekdays">${weekdays.map((day) => `<span>${esc(day)}</span>`).join('')}</div><div class="calendar-grid">${blanks}${cells}</div>`;
    document.querySelectorAll('[data-calendar-date]').forEach((button) => button.addEventListener('click', () => { dateInput.value = button.dataset.calendarDate; setView('day'); loadDay(); }));
  }

  function renderYear() {
    const active = filters();
    const year = Number(($('date').value || Ghadi.today).slice(0, 4));
    $('calendar-period-title').textContent = String(year);
    const grouped = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, items: [] }));
    state.yearItems.forEach((item) => { const itemMonth = Number(item.month); if (item.year === year && itemMonth >= 1 && itemMonth <= 12) grouped[itemMonth - 1].items.push(item); });
    $('calendar-year-view').innerHTML = grouped.map((group) => { const items = group.items.filter((item) => active.has(item.category) || (['regional', 'national'].includes(item.category) && active.has('festival'))); return `<article class="year-month"><h3>${esc(monthName(year, group.month))}</h3><div class="year-events">${items.length ? items.map((item) => `<button type="button" data-calendar-year-date="${year}-${String(group.month).padStart(2, '0')}-${String((String(item.date).match(/\d+/g) || ['1'])[0]).padStart(2, '0')}"><strong>${esc(item.name)}</strong><span>${esc(item.date)}</span></button>`).join('') : `<span class="muted">${esc(Ghadi.t('calendar.noEvents'))}</span>`}</div></article>`; }).join('');
    document.querySelectorAll('[data-calendar-year-date]').forEach((button) => button.addEventListener('click', () => { dateInput.value = button.dataset.calendarYearDate; setView('day'); loadDay(); }));
  }

  async function loadCalendar(view = state.view) {
    const date = new Date(`${$('date').value || Ghadi.today}T12:00:00`);
    try {
      Ghadi.setStatus(Ghadi.t('common.calculatingDay'));
      if (view === 'year') {
        const data = await Ghadi.get(`/api/cosmic/year/${date.getFullYear()}?${query()}`);
        state.yearItems = data.festivals || [];
        renderYear();
      } else {
        state.month = await Ghadi.get(`/api/calendar/month/${date.getMonth() + 1}?year=${date.getFullYear()}&${query()}`);
        renderMonth();
      }
      Ghadi.setStatus(`${Ghadi.t('common.reading')} ${$('calendar-period-title').textContent}`);
    } catch (error) { Ghadi.setStatus(error.message, true); }
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('[data-calendar-view]').forEach((button) => button.classList.toggle('active', button.dataset.calendarView === view));
    $('results').hidden = view !== 'day';
    $('calendar-workspace').hidden = view === 'day';
    if (view !== 'day') loadCalendar(view);
  }

  $('city').value = Ghadi.city;
  dateInput.value = new URLSearchParams(location.search).get('date') || Ghadi.today;
  $('load').onclick = loadDay;
  dateInput.onchange = loadDay;
  $('month').onchange = loadDay;
  $('ayanamsa').onchange = loadDay;
  document.querySelectorAll('[data-calendar-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.calendarView)));
  document.querySelectorAll('.calendar-filters input').forEach((input) => input.addEventListener('change', () => state.view === 'year' ? renderYear() : renderMonth()));
  $('calendar-previous').onclick = () => { const date = new Date(`${isoDate()}T12:00:00`); date.setMonth(date.getMonth() - 1); dateInput.value = date.toISOString().slice(0, 10); loadCalendar(state.view); };
  $('calendar-next').onclick = () => { const date = new Date(`${isoDate()}T12:00:00`); date.setMonth(date.getMonth() + 1); dateInput.value = date.toISOString().slice(0, 10); loadCalendar(state.view); };
  document.addEventListener('ghadi-location-changed', () => { $('city').value = Ghadi.city; state.view === 'day' ? loadDay() : loadCalendar(state.view); });
  loadDay();
});
