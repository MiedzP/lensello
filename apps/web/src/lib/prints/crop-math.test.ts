import { describe, expect, it } from 'vitest';
import { baseCropSize, deriveCropRect } from './crop-math';

describe('baseCropSize', () => {
  it('keeps full height and crops the sides when the image is wider than the target', () => {
    // 4:3 image, 1:1 target — the image is relatively wider, so height stays 1.
    expect(baseCropSize(4 / 3, 1)).toEqual({ width: 0.75, height: 1 });
  });

  it('keeps full width and crops top/bottom when the image is taller than the target', () => {
    // 3:4 image, 1:1 target — the image is relatively taller, so width stays 1.
    const { width, height } = baseCropSize(3 / 4, 1);
    expect(width).toBe(1);
    expect(height).toBeCloseTo(0.75, 5);
  });

  it('is the full frame when the image already matches the target aspect', () => {
    expect(baseCropSize(1, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('deriveCropRect', () => {
  it('at zoom 1, centres a box the size of the cover fit', () => {
    const rect = deriveCropRect(4000, 3000, 1, { zoom: 1, panX: 0.5, panY: 0.5 });
    expect(rect.w).toBeCloseTo(0.75, 5);
    expect(rect.h).toBe(1);
    // Centred: with w=0.75 there is 0.25 of travel, half of it on each side.
    expect(rect.x).toBeCloseTo(0.125, 5);
    expect(rect.y).toBe(0);
  });

  it('shrinks the box as zoom increases', () => {
    const rect = deriveCropRect(4000, 3000, 1, { zoom: 2, panX: 0.5, panY: 0.5 });
    expect(rect.w).toBeCloseTo(0.375, 5);
    expect(rect.h).toBe(0.5);
  });

  it('pans to the extremes at panX/panY 0 and 1', () => {
    const left = deriveCropRect(4000, 3000, 1, { zoom: 1, panX: 0, panY: 0.5 });
    expect(left.x).toBe(0);

    const right = deriveCropRect(4000, 3000, 1, { zoom: 1, panX: 1, panY: 0.5 });
    expect(right.x).toBeCloseTo(0.25, 5); // 1 - w, since w = 0.75
  });

  it('clamps an out-of-range zoom rather than producing a negative or oversized box', () => {
    const tooSmall = deriveCropRect(4000, 3000, 1, { zoom: 0, panX: 0.5, panY: 0.5 });
    expect(tooSmall.w).toBeCloseTo(0.75, 5); // clamped to MIN_ZOOM = 1

    const tooBig = deriveCropRect(4000, 3000, 1, { zoom: 100, panX: 0.5, panY: 0.5 });
    expect(tooBig.w).toBeGreaterThan(0);
  });

  it('produces the full frame when the image already matches the target aspect', () => {
    const rect = deriveCropRect(1000, 1000, 1, { zoom: 1, panX: 0.5, panY: 0.5 });
    expect(rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
