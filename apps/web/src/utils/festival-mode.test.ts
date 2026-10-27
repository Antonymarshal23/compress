import { describe, expect, it } from 'vitest';
import { festivalDecoration, festivalMessage, getFestivalMode } from './festival-mode';

describe('seasonal home festival mode', () => {
  it('uses the India calendar for a short Diwali decoration window', () => {
    expect(getFestivalMode(new Date('2026-11-07T20:00:00.000Z'))).toBe('diwali');
    expect(getFestivalMode(new Date('2026-11-14T12:00:00.000Z'))).toBeNull();
  });

  it('shows seasonal decorations only during the Christmas and New Year windows', () => {
    expect(getFestivalMode(new Date('2026-12-24T12:00:00.000Z'))).toBe('christmas');
    expect(getFestivalMode(new Date('2027-01-01T12:00:00.000Z'))).toBe('new-year');
    expect(getFestivalMode(new Date('2026-06-15T12:00:00.000Z'))).toBeNull();
  });

  it('provides an accessible greeting and decorative motif for each mode', () => {
    expect(festivalMessage('diwali')).toContain('Diwali');
    expect(festivalDecoration('christmas')).toContain('🎄');
    expect(festivalDecoration('new-year')).toContain('🎉');
  });
});
