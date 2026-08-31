'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Star, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';

export interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string;
  isFavorite?: boolean;
  editCount?: number;
  createdAt?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onUpload: (files: File[]) => void;
  isLoading?: boolean;
}

export function PhotoGallery({
  photos,
  onPhotoClick,
  onUpload,
  isLoading,
}: PhotoGalleryProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/'),
    );

    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onUpload(files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <UploadArea
        dragActive={dragActive}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileInput={handleFileInput}
        isLoading={isLoading}
      />

      {/* Gallery Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              onClick={() => onPhotoClick(photo)}
            />
          ))}
        </div>
      ) : (
        <EmptyGallery isLoading={isLoading} />
      )}
    </div>
  );
}

interface UploadAreaProps {
  dragActive: boolean;
  onDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading?: boolean;
}

function UploadArea({
  dragActive,
  onDrag,
  onDrop,
  onFileInput,
  isLoading,
}: UploadAreaProps) {
  return (
    <div
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      className={cn(
        'relative rounded-lg border-2 border-dashed transition-colors',
        dragActive
          ? 'border-accent bg-accent/5'
          : 'border-subtle bg-surface',
      )}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={onFileInput}
        disabled={isLoading}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <Upload
          size={32}
          className={cn(
            'mb-3 transition-colors',
            dragActive ? 'text-accent' : 'text-muted',
          )}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          {dragActive ? 'Drop photos here' : 'Drag photos here or click to upload'}
        </p>
        <p className="mt-1 text-xs text-muted">
          JPEG, PNG, WebP and HEIF images supported
        </p>
        {!isLoading ? (
          <Button variant="secondary" size="sm" className="mt-3" type="button">
            <Upload size={16} aria-hidden="true" />
            Choose files
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface PhotoThumbnailProps {
  photo: Photo;
  onClick: () => void;
}

function PhotoThumbnail({ photo, onClick }: PhotoThumbnailProps) {
  const imageUrl = photo.thumbnail_url || photo.url;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border border-subtle bg-surface-raised transition-all hover:border-strong hover:shadow-md"
      type="button"
    >
      <Image
        src={imageUrl}
        alt="Photo thumbnail"
        fill
        className="object-cover transition-transform group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />

      {/* Favorite overlay */}
      {photo.isFavorite ? (
        <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
          <Star
            size={16}
            className="fill-yellow-400 text-yellow-400"
            aria-label="Favorite"
          />
        </div>
      ) : null}

      {/* Edit count badge */}
      {photo.editCount ? (
        <div className="absolute bottom-2 left-2">
          <Badge tone="accent" className="bg-black/40 text-white">
            {photo.editCount} edit{photo.editCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      ) : null}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
    </button>
  );
}

function EmptyGallery({ isLoading }: { isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-sm text-muted">Loading photos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle bg-surface py-12 text-center">
      <Upload size={24} className="mb-3 text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        No photos yet
      </p>
      <p className="mt-1 text-xs text-muted">
        Upload photos to get started with editing and organizing.
      </p>
    </div>
  );
}
