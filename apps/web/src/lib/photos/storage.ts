import { createClient } from '@supabase/supabase-js';
import ExifParser from 'exifjs';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PhotoMetadata {
  make?: string;
  model?: string;
  dateTime?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  width?: number;
  height?: number;
  orientation?: number;
}

export interface UploadPhotoOptions {
  projectId: string;
  stageId: string;
  isFavorite?: boolean;
  metadata?: PhotoMetadata;
}

/**
 * Extract EXIF metadata from an image file
 */
export async function extractMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);

    // Parse EXIF data
    const exifData = ExifParser.readFromBinaryFile(buffer);

    // Extract common EXIF tags
    const metadata: PhotoMetadata = {};

    // Camera info
    if (exifData.tags.Make) metadata.make = exifData.tags.Make;
    if (exifData.tags.Model) metadata.model = exifData.tags.Model;

    // DateTime
    if (exifData.tags.DateTime) {
      metadata.dateTime = exifData.tags.DateTime;
    }

    // Exposure info
    if (exifData.tags.ExposureTime) {
      metadata.exposureTime = exifData.tags.ExposureTime;
    }
    if (exifData.tags.FNumber) {
      metadata.fNumber = exifData.tags.FNumber;
    }
    if (exifData.tags.ISOSpeedRatings) {
      metadata.iso = Array.isArray(exifData.tags.ISOSpeedRatings)
        ? exifData.tags.ISOSpeedRatings[0]
        : exifData.tags.ISOSpeedRatings;
    }
    if (exifData.tags.FocalLength) {
      metadata.focalLength = exifData.tags.FocalLength;
    }

    // Image dimensions
    if (exifData.tags.PixelXDimension) {
      metadata.width = exifData.tags.PixelXDimension;
    }
    if (exifData.tags.PixelYDimension) {
      metadata.height = exifData.tags.PixelYDimension;
    }
    if (exifData.tags.Orientation) {
      metadata.orientation = exifData.tags.Orientation;
    }

    return metadata;
  } catch (error) {
    console.error('Failed to extract EXIF metadata:', error);
    return {};
  }
}

/**
 * Upload a photo to Supabase Storage and create database record
 */
export async function uploadPhoto(
  file: File,
  options: UploadPhotoOptions,
  userId: string
): Promise<{
  photoId: string;
  url: string;
  metadata: PhotoMetadata;
}> {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size must be less than 50MB');
    }

    // Extract metadata
    const metadata = options.metadata || (await extractMetadata(file));

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const filename = `${timestamp}-${randomStr}-${file.name}`;
    const storagePath = `projects/${options.projectId}/photos/${filename}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(storagePath);

    // Create database record
    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert({
        project_id: options.projectId,
        stage_id: options.stageId,
        user_id: userId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        url: publicUrl,
        is_favorite: options.isFavorite || false,
        metadata: metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('photos').remove([storagePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return {
      photoId: photoData.id,
      url: publicUrl,
      metadata,
    };
  } catch (error) {
    console.error('Upload photo error:', error);
    throw error;
  }
}

/**
 * Delete a photo from storage and database
 */
export async function deletePhoto(photoId: string): Promise<void> {
  try {
    // Get photo record to find storage path
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch photo: ${fetchError.message}`);
    }

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from('photos')
      .remove([photo.storage_path]);

    if (deleteStorageError) {
      console.error('Failed to delete from storage:', deleteStorageError);
    }

    // Delete database record (cascade will handle related edits, versions)
    const { error: deleteDbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (deleteDbError) {
      throw new Error(`Database delete failed: ${deleteDbError.message}`);
    }
  } catch (error) {
    console.error('Delete photo error:', error);
    throw error;
  }
}

/**
 * Get a photo's public URL
 */
export async function getPhotoUrl(photoId: string): Promise<string> {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('url')
      .eq('id', photoId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch photo: ${error.message}`);
    }

    if (!photo) {
      throw new Error('Photo not found');
    }

    return photo.url;
  } catch (error) {
    console.error('Get photo URL error:', error);
    throw error;
  }
}

/**
 * Get photo with metadata
 */
export async function getPhoto(
  photoId: string
): Promise<Database['public']['Tables']['photos']['Row']> {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch photo: ${error.message}`);
    }

    if (!photo) {
      throw new Error('Photo not found');
    }

    return photo;
  } catch (error) {
    console.error('Get photo error:', error);
    throw error;
  }
}

/**
 * Batch delete photos
 */
export async function deletePhotos(photoIds: string[]): Promise<void> {
  try {
    // Get all photos to find storage paths
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .in('id', photoIds);

    if (fetchError) {
      throw new Error(`Failed to fetch photos: ${fetchError.message}`);
    }

    if (!photos || photos.length === 0) {
      throw new Error('Photos not found');
    }

    // Delete from storage
    const storagePaths = photos.map((p) => p.storage_path);
    const { error: deleteStorageError } = await supabase.storage
      .from('photos')
      .remove(storagePaths);

    if (deleteStorageError) {
      console.error('Failed to delete from storage:', deleteStorageError);
    }

    // Delete database records
    const { error: deleteDbError } = await supabase
      .from('photos')
      .delete()
      .in('id', photoIds);

    if (deleteDbError) {
      throw new Error(`Database delete failed: ${deleteDbError.message}`);
    }
  } catch (error) {
    console.error('Batch delete photos error:', error);
    throw error;
  }
}

/**
 * Get photo size statistics for a project
 */
export async function getProjectPhotoStats(projectId: string): Promise<{
  totalCount: number;
  totalSize: number;
  averageSize: number;
}> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('file_size')
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalCount: 0,
        totalSize: 0,
        averageSize: 0,
      };
    }

    const totalSize = data.reduce((sum, photo) => sum + (photo.file_size || 0), 0);
    const averageSize = totalSize / data.length;

    return {
      totalCount: data.length,
      totalSize,
      averageSize,
    };
  } catch (error) {
    console.error('Get project photo stats error:', error);
    throw error;
  }
}
