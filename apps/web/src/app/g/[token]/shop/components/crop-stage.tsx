'use client';

import { useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { MAX_ZOOM, MIN_ZOOM, deriveCropRect, type CropState } from '@/lib/prints/crop-math';

/**
 * A cover-fit-and-pan crop, not a free rectangle.
 *
 * The box is always the product's own aspect ratio, so there is no way to
 * drag out a crop that would not fit the print — the client chooses *which
 * part* of the photo, never *what shape*. The box's position and size are
 * computed by `deriveCropRect`, the same pure function that turns the crop
 * state into what actually gets stored and sent to the lab — the box drawn
 * here is guaranteed to be the crop that gets ordered, not an approximation
 * of it.
 */
export function CropStage({
  imageUrl,
  imageWidth,
  imageHeight,
  targetAspect,
  crop,
  onChange,
}: {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  targetAspect: number;
  crop: CropState;
  onChange: (next: CropState) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const rect = deriveCropRect(imageWidth, imageHeight, targetAspect, crop);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startPanX: crop.panX,
        startPanY: crop.panY,
      };
    },
    [crop.panX, crop.panY],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;

      const bounds = stage.getBoundingClientRect();
      const dx = (event.clientX - drag.startX) / bounds.width;
      const dy = (event.clientY - drag.startY) / bounds.height;

      // pan is normalised to the box's own travel range (1 - w), not to the
      // stage — a fully zoomed-in box (nearly the whole frame) has almost no
      // travel, and dividing by that range is what keeps the drag feeling
      // 1:1 with the pointer regardless of zoom.
      const travelX = 1 - rect.w || 1;
      const travelY = 1 - rect.h || 1;

      onChange({
        ...crop,
        panX: Math.min(Math.max(drag.startPanX + dx / travelX, 0), 1),
        panY: Math.min(Math.max(drag.startPanY + dy / travelY, 0), 1),
      });
    },
    [crop, onChange, rect.h, rect.w],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={stageRef}
        className="relative mx-auto max-h-[55vh] w-full touch-none overflow-hidden rounded-lg bg-surface-raised select-none"
        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived preview URL; not worth Next's image optimizer. */}
        <img src={imageUrl} alt="" className="pointer-events-none h-full w-full select-none object-cover" draggable={false} />

        {/* The crop box: sized and positioned from the same rect that gets
            submitted. Everything outside it is darkened with an oversized
            box-shadow, clipped by the stage's own overflow-hidden. */}
        <div
          role="group"
          aria-label="Crop position. Use the arrow keys to reposition, or drag with a pointer."
          tabIndex={0}
          className="absolute cursor-move touch-none rounded-sm ring-2 ring-white/90"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(event) => {
            const step = 0.05;
            if (event.key === 'ArrowLeft') onChange({ ...crop, panX: Math.max(crop.panX - step, 0) });
            if (event.key === 'ArrowRight') onChange({ ...crop, panX: Math.min(crop.panX + step, 1) });
            if (event.key === 'ArrowUp') onChange({ ...crop, panY: Math.max(crop.panY - step, 0) });
            if (event.key === 'ArrowDown') onChange({ ...crop, panY: Math.min(crop.panY + step, 1) });
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <ZoomOut size={16} className="text-muted" aria-hidden="true" />
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={crop.zoom}
          onChange={(event) => onChange({ ...crop, zoom: Number(event.target.value) })}
          aria-label="Zoom"
          className="flex-1 accent-accent"
        />
        <ZoomIn size={16} className="text-muted" aria-hidden="true" />
      </div>
      <p className="text-center text-xs text-faint">Drag the frame to reposition. Use the slider to zoom in.</p>
    </div>
  );
}
