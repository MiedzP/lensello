-- Create enums for project types and statuses
CREATE TYPE project_type AS ENUM (
  'wedding',
  'portrait',
  'event',
  'product',
  'commercial',
  'other'
);

CREATE TYPE project_status AS ENUM (
  'planning',
  'active',
  'review',
  'completed',
  'archived'
);

CREATE TYPE stage_status AS ENUM (
  'pending',
  'in_progress',
  'completed'
);

CREATE TYPE deliverable_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'revision'
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type project_type NOT NULL,
  status project_status NOT NULL DEFAULT 'planning',
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  expected_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  budget DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project stages table
CREATE TABLE IF NOT EXISTS project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  status stage_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, stage_order)
);

-- Deliverables table
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES project_stages (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status deliverable_status NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turnaround metrics table
CREATE TABLE IF NOT EXISTS turnaround_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  expected_days INTEGER NOT NULL,
  actual_days INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON projects (user_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_expected_deadline ON projects (expected_deadline);
CREATE INDEX idx_project_stages_project_id ON project_stages (project_id);
CREATE INDEX idx_project_stages_status ON project_stages (status);
CREATE INDEX idx_deliverables_project_id ON deliverables (project_id);
CREATE INDEX idx_deliverables_stage_id ON deliverables (stage_id);
CREATE INDEX idx_deliverables_status ON deliverables (status);
CREATE INDEX idx_turnaround_metrics_project_id ON turnaround_metrics (project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnaround_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for project_stages
CREATE POLICY "Users can view stages of their projects"
  ON project_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stages in their projects"
  ON project_stages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update stages in their projects"
  ON project_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stages.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete stages in their projects"
  ON project_stages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stages.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for deliverables
CREATE POLICY "Users can view deliverables in their projects"
  ON deliverables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deliverables.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert deliverables in their projects"
  ON deliverables
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deliverables.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update deliverables in their projects"
  ON deliverables
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deliverables.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deliverables.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete deliverables in their projects"
  ON deliverables
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deliverables.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for turnaround_metrics
CREATE POLICY "Users can view metrics for their projects"
  ON turnaround_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = turnaround_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert metrics in their projects"
  ON turnaround_metrics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = turnaround_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metrics in their projects"
  ON turnaround_metrics
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = turnaround_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = turnaround_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete metrics in their projects"
  ON turnaround_metrics
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = turnaround_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_stages_updated_at
  BEFORE UPDATE ON project_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_turnaround_metrics_updated_at
  BEFORE UPDATE ON turnaround_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
