/**
 * Database types for the Lensello schema.
 *
 * Hand-written to mirror supabase/migrations/0001_init.sql in the shape the
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
          // Added by 0005_gigs.sql — external ids and hosted checkout links
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
        };
        Update: Partial<
          Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
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
