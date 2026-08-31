-- Photography editing schema for Lensello
-- Created: 2026-08-30

-- Create enum for photo edit types
CREATE TYPE edit_type_enum AS ENUM (
  'crop',
  'brightness',
  'contrast',
  'saturation',
  'vibrance',
  'clarity',
  'shadows',
  'highlights',
  'temperature',
  'tint'
);

-- Photos table: stores raw photo uploads and metadata
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- { dimensions: { width, height }, iso, aperture, shutter, focal_length, camera_model }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE photos IS 'Raw photo uploads with EXIF and technical metadata';
COMMENT ON COLUMN photos.metadata IS 'JSONB containing { dimensions: { width, height }, iso, aperture, shutter, focal_length, camera_model }';

-- Indexes for photos
CREATE INDEX idx_photos_project_id ON photos(project_id);
CREATE INDEX idx_photos_stage_id ON photos(stage_id);
CREATE INDEX idx_photos_created_by ON photos(created_by);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX idx_photos_project_stage ON photos(project_id, stage_id);

-- Photo edits table: tracks all editing operations
CREATE TABLE photo_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  edit_type edit_type_enum NOT NULL,
  value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE photo_edits IS 'Individual editing operations applied to photos';
COMMENT ON COLUMN photo_edits.value IS 'Numeric value for the edit (e.g., -50 to 100 for brightness, percentage)';
COMMENT ON COLUMN photo_edits.applied_at IS 'Timestamp when edit was applied to current version';

-- Indexes for photo_edits
CREATE INDEX idx_photo_edits_photo_id ON photo_edits(photo_id);
CREATE INDEX idx_photo_edits_type ON photo_edits(edit_type);
CREATE INDEX idx_photo_edits_created_at ON photo_edits(created_at DESC);
CREATE INDEX idx_photo_edits_applied_at ON photo_edits(applied_at) WHERE applied_at IS NOT NULL;

-- Photo versions table: stores version history of edited photos
CREATE TABLE photo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE photo_versions IS 'Version history of edited photos';
COMMENT ON COLUMN photo_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN photo_versions.is_current IS 'Whether this is the current active version';

-- Ensure only one version per photo is marked as current
CREATE UNIQUE INDEX idx_photo_versions_current ON photo_versions(photo_id) WHERE is_current = TRUE;

-- Indexes for photo_versions
CREATE INDEX idx_photo_versions_photo_id ON photo_versions(photo_id);
CREATE INDEX idx_photo_versions_created_by ON photo_versions(created_by);
CREATE INDEX idx_photo_versions_created_at ON photo_versions(created_at DESC);
CREATE INDEX idx_photo_versions_version_number ON photo_versions(photo_id, version_number DESC);

-- Photo favorites table: user-specific photo favoriting
CREATE TABLE photo_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE photo_favorites IS 'User favorites for photos';

-- Ensure one favorite per user per photo
CREATE UNIQUE INDEX idx_photo_favorites_unique ON photo_favorites(photo_id, user_id);

-- Indexes for photo_favorites
CREATE INDEX idx_photo_favorites_photo_id ON photo_favorites(photo_id);
CREATE INDEX idx_photo_favorites_user_id ON photo_favorites(user_id);
CREATE INDEX idx_photo_favorites_created_at ON photo_favorites(created_at DESC);

-- RLS Policies for photos
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_project_photos" ON photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = photos.project_id
      AND (
        projects.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "users_can_insert_photos_in_their_projects" ON photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = photos.project_id
      AND (
        projects.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('editor', 'admin')
        )
      )
    )
  );

CREATE POLICY "users_can_update_their_photos" ON photos
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = photos.project_id
      AND (
        projects.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "users_can_delete_their_photos" ON photos
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = photos.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- RLS Policies for photo_edits
ALTER TABLE photo_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_edits_for_visible_photos" ON photo_edits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_edits.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "users_can_create_edits_on_their_photos" ON photo_edits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_edits.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('editor', 'admin')
          )
        )
      )
    )
  );

-- RLS Policies for photo_versions
ALTER TABLE photo_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_versions_for_visible_photos" ON photo_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_versions.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "users_can_create_versions_on_their_photos" ON photo_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_versions.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role IN ('editor', 'admin')
          )
        )
      )
    )
  );

CREATE POLICY "users_can_update_versions" ON photo_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_versions.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'admin'
          )
        )
      )
    )
  );

-- RLS Policies for photo_favorites
ALTER TABLE photo_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_all_favorites" ON photo_favorites
  FOR SELECT USING (TRUE);

CREATE POLICY "users_can_favorite_visible_photos" ON photo_favorites
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_favorites.photo_id
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = photos.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "users_can_delete_their_favorites" ON photo_favorites
  FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_edits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_favorites TO authenticated;
GRANT USAGE ON TYPE edit_type_enum TO authenticated;
