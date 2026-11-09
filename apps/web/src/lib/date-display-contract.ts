function hasValidCalendarDate(value: string): boolean {
  const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!calendar) return true;

  const year = Number(calendar[1]);
  const month = Number(calendar[2]);
  const day = Number(calendar[3]);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  return day >= 1 && day <= daysInMonth;
}

export function toSafeDisplayDateTime(value: string | null | undefined): string | null {
  if (!value || !hasValidCalendarDate(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

export function formatDisplayDate(value: string | null | undefined): string {
  const safeValue = toSafeDisplayDateTime(value);
  return safeValue ? new Date(safeValue).toLocaleDateString() : 'Unavailable';
}

export function formatDisplayDateTime(value: string | null | undefined): string {
  const safeValue = toSafeDisplayDateTime(value);
  return safeValue ? new Date(safeValue).toLocaleString() : 'Unavailable';
}
