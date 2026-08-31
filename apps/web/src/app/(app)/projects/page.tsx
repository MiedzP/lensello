'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProjectListResult, ProjectSummary, ProjectStatus, ProjectDashboardStats } from '@/lib/types/workflow';
import {
  getProjectsList,
  getProjectDashboardStats,
} from './actions';

// ===== Component Types =====

interface FilterState {
  status: ProjectStatus | 'all';
  page: number;
  pageSize: number;
}

// ===== Utility Functions =====

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysText(days: number): string {
  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }
  if (days === 0) {
    return 'Due today';
  }
  return `${days} days left`;
}

function getStatusColor(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.PLANNING:
      return 'bg-blue-100 text-blue-800';
    case ProjectStatus.ACTIVE:
      return 'bg-green-100 text-green-800';
    case ProjectStatus.REVIEW:
      return 'bg-yellow-100 text-yellow-800';
    case ProjectStatus.COMPLETED:
      return 'bg-gray-100 text-gray-800';
    case ProjectStatus.ARCHIVED:
      return 'bg-slate-100 text-slate-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getProgressColor(progress: number): string {
  if (progress < 33) return 'bg-red-500';
  if (progress < 66) return 'bg-yellow-500';
  return 'bg-green-500';
}

// ===== Components =====

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
}

function StatCard({ label, value, subtext, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="mt-1 text-sm text-gray-500">{subtext}</p>}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectSummary;
}

function ProjectCard({ project }: ProjectCardProps) {
  const daysText = getDaysText(project.daysUntilDeadline);
  const daysColor = project.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600';

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 overflow-hidden cursor-pointer">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{project.name}</h3>
              {project.clientName && (
                <p className="text-sm text-gray-500 mt-1">{project.clientName}</p>
              )}
            </div>
            <span
              className={`ml-3 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                project.status,
              )}`}
            >
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-gray-900">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(project.progress)}`}
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Stages</p>
              <p className="text-lg font-bold text-gray-900">
                {project.completedStageCount}/{project.stageCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Deliverables</p>
              <p className="text-lg font-bold text-gray-900">
                {project.completedDeliverableCount}/{project.deliverableCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Type</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{project.type}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Deadline</p>
              <p className={`text-sm font-medium ${daysColor}`}>{daysText}</p>
            </div>
            {project.budget && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Budget</p>
                <p className="text-sm font-medium text-gray-900">
                  ${project.budget.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ===== Main Page Component =====

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<ProjectDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    page: 1,
    pageSize: 12,
  });

  // Load projects and stats
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load projects
        const result = await getProjectsList({
          status: filters.status === 'all' ? undefined : (filters.status as ProjectStatus),
          page: filters.page,
          pageSize: filters.pageSize,
        });
        setProjects(result.items);

        // Load stats
        const dashboardStats = await getProjectDashboardStats();
        setStats(dashboardStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
        console.error('Error loading projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filters.status, filters.page, filters.pageSize]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
              <p className="mt-2 text-gray-600">Manage and track your photography projects</p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Project
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Dashboard Stats */}
        {stats && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard
              label="Total Projects"
              value={stats.totalProjects}
              subtext={`${stats.completedProjects} completed`}
            />
            <StatCard
              label="Active Projects"
              value={stats.activeProjects}
              subtext={`${stats.overdueProjects} overdue`}
            />
            <StatCard
              label="Avg Completion"
              value={`${stats.averageCompletionDays} days`}
              subtext="From start to finish"
            />
            <StatCard
              label="Total Budget"
              value={`$${stats.totalBudget.toLocaleString()}`}
              subtext={`${stats.totalProjects} projects`}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilters({ ...filters, status: 'all', page: 1 })}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filters.status === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Projects
            </button>
            {Object.values(ProjectStatus).map((status) => (
              <button
                key={status}
                onClick={() => setFilters({ ...filters, status, page: 1 })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                  filters.status === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                <svg
                  className="w-6 h-6 text-blue-600 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Loading projects...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium mb-2">Failed to load projects</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.status === 'all'
                ? "Get started by creating your first project."
                : "No projects found with this filter."}
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Project
            </Link>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && projects.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-600 text-sm">
                Page {filters.page}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
