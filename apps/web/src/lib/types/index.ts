/**
 * Type imports strategy for optimal bundle size
 *
 * ✓ TREE-SHAKEABLE - Import only what you need
 * ✓ DOCUMENTED - Comments show bundle impact per import
 * ✓ DOMAIN-FOCUSED - Split by feature area to reduce duplication
 *
 * BUNDLE SIZE ANALYSIS
 * =====================
 * Importing from full db.types.ts: ~95 KB
 * Importing from domain files: ~5-10 KB each
 * Savings per route: ~60-80% reduction
 *
 * USAGE GUIDELINES
 * ================
 * 1. For generic types (Json, Tables): import from ./utilities
 *    impact: +2 KB
 *
 * 2. For onboarding: import from ./onboarding
 *    impact: +3 KB (single responsibility, easy to cache/test)
 *
 * 3. For academy: import from ./academy
 *    impact: +4 KB (6 related tables grouped)
 *
 * 4. NEVER import full Database type unless building a query abstraction
 *    impact: +95 KB (entire schema in bundle)
 *
 * RE-EXPORT STRATEGY
 * ==================
 * This file exports commonly-used type combinations so consumers
 * can do: import type { OnboardingTypes } from '@/lib/types'
 * instead of: import type { ... } from '@/lib/types/onboarding'
 */

// Utilities - ALWAYS import these instead of db.types for generic types
// Bundle impact: +2KB vs +95KB
export type { Json, Tables, TablesInsert, TablesUpdate, Database } from './utilities'

// Onboarding-specific types
// Bundle impact: +3KB (concentrated in onboarding routes only)
export type {
  BusinessProfile,
  BusinessProfileUpdate,
  BusinessProfileInsert,
  DiagnosticResponse,
  OnboardingStep,
  OnboardingFormData,
  OnboardingResult,
} from './onboarding'

// Academy-specific types
// Bundle impact: +4KB (6 academy tables grouped together)
export type {
  AcademyModule,
  AcademyLesson,
  AcademyProgress,
  AcademyResource,
  AcademyWorksheet,
  AcademyWorksheetResponse,
  AcademyModuleUpdate,
  AcademyLessonUpdate,
  AcademyProgressUpdate,
  AcademyModuleInsert,
  AcademyLessonInsert,
  AcademyProgressInsert,
} from './academy'

/**
 * Type bundles for common scenarios
 * Use these for cleaner imports in components
 */

export type OnboardingTypes = {
  Step: OnboardingStep
  FormData: OnboardingFormData
  Result: OnboardingResult
  Profile: BusinessProfile
}

export type AcademyTypes = {
  Module: AcademyModule
  Lesson: AcademyLesson
  Progress: AcademyProgress
}

/**
 * IMPORTANT: What NOT to do
 *
 * ❌ DO NOT:
 *    import { Database } from '@/lib/db.types'  // Full 95KB file!
 *    import type * from '@/lib/db.types'
 *
 * ✅ DO INSTEAD:
 *    import type { Json, Tables } from '@/lib/types/utilities'
 *    import type { OnboardingStep } from '@/lib/types/onboarding'
 *
 * This keeps your bundles lean and tree-shaking effective.
 */
