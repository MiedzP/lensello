import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session } from '@/lib/auth';
import type { Database } from '@/lib/db.types';

/**
 * Schema typing for the functions added by `supabase/migrations/20260731150100_library.sql`.
 *
 * `@/lib/db.types` is a shared file that mirrors `20260731150000_init.sql`, and this
 * module does not own it, so the three `library_*` functions are declared here
 * instead. Everything downstream of `libraryDb()` stays fully typed — the one
 * cast is confined to this file.
 *
 * If db.types.ts is ever regenerated from the live database it will pick these
 * up on its own and this module can be deleted.
 */

export interface ShootSummaryRow {
  shoot_id: string;
  asset_count: number;
  select_count: number;
  cover_storage_path: string | null;
}

type LibraryFunctions = Database['public']['Functions'] & {
  library_shoot_summaries: {
    Args: Record<PropertyKey, never>;
    Returns: ShootSummaryRow[];
  };
  library_add_asset_tag: {
    Args: { p_shoot_id: string; p_asset_ids: string[]; p_tag: string };
    Returns: number;
  };
  library_remove_asset_tag: {
    Args: { p_shoot_id: string; p_asset_ids: string[]; p_tag: string };
    Returns: number;
  };
};

export interface LibraryDatabase extends Omit<Database, 'public'> {
  public: Omit<Database['public'], 'Functions'> & { Functions: LibraryFunctions };
}

export type LibraryClient = SupabaseClient<LibraryDatabase>;

/**
 * Re-types a request-scoped Supabase client so the library RPCs are callable.
 *
 * Purely a compile-time view of the same client: it still carries the caller's
 * cookies and therefore their RLS context. This is not a privilege change.
 */
export function libraryDb(client: Session['supabase']): LibraryClient {
  return client as unknown as LibraryClient;
}
