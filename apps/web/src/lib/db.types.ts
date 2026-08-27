export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academy_lessons: {
        Row: {
          body_md: string
          created_at: string
          estimated_minutes: number | null
          id: string
          is_published: boolean
          module_id: string
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          module_id: string
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          module_id?: string
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          accent_color: string | null
          created_at: string
          icon: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      academy_progress: {
        Row: {
          completed_at: string | null
          lesson_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          lesson_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          lesson_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          lesson_id: string | null
          module_id: string | null
          sort_order: number
          storage_path: string | null
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          lesson_id?: string | null
          module_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          lesson_id?: string | null
          module_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_resources_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_worksheet_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          worksheet_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          worksheet_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_worksheet_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_worksheet_responses_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "academy_worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_worksheets: {
        Row: {
          created_at: string
          id: string
          intro: string | null
          lesson_id: string
          profile_key: string | null
          schema: Json
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro?: string | null
          lesson_id: string
          profile_key?: string | null
          schema?: Json
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          intro?: string | null
          lesson_id?: string
          profile_key?: string | null
          schema?: Json
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_worksheets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics: {
        Row: {
          ad_id: string
          clicks: number
          day: string
          id: string
          impressions: number
          leads: number
          spend_cents: number
        }
        Insert: {
          ad_id: string
          clicks?: number
          day: string
          id?: string
          impressions?: number
          leads?: number
          spend_cents?: number
        }
        Update: {
          ad_id?: string
          clicks?: number
          day?: string
          id?: string
          impressions?: number
          leads?: number
          spend_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          asset_id: string | null
          audience: string | null
          call_to_action: string
          campaign_id: string | null
          created_at: string
          daily_budget_cents: number
          ends_on: string | null
          external_id: string | null
          headline: string
          id: string
          name: string
          platform: string
          primary_text: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          audience?: string | null
          call_to_action?: string
          campaign_id?: string | null
          created_at?: string
          daily_budget_cents?: number
          ends_on?: string | null
          external_id?: string | null
          headline?: string
          id?: string
          name: string
          platform?: string
          primary_text?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          audience?: string | null
          call_to_action?: string
          campaign_id?: string | null
          created_at?: string
          daily_budget_cents?: number
          ends_on?: string | null
          external_id?: string | null
          headline?: string
          id?: string
          name?: string
          platform?: string
          primary_text?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_ai_labels: {
        Row: {
          asset_id: string
          confidence: number
          created_at: string
          id: string
          kind: string
          label: string
          source: string
        }
        Insert: {
          asset_id: string
          confidence?: number
          created_at?: string
          id?: string
          kind?: string
          label: string
          source?: string
        }
        Update: {
          asset_id?: string
          confidence?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_ai_labels_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          ai_caption: string | null
          ai_captioned_at: string | null
          alt_text: string | null
          byte_size: number
          captured_at: string | null
          created_at: string
          filename: string
          height: number | null
          id: string
          is_select: boolean
          mime_type: string
          rating: number
          shoot_id: string
          storage_path: string
          tags: string[]
          width: number | null
        }
        Insert: {
          ai_caption?: string | null
          ai_captioned_at?: string | null
          alt_text?: string | null
          byte_size?: number
          captured_at?: string | null
          created_at?: string
          filename: string
          height?: number | null
          id?: string
          is_select?: boolean
          mime_type?: string
          rating?: number
          shoot_id: string
          storage_path: string
          tags?: string[]
          width?: number | null
        }
        Update: {
          ai_caption?: string | null
          ai_captioned_at?: string | null
          alt_text?: string | null
          byte_size?: number
          captured_at?: string | null
          created_at?: string
          filename?: string
          height?: number | null
          id?: string
          is_select?: boolean
          mime_type?: string
          rating?: number
          shoot_id?: string
          storage_path?: string
          tags?: string[]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          subject_id: string | null
          subject_type: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          subject_id?: string | null
          subject_type: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          subject_id?: string | null
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_steps: {
        Row: {
          action_kind: string
          error: string | null
          finished_at: string | null
          id: string
          output: Json | null
          run_id: string
          sort_order: number
          started_at: string
          status: string
          step_id: string | null
        }
        Insert: {
          action_kind: string
          error?: string | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          run_id: string
          sort_order?: number
          started_at?: string
          status?: string
          step_id?: string | null
        }
        Update: {
          action_kind?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          run_id?: string
          sort_order?: number
          started_at?: string
          status?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          error: string | null
          finished_at: string | null
          id: string
          skip_reason: string | null
          started_at: string
          status: string
          trigger_payload: Json | null
        }
        Insert: {
          automation_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          skip_reason?: string | null
          started_at?: string
          status?: string
          trigger_payload?: Json | null
        }
        Update: {
          automation_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          skip_reason?: string | null
          started_at?: string
          status?: string
          trigger_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          action_kind: string
          automation_id: string
          config: Json
          continue_on_error: boolean
          created_at: string
          id: string
          sort_order: number
        }
        Insert: {
          action_kind: string
          automation_id: string
          config?: Json
          continue_on_error?: boolean
          created_at?: string
          id?: string
          sort_order?: number
        }
        Update: {
          action_kind?: string
          automation_id?: string
          config?: Json
          continue_on_error?: boolean
          created_at?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          max_runs_per_day: number | null
          name: string
          run_count: number
          trigger_config: Json
          trigger_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          max_runs_per_day?: number | null
          name: string
          run_count?: number
          trigger_config?: Json
          trigger_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          max_runs_per_day?: number | null
          name?: string
          run_count?: number
          trigger_config?: Json
          trigger_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_goals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          photography_type: string
          priority: string
          status: string
          target_monthly_bookings: number | null
          target_monthly_revenue_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          photography_type: string
          priority: string
          status?: string
          target_monthly_bookings?: number | null
          target_monthly_revenue_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          photography_type?: string
          priority?: string
          status?: string
          target_monthly_bookings?: number | null
          target_monthly_revenue_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      business_profile: {
        Row: {
          annual_revenue_target_cents: number | null
          average_booking_value_cents: number | null
          brand_voice: string | null
          business_name: string | null
          current_booking_rate: number | null
          customer_journey: Json | null
          desired_monthly_bookings: number | null
          desired_work_types: string | null
          elevate_google_rating: number | null
          elevate_portfolio_shoot_count: number | null
          elevate_positioning_clarity: string | null
          elevate_review_count: number | null
          email_crm_linked: boolean | null
          geographic_service_area: string | null
          google_analytics_linked: boolean | null
          google_business_linked: boolean | null
          id: boolean
          ideal_client_description: string | null
          known_quiet_periods: string[] | null
          lead_monthly_enquiries: number | null
          lead_organic_pct: number | null
          lead_paid_pct: number | null
          lead_referral_pct: number | null
          lead_sources: string[] | null
          location_country: string | null
          location_region: string | null
          meta_account_linked: boolean | null
          nurture_consultation_rate_pct: number | null
          nurture_conversion_pct: number | null
          nurture_followup_system: string | null
          nurture_response_time_hours: number | null
          photography_categories: string[] | null
          positioning: string | null
          price_point: string | null
          scale_automation_level: string | null
          scale_average_booking_value_cents: number | null
          scale_monthly_capacity_bookings: number | null
          scale_profit_margin_pct: number | null
          service_area: string | null
          seven_ps: Json | null
          swot: Json | null
          target_client: string | null
          unique_value: string | null
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          annual_revenue_target_cents?: number | null
          average_booking_value_cents?: number | null
          brand_voice?: string | null
          business_name?: string | null
          current_booking_rate?: number | null
          customer_journey?: Json | null
          desired_monthly_bookings?: number | null
          desired_work_types?: string | null
          elevate_google_rating?: number | null
          elevate_portfolio_shoot_count?: number | null
          elevate_positioning_clarity?: string | null
          elevate_review_count?: number | null
          email_crm_linked?: boolean | null
          geographic_service_area?: string | null
          google_analytics_linked?: boolean | null
          google_business_linked?: boolean | null
          id?: boolean
          ideal_client_description?: string | null
          known_quiet_periods?: string[] | null
          lead_monthly_enquiries?: number | null
          lead_organic_pct?: number | null
          lead_paid_pct?: number | null
          lead_referral_pct?: number | null
          lead_sources?: string[] | null
          location_country?: string | null
          location_region?: string | null
          meta_account_linked?: boolean | null
          nurture_consultation_rate_pct?: number | null
          nurture_conversion_pct?: number | null
          nurture_followup_system?: string | null
          nurture_response_time_hours?: number | null
          photography_categories?: string[] | null
          positioning?: string | null
          price_point?: string | null
          scale_automation_level?: string | null
          scale_average_booking_value_cents?: number | null
          scale_monthly_capacity_bookings?: number | null
          scale_profit_margin_pct?: number | null
          service_area?: string | null
          seven_ps?: Json | null
          swot?: Json | null
          target_client?: string | null
          unique_value?: string | null
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          annual_revenue_target_cents?: number | null
          average_booking_value_cents?: number | null
          brand_voice?: string | null
          business_name?: string | null
          current_booking_rate?: number | null
          customer_journey?: Json | null
          desired_monthly_bookings?: number | null
          desired_work_types?: string | null
          elevate_google_rating?: number | null
          elevate_portfolio_shoot_count?: number | null
          elevate_positioning_clarity?: string | null
          elevate_review_count?: number | null
          email_crm_linked?: boolean | null
          geographic_service_area?: string | null
          google_analytics_linked?: boolean | null
          google_business_linked?: boolean | null
          id?: boolean
          ideal_client_description?: string | null
          known_quiet_periods?: string[] | null
          lead_monthly_enquiries?: number | null
          lead_organic_pct?: number | null
          lead_paid_pct?: number | null
          lead_referral_pct?: number | null
          lead_sources?: string[] | null
          location_country?: string | null
          location_region?: string | null
          meta_account_linked?: boolean | null
          nurture_consultation_rate_pct?: number | null
          nurture_conversion_pct?: number | null
          nurture_followup_system?: string | null
          nurture_response_time_hours?: number | null
          photography_categories?: string[] | null
          positioning?: string | null
          price_point?: string | null
          scale_automation_level?: string | null
          scale_average_booking_value_cents?: number | null
          scale_monthly_capacity_bookings?: number | null
          scale_profit_margin_pct?: number | null
          service_area?: string | null
          seven_ps?: Json | null
          swot?: Json | null
          target_client?: string | null
          unique_value?: string | null
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_playbooks: {
        Row: {
          accent_color: string | null
          audience_template: string | null
          brief_template: string | null
          cover_emoji: string | null
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          is_builtin: boolean
          name: string
          objective: string | null
          platforms: string[]
          posting_days: number[]
          season: string
          slug: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          audience_template?: string | null
          brief_template?: string | null
          cover_emoji?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          name: string
          objective?: string | null
          platforms?: string[]
          posting_days?: number[]
          season?: string
          slug: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          audience_template?: string | null
          brief_template?: string | null
          cover_emoji?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          name?: string
          objective?: string | null
          platforms?: string[]
          posting_days?: number[]
          season?: string
          slug?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_posts: {
        Row: {
          asset_ids: string[]
          campaign_id: string
          caption: string
          created_at: string
          external_id: string | null
          failure_reason: string | null
          hashtags: string[]
          id: string
          platform: string
          published_at: string | null
          scheduled_for: string | null
          status: string
        }
        Insert: {
          asset_ids?: string[]
          campaign_id: string
          caption?: string
          created_at?: string
          external_id?: string | null
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          platform: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Update: {
          asset_ids?: string[]
          campaign_id?: string
          caption?: string
          created_at?: string
          external_id?: string | null
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          platform?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tasks: {
        Row: {
          assigned_to: string | null
          campaign_id: string
          client_id: string | null
          created_at: string
          detail: string | null
          done_at: string | null
          due_on: string | null
          due_time: string | null
          id: string
          kind: string
          playbook_task_id: string | null
          post_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id: string
          client_id?: string | null
          created_at?: string
          detail?: string | null
          done_at?: string | null
          due_on?: string | null
          due_time?: string | null
          id?: string
          kind?: string
          playbook_task_id?: string | null
          post_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string
          client_id?: string | null
          created_at?: string
          detail?: string | null
          done_at?: string | null
          due_on?: string | null
          due_time?: string | null
          id?: string
          kind?: string
          playbook_task_id?: string | null
          post_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tasks_playbook_task_id_fkey"
            columns: ["playbook_task_id"]
            isOneToOne: false
            referencedRelation: "playbook_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tasks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "campaign_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience: string | null
          brief: string | null
          cover_asset_id: string | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          objective: string
          platforms: string[]
          playbook_id: string | null
          posting_days: number[]
          posting_time: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          brief?: string | null
          cover_asset_id?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          objective: string
          platforms?: string[]
          playbook_id?: string | null
          posting_days?: number[]
          posting_time?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          brief?: string | null
          cover_asset_id?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          objective?: string
          platforms?: string[]
          playbook_id?: string | null
          posting_days?: number[]
          posting_time?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "campaign_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consents: {
        Row: {
          client_id: string
          created_at: string
          evidence: string | null
          granted: boolean
          id: string
          ip_hash: string | null
          purpose: string
          recorded_by: string | null
          source: string
        }
        Insert: {
          client_id: string
          created_at?: string
          evidence?: string | null
          granted: boolean
          id?: string
          ip_hash?: string | null
          purpose: string
          recorded_by?: string | null
          source: string
        }
        Update: {
          client_id?: string
          created_at?: string
          evidence?: string | null
          granted?: boolean
          id?: string
          ip_hash?: string | null
          purpose?: string
          recorded_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_accounts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          last_seen_at: string | null
          passcode_hash: string | null
          revoked_at: string | null
          setup_expires_at: string | null
          setup_token_hash: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          last_seen_at?: string | null
          passcode_hash?: string | null
          revoked_at?: string | null
          setup_expires_at?: string | null
          setup_token_hash?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          last_seen_at?: string | null
          passcode_hash?: string | null
          revoked_at?: string | null
          setup_expires_at?: string | null
          setup_token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_hash: string | null
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash?: string | null
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash?: string | null
          succeeded?: boolean
        }
        Relationships: []
      }
      client_portal_sessions: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          token_hash: string
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          token_hash: string
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "client_portal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_social_handles: {
        Row: {
          client_id: string
          created_at: string
          external_user_id: string | null
          handle: string
          id: string
          platform: string
        }
        Insert: {
          client_id: string
          created_at?: string
          external_user_id?: string | null
          handle: string
          id?: string
          platform: string
        }
        Update: {
          client_id?: string
          created_at?: string
          external_user_id?: string | null
          handle?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_social_handles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_contacted_at: string | null
          marketing_consent: boolean
          name: string
          notes: string | null
          phone: string | null
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          marketing_consent?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          marketing_consent?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_identities: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          display_name: string | null
          id: string
          identifier: string
          is_primary: boolean
          verified: boolean
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          identifier: string
          is_primary?: boolean
          verified?: boolean
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          identifier?: string
          is_primary?: boolean
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          accepted_at: string | null
          accepted_ip_hash: string | null
          accepted_name: string | null
          accepted_user_agent: string | null
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          gig_id: string
          id: string
          sent_at: string | null
          status: string
          title: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip_hash?: string | null
          accepted_name?: string | null
          accepted_user_agent?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          gig_id: string
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip_hash?: string | null
          accepted_name?: string | null
          accepted_user_agent?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          gig_id?: string
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          client_id: string
          created_at: string
          external_thread_id: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          snoozed_until: string | null
          status: string
          subject: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel: string
          client_id: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          client_id?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_import_files: {
        Row: {
          asset_id: string | null
          attempts: number
          byte_size: number
          created_at: string
          drive_file_id: string
          error: string | null
          height: number | null
          id: string
          job_id: string
          mime_type: string
          modified_time: string | null
          name: string
          status: string
          updated_at: string
          width: number | null
        }
        Insert: {
          asset_id?: string | null
          attempts?: number
          byte_size?: number
          created_at?: string
          drive_file_id: string
          error?: string | null
          height?: number | null
          id?: string
          job_id: string
          mime_type: string
          modified_time?: string | null
          name: string
          status?: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          asset_id?: string | null
          attempts?: number
          byte_size?: number
          created_at?: string
          drive_file_id?: string
          error?: string | null
          height?: number | null
          id?: string
          job_id?: string
          mime_type?: string
          modified_time?: string | null
          name?: string
          status?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_import_files_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_import_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "drive_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          drive_folder_id: string
          drive_folder_name: string
          failed_files: number
          id: string
          imported_files: number
          shoot_id: string
          status: string
          total_files: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drive_folder_id: string
          drive_folder_name: string
          failed_files?: number
          id?: string
          imported_files?: number
          shoot_id: string
          status?: string
          total_files?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string
          drive_folder_name?: string
          failed_files?: number
          id?: string
          imported_files?: number
          shoot_id?: string
          status?: string
          total_files?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_import_jobs_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          accent_color: string | null
          allow_downloads: boolean
          client_id: string | null
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          display_style: string
          download_quality: string
          expires_at: string | null
          id: string
          message: string | null
          password_hash: string | null
          revoked_at: string | null
          shoot_id: string
          title: string
          token_hash: string
          updated_at: string
          watermark: boolean
        }
        Insert: {
          accent_color?: string | null
          allow_downloads?: boolean
          client_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          display_style?: string
          download_quality?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          password_hash?: string | null
          revoked_at?: string | null
          shoot_id: string
          title?: string
          token_hash: string
          updated_at?: string
          watermark?: boolean
        }
        Update: {
          accent_color?: string | null
          allow_downloads?: boolean
          client_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          display_style?: string
          download_quality?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          password_hash?: string | null
          revoked_at?: string | null
          shoot_id?: string
          title?: string
          token_hash?: string
          updated_at?: string
          watermark?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "galleries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_approvals: {
        Row: {
          approved_at: string
          approved_name: string
          favourite_count: number
          gallery_id: string
          note: string | null
        }
        Insert: {
          approved_at?: string
          approved_name?: string
          favourite_count?: number
          gallery_id: string
          note?: string | null
        }
        Update: {
          approved_at?: string
          approved_name?: string
          favourite_count?: number
          gallery_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_approvals_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: true
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_favourites: {
        Row: {
          asset_id: string
          created_at: string
          gallery_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          gallery_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          gallery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_favourites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_favourites_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_section_assets: {
        Row: {
          asset_id: string
          section_id: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          section_id: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_section_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_section_assets_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "gallery_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_sections: {
        Row: {
          blurb: string | null
          created_at: string
          gallery_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          gallery_id: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          gallery_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_sections_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_views: {
        Row: {
          created_at: string
          downloaded: boolean
          gallery_id: string
          id: string
          ip_hash: string | null
        }
        Insert: {
          created_at?: string
          downloaded?: boolean
          gallery_id: string
          id?: string
          ip_hash?: string | null
        }
        Update: {
          created_at?: string
          downloaded?: boolean
          gallery_id?: string
          id?: string
          ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_views_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_images: {
        Row: {
          asset_id: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decision: string
          height: number | null
          id: string
          model: string | null
          prompt: string
          provider: string
          request_id: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string
          height?: number | null
          id?: string
          model?: string | null
          prompt: string
          provider?: string
          request_id?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string
          height?: number | null
          id?: string
          model?: string | null
          prompt?: string
          provider?: string
          request_id?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_images_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "studio_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_tasks: {
        Row: {
          due_at: string | null
          gig_id: string
          id: string
          is_done: boolean
          label: string
          position: number
        }
        Insert: {
          due_at?: string | null
          gig_id: string
          id?: string
          is_done?: boolean
          label: string
          position?: number
        }
        Update: {
          due_at?: string | null
          gig_id?: string
          id?: string
          is_done?: boolean
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "gig_tasks_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          balance_paid_at: string | null
          balance_payment_id: string | null
          balance_payment_url: string | null
          calendar_event_id: string | null
          client_id: string | null
          created_at: string
          deposit_cents: number
          deposit_paid_at: string | null
          deposit_payment_id: string | null
          deposit_payment_url: string | null
          ends_at: string
          id: string
          location: string | null
          notes: string | null
          price_cents: number
          starts_at: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          balance_paid_at?: string | null
          balance_payment_id?: string | null
          balance_payment_url?: string | null
          calendar_event_id?: string | null
          client_id?: string | null
          created_at?: string
          deposit_cents?: number
          deposit_paid_at?: string | null
          deposit_payment_id?: string | null
          deposit_payment_url?: string | null
          ends_at: string
          id?: string
          location?: string | null
          notes?: string | null
          price_cents?: number
          starts_at: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          balance_paid_at?: string | null
          balance_payment_id?: string | null
          balance_payment_url?: string | null
          calendar_event_id?: string | null
          client_id?: string | null
          created_at?: string
          deposit_cents?: number
          deposit_paid_at?: string | null
          deposit_payment_id?: string | null
          deposit_payment_url?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          price_cents?: number
          starts_at?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_attempts: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          note: string | null
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          revoked_at?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_roles: {
        Row: {
          is_primary: boolean
          mailbox_id: string
        }
        Insert: {
          is_primary?: boolean
          mailbox_id: string
        }
        Update: {
          is_primary?: boolean
          mailbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_roles_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: true
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_secrets: {
        Row: {
          mailbox_id: string
          password: string
          updated_at: string
        }
        Insert: {
          mailbox_id: string
          password: string
          updated_at?: string
        }
        Update: {
          mailbox_id?: string
          password?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_secrets_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: true
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          connected_by: string | null
          created_at: string
          display_name: string
          email_address: string
          id: string
          imap_host: string
          imap_port: number
          last_error: string | null
          last_synced_at: string | null
          smtp_host: string
          smtp_port: number
          status: string
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          display_name?: string
          email_address: string
          id?: string
          imap_host: string
          imap_port?: number
          last_error?: string | null
          last_synced_at?: string | null
          smtp_host: string
          smtp_port?: number
          status?: string
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          display_name?: string
          email_address?: string
          id?: string
          imap_host?: string
          imap_port?: number
          last_error?: string | null
          last_synced_at?: string | null
          smtp_host?: string
          smtp_port?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          client_id: string
          conversation_id: string | null
          created_at: string
          direction: string
          external_id: string | null
          id: string
          is_ai_draft: boolean
          is_handled: boolean
          sent_at: string
          subject: string | null
        }
        Insert: {
          body: string
          channel?: string
          client_id: string
          conversation_id?: string | null
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          is_ai_draft?: boolean
          is_handled?: boolean
          sent_at?: string
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          client_id?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          is_ai_draft?: boolean
          is_handled?: boolean
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_tasks: {
        Row: {
          created_at: string
          day_offset: number
          detail: string | null
          id: string
          kind: string
          platform: string | null
          playbook_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          day_offset?: number
          detail?: string | null
          id?: string
          kind?: string
          platform?: string | null
          playbook_id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          day_offset?: number
          detail?: string | null
          id?: string
          kind?: string
          platform?: string | null
          playbook_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_tasks_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "campaign_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      print_order_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          order_id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          order_id: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          order_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "print_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      print_order_items: {
        Row: {
          asset_id: string
          created_at: string
          crop: Json | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          size_label: string | null
          unit_price: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          crop?: Json | null
          id?: string
          order_id: string
          product_id: string
          product_name?: string
          quantity?: number
          size_label?: string | null
          unit_price: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          crop?: Json | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          size_label?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_order_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
        ]
      }
      print_orders: {
        Row: {
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          currency: string
          gallery_id: string | null
          id: string
          lab_order_ref: string | null
          lab_status: string | null
          lab_submitted_at: string | null
          notes: string | null
          paid_at: string | null
          ship_city: string | null
          ship_country: string
          ship_line1: string | null
          ship_line2: string | null
          ship_postcode: string | null
          shipping: number
          status: string
          stripe_payment_intent_id: string | null
          subtotal: number
          tax: number
          total: number
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string
          gallery_id?: string | null
          id?: string
          lab_order_ref?: string | null
          lab_status?: string | null
          lab_submitted_at?: string | null
          notes?: string | null
          paid_at?: string | null
          ship_city?: string | null
          ship_country?: string
          ship_line1?: string | null
          ship_line2?: string | null
          ship_postcode?: string | null
          shipping?: number
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string
          gallery_id?: string | null
          id?: string
          lab_order_ref?: string | null
          lab_status?: string | null
          lab_submitted_at?: string | null
          notes?: string | null
          paid_at?: string | null
          ship_city?: string | null
          ship_country?: string
          ship_line1?: string | null
          ship_line2?: string | null
          ship_postcode?: string | null
          shipping?: number
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      print_products: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string | null
          height_mm: number | null
          id: string
          is_active: boolean
          is_digital: boolean
          lab_sku: string | null
          name: string
          price: number
          size_label: string | null
          sku: string
          sort_order: number
          unit_cost: number
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          height_mm?: number | null
          id?: string
          is_active?: boolean
          is_digital?: boolean
          lab_sku?: string | null
          name: string
          price?: number
          size_label?: string | null
          sku: string
          sort_order?: number
          unit_cost?: number
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          height_mm?: number | null
          id?: string
          is_active?: boolean
          is_digital?: boolean
          lab_sku?: string | null
          name?: string
          price?: number
          size_label?: string | null
          sku?: string
          sort_order?: number
          unit_cost?: number
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          onboarding_completed: boolean
          onboarding_step: string | null
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          role?: string
        }
        Relationships: []
      }
      shoots: {
        Row: {
          client_id: string | null
          cover_asset_id: string | null
          created_at: string
          gig_id: string | null
          id: string
          location: string | null
          notes: string | null
          shot_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          gig_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          shot_at?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          gig_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          shot_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoots_cover_asset_fk"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoots_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      social_account_secrets: {
        Row: {
          access_token: string
          account_id: string
          expires_at: string | null
          refresh_token: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          expires_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          expires_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_account_secrets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          can_collect_messages: boolean
          can_publish: boolean
          connected_at: string
          connected_by: string | null
          created_at: string
          display_name: string
          external_account_id: string | null
          followers: number
          handle: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          can_collect_messages?: boolean
          can_publish?: boolean
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_name?: string
          external_account_id?: string | null
          followers?: number
          handle: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          platform: string
          status?: string
          updated_at?: string
        }
        Update: {
          can_collect_messages?: boolean
          can_publish?: boolean
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_name?: string
          external_account_id?: string | null
          followers?: number
          handle?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_requests: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          interpreted: Json | null
          prompt: string
          shoot_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          interpreted?: Json | null
          prompt: string
          shoot_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          interpreted?: Json | null
          prompt?: string
          shoot_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_requests_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_shortlist: {
        Row: {
          asset_id: string
          created_at: string
          decided_at: string | null
          decision: string
          id: string
          rank: number
          rationale: string | null
          request_id: string
          score: number | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          rank?: number
          rationale?: string | null
          request_id: string
          score?: number | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          rank?: number
          rationale?: string | null
          request_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_shortlist_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_shortlist_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "studio_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_staff: { Args: never; Returns: boolean }
      library_add_asset_tag: {
        Args: { p_asset_ids: string[]; p_shoot_id: string; p_tag: string }
        Returns: number
      }
      library_remove_asset_tag: {
        Args: { p_asset_ids: string[]; p_shoot_id: string; p_tag: string }
        Returns: number
      }
      library_shoot_summaries: {
        Args: never
        Returns: {
          asset_count: number
          cover_storage_path: string
          select_count: number
          shoot_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
