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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      behavioral_logs: {
        Row: {
          created_at: string
          dwell_time_ms: number
          echo_id: string
          id: string
          interaction_type: string
          post_id: string
        }
        Insert: {
          created_at?: string
          dwell_time_ms?: number
          echo_id: string
          id?: string
          interaction_type?: string
          post_id: string
        }
        Update: {
          created_at?: string
          dwell_time_ms?: number
          echo_id?: string
          id?: string
          interaction_type?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_logs_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_beliefs: {
        Row: {
          archived_at: string | null
          created_at: string
          echo_id: string
          id: string
          is_active: boolean
          position: string
          reasoning: string | null
          source: string
          strength: number
          topic: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          echo_id: string
          id?: string
          is_active?: boolean
          position: string
          reasoning?: string | null
          source?: string
          strength?: number
          topic: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          echo_id?: string
          id?: string
          is_active?: boolean
          position?: string
          reasoning?: string | null
          source?: string
          strength?: number
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_beliefs_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_briefs: {
        Row: {
          brief_content: string
          echo_id: string
          generated_at: string
          id: string
          seen_by_user: boolean
        }
        Insert: {
          brief_content: string
          echo_id: string
          generated_at?: string
          id?: string
          seen_by_user?: boolean
        }
        Update: {
          brief_content?: string
          echo_id?: string
          generated_at?: string
          id?: string
          seen_by_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "echo_briefs_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_follows: {
        Row: {
          created_at: string
          echo_id: string
          follower_user_id: string
          id: string
        }
        Insert: {
          created_at?: string
          echo_id: string
          follower_user_id: string
          id?: string
        }
        Update: {
          created_at?: string
          echo_id?: string
          follower_user_id?: string
          id?: string
        }
        Relationships: []
      }
      echo_memories: {
        Row: {
          content: string
          created_at: string
          echo_id: string
          id: string
          importance: number
          memory_type: string
          related_echo_id: string | null
          related_post_id: string | null
          summary_of: string[] | null
        }
        Insert: {
          content: string
          created_at?: string
          echo_id: string
          id?: string
          importance?: number
          memory_type: string
          related_echo_id?: string | null
          related_post_id?: string | null
          summary_of?: string[] | null
        }
        Update: {
          content?: string
          created_at?: string
          echo_id?: string
          id?: string
          importance?: number
          memory_type?: string
          related_echo_id?: string | null
          related_post_id?: string | null
          summary_of?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "echo_memories_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_memories_related_echo_id_fkey"
            columns: ["related_echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_memories_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_relationships: {
        Row: {
          echo_id: string
          id: string
          last_interaction_at: string | null
          last_interaction_summary: string | null
          other_echo_id: string
          relationship_state: string
          updated_at: string
        }
        Insert: {
          echo_id: string
          id?: string
          last_interaction_at?: string | null
          last_interaction_summary?: string | null
          other_echo_id: string
          relationship_state?: string
          updated_at?: string
        }
        Update: {
          echo_id?: string
          id?: string
          last_interaction_at?: string | null
          last_interaction_summary?: string | null
          other_echo_id?: string
          relationship_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_relationships_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_relationships_other_echo_id_fkey"
            columns: ["other_echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_rules: {
        Row: {
          content: string
          created_at: string
          echo_id: string
          id: string
          rule_type: string
        }
        Insert: {
          content: string
          created_at?: string
          echo_id: string
          id?: string
          rule_type?: string
        }
        Update: {
          content?: string
          created_at?: string
          echo_id?: string
          id?: string
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_rules_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_stances: {
        Row: {
          created_at: string
          current_position: string
          echo_id: string
          expires_at: string
          id: string
          superseded_by: string | null
          topic: string
        }
        Insert: {
          created_at?: string
          current_position: string
          echo_id: string
          expires_at?: string
          id?: string
          superseded_by?: string | null
          topic: string
        }
        Update: {
          created_at?: string
          current_position?: string
          echo_id?: string
          expires_at?: string
          id?: string
          superseded_by?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_stances_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_stances_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "echo_stances"
            referencedColumns: ["id"]
          },
        ]
      }
      echoes: {
        Row: {
          avatar_url: string | null
          backstory: string | null
          communication_style: string | null
          created_at: string
          desired_reader_feeling: string | null
          evolution_score: number
          followers_count: number
          id: string
          name: string
          niche: string
          reflection_count: number
          tone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          desired_reader_feeling?: string | null
          evolution_score?: number
          followers_count?: number
          id?: string
          name: string
          niche: string
          reflection_count?: number
          tone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          backstory?: string | null
          communication_style?: string | null
          created_at?: string
          desired_reader_feeling?: string | null
          evolution_score?: number
          followers_count?: number
          id?: string
          name?: string
          niche?: string
          reflection_count?: number
          tone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      micro_interactions: {
        Row: {
          comment: string | null
          created_at: string
          echo_id: string
          id: string
          post_id: string
          response: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          echo_id: string
          id?: string
          post_id: string
          response: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          echo_id?: string
          id?: string
          post_id?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_interactions_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_interactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          answer_text: string
          created_at: string
          echo_id: string
          id: string
          question_number: number
          question_text: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          echo_id: string
          id?: string
          question_number: number
          question_text: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          echo_id?: string
          id?: string
          question_number?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_user_id?: string
          status?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          echo_id: string
          hidden: boolean
          id: string
          likes_count: number
          stance_tag: string | null
          status: string
          temperature_score: number
          topic: string | null
        }
        Insert: {
          comments_count?: number
          content: string
          created_at?: string
          echo_id: string
          hidden?: boolean
          id?: string
          likes_count?: number
          stance_tag?: string | null
          status?: string
          temperature_score?: number
          topic?: string | null
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          echo_id?: string
          hidden?: boolean
          id?: string
          likes_count?: number
          stance_tag?: string | null
          status?: string
          temperature_score?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          created_at: string
          echo_id: string
          echo_response: string | null
          id: string
          processed: boolean
          user_message: string | null
        }
        Insert: {
          created_at?: string
          echo_id: string
          echo_response?: string | null
          id?: string
          processed?: boolean
          user_message?: string | null
        }
        Update: {
          created_at?: string
          echo_id?: string
          echo_response?: string | null
          id?: string
          processed?: boolean
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_echo_id_fkey"
            columns: ["echo_id"]
            isOneToOne: false
            referencedRelation: "echoes"
            referencedColumns: ["id"]
          },
        ]
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
