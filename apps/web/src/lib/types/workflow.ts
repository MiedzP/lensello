/**
 * Workflow Automation Types
 * Types for project management, stages, deliverables, and turnaround metrics
 */

// ===== Enums =====

export enum ProjectType {
  WEDDING = 'wedding',
  PORTRAIT = 'portrait',
  EVENT = 'event',
  PRODUCT = 'product',
  COMMERCIAL = 'commercial',
  OTHER = 'other',
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  REVIEW = 'review',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum StageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum DeliverableStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REVISION = 'revision',
}

// ===== Database Row Types =====

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  description: string | null;
  start_date: string | null;
  expected_deadline: string;
  actual_completion_date: string | null;
  budget: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStageRow {
  id: string;
  project_id: string;
  stage_name: string;
  stage_order: number;
  status: StageStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliverableRow {
  id: string;
  project_id: string;
  stage_id: string;
  name: string;
  description: string | null;
  status: DeliverableStatus;
  due_date: string | null;
  completed_at: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TurnaroundMetricRow {
  id: string;
  project_id: string;
  metric_name: string;
  expected_days: number;
  actual_days: number | null;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ===== Domain Types =====

export interface Project extends ProjectRow {}

export interface ProjectStage extends ProjectStageRow {}

export interface Deliverable extends DeliverableRow {}

export interface TurnaroundMetric extends TurnaroundMetricRow {}

// ===== DTO Types =====

export interface CreateProjectInput {
  name: string;
  type: ProjectType;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  description?: string;
  startDate?: Date | string;
  expectedDeadline: Date | string;
  budget?: number;
  notes?: string;
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  description?: string;
  startDate?: Date | string | null;
  expectedDeadline?: Date | string;
  actualCompletionDate?: Date | string | null;
  budget?: number | null;
  notes?: string | null;
}

export interface CreateProjectStageInput {
  projectId: string;
  stageName: string;
  stageOrder: number;
  notes?: string;
}

export interface UpdateProjectStageInput {
  stageName?: string;
  status?: StageStatus;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  notes?: string | null;
}

export interface CreateDeliverableInput {
  projectId: string;
  stageId: string;
  name: string;
  description?: string;
  dueDate?: Date | string;
  notes?: string;
}

export interface UpdateDeliverableInput {
  name?: string;
  description?: string;
  status?: DeliverableStatus;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  fileUrl?: string | null;
  notes?: string | null;
}

export interface CreateTurnaroundMetricInput {
  projectId: string;
  metricName: string;
  expectedDays: number;
  notes?: string;
}

export interface UpdateTurnaroundMetricInput {
  metricName?: string;
  expectedDays?: number;
  actualDays?: number | null;
  completed?: boolean;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  notes?: string | null;
}

// ===== Aggregated Types =====

export interface ProjectWithDetails extends Project {
  stages: ProjectStage[];
  deliverables: Deliverable[];
  metrics: TurnaroundMetric[];
}

export interface ProjectTimeline {
  projectId: string;
  projectName: string;
  stages: Array<{
    id: string;
    stageName: string;
    stageOrder: number;
    status: StageStatus;
    startedAt: string | null;
    completedAt: string | null;
    deliverables: Deliverable[];
    progress: number; // 0-100
  }>;
  overallProgress: number; // 0-100
  daysUntilDeadline: number;
  isOverdue: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  clientName: string | null;
  expectedDeadline: string;
  actualCompletionDate: string | null;
  progress: number; // 0-100
  stageCount: number;
  completedStageCount: number;
  deliverableCount: number;
  completedDeliverableCount: number;
  daysUntilDeadline: number;
  isOverdue: boolean;
  budget: number | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Dashboard Types =====

export interface ProjectDashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  averageCompletionDays: number;
  totalBudget: number;
  averageProjectDuration: number;
}

export interface ProjectFilter {
  status?: ProjectStatus | ProjectStatus[];
  type?: ProjectType | ProjectType[];
  isOverdue?: boolean;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  searchTerm?: string;
}

export interface ProjectListResult {
  items: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ===== API Response Types =====

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  success: boolean;
}

export interface ProjectResponse extends ApiResponse<Project> {}
export interface ProjectListResponse extends ApiResponse<ProjectListResult> {}
export interface ProjectTimelineResponse extends ApiResponse<ProjectTimeline> {}

// ===== Validation Types =====

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ===== Status Helper Types =====

export interface StatusTransition {
  from: ProjectStatus;
  to: ProjectStatus;
  allowedRoles?: string[];
}

export interface StageProgress {
  totalStages: number;
  completedStages: number;
  inProgressStages: number;
  pendingStages: number;
  percentageComplete: number;
}

export interface DeliverableProgress {
  totalDeliverables: number;
  completedDeliverables: number;
  inProgressDeliverables: number;
  revisionDeliverables: number;
  pendingDeliverables: number;
  percentageComplete: number;
}

// ===== Form Types =====

export interface ProjectFormData {
  name: string;
  type: ProjectType;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  description?: string;
  startDate?: string;
  expectedDeadline: string;
  budget?: string;
  notes?: string;
}

export interface StageFormData {
  stageName: string;
  stageOrder: number;
  notes?: string;
}

export interface DeliverableFormData {
  name: string;
  description?: string;
  dueDate?: string;
  notes?: string;
}
