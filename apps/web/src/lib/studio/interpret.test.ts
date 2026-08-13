import { describe, expect, it } from 'vitest';
import { heuristicInterpret } from './interpret';

describe('heuristicInterpret', () => {
  it('splits a compound request into single-concept labels', () => {
    const result = heuristicInterpret("I want to create a post about the groom's speech");
    expect(result.labels).toContain('speech');
    expect(result.labels).toContain('groom');
    expect(result.method).toBe('heuristic');
  });

  it('reads a stated count of photos', () => {
    const result = heuristicInterpret('pull out 10 photos of the groom\'s speech');
    expect(result.count).toBe(10);
  });

  it('reads a spelled-out count', () => {
    const result = heuristicInterpret('give me five photos of confetti');
    expect(result.count).toBe(5);
  });

  it('falls back to the default count when none is stated', () => {
    const result = heuristicInterpret('a post about the first dance');
    expect(result.count).toBe(10);
  });

  it('clamps an absurd stated count into the guard rail range', () => {
    const result = heuristicInterpret('give me 999 photos of confetti');
    expect(result.count).toBe(40);
  });

  it('detects a known shoot type mentioned in the brief', () => {
    const result = heuristicInterpret('a wedding post about the first dance', {
      knownShootTypes: ['wedding', 'portrait'],
    });
    expect(result.shootType).toBe('wedding');
  });

  it('does not guess a shoot type the library has no work in', () => {
    const result = heuristicInterpret('a wedding post about the first dance', {
      knownShootTypes: ['portrait'],
    });
    expect(result.shootType).toBeNull();
  });

  it('drops filler words rather than treating them as labels', () => {
    const result = heuristicInterpret('I want to create a post about confetti');
    expect(result.labels).not.toContain('want');
    expect(result.labels).not.toContain('post');
    expect(result.labels).not.toContain('about');
    expect(result.labels).toContain('confetti');
  });

  it('never throws on an empty brief', () => {
    expect(() => heuristicInterpret('')).not.toThrow();
    expect(heuristicInterpret('   ').labels).toEqual([]);
  });
});
