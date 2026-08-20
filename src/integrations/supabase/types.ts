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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          body: string | null
          created_at: string
          id: number
          lat: number | null
          lon: number | null
          metadata: Json
          severity: string
          source: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          lat?: number | null
          lon?: number | null
          metadata?: Json
          severity?: string
          source?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          lat?: number | null
          lon?: number | null
          metadata?: Json
          severity?: string
          source?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          date: string
          generated_at: string
          id: string
          summary: string
          type: string
        }
        Insert: {
          date?: string
          generated_at?: string
          id?: string
          summary: string
          type: string
        }
        Update: {
          date?: string
          generated_at?: string
          id?: string
          summary?: string
          type?: string
        }
        Relationships: []
      }
      anomaly_alerts: {
        Row: {
          baseline_num: number | null
          category: string
          description: string | null
          detected_at: string
          id: string
          is_active: boolean
          metric_key: string
          severity: string
          title: string
          value_num: number | null
        }
        Insert: {
          baseline_num?: number | null
          category: string
          description?: string | null
          detected_at?: string
          id?: string
          is_active?: boolean
          metric_key: string
          severity: string
          title: string
          value_num?: number | null
        }
        Update: {
          baseline_num?: number | null
          category?: string
          description?: string | null
          detected_at?: string
          id?: string
          is_active?: boolean
          metric_key?: string
          severity?: string
          title?: string
          value_num?: number | null
        }
        Relationships: []
      }
      historical_snapshots: {
        Row: {
          category: string
          created_at: string | null
          id: number
          metric_key: string
          snapshot_date: string
          source: string | null
          unit: string | null
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: number
          metric_key: string
          snapshot_date: string
          source?: string | null
          unit?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: number
          metric_key?: string
          snapshot_date?: string
          source?: string | null
          unit?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      live_data_cache: {
        Row: {
          data: Json
          data_type: string
          error: string | null
          expires_at: string | null
          fetched_at: string
          id: string
          source: string | null
        }
        Insert: {
          data: Json
          data_type: string
          error?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          source?: string | null
        }
        Update: {
          data?: Json
          data_type?: string
          error?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      monitored_accounts: {
        Row: {
          channel_id: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          last_checked: string | null
          platform: string
          username: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          last_checked?: string | null
          platform: string
          username: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          last_checked?: string | null
          platform?: string
          username?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          analyzed_at: string | null
          author: string | null
          collected_at: string | null
          content: string
          content_hash: string | null
          id: string
          keywords_matched: string[] | null
          platform: string
          published_at: string | null
          sentiment: string | null
          sentiment_confidence: number | null
          sentiment_method: string | null
          region?: string | null
          url?: string | null
        }
        Insert: {
          analyzed_at?: string | null
          author?: string | null
          collected_at?: string | null
          content: string
          id?: string
          keywords_matched?: string[] | null
          platform: string
          published_at?: string | null
          sentiment?: string | null
          sentiment_confidence?: number | null
          sentiment_method?: string | null
          url?: string | null
        }
        Update: {
          analyzed_at?: string | null
          author?: string | null
          collected_at?: string | null
          content?: string
          id?: string
          keywords_matched?: string[] | null
          platform?: string
          published_at?: string | null
          sentiment?: string | null
          sentiment_confidence?: number | null
          sentiment_method?: string | null
          url?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: number
          preferences: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          region: string | null
          rss_url: string | null
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          rss_url?: string | null
          url?: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          rss_url?: string | null
          url?: string
        }
        Relationships: []
      }

      email_alerts: {
        Row: {
          alert_keyword: string | null
          article_snippet: string | null
          article_title: string
          article_url: string | null
          created_at: string | null
          email_received_at: string | null
          id: string
          processed: boolean | null
          published_at: string | null
          social_post_id: string | null
          source: string
          source_domain: string | null
        }
        Insert: {
          alert_keyword?: string | null
          article_snippet?: string | null
          article_title?: string
          article_url?: string | null
          created_at?: string | null
          email_received_at?: string | null
          id?: string
          processed?: boolean | null
          published_at?: string | null
          social_post_id?: string | null
          source?: string
          source_domain?: string | null
        }
        Update: {
          alert_keyword?: string | null
          article_snippet?: string | null
          article_title?: string
          article_url?: string | null
          created_at?: string | null
          email_received_at?: string | null
          id?: string
          processed?: boolean | null
          published_at?: string | null
          social_post_id?: string | null
          source?: string
          source_domain?: string | null
        }
        Relationships: []
      }

      osint_searches: {
        Row: {
          found_count: number | null
          id: string
          platform_count: number | null
          query: string
          results: Json | null
          search_type: string
          searched_at: string | null
          user_agent: string | null
        }
        Insert: {
          found_count?: number | null
          id?: string
          platform_count?: number | null
          query: string
          results?: Json | null
          search_type?: string
          searched_at?: string | null
          user_agent?: string | null
        }
        Update: {
          found_count?: number | null
          id?: string
          platform_count?: number | null
          query?: string
          results?: Json | null
          search_type?: string
          searched_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      source_reliability: {
        Row: {
          accurate_posts: number | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          platform: string
          reliability_score: number | null
          source_name: string
          total_posts: number | null
        }
        Insert: {
          accurate_posts?: number | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform: string
          reliability_score?: number | null
          source_name: string
          total_posts?: number | null
        }
        Update: {
          accurate_posts?: number | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string
          reliability_score?: number | null
          source_name?: string
          total_posts?: number | null
        }
        Relationships: []
      }
      social_analyses: {
        Row: {
          analyzed_at: string
          content: string
          created_at: string
          engagement_count: number | null
          id: string
          keyword_id: string | null
          platform: string
          sentiment: string | null
          sentiment_score: number | null
          source_author: string | null
          source_url: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          content: string
          created_at?: string
          engagement_count?: number | null
          id?: string
          keyword_id?: string | null
          platform: string
          sentiment?: string | null
          sentiment_score?: number | null
          source_author?: string | null
          source_url?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          analyzed_at?: string
          content?: string
          created_at?: string
          engagement_count?: number | null
          id?: string
          keyword_id?: string | null
          platform?: string
          sentiment?: string | null
          sentiment_score?: number | null
          source_author?: string | null
          source_url?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_analyses_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "social_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      social_keywords: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          keyword: string
          platform: string
          region: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          keyword: string
          platform?: string
          region?: string | null
          user_id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          keyword?: string
          platform?: string
          region?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_trends: {
        Row: {
          avg_confidence: number | null
          created_at: string | null
          id: string
          mention_count: number | null
          negative_count: number | null
          neutral_count: number | null
          period_end: string
          period_start: string
          period_type: string
          platform: string | null
          positive_count: number | null
          region: string | null
          top_keywords: string[] | null
        }
        Insert: {
          avg_confidence?: number | null
          created_at?: string | null
          id?: string
          mention_count?: number | null
          negative_count?: number | null
          neutral_count?: number | null
          period_end: string
          period_start: string
          period_type?: string
          platform?: string | null
          positive_count?: number | null
          region?: string | null
          top_keywords?: string[] | null
        }
        Update: {
          avg_confidence?: number | null
          created_at?: string | null
          id?: string
          mention_count?: number | null
          negative_count?: number | null
          neutral_count?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          platform?: string | null
          positive_count?: number | null
          region?: string | null
          top_keywords?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
