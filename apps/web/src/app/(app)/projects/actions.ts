'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  Project,
  ProjectStage,
  Deliverable,
  TurnaroundMetric,
  ProjectTimeline,
  ProjectSummary,
  ProjectListResult,
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectStageInput,
  UpdateProjectStageInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
  CreateTurnaroundMetricInput,
  UpdateTurnaroundMetricInput,
  ProjectStatus,
  StageStatus,
  DeliverableStatus,
  ProjectDashboardStats,
} from '@/lib/types/workflow';

// ===== Error Handling =====

class ProjectError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

class NotFoundError extends ProjectError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`);
  }
}

class UnauthorizedError extends ProjectError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message);
  }
}

class ValidationError extends ProjectError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

// ===== Helper Functions =====

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return user;
}

async function getSupabaseClient() {
  return createClient();
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

function calculateDaysUntilDeadline(deadline: string | Date): number {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const today = new Date();
  const diffTime = deadlineDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isOverdue(deadline: string | Date): boolean {
  return calculateDaysUntilDeadline(deadline) < 0;
}

function calculateProgressPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// ===== Project Actions =====

export async function createProject(input: CreateProjectInput): Promise<Project> {
  try {
    const user = await requireUser();
    const supabase = await getSupabaseClient();

    // Validate required fields
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Project name is required');
    }

    if (!input.expectedDeadline) {
      throw new ValidationError('Expected deadline is required');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        type: input.type,
        status: 'planning',
        client_name: input.clientName || null,
        client_email: input.clientEmail || null,
        client_phone: input.clientPhone || null,
        description: input.description || null,
        start_date: input.startDate ? formatDate(input.startDate) : null,
        expected_deadline: formatDate(input.expectedDeadline),
        budget: input.budget || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to create project: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to create project: ${String(error)}`);
  }
}

export async function getProject(projectId: string): Promise<Project> {
  try {
    const user = await requireUser();
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from('projects')
      .select()
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      throw new NotFoundError('Project');
    }

    if (!data) {
      throw new NotFoundError('Project');
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to fetch project: ${String(error)}`);
  }
}

export async function getProjectsList(
  filters?: {
    status?: ProjectStatus;
    page?: number;
    pageSize?: number;
  },
): Promise<ProjectListResult> {
  try {
    const user = await requireUser();
    const supabase = await getSupabaseClient();
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to fetch projects: ${error.message}`);
    }

    const items: ProjectSummary[] = [];
    for (const project of data || []) {
      const summary = await projectToSummary(project, supabase);
      items.push(summary);
    }

    return {
      items,
      total: count || 0,
      page,
      pageSize,
      hasMore: offset + pageSize < (count || 0),
    };
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to fetch projects list: ${String(error)}`);
  }
}

export async function getProjectTimeline(projectId: string): Promise<ProjectTimeline> {
  try {
    const user = await requireUser();
    const supabase = await getSupabaseClient();

    // Get project
    const project = await getProject(projectId);

    // Get stages
    const { data: stages, error: stagesError } = await supabase
      .from('project_stages')
      .select()
      .eq('project_id', projectId)
      .order('stage_order', { ascending: true });

    if (stagesError) {
      throw new ProjectError('DB_ERROR', `Failed to fetch stages: ${stagesError.message}`);
    }

    // Get deliverables
    const { data: deliverables, error: deliverablesError } = await supabase
      .from('deliverables')
      .select()
      .eq('project_id', projectId);

    if (deliverablesError) {
      throw new ProjectError('DB_ERROR', `Failed to fetch deliverables: ${deliverablesError.message}`);
    }

    const timelineStages = (stages || []).map((stage) => {
      const stageDeliverables = (deliverables || []).filter((d) => d.stage_id === stage.id);
      const completedDeliverables = stageDeliverables.filter(
        (d) => d.status === DeliverableStatus.COMPLETED,
      ).length;

      return {
        id: stage.id,
        stageName: stage.stage_name,
        stageOrder: stage.stage_order,
        status: stage.status as StageStatus,
        startedAt: stage.started_at,
        completedAt: stage.completed_at,
        deliverables: stageDeliverables,
        progress: calculateProgressPercentage(completedDeliverables, stageDeliverables.length),
      };
    });

    const totalDeliverables = deliverables?.length || 0;
    const completedDeliverables =
      (deliverables?.filter((d) => d.status === DeliverableStatus.COMPLETED).length || 0) +
      (deliverables?.filter((d) => d.status === DeliverableStatus.COMPLETED).length || 0);

    return {
      projectId: project.id,
      projectName: project.name,
      stages: timelineStages,
      overallProgress: calculateProgressPercentage(completedDeliverables, totalDeliverables),
      daysUntilDeadline: calculateDaysUntilDeadline(project.expected_deadline),
      isOverdue: isOverdue(project.expected_deadline),
    };
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to fetch project timeline: ${String(error)}`);
  }
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
  try {
    const project = await getProject(projectId);
    const supabase = await getSupabaseClient();

    const updates: Record<string, unknown> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.status !== undefined) updates.status = input.status;
    if (input.clientName !== undefined) updates.client_name = input.clientName;
    if (input.clientEmail !== undefined) updates.client_email = input.clientEmail;
    if (input.clientPhone !== undefined) updates.client_phone = input.clientPhone;
    if (input.description !== undefined) updates.description = input.description;
    if (input.startDate !== undefined) updates.start_date = formatDate(input.startDate);
    if (input.expectedDeadline !== undefined)
      updates.expected_deadline = formatDate(input.expectedDeadline);
    if (input.actualCompletionDate !== undefined)
      updates.actual_completion_date = formatDate(input.actualCompletionDate);
    if (input.budget !== undefined) updates.budget = input.budget;
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to update project: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to update project: ${String(error)}`);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  try {
    await getProject(projectId); // Verify ownership
    const supabase = await getSupabaseClient();

    const { error } = await supabase.from('projects').delete().eq('id', projectId);

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to delete project: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to delete project: ${String(error)}`);
  }
}

// ===== Project Stage Actions =====

export async function createProjectStage(input: CreateProjectStageInput): Promise<ProjectStage> {
  try {
    await getProject(input.projectId); // Verify ownership
    const supabase = await getSupabaseClient();

    if (!input.stageName || input.stageName.trim().length === 0) {
      throw new ValidationError('Stage name is required');
    }

    const { data, error } = await supabase
      .from('project_stages')
      .insert({
        project_id: input.projectId,
        stage_name: input.stageName.trim(),
        stage_order: input.stageOrder,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to create stage: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to create stage: ${String(error)}`);
  }
}

export async function updateProjectStage(
  stageId: string,
  input: UpdateProjectStageInput,
): Promise<ProjectStage> {
  try {
    const supabase = await getSupabaseClient();

    // Verify the stage exists and user owns the project
    const { data: stage, error: fetchError } = await supabase
      .from('project_stages')
      .select('project_id')
      .eq('id', stageId)
      .single();

    if (fetchError || !stage) {
      throw new NotFoundError('Project stage');
    }

    await getProject(stage.project_id); // Verify ownership

    const updates: Record<string, unknown> = {};

    if (input.stageName !== undefined) updates.stage_name = input.stageName;
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === StageStatus.IN_PROGRESS && !stage.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (input.status === StageStatus.COMPLETED) {
        updates.completed_at = formatDate(input.completedAt) || new Date().toISOString();
      }
    }
    if (input.startedAt !== undefined) updates.started_at = formatDate(input.startedAt);
    if (input.completedAt !== undefined) updates.completed_at = formatDate(input.completedAt);
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await supabase
      .from('project_stages')
      .update(updates)
      .eq('id', stageId)
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to update stage: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to update stage: ${String(error)}`);
  }
}

export async function deleteProjectStage(stageId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClient();

    const { data: stage, error: fetchError } = await supabase
      .from('project_stages')
      .select('project_id')
      .eq('id', stageId)
      .single();

    if (fetchError || !stage) {
      throw new NotFoundError('Project stage');
    }

    await getProject(stage.project_id);

    const { error } = await supabase.from('project_stages').delete().eq('id', stageId);

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to delete stage: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to delete stage: ${String(error)}`);
  }
}

// ===== Deliverable Actions =====

export async function createDeliverable(input: CreateDeliverableInput): Promise<Deliverable> {
  try {
    await getProject(input.projectId); // Verify ownership
    const supabase = await getSupabaseClient();

    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Deliverable name is required');
    }

    const { data, error } = await supabase
      .from('deliverables')
      .insert({
        project_id: input.projectId,
        stage_id: input.stageId,
        name: input.name.trim(),
        description: input.description || null,
        due_date: input.dueDate ? formatDate(input.dueDate) : null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to create deliverable: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to create deliverable: ${String(error)}`);
  }
}

export async function updateDeliverable(
  deliverableId: string,
  input: UpdateDeliverableInput,
): Promise<Deliverable> {
  try {
    const supabase = await getSupabaseClient();

    const { data: deliverable, error: fetchError } = await supabase
      .from('deliverables')
      .select('project_id')
      .eq('id', deliverableId)
      .single();

    if (fetchError || !deliverable) {
      throw new NotFoundError('Deliverable');
    }

    await getProject(deliverable.project_id);

    const updates: Record<string, unknown> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === DeliverableStatus.COMPLETED) {
        updates.completed_at = formatDate(input.completedAt) || new Date().toISOString();
      }
    }
    if (input.dueDate !== undefined) updates.due_date = formatDate(input.dueDate);
    if (input.completedAt !== undefined) updates.completed_at = formatDate(input.completedAt);
    if (input.fileUrl !== undefined) updates.file_url = input.fileUrl;
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await supabase
      .from('deliverables')
      .update(updates)
      .eq('id', deliverableId)
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to update deliverable: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to update deliverable: ${String(error)}`);
  }
}

export async function deleteDeliverable(deliverableId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClient();

    const { data: deliverable, error: fetchError } = await supabase
      .from('deliverables')
      .select('project_id')
      .eq('id', deliverableId)
      .single();

    if (fetchError || !deliverable) {
      throw new NotFoundError('Deliverable');
    }

    await getProject(deliverable.project_id);

    const { error } = await supabase.from('deliverables').delete().eq('id', deliverableId);

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to delete deliverable: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to delete deliverable: ${String(error)}`);
  }
}

// ===== Turnaround Metric Actions =====

export async function createTurnaroundMetric(
  input: CreateTurnaroundMetricInput,
): Promise<TurnaroundMetric> {
  try {
    await getProject(input.projectId);
    const supabase = await getSupabaseClient();

    if (!input.metricName || input.metricName.trim().length === 0) {
      throw new ValidationError('Metric name is required');
    }

    if (input.expectedDays <= 0) {
      throw new ValidationError('Expected days must be greater than 0');
    }

    const { data, error } = await supabase
      .from('turnaround_metrics')
      .insert({
        project_id: input.projectId,
        metric_name: input.metricName.trim(),
        expected_days: input.expectedDays,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to create metric: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to create metric: ${String(error)}`);
  }
}

export async function updateTurnaroundMetric(
  metricId: string,
  input: UpdateTurnaroundMetricInput,
): Promise<TurnaroundMetric> {
  try {
    const supabase = await getSupabaseClient();

    const { data: metric, error: fetchError } = await supabase
      .from('turnaround_metrics')
      .select('project_id')
      .eq('id', metricId)
      .single();

    if (fetchError || !metric) {
      throw new NotFoundError('Turnaround metric');
    }

    await getProject(metric.project_id);

    const updates: Record<string, unknown> = {};

    if (input.metricName !== undefined) updates.metric_name = input.metricName;
    if (input.expectedDays !== undefined) updates.expected_days = input.expectedDays;
    if (input.actualDays !== undefined) updates.actual_days = input.actualDays;
    if (input.completed !== undefined) {
      updates.completed = input.completed;
      if (input.completed) {
        updates.completed_at = formatDate(input.completedAt) || new Date().toISOString();
      }
    }
    if (input.startedAt !== undefined) updates.started_at = formatDate(input.startedAt);
    if (input.completedAt !== undefined) updates.completed_at = formatDate(input.completedAt);
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await supabase
      .from('turnaround_metrics')
      .update(updates)
      .eq('id', metricId)
      .select()
      .single();

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to update metric: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to update metric: ${String(error)}`);
  }
}

export async function deleteTurnaroundMetric(metricId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClient();

    const { data: metric, error: fetchError } = await supabase
      .from('turnaround_metrics')
      .select('project_id')
      .eq('id', metricId)
      .single();

    if (fetchError || !metric) {
      throw new NotFoundError('Turnaround metric');
    }

    await getProject(metric.project_id);

    const { error } = await supabase.from('turnaround_metrics').delete().eq('id', metricId);

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to delete metric: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to delete metric: ${String(error)}`);
  }
}

// ===== Dashboard Actions =====

export async function getProjectDashboardStats(): Promise<ProjectDashboardStats> {
  try {
    const user = await requireUser();
    const supabase = await getSupabaseClient();

    const { data: projects, error } = await supabase
      .from('projects')
      .select()
      .eq('user_id', user.id);

    if (error) {
      throw new ProjectError('DB_ERROR', `Failed to fetch stats: ${error.message}`);
    }

    const now = new Date();
    const activeProjects = (projects || []).filter((p) => p.status === ProjectStatus.ACTIVE).length;
    const completedProjects = (projects || []).filter(
      (p) => p.status === ProjectStatus.COMPLETED,
    ).length;
    const overdueProjects = (projects || []).filter((p) => isOverdue(p.expected_deadline)).length;

    let totalBudget = 0;
    let totalCompletionDays = 0;
    let completedCount = 0;

    for (const project of projects || []) {
      if (project.budget) {
        totalBudget += project.budget;
      }
      if (project.actual_completion_date && project.start_date) {
        const startDate = new Date(project.start_date);
        const completionDate = new Date(project.actual_completion_date);
        const days = Math.ceil(
          (completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        totalCompletionDays += days;
        completedCount++;
      }
    }

    return {
      totalProjects: projects?.length || 0,
      activeProjects,
      completedProjects,
      overdueProjects,
      averageCompletionDays: completedCount > 0 ? Math.round(totalCompletionDays / completedCount) : 0,
      totalBudget,
      averageProjectDuration: projects?.length || 0 > 0 ? Math.round(totalCompletionDays / (projects?.length || 1)) : 0,
    };
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError('UNKNOWN_ERROR', `Failed to fetch dashboard stats: ${String(error)}`);
  }
}

// ===== Helper function to convert project to summary =====

async function projectToSummary(project: Project, supabase: any): Promise<ProjectSummary> {
  const { data: stages } = await supabase
    .from('project_stages')
    .select()
    .eq('project_id', project.id);

  const { data: deliverables } = await supabase
    .from('deliverables')
    .select()
    .eq('project_id', project.id);

  const completedStages = (stages || []).filter((s) => s.status === StageStatus.COMPLETED).length;
  const completedDeliverables = (deliverables || []).filter(
    (d) => d.status === DeliverableStatus.COMPLETED,
  ).length;

  const stagesProgress = calculateProgressPercentage(
    completedStages,
    (stages || []).length,
  );
  const deliverablesProgress = calculateProgressPercentage(
    completedDeliverables,
    (deliverables || []).length,
  );
  const overallProgress = Math.round((stagesProgress + deliverablesProgress) / 2);

  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    clientName: project.client_name,
    expectedDeadline: project.expected_deadline,
    actualCompletionDate: project.actual_completion_date,
    progress: overallProgress,
    stageCount: stages?.length || 0,
    completedStageCount: completedStages,
    deliverableCount: deliverables?.length || 0,
    completedDeliverableCount: completedDeliverables,
    daysUntilDeadline: calculateDaysUntilDeadline(project.expected_deadline),
    isOverdue: isOverdue(project.expected_deadline),
    budget: project.budget,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}
