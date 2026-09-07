// Schedules. Intervals fire on wall-clock boundaries; the bell schedules follow
// the US session in New York time, which is what a stock dividend should do.
export const SCHEDULES = {
  interval: { label: 'Every N minutes' },
  closing_bell: { label: 'Closing bell (4:00 pm ET, weekdays)', emoji: '🔔' },
  opening_bell: { label: 'Opening bell (9:30 am ET, weekdays)', emoji: '🛎️' },
};

export const INTERVAL_OPTIONS = [1, 2, 5, 10, 30, 60];
export const NY_TZ = 'America/New_York';

export function cronFor(config) {
  if (config.schedule_kind === 'closing_bell') return { expression: '0 16 * * 1-5', timezone: NY_TZ };
  if (config.schedule_kind === 'opening_bell') return { expression: '30 9 * * 1-5', timezone: NY_TZ };
  const m = Number(config.interval_minutes) || 5;
  if (m === 1) return { expression: '* * * * *' };
  if (m === 60) return { expression: '0 * * * *' };
  if (m < 60) return { expression: `*/${m} * * * *` };
  return { expression: `0 */${Math.max(1, Math.floor(m / 60))} * * *` };
}

export function scheduleLabel(config) {
  if (config.schedule_kind === 'closing_bell') return 'at the closing bell';
  if (config.schedule_kind === 'opening_bell') return 'at the opening bell';
  return `every ${config.interval_minutes} min`;
}

/** US regular session: Monday to Friday, 9:30 to 16:00 New York time (holidays not modelled). */
export function isMarketOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (day === 'Sat' || day === 'Sun') return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
