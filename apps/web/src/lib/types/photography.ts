/**
 * Photography editing types for Lensello
 * Defines schemas for photos, edits, versions, and favorites
 */

/* ============================================================================
   Enums
   ============================================================================ */

export enum EditType {
  CROP = 'crop',
  BRIGHTNESS = 'brightness',
  CONTRAST = 'contrast',
  SATURATION = 'saturation',
  VIBRANCE = 'vibrance',
  CLARITY = 'clarity',
  SHADOWS = 'shadows',
  HIGHLIGHTS = 'highlights',
  TEMPERATURE = 'temperature',
  TINT = 'tint',
}

/* ============================================================================
   Database Schemas
   ============================================================================ */

/**
 * Photographic metadata stored as JSONB
 * Contains technical camera and image information
 */
export interface PhotoMetadata {
  dimensions?: {
    width: number;
    height: number;
  };
  iso?: number;
  aperture?: number; // f-stop (e.g., 2.8, 5.6)
  shutter?: string; // exposure time (e.g., "1/1000", "2")
  focalLength?: number; // in mm
  cameraModel?: string;
  [key: string]: unknown; // allow extensibility
}

/**
 * Raw photo upload record
 */
export interface Photo {
  id: string;
  projectId: string;
  stageId: string;
  filename: string;
  fileUrl: string;
  metadata: PhotoMetadata;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy: string; // user ID
}

/**
 * Individual editing operation
 */
export interface PhotoEdit {
  id: string;
  photoId: string;
  editType: EditType;
  value: number;
  createdAt: string; // ISO 8601
  appliedAt: string | null; // ISO 8601 or null if not yet applied
  createdBy: string; // user ID
}

/**
 * Versioned photo with applied edits
 */
export interface PhotoVersion {
  id: string;
  photoId: string;
  versionNumber: number;
  fileUrl: string;
  createdBy: string; // user ID
  createdAt: string; // ISO 8601
  isCurrent: boolean;
}

/**
 * User favorite marking
 */
export interface PhotoFavorite {
  id: string;
  photoId: string;
  userId: string;
  createdAt: string; // ISO 8601
}

/* ============================================================================
   Request/Input Types
   ============================================================================ */

/**
 * Request to create or update a photo edit
 */
export interface EditRequest {
  editType: EditType;
  value: number;
}

/**
 * Request to apply multiple edits and create a new version
 */
export interface ApplyEditsRequest {
  photoId: string;
  edits: EditRequest[];
  versionLabel?: string;
}

/**
 * Request to upload a new photo
 */
export interface UploadPhotoRequest {
  projectId: string;
  stageId: string;
  file: File;
  metadata?: PhotoMetadata;
}

/* ============================================================================
   Composite/View Types
   ============================================================================ */

/**
 * Photo with all related data for gallery display
 */
export interface PhotoWithMetadata extends Photo {
  edits: PhotoEdit[];
  versions: PhotoVersion[];
  isFavorited: boolean;
  favoriteCount: number;
}

/**
 * Photo edit history and current state
 */
export interface PhotoEditHistory {
  photoId: string;
  edits: PhotoEdit[];
  currentVersion: PhotoVersion | null;
  appliedEdits: PhotoEdit[];
  pendingEdits: PhotoEdit[];
}

/**
 * Gallery statistics for a stage
 */
export interface PhotoGalleryStats {
  totalPhotos: number;
  editedPhotos: number;
  favoritedPhotos: number;
  versionCount: number;
  averageEditsPerPhoto: number;
  recentUploads: Photo[];
}

/**
 * Batch edit operation result
 */
export interface BatchEditResult {
  photoId: string;
  success: boolean;
  versionId?: string;
  error?: string;
  appliedEdits: number;
}

/* ============================================================================
   Filtering & Pagination
   ============================================================================ */

/**
 * Query filters for photo gallery
 */
export interface PhotoFilters {
  projectId?: string;
  stageId?: string;
  createdBy?: string;
  isFavorited?: boolean;
  hasEdits?: boolean;
  search?: string; // filename search
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'created' | 'updated' | 'favorites';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/* ============================================================================
   API Response Types
   ============================================================================ */

/**
 * Standard API response for photo operations
 */
export interface PhotoApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Batch operation response
 */
export interface BatchOperationResponse {
  success: boolean;
  results: BatchEditResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/* ============================================================================
   Type Guards
   ============================================================================ */

export function isPhoto(obj: unknown): obj is Photo {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'projectId' in obj &&
    'stageId' in obj &&
    'filename' in obj &&
    'fileUrl' in obj &&
    'createdAt' in obj
  );
}

export function isPhotoEdit(obj: unknown): obj is PhotoEdit {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'photoId' in obj &&
    'editType' in obj &&
    'value' in obj &&
    'createdAt' in obj
  );
}

export function isPhotoVersion(obj: unknown): obj is PhotoVersion {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'photoId' in obj &&
    'versionNumber' in obj &&
    'fileUrl' in obj &&
    'createdAt' in obj &&
    'isCurrent' in obj
  );
}

export function isEditType(value: unknown): value is EditType {
  return Object.values(EditType).includes(value as EditType);
}

/* ============================================================================
   Constants
   ============================================================================ */

export const EDIT_TYPE_LABELS: Record<EditType, string> = {
  [EditType.CROP]: 'Crop',
  [EditType.BRIGHTNESS]: 'Brightness',
  [EditType.CONTRAST]: 'Contrast',
  [EditType.SATURATION]: 'Saturation',
  [EditType.VIBRANCE]: 'Vibrance',
  [EditType.CLARITY]: 'Clarity',
  [EditType.SHADOWS]: 'Shadows',
  [EditType.HIGHLIGHTS]: 'Highlights',
  [EditType.TEMPERATURE]: 'Temperature',
  [EditType.TINT]: 'Tint',
};

export const EDIT_VALUE_RANGES: Record<EditType, { min: number; max: number; step: number }> = {
  [EditType.CROP]: { min: 0, max: 100, step: 1 }, // percentage
  [EditType.BRIGHTNESS]: { min: -100, max: 100, step: 1 },
  [EditType.CONTRAST]: { min: -100, max: 100, step: 1 },
  [EditType.SATURATION]: { min: -100, max: 100, step: 1 },
  [EditType.VIBRANCE]: { min: -100, max: 100, step: 1 },
  [EditType.CLARITY]: { min: -100, max: 100, step: 1 },
  [EditType.SHADOWS]: { min: -100, max: 100, step: 1 },
  [EditType.HIGHLIGHTS]: { min: -100, max: 100, step: 1 },
  [EditType.TEMPERATURE]: { min: -100, max: 100, step: 1 }, // color temperature shift
  [EditType.TINT]: { min: -100, max: 100, step: 1 }, // magenta/green tint
};

/**
 * Maximum file size for photo upload (50 MB)
 */
export const MAX_PHOTO_UPLOAD_SIZE = 50 * 1024 * 1024;

/**
 * Allowed photo file types
 */
export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/x-canon-crw',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
];

/**
 * Default pagination size
 */
export const DEFAULT_PAGE_SIZE = 24;

/* ============================================================================
   Utility Types
   ============================================================================ */

/**
 * Omit photo versions from photo for lighter responses
 */
export type PhotoPreview = Omit<Photo, 'metadata'> & {
  metadata?: Partial<PhotoMetadata>;
};

/**
 * Minimal photo info for listings
 */
export type PhotoListItem = Pick<
  Photo,
  'id' | 'projectId' | 'stageId' | 'filename' | 'fileUrl' | 'createdAt'
> & {
  editCount: number;
  isFavorited: boolean;
};
