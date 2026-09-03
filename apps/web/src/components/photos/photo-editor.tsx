'use client';

import type { ReactNode } from 'react';
import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X, RotateCcw, Save, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardBody, Tooltip } from '@/components/ui';

export interface EditState {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  clarity: number;
  shadows: number;
  highlights: number;
  temperature: number;
  tint: number;
}

interface PhotoEditorProps {
  photoUrl: string;
  photoId: string;
  initialEdits?: Partial<EditState>;
  onSave: (edits: EditState) => Promise<void>;
  onSaveVersion: (edits: EditState, versionName: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const INITIAL_STATE: EditState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  clarity: 0,
  shadows: 0,
  highlights: 0,
  temperature: 4000,
  tint: 0,
};

export function PhotoEditor({
  photoUrl,
  photoId,
  initialEdits,
  onSave,
  onSaveVersion,
  onCancel,
  isLoading,
}: PhotoEditorProps) {
  const [edits, setEdits] = useState<EditState>({
    ...INITIAL_STATE,
    ...initialEdits,
  });
  const [history, setHistory] = useState<EditState[]>([
    { ...INITIAL_STATE, ...initialEdits },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showVersionInput, setShowVersionInput] = useState(false);
  const versionNameRef = useRef<HTMLInputElement>(null);

  const updateEdit = useCallback((key: keyof EditState, value: number) => {
    setEdits((prev) => {
      const newEdits = { ...prev, [key]: value };
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newEdits);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      return newEdits;
    });
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEdits(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEdits(history[newIndex]);
    }
  }, [history, historyIndex]);

  const reset = useCallback(() => {
    const resetEdits = { ...INITIAL_STATE, ...initialEdits };
    setEdits(resetEdits);
    setHistory([resetEdits]);
    setHistoryIndex(0);
  }, [initialEdits]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(edits);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVersion = async () => {
    const versionName = versionNameRef.current?.value ||
      `Version ${new Date().toLocaleString()}`;
    setIsSaving(true);
    try {
      await onSaveVersion(edits, versionName);
      setShowVersionInput(false);
    } finally {
      setIsSaving(false);
    }
  };

  const cssFilters = `
    brightness(${100 + edits.brightness}%)
    contrast(${100 + edits.contrast}%)
    saturate(${100 + edits.saturation}%)
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Close button */}
      <Tooltip label="Close editor" side="left">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
          type="button"
        >
          <X size={24} aria-hidden="true" />
        </button>
      </Tooltip>

      <div className="flex h-full w-full gap-4 p-4 sm:h-auto sm:max-h-[90vh] sm:w-auto sm:p-6">
        {/* Image preview */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative h-full w-full sm:h-auto sm:w-auto max-w-2xl">
            <Image
              src={photoUrl}
              alt="Photo being edited"
              width={800}
              height={600}
              className="h-full w-full object-contain"
              style={{ filter: cssFilters }}
              priority
            />
          </div>
        </div>

        {/* Controls panel */}
        <div className="flex w-full flex-col gap-4 sm:w-96 sm:overflow-y-auto sm:pr-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Edit Photo</h2>
            <div className="flex gap-1">
              <Tooltip label="Undo" side="bottom">
                <button
                  onClick={undo}
                  disabled={historyIndex === 0}
                  className="rounded p-1.5 hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  type="button"
                >
                  <RotateCcw size={16} className="scale-x-[-1]" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip label="Redo" side="bottom">
                <button
                  onClick={redo}
                  disabled={historyIndex === history.length - 1}
                  className="rounded p-1.5 hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  type="button"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            <SliderGroup
              title="Light"
              sliders={[
                {
                  label: 'Brightness',
                  value: edits.brightness,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('brightness', v),
                },
                {
                  label: 'Contrast',
                  value: edits.contrast,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('contrast', v),
                },
                {
                  label: 'Shadows',
                  value: edits.shadows,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('shadows', v),
                },
                {
                  label: 'Highlights',
                  value: edits.highlights,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('highlights', v),
                },
              ]}
            />

            <SliderGroup
              title="Color"
              sliders={[
                {
                  label: 'Saturation',
                  value: edits.saturation,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('saturation', v),
                },
                {
                  label: 'Vibrance',
                  value: edits.vibrance,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('vibrance', v),
                },
                {
                  label: 'Temperature (K)',
                  value: edits.temperature,
                  min: 2700,
                  max: 6500,
                  step: 100,
                  onChange: (v) => updateEdit('temperature', v),
                },
                {
                  label: 'Tint',
                  value: edits.tint,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('tint', v),
                },
              ]}
            />

            <SliderGroup
              title="Detail"
              sliders={[
                {
                  label: 'Clarity',
                  value: edits.clarity,
                  min: -100,
                  max: 100,
                  onChange: (v) => updateEdit('clarity', v),
                },
              ]}
            />
          </div>

          {/* Action buttons */}
          <div className="mt-auto flex flex-col gap-2 border-t border-subtle pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="w-full"
            >
              <Save size={16} aria-hidden="true" />
              Save edits
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowVersionInput(!showVersionInput)}
              disabled={isSaving || isLoading}
              className="w-full"
            >
              <Copy size={16} aria-hidden="true" />
              Save as version
            </Button>

            {showVersionInput ? (
              <div className="space-y-2">
                <input
                  ref={versionNameRef}
                  type="text"
                  placeholder="Version name (optional)"
                  className="w-full rounded-md border border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  defaultValue={`Version ${new Date().toLocaleString()}`}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveVersion}
                  disabled={isSaving || isLoading}
                  className="w-full"
                >
                  Confirm
                </Button>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="md"
              onClick={reset}
              disabled={isSaving || isLoading}
              className="w-full"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reset
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={onCancel}
              disabled={isSaving || isLoading}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderItem {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

interface SliderGroupProps {
  title: string;
  sliders: SliderItem[];
}

function SliderGroup({ title, sliders }: SliderGroupProps) {
  return (
    <Card>
      <div className="border-b border-subtle px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <CardBody className="space-y-4">
        {sliders.map((slider) => (
          <SliderControl
            key={slider.label}
            label={slider.label}
            value={slider.value}
            min={slider.min ?? -100}
            max={slider.max ?? 100}
            step={slider.step ?? 1}
            onChange={slider.onChange}
          />
        ))}
      </CardBody>
    </Card>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: SliderControlProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-xs font-mono text-muted tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'w-full h-2 rounded-full appearance-none cursor-pointer',
          'bg-surface-raised',
          'accent-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        style={{
          background: getSliderBackground(value, min, max),
        }}
      />
    </div>
  );
}

function getSliderBackground(value: number, min: number, max: number) {
  const percent = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${percent}%, var(--color-surface-raised) ${percent}%, var(--color-surface-raised) 100%)`;
}
