import { club } from './club';

const tz = club.timezone;

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });

const monthDay = fmt({ month: 'short', day: 'numeric' });
const weekdayLong = fmt({ weekday: 'long' });
const weekdayShort = fmt({ weekday: 'short' });
const month = fmt({ month: 'short' });
const day = fmt({ day: 'numeric' });
const time = fmt({ hour: 'numeric', minute: '2-digit' });
const timeWithZone = fmt({ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const full = fmt({ weekday: 'long', month: 'long', day: 'numeric' });
const shortStamp = fmt({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const dateParts = (iso: string) => {
  const d = new Date(iso);
  return { month: month.format(d), day: day.format(d), weekday: weekdayShort.format(d) };
};

export const longDate = (iso: string) => full.format(new Date(iso));
export const shortDate = (iso: string) => monthDay.format(new Date(iso));
export const weekday = (iso: string) => weekdayLong.format(new Date(iso));
export const stamp = (iso: string) => shortStamp.format(new Date(iso));

export function timeRange(startsAt: string, endsAt: string) {
  return `${time.format(new Date(startsAt))} to ${timeWithZone.format(new Date(endsAt))}`;
}

export function relativeDay(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return null;
}

// ---- datetime-local inputs, always interpreted in the club's timezone ----

function offsetMinutes(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - date.getTime()) / 60_000;
}

export function toInputValue(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() + offsetMinutes(d) * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromInputValue(value: string) {
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - offsetMinutes(new Date(guess)) * 60_000;
  ts = guess - offsetMinutes(new Date(ts)) * 60_000; // second pass handles daylight saving edges
  return new Date(ts).toISOString();
}

export function spotsLeft(e: { capacity: number | null; goingCount: number }) {
  return e.capacity == null ? null : Math.max(0, e.capacity - e.goingCount);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
