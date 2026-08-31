'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/require-user';
import { uploadPhoto, deletePhoto as deletePhotoFromStorage } from '@/lib/photos/storage';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PhotoEdit {
  id?: string;
  type:
    | 'brightness'
    | 'contrast'
    | 'saturation'
    | 'hue'
    | 'exposure'
    | 'shadows'
    | 'highlights'
    | 'temperature'
    | 'tint'
    | 'clarity'
    | 'vibrance'
    | 'crop';
  value: number;
  timestamp?: string;
}

export interface CropEdit extends PhotoEdit {
  type: 'crop';
  value: number;
  cropData?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

/**
 * Upload a photo to a project stage
 */
export async function uploadProjectPhoto(
  projectId: string,
  stageId: string,
  file: File
): Promise<{ success: boolean; photoId?: string; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify stage belongs to project
    const { data: stage, error: stageError } = await supabase
      .from('project_stages')
      .select('id, project_id')
      .eq('id', stageId)
      .eq('project_id', projectId)
      .single();

    if (stageError || !stage) {
      return { success: false, error: 'Stage not found' };
    }

    // Upload photo
    const result = await uploadPhoto(
      file,
      {
        projectId,
        stageId,
        isFavorite: false,
      },
      user.id
    );

    // Revalidate photos list
    revalidatePath(`/projects/${projectId}/photos`);

    return { success: true, photoId: result.photoId };
  } catch (error) {
    console.error('Upload project photo error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Get all photos for a project stage
 */
export async function getProjectPhotos(
  projectId: string,
  stageId?: string
): Promise<{
  success: boolean;
  photos?: Array<Database['public']['Tables']['photos']['Row']>;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Build query
    let query = supabase
      .from('photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    const { data: photos, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, photos: photos || [] };
  } catch (error) {
    console.error('Get project photos error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch photos',
    };
  }
}

/**
 * Apply edits to a photo
 */
export async function applyEdits(
  photoId: string,
  edits: PhotoEdit[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Store edits in photo_edits table
    const editsToInsert = edits.map((edit) => ({
      photo_id: photoId,
      user_id: user.id,
      edit_type: edit.type,
      value: edit.value,
      crop_data: 'cropData' in edit ? (edit as CropEdit).cropData : null,
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('photo_edits')
      .insert(editsToInsert);

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    // Update photo's edited_at timestamp
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        edited_at: new Date().toISOString(),
        is_edited: true,
      })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Apply edits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply edits',
    };
  }
}

/**
 * Get all edits for a photo
 */
export async function getPhotoEdits(
  photoId: string
): Promise<{
  success: boolean;
  edits?: Array<Database['public']['Tables']['photo_edits']['Row']>;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: edits, error } = await supabase
      .from('photo_edits')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, edits: edits || [] };
  } catch (error) {
    console.error('Get photo edits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch edits',
    };
  }
}

/**
 * Undo last edit(s) for a photo
 */
export async function undoPhotoEdits(
  photoId: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get edits to delete (most recent ones)
    const { data: editsToDelete, error: fetchError } = await supabase
      .from('photo_edits')
      .select('id')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: false })
      .limit(count);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!editsToDelete || editsToDelete.length === 0) {
      return { success: true };
    }

    const editIds = editsToDelete.map((e) => e.id);

    // Delete edits
    const { error: deleteError } = await supabase
      .from('photo_edits')
      .delete()
      .in('id', editIds);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Check if there are any edits left
    const { data: remainingEdits } = await supabase
      .from('photo_edits')
      .select('id', { count: 'exact', head: true })
      .eq('photo_id', photoId);

    const hasEdits = (remainingEdits?.length ?? 0) > 0;

    // Update photo's edited status
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        edited_at: hasEdits ? new Date().toISOString() : null,
        is_edited: hasEdits,
      })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Undo photo edits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to undo edits',
    };
  }
}

/**
 * Save current state as a version
 */
export async function saveAsVersion(
  photoId: string,
  versionName: string
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get all current edits
    const { data: edits, error: editsError } = await supabase
      .from('photo_edits')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true });

    if (editsError) {
      return { success: false, error: editsError.message };
    }

    // Create version record
    const { data: version, error: versionError } = await supabase
      .from('photo_versions')
      .insert({
        photo_id: photoId,
        user_id: user.id,
        version_name: versionName,
        edits: edits || [],
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (versionError) {
      return { success: false, error: versionError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true, versionId: version.id };
  } catch (error) {
    console.error('Save as version error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save version',
    };
  }
}

/**
 * Get all versions for a photo
 */
export async function getPhotoVersions(
  photoId: string
): Promise<{
  success: boolean;
  versions?: Array<Database['public']['Tables']['photo_versions']['Row']>;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: versions, error } = await supabase
      .from('photo_versions')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, versions: versions || [] };
  } catch (error) {
    console.error('Get photo versions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch versions',
    };
  }
}

/**
 * Restore a photo to a specific version
 */
export async function restorePhotoVersion(
  photoId: string,
  versionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get version
    const { data: version, error: versionError } = await supabase
      .from('photo_versions')
      .select('edits')
      .eq('id', versionId)
      .eq('photo_id', photoId)
      .single();

    if (versionError || !version) {
      return { success: false, error: 'Version not found' };
    }

    // Clear existing edits
    const { error: deleteError } = await supabase
      .from('photo_edits')
      .delete()
      .eq('photo_id', photoId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Restore edits from version
    if (version.edits && Array.isArray(version.edits) && version.edits.length > 0) {
      const { error: insertError } = await supabase
        .from('photo_edits')
        .insert(
          version.edits.map((edit: any) => ({
            ...edit,
            id: undefined, // Let DB generate new ID
            photo_id: photoId,
            user_id: user.id,
          }))
        );

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    // Update photo's edited_at timestamp
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        edited_at: new Date().toISOString(),
        is_edited: version.edits && version.edits.length > 0,
      })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Restore photo version error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore version',
    };
  }
}

/**
 * Toggle favorite status for a photo
 */
export async function toggleFavorite(
  photoId: string
): Promise<{ success: boolean; isFavorite?: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id, is_favorite')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const newFavoriteStatus = !photo.is_favorite;

    // Update favorite status
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        is_favorite: newFavoriteStatus,
      })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true, isFavorite: newFavoriteStatus };
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle favorite',
    };
  }
}

/**
 * Delete a photo
 */
export async function deletePhoto(photoId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete from storage and database
    await deletePhotoFromStorage(photoId);

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Delete photo error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete photo',
    };
  }
}

/**
 * Batch delete photos
 */
export async function deletePhotos(photoIds: string[]): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Verify user owns all photos
    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .in('id', photoIds);

    if (photoError || !photos) {
      return { success: false, error: 'Failed to fetch photos' };
    }

    // Verify ownership of all photos
    const userPhotos = photos.filter((p) => p.user_id === user.id);

    if (userPhotos.length !== photoIds.length) {
      return { success: false, error: 'Unauthorized' };
    }

    if (userPhotos.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Get all photos to delete their storage
    const { data: photosToDelete, error: fetchError } = await supabase
      .from('photos')
      .select('storage_path')
      .in('id', photoIds);

    if (fetchError) {
      return { success: false, error: 'Failed to fetch photos' };
    }

    // Delete from storage
    if (photosToDelete && photosToDelete.length > 0) {
      const storagePaths = photosToDelete.map((p) => p.storage_path);
      const { error: deleteStorageError } = await supabase.storage
        .from('photos')
        .remove(storagePaths);

      if (deleteStorageError) {
        console.error('Failed to delete from storage:', deleteStorageError);
      }
    }

    // Delete database records
    const { error: deleteDbError } = await supabase
      .from('photos')
      .delete()
      .in('id', photoIds);

    if (deleteDbError) {
      return { success: false, error: deleteDbError.message };
    }

    // Revalidate for all affected projects
    const uniqueProjectIds = [...new Set(userPhotos.map((p) => p.project_id))];
    uniqueProjectIds.forEach((projectId) => {
      revalidatePath(`/projects/${projectId}/photos`);
    });

    return { success: true, deletedCount: photoIds.length };
  } catch (error) {
    console.error('Batch delete photos error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete photos',
    };
  }
}

/**
 * Add a tag to a photo
 */
export async function addPhotoTag(
  photoId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current tags
    const { data: photoData } = await supabase
      .from('photos')
      .select('tags')
      .eq('id', photoId)
      .single();

    const currentTags = photoData?.tags || [];
    const updatedTags = [...new Set([...currentTags, tag.toLowerCase().trim()])];

    // Update tags
    const { error: updateError } = await supabase
      .from('photos')
      .update({ tags: updatedTags })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Add photo tag error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add tag',
    };
  }
}

/**
 * Remove a tag from a photo
 */
export async function removePhotoTag(
  photoId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    // Verify user owns the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, user_id, project_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current tags
    const { data: photoData } = await supabase
      .from('photos')
      .select('tags')
      .eq('id', photoId)
      .single();

    const currentTags = photoData?.tags || [];
    const updatedTags = currentTags.filter((t: string) => t !== tag.toLowerCase().trim());

    // Update tags
    const { error: updateError } = await supabase
      .from('photos')
      .update({ tags: updatedTags })
      .eq('id', photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/projects/${photo.project_id}/photos`);

    return { success: true };
  } catch (error) {
    console.error('Remove photo tag error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove tag',
    };
  }
}
