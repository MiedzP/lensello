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
          /** Prose description of the frame, written by the captioning pass. */
          ai_caption: string | null;
          ai_captioned_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          storage_path: string;
          filename: string;
          ai_caption?: string | null;
          ai_captioned_at?: string | null;
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
          playbook_id: string | null;
          /** Weekdays this campaign posts on, 0 = Sunday. Drives the calendar. */
          posting_days: number[];
          posting_time: string;
          cover_asset_id: string | null;
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
          playbook_id?: string | null;
          posting_days?: number[];
          posting_time?: string;
          cover_asset_id?: string | null;
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
            | 'pinterest'
            | 'sms'
            | 'whatsapp'
            | 'comment';
          /** Null for messages written before threading; the inbox falls back
           *  to grouping by client + channel. */
          conversation_id: string | null;
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
          conversation_id?: string | null;
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
          /** Browsing experience, not a colour theme — each is a distinct layout. */
          display_style: 'mosaic' | 'fine_art' | 'film_strip' | 'contact_sheet' | 'story';
          /** `#rrggbb` or null. Validated in the database. */
          accent_color: string | null;
          cover_asset_id: string | null;
          client_id: string | null;
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
          display_style?: Database['public']['Tables']['galleries']['Row']['display_style'];
          accent_color?: string | null;
          cover_asset_id?: string | null;
          client_id?: string | null;
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

      // --- client portal ---------------------------------------------------

      gallery_sections: {
        Row: {
          id: string;
          gallery_id: string;
          title: string;
          blurb: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          gallery_id: string;
          title: string;
          blurb?: string | null;
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['gallery_sections']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      gallery_section_assets: {
        Row: {
          section_id: string;
          asset_id: string;
          sort_order: number;
        };
        Insert: {
          section_id: string;
          asset_id: string;
          sort_order?: number;
        };
        Update: Partial<
          Database['public']['Tables']['gallery_section_assets']['Row']
        >;
        Relationships: [];
      };

      client_portal_accounts: {
        Row: {
          id: string;
          client_id: string;
          /** Lowercased by the application before write. */
          email: string;
          passcode_hash: string | null;
          setup_token_hash: string | null;
          setup_expires_at: string | null;
          last_seen_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          email: string;
          passcode_hash?: string | null;
          setup_token_hash?: string | null;
          setup_expires_at?: string | null;
          last_seen_at?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['client_portal_accounts']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      client_portal_sessions: {
        Row: {
          id: string;
          account_id: string;
          token_hash: string;
          expires_at: string;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          token_hash: string;
          expires_at: string;
          ip_hash?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['client_portal_sessions']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      client_portal_attempts: {
        Row: {
          id: string;
          email: string | null;
          ip_hash: string | null;
          succeeded: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          ip_hash?: string | null;
          succeeded?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['client_portal_attempts']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      // --- print sales -----------------------------------------------------

      print_products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          category:
            | 'print'
            | 'framed'
            | 'canvas'
            | 'album'
            | 'wall_art'
            | 'digital'
            | 'package'
            | 'other';
          description: string | null;
          size_label: string | null;
          width_mm: number | null;
          height_mm: number | null;
          lab_sku: string | null;
          currency: string;
          /** Minor units (pence) of `currency`. */
          unit_cost: number;
          /** Minor units (pence) of `currency`, tax inclusive. */
          price: number;
          is_digital: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          category?: Database['public']['Tables']['print_products']['Row']['category'];
          description?: string | null;
          size_label?: string | null;
          width_mm?: number | null;
          height_mm?: number | null;
          lab_sku?: string | null;
          currency?: string;
          unit_cost?: number;
          price?: number;
          is_digital?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['print_products']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      print_orders: {
        Row: {
          id: string;
          gallery_id: string | null;
          client_id: string | null;
          status:
            | 'cart'
            | 'awaiting_payment'
            | 'paid'
            | 'submitted_to_lab'
            | 'in_production'
            | 'shipped'
            | 'delivered'
            | 'cancelled'
            | 'refunded';
          currency: string;
          subtotal: number;
          shipping: number;
          tax: number;
          total: number;
          stripe_payment_intent_id: string | null;
          paid_at: string | null;
          lab_order_ref: string | null;
          lab_status: string | null;
          lab_submitted_at: string | null;
          tracking_url: string | null;
          contact_name: string | null;
          contact_email: string | null;
          ship_line1: string | null;
          ship_line2: string | null;
          ship_city: string | null;
          ship_postcode: string | null;
          ship_country: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gallery_id?: string | null;
          client_id?: string | null;
          status?: Database['public']['Tables']['print_orders']['Row']['status'];
          currency?: string;
          subtotal?: number;
          shipping?: number;
          tax?: number;
          total?: number;
          stripe_payment_intent_id?: string | null;
          paid_at?: string | null;
          lab_order_ref?: string | null;
          lab_status?: string | null;
          lab_submitted_at?: string | null;
          tracking_url?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          ship_line1?: string | null;
          ship_line2?: string | null;
          ship_city?: string | null;
          ship_postcode?: string | null;
          ship_country?: string;
          notes?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['print_orders']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      print_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          asset_id: string;
          quantity: number;
          /** Snapshot of the catalogue price at the moment of ordering. */
          unit_price: number;
          product_name: string;
          size_label: string | null;
          /** Normalised 0-1 rect: `{x, y, w, h}`. */
          crop: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          asset_id: string;
          quantity?: number;
          unit_price: number;
          product_name?: string;
          size_label?: string | null;
          crop?: Json | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['print_order_items']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      print_order_events: {
        Row: {
          id: string;
          order_id: string;
          kind: string;
          detail: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          kind: string;
          detail?: string | null;
          payload?: Json | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['print_order_events']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      // --- campaign planner ------------------------------------------------

      campaign_playbooks: {
        Row: {
          id: string;
          slug: string;
          name: string;
          summary: string | null;
          season:
            | 'wedding_fair'
            | 'engagement'
            | 'new_year'
            | 'valentines'
            | 'spring'
            | 'summer'
            | 'autumn'
            | 'christmas'
            | 'evergreen'
            | 'other';
          objective:
            | Database['public']['Tables']['campaigns']['Row']['objective']
            | null;
          audience_template: string | null;
          brief_template: string | null;
          duration_days: number;
          /** Weekdays, 0 = Sunday. */
          posting_days: number[];
          platforms: string[];
          cover_emoji: string | null;
          accent_color: string | null;
          is_builtin: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          summary?: string | null;
          season?: Database['public']['Tables']['campaign_playbooks']['Row']['season'];
          objective?:
            | Database['public']['Tables']['campaigns']['Row']['objective']
            | null;
          audience_template?: string | null;
          brief_template?: string | null;
          duration_days?: number;
          posting_days?: number[];
          platforms?: string[];
          cover_emoji?: string | null;
          accent_color?: string | null;
          is_builtin?: boolean;
          is_active?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['campaign_playbooks']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      playbook_tasks: {
        Row: {
          id: string;
          playbook_id: string;
          /** Days relative to campaign start; negative is the run-up. */
          day_offset: number;
          title: string;
          detail: string | null;
          kind:
            | 'post'
            | 'story'
            | 'email'
            | 'outreach'
            | 'ad'
            | 'call'
            | 'shoot'
            | 'admin'
            | 'print';
          platform: 'instagram' | 'facebook' | 'tiktok' | 'pinterest' | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          day_offset?: number;
          title: string;
          detail?: string | null;
          kind?: Database['public']['Tables']['playbook_tasks']['Row']['kind'];
          platform?: Database['public']['Tables']['playbook_tasks']['Row']['platform'];
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['playbook_tasks']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      campaign_tasks: {
        Row: {
          id: string;
          campaign_id: string;
          /** Provenance only — the task is a copy and survives template edits. */
          playbook_task_id: string | null;
          title: string;
          detail: string | null;
          kind: Database['public']['Tables']['playbook_tasks']['Row']['kind'];
          due_on: string | null;
          due_time: string | null;
          client_id: string | null;
          post_id: string | null;
          assigned_to: string | null;
          done_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          playbook_task_id?: string | null;
          title: string;
          detail?: string | null;
          kind?: Database['public']['Tables']['campaign_tasks']['Row']['kind'];
          due_on?: string | null;
          due_time?: string | null;
          client_id?: string | null;
          post_id?: string | null;
          assigned_to?: string | null;
          done_at?: string | null;
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['campaign_tasks']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      // --- conversations ---------------------------------------------------

      conversations: {
        Row: {
          id: string;
          client_id: string;
          channel: Database['public']['Tables']['messages']['Row']['channel'];
          external_thread_id: string | null;
          subject: string | null;
          status: 'open' | 'snoozed' | 'closed';
          snoozed_until: string | null;
          assigned_to: string | null;
          last_message_at: string | null;
          last_inbound_at: string | null;
          unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          channel: Database['public']['Tables']['messages']['Row']['channel'];
          external_thread_id?: string | null;
          subject?: string | null;
          status?: Database['public']['Tables']['conversations']['Row']['status'];
          snoozed_until?: string | null;
          assigned_to?: string | null;
          last_message_at?: string | null;
          last_inbound_at?: string | null;
          unread_count?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['conversations']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      contact_identities: {
        Row: {
          id: string;
          client_id: string;
          channel:
            | 'email'
            | 'phone'
            | 'instagram'
            | 'facebook'
            | 'tiktok'
            | 'pinterest'
            | 'whatsapp';
          /** Stored normalised: lowercased addresses, E.164 phones, bare handles. */
          identifier: string;
          display_name: string | null;
          verified: boolean;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          channel: Database['public']['Tables']['contact_identities']['Row']['channel'];
          identifier: string;
          display_name?: string | null;
          verified?: boolean;
          is_primary?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['contact_identities']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      // --- creative studio -------------------------------------------------

      asset_ai_labels: {
        Row: {
          id: string;
          asset_id: string;
          label: string;
          kind:
            | 'subject'
            | 'scene'
            | 'moment'
            | 'emotion'
            | 'object'
            | 'colour'
            | 'people';
          confidence: number;
          /** `manual` outranks `ai` and must never be overwritten by a re-run. */
          source: 'ai' | 'manual';
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          label: string;
          kind?: Database['public']['Tables']['asset_ai_labels']['Row']['kind'];
          confidence?: number;
          source?: Database['public']['Tables']['asset_ai_labels']['Row']['source'];
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['asset_ai_labels']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      studio_requests: {
        Row: {
          id: string;
          /** Verbatim, never rewritten. */
          prompt: string;
          interpreted: Json | null;
          campaign_id: string | null;
          shoot_id: string | null;
          status:
            | 'drafting'
            | 'searching'
            | 'ready'
            | 'approved'
            | 'rejected'
            | 'failed';
          failure_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prompt: string;
          interpreted?: Json | null;
          campaign_id?: string | null;
          shoot_id?: string | null;
          status?: Database['public']['Tables']['studio_requests']['Row']['status'];
          failure_reason?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['studio_requests']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      studio_shortlist: {
        Row: {
          id: string;
          request_id: string;
          asset_id: string;
          rank: number;
          rationale: string | null;
          score: number | null;
          decision: 'pending' | 'approved' | 'rejected';
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          asset_id: string;
          rank?: number;
          rationale?: string | null;
          score?: number | null;
          decision?: Database['public']['Tables']['studio_shortlist']['Row']['decision'];
          decided_at?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['studio_shortlist']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      generated_images: {
        Row: {
          id: string;
          request_id: string | null;
          storage_path: string;
          prompt: string;
          provider: string;
          model: string | null;
          width: number | null;
          height: number | null;
          /** Set only when explicitly promoted into the photo library. */
          asset_id: string | null;
          decision: 'pending' | 'approved' | 'rejected';
          decided_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          storage_path: string;
          prompt: string;
          provider?: string;
          model?: string | null;
          width?: number | null;
          height?: number | null;
          asset_id?: string | null;
          decision?: Database['public']['Tables']['generated_images']['Row']['decision'];
          decided_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['generated_images']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      // --- automations -----------------------------------------------------

      automations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          trigger_kind:
            | 'message_received'
            | 'inquiry_created'
            | 'client_stage_changed'
            | 'gig_booked'
            | 'gig_upcoming'
            | 'gallery_viewed'
            | 'gallery_approved'
            | 'order_paid'
            | 'campaign_task_due'
            | 'schedule'
            | 'webhook'
            | 'manual';
          trigger_config: Json;
          /** Off until switched on, deliberately. */
          enabled: boolean;
          max_runs_per_day: number | null;
          last_run_at: string | null;
          run_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          trigger_kind: Database['public']['Tables']['automations']['Row']['trigger_kind'];
          trigger_config?: Json;
          enabled?: boolean;
          max_runs_per_day?: number | null;
          last_run_at?: string | null;
          run_count?: number;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['automations']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      automation_steps: {
        Row: {
          id: string;
          automation_id: string;
          sort_order: number;
          action_kind:
            | 'send_email'
            | 'send_sms'
            | 'send_dm'
            | 'create_task'
            | 'create_client'
            | 'update_client_stage'
            | 'add_tag'
            | 'draft_reply'
            | 'notify_staff'
            | 'webhook'
            | 'wait'
            | 'branch';
          config: Json;
          continue_on_error: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation_id: string;
          sort_order?: number;
          action_kind: Database['public']['Tables']['automation_steps']['Row']['action_kind'];
          config?: Json;
          continue_on_error?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['automation_steps']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      automation_runs: {
        Row: {
          id: string;
          automation_id: string;
          status: 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
          skip_reason: string | null;
          trigger_payload: Json | null;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          automation_id: string;
          status?: Database['public']['Tables']['automation_runs']['Row']['status'];
          skip_reason?: string | null;
          trigger_payload?: Json | null;
          error?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['automation_runs']['Row'], 'id'>
        >;
        Relationships: [];
      };

      automation_run_steps: {
        Row: {
          id: string;
          run_id: string;
          /** Null if the definition was edited after the run. */
          step_id: string | null;
          sort_order: number;
          action_kind: string;
          status: 'running' | 'succeeded' | 'failed' | 'skipped';
          output: Json | null;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          step_id?: string | null;
          sort_order?: number;
          action_kind: string;
          status?: Database['public']['Tables']['automation_run_steps']['Row']['status'];
          output?: Json | null;
          error?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['automation_run_steps']['Row'], 'id'>
        >;
        Relationships: [];
      };

      api_keys: {
        Row: {
          id: string;
          name: string;
          /** Display-only. Cannot reconstruct the key. */
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          last_used_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at'>
        >;
        Relationships: [];
      };

      // --- academy ---------------------------------------------------------

      academy_modules: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string | null;
          /** lucide-react icon name. */
          icon: string | null;
          accent_color: string | null;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          summary?: string | null;
          icon?: string | null;
          accent_color?: string | null;
          sort_order?: number;
          is_published?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_modules']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      academy_lessons: {
        Row: {
          id: string;
          module_id: string;
          slug: string;
          title: string;
          summary: string | null;
          body_md: string;
          estimated_minutes: number | null;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          slug: string;
          title: string;
          summary?: string | null;
          body_md?: string;
          estimated_minutes?: number | null;
          sort_order?: number;
          is_published?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_lessons']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      academy_resources: {
        Row: {
          id: string;
          /** Exactly one of lesson_id / module_id is set. */
          lesson_id: string | null;
          module_id: string | null;
          title: string;
          description: string | null;
          kind: 'template' | 'checklist' | 'link' | 'download' | 'video' | 'community';
          url: string | null;
          storage_path: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id?: string | null;
          module_id?: string | null;
          title: string;
          description?: string | null;
          kind?: Database['public']['Tables']['academy_resources']['Row']['kind'];
          url?: string | null;
          storage_path?: string | null;
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_resources']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      academy_progress: {
        Row: {
          lesson_id: string;
          user_id: string;
          status: 'in_progress' | 'complete';
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          lesson_id: string;
          user_id: string;
          status?: Database['public']['Tables']['academy_progress']['Row']['status'];
          completed_at?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_progress']['Row'],
            'lesson_id' | 'user_id'
          >
        >;
        Relationships: [];
      };

      academy_worksheets: {
        Row: {
          id: string;
          lesson_id: string;
          slug: string;
          title: string;
          intro: string | null;
          /** Field definitions: `[{key, label, type, help, options?}]`. */
          schema: Json;
          /** Which business_profile column these answers roll up into. */
          profile_key:
            | 'swot'
            | 'seven_ps'
            | 'positioning'
            | 'target_client'
            | 'customer_journey'
            | 'brand_voice'
            | 'price_point'
            | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          slug: string;
          title: string;
          intro?: string | null;
          schema?: Json;
          profile_key?: Database['public']['Tables']['academy_worksheets']['Row']['profile_key'];
          sort_order?: number;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_worksheets']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      academy_worksheet_responses: {
        Row: {
          id: string;
          worksheet_id: string;
          user_id: string;
          answers: Json;
          /** Only submitted responses roll up to the business profile. */
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worksheet_id: string;
          user_id: string;
          answers?: Json;
          submitted_at?: string | null;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['academy_worksheet_responses']['Row'],
            'id' | 'created_at'
          >
        >;
        Relationships: [];
      };

      business_profile: {
        Row: {
          /** Always `true` — the table holds exactly one row. */
          id: boolean;
          business_name: string | null;
          positioning: string | null;
          target_client: string | null;
          price_point: string | null;
          unique_value: string | null;
          brand_voice: string | null;
          service_area: string | null;
          /** `{strengths, weaknesses, opportunities, threats}` */
          swot: Json | null;
          /** `{product, price, place, promotion, people, process, physical_evidence}` */
          seven_ps: Json | null;
          customer_journey: Json | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          business_name?: string | null;
          positioning?: string | null;
          target_client?: string | null;
          price_point?: string | null;
          unique_value?: string | null;
          brand_voice?: string | null;
          service_area?: string | null;
          swot?: Json | null;
          seven_ps?: Json | null;
          customer_journey?: Json | null;
          updated_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['business_profile']['Row'], 'id'>
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
