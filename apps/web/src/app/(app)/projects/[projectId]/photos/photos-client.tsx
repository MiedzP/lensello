'use client';

import { useState, useCallback } from 'react';
import { PhotoGallery, type Photo } from '@/components/photos/photo-gallery';
import {
  PhotoViewer,
  type ExifData,
  type PhotoVersion,
} from '@/components/photos/photo-viewer';
import {
  PhotoEditor,
  type EditState,
} from '@/components/photos/photo-editor';
import { ErrorNote } from '@/components/ui';

type ViewMode = 'gallery' | 'viewer' | 'editor';

interface PhotoWithMetadata extends Photo {
  isFavorite?: boolean;
  exif?: ExifData;
  versions?: PhotoVersion[];
  editCount?: number;
}

interface PhotosClientProps {
  projectId: string;
}

export function PhotosClient({ projectId }: PhotosClientProps) {
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithMetadata | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEdits, setCurrentEdits] = useState<Partial<EditState> | null>(
    null,
  );

  const handlePhotoClick = useCallback((photo: Photo) => {
    setSelectedPhoto(photo as PhotoWithMetadata);
    setViewMode('viewer');
    setError(null);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement actual upload logic to Supabase storage
      // For now, this is a placeholder that would be implemented with:
      // - Form data creation with files
      // - Upload to Supabase storage bucket
      // - Create photo records in database
      // - Update local photos state

      // Placeholder implementation
      const uploadedPhotos: PhotoWithMetadata[] = await Promise.all(
        files.map(async (file) => {
          // This would actually upload to Supabase
          const url = URL.createObjectURL(file);
          return {
            id: `photo-${Date.now()}-${Math.random()}`,
            url,
            thumbnail_url: url,
            isFavorite: false,
            editCount: 0,
            createdAt: new Date().toISOString(),
          };
        }),
      );

      setPhotos((prev) => [...uploadedPhotos, ...prev]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to upload photos',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFavoriteToggle = useCallback(
    async (isFavorite: boolean) => {
      if (!selectedPhoto) return;

      try {
        // TODO: Implement favorite toggle in Supabase
        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === selectedPhoto.id
              ? { ...photo, isFavorite }
              : photo,
          ),
        );

        setSelectedPhoto((prev) =>
          prev ? { ...prev, isFavorite } : null,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to update favorite status',
        );
      }
    },
    [selectedPhoto],
  );

  const handleEdit = useCallback(() => {
    if (!selectedPhoto) return;
    setCurrentEdits(null);
    setViewMode('editor');
  }, [selectedPhoto]);

  const handleVersionSelect = useCallback(
    (version: PhotoVersion) => {
      if (!selectedPhoto) return;
      // TODO: Load version edits from database
      setCurrentEdits(null);
      setViewMode('editor');
    },
    [selectedPhoto],
  );

  const handleSaveEdits = useCallback(
    async (edits: EditState) => {
      if (!selectedPhoto) return;

      try {
        // TODO: Save edits to Supabase
        // - Create or update edit record
        // - Possibly trigger background job for image processing
        // - Update photo record with edit count

        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === selectedPhoto.id
              ? {
                  ...photo,
                  editCount: (photo.editCount ?? 0) + 1,
                }
              : photo,
          ),
        );

        setSelectedPhoto((prev) =>
          prev
            ? {
                ...prev,
                editCount: (prev.editCount ?? 0) + 1,
              }
            : null,
        );

        setViewMode('viewer');
        setCurrentEdits(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to save edits',
        );
      }
    },
    [selectedPhoto],
  );

  const handleSaveVersion = useCallback(
    async (edits: EditState, versionName: string) => {
      if (!selectedPhoto) return;

      try {
        // TODO: Save as new version in Supabase
        // - Create new version record
        // - Store edits with version reference
        // - Update versions list on photo

        const newVersion: PhotoVersion = {
          id: `version-${Date.now()}`,
          name: versionName,
          createdAt: new Date().toISOString(),
          isCurrent: true,
        };

        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === selectedPhoto.id
              ? {
                  ...photo,
                  versions: [newVersion, ...(photo.versions ?? [])],
                  editCount: (photo.editCount ?? 0) + 1,
                }
              : photo,
          ),
        );

        setSelectedPhoto((prev) =>
          prev
            ? {
                ...prev,
                versions: [newVersion, ...(prev.versions ?? [])],
                editCount: (prev.editCount ?? 0) + 1,
              }
            : null,
        );

        setViewMode('viewer');
        setCurrentEdits(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to save version',
        );
      }
    },
    [selectedPhoto],
  );

  const handleCloseViewer = useCallback(() => {
    setSelectedPhoto(null);
    setViewMode('gallery');
    setCurrentEdits(null);
    setError(null);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setViewMode('viewer');
    setCurrentEdits(null);
  }, []);

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : null}

      {viewMode === 'gallery' ? (
        <PhotoGallery
          photos={photos}
          onPhotoClick={handlePhotoClick}
          onUpload={handleUpload}
          isLoading={isLoading}
        />
      ) : null}

      {viewMode === 'viewer' && selectedPhoto ? (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={handleCloseViewer}
          onEdit={handleEdit}
          onFavoriteToggle={handleFavoriteToggle}
          onVersionSelect={handleVersionSelect}
          isLoading={isLoading}
        />
      ) : null}

      {viewMode === 'editor' && selectedPhoto ? (
        <PhotoEditor
          photoUrl={selectedPhoto.url}
          photoId={selectedPhoto.id}
          initialEdits={currentEdits}
          onSave={handleSaveEdits}
          onSaveVersion={handleSaveVersion}
          onCancel={handleCloseEditor}
          isLoading={isLoading}
        />
      ) : null}
    </div>
  );
}
