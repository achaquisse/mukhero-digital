import { describe, expect, it } from 'vitest';
import { addDays, addMonths, compact, dateNumeric, dayLabelYear, fileSize, fmt, initials, monthFull, pct1, sfmt } from './format';

describe('number formatting', () => {
  it('groups thousands with spaces and rounds', () => {
    expect(fmt(1234567.6)).toBe('1 234 568');
    expect(fmt(0)).toBe('0');
    expect(fmt(undefined)).toBe('0');
  });

  it('uses a typographic minus for negatives', () => {
    expect(fmt(-1500)).toBe('−1 500');
    expect(fmt(-0.4)).toBe('0');
  });

  it('signs positives in sfmt only', () => {
    expect(sfmt(1200)).toBe('+1 200');
    expect(sfmt(-5)).toBe('−5');
    expect(sfmt(0)).toBe('0');
  });

  it('compacts large values', () => {
    expect(compact(9999)).toBe('9 999');
    expect(compact(45_300)).toBe('45 k');
    expect(compact(1_250_000)).toBe('1,3 M');
    expect(compact(-23_000_000)).toBe('−23 M');
  });

  it('formats percentages with a comma', () => {
    expect(pct1(1, 8)).toBe('12,5%');
    expect(pct1(1, 0)).toBe('—');
  });
});

describe('dates', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2026-10', -11)).toBe('2025-11');
  });

  it('adds days', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('labels dates in Portuguese', () => {
    expect(dayLabelYear('2026-03-05')).toBe('5 Mar 2026');
    expect(monthFull('2026-10')).toBe('Outubro 2026');
    expect(dateNumeric('2026-03-05')).toBe('05/03/26');
  });
});

describe('misc', () => {
  it('builds initials', () => {
    expect(initials('Carlos  Machava')).toBe('CM');
    expect(initials('ana maria sitoe')).toBe('AM');
  });

  it('formats file sizes', () => {
    expect(fileSize(512)).toBe('512 B');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
