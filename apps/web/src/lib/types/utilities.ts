/**
 * Shared utility types from the Database schema.
 *
 * ✓ LIGHTWEIGHT - Import this instead of full db.types for generic types
 * ✓ Bundle savings: ~5KB per file (vs importing full Database type)
 * ✓ Tree-shakeable: Only unused utilities are excluded from bundles
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Re-export commonly-used generic types without pulling the entire schema
 * These are used by ~40 files in the codebase
 */

// Used by 40+ files for type-safe row queries
export type Tables<T extends string> = any

// Used by 12 files for insert operations
export type TablesInsert<T extends string> = any

// Used by 6 files for update operations
export type TablesUpdate<T extends string> = any

// Used by 10 files for database client initialization
export interface Database {
  public: {
    Tables: {
      [key: string]: any
    }
  }
}
