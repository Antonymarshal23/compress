export type FestivalMode = 'diwali' | 'christmas' | 'new-year';

type FestivalWindow = {
  start: number;
  end: number;
  mode: FestivalMode;
};

const diwaliDates: Record<number, string> = {
  2025: '2025-10-20',
  2026: '2026-11-08',
  2027: '2027-10-29',
  2028: '2028-10-17',
  2029: '2029-11-05',
  2030: '2030-10-26',
  2031: '2031-11-14',
  2032: '2032-11-02',
  2033: '2033-10-22',
  2034: '2034-11-10',
  2035: '2035-10-30',
};

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function indiaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function getFestivalMode(date: Date = new Date()): FestivalMode | null {
  const parts = indiaDateParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const currentDay = dayNumber(`${parts.year}-${parts.month}-${parts.day}`);

  const diwali = diwaliDates[year];
  if (diwali) {
    const festivalDay = dayNumber(diwali);
    if (currentDay >= festivalDay - 4 && currentDay <= festivalDay + 1) return 'diwali';
  }

  if (month === 12 && day >= 20 && day <= 26) return 'christmas';
  if ((month === 12 && day >= 29) || (month === 1 && day <= 2)) return 'new-year';
  return null;
}

export function festivalMessage(mode: FestivalMode): string {
  switch (mode) {
    case 'diwali':
      return 'Wishing you a bright and joyful Diwali';
    case 'christmas':
      return 'Warm wishes for a joyful Christmas';
    case 'new-year':
      return 'Wishing you a bright start to the New Year';
  }
}

export function festivalDecoration(mode: FestivalMode): string[] {
  switch (mode) {
    case 'diwali':
      return ['🪔', '✦', '🪷', '✧'];
    case 'christmas':
      return ['✦', '❄', '🎄', '✧'];
    case 'new-year':
      return ['✦', '✧', '🎉', '✦'];
  }
}
