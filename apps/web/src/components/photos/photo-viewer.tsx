'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Star,
  Edit2,
  ChevronDown,
  FileJson,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardBody } from '@/components/ui';

export interface ExifData {
  camera?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  focal_length?: string;
}

export interface PhotoVersion {
  id: string;
  name: string;
  createdAt: string;
  isCurrent?: boolean;
}

interface PhotoViewerProps {
  photo: {
    id: string;
    url: string;
    isFavorite?: boolean;
    exif?: ExifData;
    versions?: PhotoVersion[];
  };
  onClose: () => void;
  onEdit: () => void;
  onFavoriteToggle: (isFavorite: boolean) => void;
  onVersionSelect?: (version: PhotoVersion) => void;
  showBeforeAfter?: boolean;
  beforeUrl?: string;
  isLoading?: boolean;
}

export function PhotoViewer({
  photo,
  onClose,
  onEdit,
  onFavoriteToggle,
  onVersionSelect,
  showBeforeAfter,
  beforeUrl,
  isLoading,
}: PhotoViewerProps) {
  const [isFavorite, setIsFavorite] = useState(photo.isFavorite ?? false);
  const [showVersions, setShowVersions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFavoriteToggle = () => {
    const newState = !isFavorite;
    setIsFavorite(newState);
    onFavoriteToggle(newState);
  };

  const handleCopyExif = () => {
    if (!photo.exif) return;

    const exifText = Object.entries(photo.exif)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    navigator.clipboard.writeText(exifText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
        type="button"
      >
        <X size={24} aria-hidden="true" />
      </button>

      <div className="flex h-full w-full gap-4 p-4 sm:h-auto sm:max-h-[90vh] sm:w-auto sm:p-6">
        {/* Main image */}
        <div className="flex flex-1 items-center justify-center">
          {showBeforeAfter && beforeUrl ? (
            <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={photo.url} />
          ) : (
            <div className="relative h-full w-full sm:h-auto sm:w-auto">
              <Image
                src={photo.url}
                alt="Photo"
                width={800}
                height={600}
                className="h-full w-full object-contain"
                priority
              />
            </div>
          )}
        </div>

        {/* Sidebar with controls and metadata */}
        <div className="flex w-full flex-col gap-4 sm:w-80">
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={onEdit}
              disabled={isLoading}
              className="flex-1"
            >
              <Edit2 size={16} aria-hidden="true" />
              Edit
            </Button>

            <Button
              variant={isFavorite ? 'primary' : 'secondary'}
              size="md"
              onClick={handleFavoriteToggle}
              disabled={isLoading}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                size={16}
                className={isFavorite ? 'fill-current' : ''}
                aria-hidden="true"
              />
            </Button>
          </div>

          {/* EXIF Data */}
          {photo.exif ? (
            <Card>
              <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileJson size={16} aria-hidden="true" />
                  Camera Settings
                </h3>
                <button
                  onClick={handleCopyExif}
                  className="rounded p-1 hover:bg-surface-hover transition-colors"
                  title="Copy EXIF data"
                  type="button"
                >
                  {copied ? (
                    <Check size={16} className="text-success" aria-hidden="true" />
                  ) : (
                    <Copy size={16} className="text-muted" aria-hidden="true" />
                  )}
                </button>
              </div>

              <CardBody className="space-y-3">
                {photo.exif.camera && (
                  <ExifRow label="Camera" value={photo.exif.camera} />
                )}
                {photo.exif.iso && (
                  <ExifRow label="ISO" value={photo.exif.iso.toString()} />
                )}
                {photo.exif.aperture && (
                  <ExifRow label="Aperture" value={`ƒ/${photo.exif.aperture}`} />
                )}
                {photo.exif.shutter && (
                  <ExifRow label="Shutter" value={`${photo.exif.shutter}s`} />
                )}
                {photo.exif.focal_length && (
                  <ExifRow label="Focal Length" value={`${photo.exif.focal_length}mm`} />
                )}
              </CardBody>
            </Card>
          ) : null}

          {/* Version history */}
          {photo.versions && photo.versions.length > 0 ? (
            <Card>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="flex w-full items-center justify-between border-b border-subtle px-5 py-3 hover:bg-surface-hover transition-colors"
                type="button"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  Versions ({photo.versions.length})
                </h3>
                <ChevronDown
                  size={16}
                  className={cn(
                    'transition-transform',
                    showVersions && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>

              {showVersions ? (
                <CardBody className="space-y-1.5">
                  {photo.versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => {
                        onVersionSelect?.(version);
                        setShowVersions(false);
                      }}
                      className={cn(
                        'w-full rounded px-3 py-2 text-left text-sm transition-colors',
                        version.isCurrent
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-foreground hover:bg-surface-hover',
                      )}
                      type="button"
                    >
                      <div className="font-medium">{version.name}</div>
                      <div className="text-xs text-muted">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </CardBody>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ExifRowProps {
  label: string;
  value: string;
}

function ExifRow({ label, value }: ExifRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
}

function BeforeAfterSlider({ beforeUrl, afterUrl }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const position = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(Math.max(position, 0), 100));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const position =
      ((e.touches[0].clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(Math.max(position, 0), 100));
  };

  return (
    <div
      className="relative h-full w-full cursor-col-resize overflow-hidden rounded-lg"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* After image (background) */}
      <div className="absolute inset-0">
        <Image
          src={afterUrl}
          alt="After"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Before image (overlay) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <Image
          src={beforeUrl}
          alt="Before"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 h-full w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg flex items-center justify-center">
          <div className="flex gap-1">
            <div className="h-1 w-1 rounded-full bg-black/30" />
            <div className="h-1 w-1 rounded-full bg-black/30" />
            <div className="h-1 w-1 rounded-full bg-black/30" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 rounded bg-black/40 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        Before
      </div>
      <div className="absolute bottom-4 right-4 rounded bg-black/40 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        After
      </div>
    </div>
  );
}
