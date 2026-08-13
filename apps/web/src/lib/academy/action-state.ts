export interface ActionState {
  ok: boolean;
  message: string | null;
}

export const IDLE: ActionState = { ok: true, message: null };

// Combining diacritical marks, U+0300-U+036F. Written as an escape rather
// than the literal characters so the regex source is not itself a string of
// combining marks glued onto its own brackets.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Turns a title into a URL-safe slug. Lowercased, ASCII, hyphenated, and
 * capped so a very long title does not produce an unusable URL. */
export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'untitled').slice(0, 80);
}
