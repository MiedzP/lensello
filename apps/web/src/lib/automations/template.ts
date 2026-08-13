/**
 * `{{dotted.path}}` substitution for step config text.
 *
 * Deliberately not a templating library: the inputs are photographer-written
 * strings and the values come from our own `RunContext`, so there is no
 * user-supplied template to worry about executing, only a lookup. A missing
 * path renders as an empty string rather than throwing — a step with a typo'd
 * placeholder should still send *something* sane, and the preview (see
 * `display.ts`) is where a photographer catches the typo before it goes out.
 */

export function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(input: string, vars: Record<string, unknown>): string {
  return input.replace(PLACEHOLDER, (_match, path: string) => toDisplay(getPath(vars, path)));
}

/** Every placeholder referenced in a string, for the builder's "what this does" preview. */
export function extractPlaceholders(input: string): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(PLACEHOLDER)) {
    if (match[1]) found.add(match[1]);
  }
  return Array.from(found);
}
