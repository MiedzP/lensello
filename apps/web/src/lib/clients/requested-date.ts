/**
 * Best-effort extraction of "the date they asked about" from inquiry text.
 *
 * This exists to answer one narrow question honestly: can we look the date up
 * in the `gigs` table, or do we have to tell the AI that availability is
 * unknown? It is deliberately conservative —
 *
 *   - it recognises a small set of unambiguous written forms and nothing else;
 *   - if the text yields more than one distinct date, it returns null rather
 *     than picking a favourite.
 *
 * A null result is not a failure. It pre-fills nothing, the photographer types
 * the date they actually mean, and `isDateAvailable` stays null until someone
 * knows. Guessing here would be the one thing the reply prompt forbids.
 */

import type { DateOnly } from '@lensello/core';

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** `September 14`, `Sept 14th, 2026`, `Sep 14 2026` */
const MONTH_FIRST = new RegExp(
  String.raw`\b(${MONTH_NAMES})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b`,
  'gi',
);

/** `14 September`, `14th of September 2026` */
const DAY_FIRST = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_NAMES})\.?(?:\s*,?\s*(\d{4}))?\b`,
  'gi',
);

/** `2026-09-14` */
const ISO = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g;

/** `9/14/2026`, `09/14/26`, `9/14` — read US-style month/day. */
const SLASHED = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?![\d/])/g;

interface Candidate {
  month: number;
  day: number;
  year: number | null;
}

/**
 * "may" is the one month name that is also a common verb, and matching is
 * case-insensitive for every other form. Requiring a capital M costs nothing
 * real ("May 14" is how anyone writes the date) and stops "we may 2 weeks out"
 * from becoming the 2nd of May.
 */
function isVerbMay(token: string): boolean {
  return token.toLowerCase() === 'may' && token[0] === 'm';
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function toDateOnly(year: number, month: number, day: number): DateOnly {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A bare "September 14" means the next September 14 that has not happened yet.
 * Someone enquiring about a wedding is not asking about last year.
 */
function resolveYear(candidate: Candidate, today: Date): number | null {
  if (candidate.year !== null) {
    return isRealDate(candidate.year, candidate.month, candidate.day)
      ? candidate.year
      : null;
  }

  const thisYear = today.getUTCFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    if (!isRealDate(year, candidate.month, candidate.day)) continue;
    const at = Date.UTC(year, candidate.month - 1, candidate.day);
    if (at >= Date.UTC(thisYear, today.getUTCMonth(), today.getUTCDate())) {
      return year;
    }
  }
  return null;
}

function collect(text: string): Candidate[] {
  const found: Candidate[] = [];

  for (const match of text.matchAll(MONTH_FIRST)) {
    const token = match[1]!;
    const month = MONTHS[token.toLowerCase()];
    if (month === undefined || isVerbMay(token)) continue;
    found.push({
      month,
      day: Number(match[2]),
      year: match[3] ? Number(match[3]) : null,
    });
  }

  for (const match of text.matchAll(DAY_FIRST)) {
    const token = match[2]!;
    const month = MONTHS[token.toLowerCase()];
    if (month === undefined || isVerbMay(token)) continue;
    found.push({
      month,
      day: Number(match[1]),
      year: match[3] ? Number(match[3]) : null,
    });
  }

  for (const match of text.matchAll(ISO)) {
    found.push({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    });
  }

  for (const match of text.matchAll(SLASHED)) {
    const raw = match[3];
    // A two-digit year is read as 20xx; nobody is enquiring about 1926.
    const year =
      raw === undefined ? null : raw.length === 2 ? 2000 + Number(raw) : Number(raw);
    found.push({ month: Number(match[1]), day: Number(match[2]), year });
  }

  return found;
}

/**
 * The single date the text is about, or null when there is no date or more
 * than one.
 *
 * `today` is injectable so the year-rollover behaviour is testable and so a
 * render is not silently coupled to the wall clock.
 */
export function findRequestedDate(
  text: string,
  today: Date = new Date(),
): DateOnly | null {
  const resolved = new Set<DateOnly>();

  for (const candidate of collect(text)) {
    const year = resolveYear(candidate, today);
    if (year === null) continue;
    resolved.add(toDateOnly(year, candidate.month, candidate.day));
  }

  // Ambiguous means unknown. Better a blank field the human fills in than a
  // confident answer about the wrong Saturday.
  if (resolved.size !== 1) return null;
  return [...resolved][0]!;
}
