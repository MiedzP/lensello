/**
 * Database types for the Lensello schema.
 *
 * Hand-written to mirror everything in supabase/migrations/ in the shape the
 * Supabase type generator emits, so it can be replaced wholesale once the CLI
 * is available:
 *
 *   supabase gen types typescript --project-id <id> > src/lib/db.types.ts
 *
 * If you change the migration, change this file in the same commit.
 */

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Columns with a default or generated value are optional on insert. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'owner' | 'staff';
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: 'owner' | 'staff';
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: 'owner' | 'staff';
        };
        Relationships: [];
      };

      clients: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          stage: 'lead' | 'inquiry' | 'quoted' | 'booked' | 'completed' | 'lost';
          source:
            | 'instagram'
            | 'referral'
            | 'website'
            | 'google'
            | 'wedding_wire'
            | 'repeat'
            | 'other';
          notes: string | null;
          last_contacted_at: string | null;
          /** Maintained by a trigger on client_consents; do not write directly. */
          marketing_consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          stage?: Database['public']['Tables']['clients']['Row']['stage'];
          source?: Database['public']['Tables']['clients']['Row']['source'];
          notes?: string | null;
          last_contacted_at?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      gigs: {
        Row: {
          id: string;
          client_id: string | null;
          title: string;
          type:
            | 'wedding'
            | 'engagement'
            | 'portrait'
            | 'headshot'
            | 'family'
            | 'event'
            | 'commercial'
            | 'product'
            | 'real_estate';
          status: 'inquiry' | 'hold' | 'confirmed' | 'completed' | 'cancelled';
          starts_at: string;
          ends_at: string;
          location: string | null;
          price_cents: number;
          deposit_cents: number;
          deposit_paid_at: string | null;
          balance_paid_at: string | null;
          notes: string | null;
          // Added by 20260731150400_gigs.sql — external ids and hosted checkout links
          // for the calendar and payment adapters.
          calendar_event_id: string | null;
          deposit_payment_id: string | null;
          deposit_payment_url: string | null;
          balance_payment_id: string | null;
          balance_payment_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          title: string;
          type: Database['public']['Tables']['gigs']['Row']['type'];
          status?: Database['public']['Tables']['gigs']['Row']['status'];
          starts_at: string;
          ends_at: string;
          location?: string | null;
          price_cents?: number;
          deposit_cents?: number;
          deposit_paid_at?: string | null;
          balance_paid_at?: string | null;
          notes?: string | null;
          calendar_event_id?: string | null;
          deposit_payment_id?: string | null;
          deposit_payment_url?: string | null;
          balance_payment_id?: string | null;
          balance_payment_url?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['gigs']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      gig_tasks: {
        Row: {
          id: string;
          gig_id: string;
          label: string;
          is_done: boolean;
          due_at: string | null;
          position: number;
        };
        Insert: {
          id?: string;
          gig_id: string;
          label: string;
          is_done?: boolean;
          due_at?: string | null;
          position?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['gig_tasks']['Row'], 'id'>>;
        Relationships: [];
      };

      shoots: {
        Row: {
          id: string;
          title: string;
          type: Database['public']['Tables']['gigs']['Row']['type'];
          status: 'planned' | 'shot' | 'culling' | 'editing' | 'delivered' | 'archived';
          client_id: string | null;
          gig_id: string | null;
          shot_at: string | null;
          location: string | null;
          notes: string | null;
          cover_asset_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type: Database['public']['Tables']['gigs']['Row']['type'];
          status?: Database['public']['Tables']['shoots']['Row']['status'];
          client_id?: string | null;
          gig_id?: string | null;
          shot_at?: string | null;
          location?: string | null;
          notes?: string | null;
          cover_asset_id?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['shoots']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      assets: {
        Row: {
          id: string;
          shoot_id: string;
          storage_path: string;
          filename: string;
          mime_type: string;
          byte_size: number;
          width: number | null;
          height: number | null;
          rating: number;
          is_select: boolean;
          tags: string[];
          alt_text: string | null;
          captured_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          storage_path: string;
          filename: string;
          mime_type?: string;
          byte_size?: number;
          width?: number | null;
          height?: number | null;
          rating?: number;
          is_select?: boolean;
          tags?: string[];
          alt_text?: string | null;
          captured_at?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['assets']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      campaigns: {
        Row: {
          id: string;
          name: string;
          objective:
            | 'book_more_shoots'
            | 'fill_a_date'
            | 'promote_a_package'
            | 'showcase_portfolio'
            | 'seasonal_promo'
            | 'referral_push';
          status: 'draft' | 'ready' | 'scheduled' | 'active' | 'completed' | 'archived';
          brief: string | null;
          audience: string | null;
          platforms: string[];
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          objective: Database['public']['Tables']['campaigns']['Row']['objective'];
          status?: Database['public']['Tables']['campaigns']['Row']['status'];
          brief?: string | null;
          audience?: string | null;
          platforms?: string[];
          starts_on?: string | null;
          ends_on?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      campaign_posts: {
        Row: {
          id: string;
          campaign_id: string;
          platform: 'instagram' | 'facebook' | 'tiktok' | 'pinterest';
          caption: string;
          hashtags: string[];
          asset_ids: string[];
          status: 'draft' | 'approved' | 'scheduled' | 'published' | 'failed';
          scheduled_for: string | null;
          published_at: string | null;
          external_id: string | null;
          failure_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          platform: Database['public']['Tables']['campaign_posts']['Row']['platform'];
          caption?: string;
          hashtags?: string[];
          asset_ids?: string[];
          status?: Database['public']['Tables']['campaign_posts']['Row']['status'];
          scheduled_for?: string | null;
          published_at?: string | null;
          external_id?: string | null;
          failure_reason?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['campaign_posts']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      messages: {
        Row: {
          id: string;
          client_id: string;
          direction: 'inbound' | 'outbound';
          subject: string | null;
          body: string;
          is_handled: boolean;
          is_ai_draft: boolean;
          sent_at: string;
          external_id: string | null;
          channel:
            | 'email'
            | 'form'
            | 'instagram'
            | 'facebook'
            | 'tiktok'
            | 'pinterest';
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          direction: 'inbound' | 'outbound';
          subject?: string | null;
          body: string;
          is_handled?: boolean;
          is_ai_draft?: boolean;
          sent_at?: string;
          external_id?: string | null;
          channel?: Database['public']['Tables']['messages']['Row']['channel'];
        };
        Update: Partial<
          Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      invites: {
        Row: {
          id: string;
          token_hash: string;
          email: string | null;
          role: 'staff';
          note: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token_hash: string;
          email?: string | null;
          role?: 'staff';
          note?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['invites']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      contracts: {
        Row: {
          id: string;
          gig_id: string;
          token_hash: string;
          body: string;
          title: string;
          status: 'draft' | 'sent' | 'accepted' | 'void';
          sent_at: string | null;
          expires_at: string | null;
          accepted_at: string | null;
          accepted_name: string | null;
          accepted_ip_hash: string | null;
          accepted_user_agent: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gig_id: string;
          token_hash: string;
          body: string;
          title?: string;
          status?: Database['public']['Tables']['contracts']['Row']['status'];
          sent_at?: string | null;
          expires_at?: string | null;
          accepted_at?: string | null;
          accepted_name?: string | null;
          accepted_ip_hash?: string | null;
          accepted_user_agent?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['contracts']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      galleries: {
        Row: {
          id: string;
          shoot_id: string;
          token_hash: string;
          title: string;
          message: string | null;
          password_hash: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          allow_downloads: boolean;
          download_quality: 'web' | 'full';
          watermark: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          token_hash: string;
          title?: string;
          message?: string | null;
          password_hash?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          allow_downloads?: boolean;
          download_quality?: Database['public']['Tables']['galleries']['Row']['download_quality'];
          watermark?: boolean;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['galleries']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      gallery_favourites: {
        Row: {
          gallery_id: string;
          asset_id: string;
          created_at: string;
        };
        Insert: {
          gallery_id: string;
          asset_id: string;
        };
        Update: never;
        Relationships: [];
      };

      gallery_approvals: {
        Row: {
          gallery_id: string;
          approved_at: string;
          approved_name: string;
          note: string | null;
          favourite_count: number;
        };
        Insert: {
          gallery_id: string;
          approved_at?: string;
          approved_name?: string;
          note?: string | null;
          favourite_count?: number;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['gallery_approvals']['Row'], 'gallery_id'>
        >;
        Relationships: [];
      };

      gallery_views: {
        Row: {
          id: string;
          gallery_id: string;
          ip_hash: string | null;
          downloaded: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          gallery_id: string;
          ip_hash?: string | null;
          downloaded?: boolean;
        };
        Update: never;
        Relationships: [];
      };

      client_consents: {
        Row: {
          id: string;
          client_id: string;
          purpose: 'marketing';
          granted: boolean;
          source: 'inquiry_form' | 'staff' | 'unsubscribe' | 'import';
          evidence: string | null;
          ip_hash: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          purpose: 'marketing';
          granted: boolean;
          source: Database['public']['Tables']['client_consents']['Row']['source'];
          evidence?: string | null;
          ip_hash?: string | null;
          recorded_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };

      /** Append-only: no update or delete policy exists. */
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          subject_type: string;
          subject_id: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action: string;
          subject_type: string;
          subject_id?: string | null;
          detail?: Json;
        };
        Update: never;
        Relationships: [];
      };

      /** Service-role only: RLS is enabled with no policies. */
      inquiry_attempts: {
        Row: {
          id: string;
          ip_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ip_hash: string;
          created_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['inquiry_attempts']['Row'], 'id'>
        >;
        Relationships: [];
      };

      social_accounts: {
        Row: {
          id: string;
          platform: 'instagram' | 'facebook' | 'tiktok' | 'pinterest';
          handle: string;
          display_name: string;
          followers: number;
          status: 'connected' | 'expired' | 'revoked';
          external_account_id: string | null;
          can_publish: boolean;
          can_collect_messages: boolean;
          connected_by: string | null;
          connected_at: string;
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          platform: Database['public']['Tables']['social_accounts']['Row']['platform'];
          handle: string;
          display_name?: string;
          followers?: number;
          status?: Database['public']['Tables']['social_accounts']['Row']['status'];
          external_account_id?: string | null;
          can_publish?: boolean;
          can_collect_messages?: boolean;
          connected_by?: string | null;
          connected_at?: string;
          last_synced_at?: string | null;
          last_error?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['social_accounts']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      /** Service-role only: RLS is enabled with no policies. */
      social_account_secrets: {
        Row: {
          account_id: string;
          access_token: string;
          refresh_token: string | null;
          expires_at: string | null;
          scopes: string[];
          updated_at: string;
        };
        Insert: {
          account_id: string;
          access_token: string;
          refresh_token?: string | null;
          expires_at?: string | null;
          scopes?: string[];
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['social_account_secrets']['Row'],
            'account_id'
          >
        >;
        Relationships: [];
      };

      mailboxes: {
        Row: {
          id: string;
          email_address: string;
          display_name: string;
          imap_host: string;
          imap_port: number;
          smtp_host: string;
          smtp_port: number;
          status: 'connected' | 'failing' | 'disabled';
          last_error: string | null;
          last_synced_at: string | null;
          connected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email_address: string;
          display_name?: string;
          imap_host: string;
          imap_port?: number;
          smtp_host: string;
          smtp_port?: number;
          status?: Database['public']['Tables']['mailboxes']['Row']['status'];
          last_error?: string | null;
          last_synced_at?: string | null;
          connected_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['mailboxes']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      mailbox_roles: {
        Row: {
          mailbox_id: string;
          is_primary: boolean;
        };
        Insert: {
          mailbox_id: string;
          is_primary?: boolean;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['mailbox_roles']['Row'], 'mailbox_id'>
        >;
        Relationships: [];
      };

      /** Service-role only: RLS is enabled with no policies. */
      mailbox_secrets: {
        Row: {
          mailbox_id: string;
          password: string;
          updated_at: string;
        };
        Insert: {
          mailbox_id: string;
          password: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['mailbox_secrets']['Row'], 'mailbox_id'>
        >;
        Relationships: [];
      };

      client_social_handles: {
        Row: {
          id: string;
          client_id: string;
          platform: 'instagram' | 'facebook' | 'tiktok' | 'pinterest';
          handle: string;
          external_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          platform: Database['public']['Tables']['client_social_handles']['Row']['platform'];
          handle: string;
          external_user_id?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['client_social_handles']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      ads: {
        Row: {
          id: string;
          campaign_id: string | null;
          platform: 'meta' | 'google' | 'tiktok';
          name: string;
          status: 'draft' | 'review' | 'active' | 'paused' | 'ended';
          headline: string;
          primary_text: string;
          call_to_action: string;
          asset_id: string | null;
          daily_budget_cents: number;
          audience: string | null;
          external_id: string | null;
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          platform?: Database['public']['Tables']['ads']['Row']['platform'];
          name: string;
          status?: Database['public']['Tables']['ads']['Row']['status'];
          headline?: string;
          primary_text?: string;
          call_to_action?: string;
          asset_id?: string | null;
          daily_budget_cents?: number;
          audience?: string | null;
          external_id?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['ads']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      ad_metrics: {
        Row: {
          id: string;
          ad_id: string;
          day: string;
          impressions: number;
          clicks: number;
          spend_cents: number;
          leads: number;
        };
        Insert: {
          id?: string;
          ad_id: string;
          day: string;
          impressions?: number;
          clicks?: number;
          spend_cents?: number;
          leads?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['ad_metrics']['Row'], 'id'>>;
        Relationships: [];
      };

      drive_import_jobs: {
        Row: {
          id: string;
          drive_folder_id: string;
          drive_folder_name: string;
          shoot_id: string;
          status: 'pending' | 'running' | 'completed' | 'completed_with_errors';
          total_files: number;
          imported_files: number;
          failed_files: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          drive_folder_id: string;
          drive_folder_name: string;
          shoot_id: string;
          status?: Database['public']['Tables']['drive_import_jobs']['Row']['status'];
          total_files?: number;
          imported_files?: number;
          failed_files?: number;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['drive_import_jobs']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      drive_import_files: {
        Row: {
          id: string;
          job_id: string;
          drive_file_id: string;
          name: string;
          mime_type: string;
          byte_size: number;
          width: number | null;
          height: number | null;
          modified_time: string | null;
          status: 'pending' | 'imported' | 'failed';
          attempts: number;
          asset_id: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          drive_file_id: string;
          name: string;
          mime_type: string;
          byte_size?: number;
          width?: number | null;
          height?: number | null;
          modified_time?: string | null;
          status?: Database['public']['Tables']['drive_import_files']['Row']['status'];
          attempts?: number;
          asset_id?: string | null;
          error?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['drive_import_files']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// --- convenience aliases ------------------------------------------------

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];

export type { Json };
