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
    PostgrestVersion: "14.15"
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
      assets: {
        Row: {
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
      campaigns: {
        Row: {
          audience: string | null
          brief: string | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          objective: string
          platforms: string[]
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          brief?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          objective: string
          platforms?: string[]
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          brief?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          objective?: string
          platforms?: string[]
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_contacted_at: string | null
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
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
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
      messages: {
        Row: {
          body: string
          client_id: string
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
          client_id: string
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
          client_id?: string
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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
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
