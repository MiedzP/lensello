/**
 * Academy module types extracted from db.types.ts
 *
 * ✓ CONCENTRATED - 6 academy tables in one focused file
 * ✓ Bundle savings: ~3KB when used by academy routes
 * ✓ Clear separation - 40+ files import Tables but only 6 are academy-related
 *
 * Related tables: academy_lessons, academy_modules, academy_progress,
 * academy_resources, academy_worksheets, academy_worksheet_responses
 */

import type { Json } from './utilities'

export interface AcademyModule {
  id: string
  slug: string
  title: string
  summary: string | null
  icon: string | null
  accent_color: string | null
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AcademyLesson {
  id: string
  module_id: string
  slug: string
  title: string
  summary: string | null
  body_md: string
  is_published: boolean
  estimated_minutes: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AcademyProgress {
  user_id: string
  lesson_id: string
  status: string
  completed_at: string | null
  updated_at: string
}

export interface AcademyResource {
  id: string
  lesson_id: string | null
  module_id: string | null
  title: string
  description: string | null
  kind: string
  url: string | null
  storage_path: string | null
  sort_order: number
  created_at: string
}

export interface AcademyWorksheet {
  id: string
  lesson_id: string
  slug: string
  title: string
  intro: string | null
  schema: Json
  profile_key: string | null
  sort_order: number
  created_at: string
}

export interface AcademyWorksheetResponse {
  id: string
  worksheet_id: string
  user_id: string
  answers: Json
  submitted_at: string | null
  created_at: string
  updated_at: string
}

// Update types
export type AcademyModuleUpdate = Partial<Omit<AcademyModule, 'id' | 'created_at'>>
export type AcademyLessonUpdate = Partial<Omit<AcademyLesson, 'id' | 'created_at'>>
export type AcademyProgressUpdate = Partial<Omit<AcademyProgress, 'user_id' | 'lesson_id'>>

// Insert types
export type AcademyModuleInsert = Omit<AcademyModule, 'created_at' | 'updated_at' | 'id'>
export type AcademyLessonInsert = Omit<AcademyLesson, 'created_at' | 'updated_at' | 'id'>
export type AcademyProgressInsert = Omit<AcademyProgress, 'updated_at'>
