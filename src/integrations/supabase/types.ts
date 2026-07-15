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
      checkins: {
        Row: {
          checkin_date: string
          created_at: string
          id: string
          reward: number
          streak: number
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          id?: string
          reward: number
          streak?: number
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          id?: string
          reward?: number
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      deposit_addresses: {
        Row: {
          address: string
          id: string
          is_active: boolean
          memo: string | null
          min_deposit: number
          network: Database["public"]["Enums"]["crypto_network"]
          updated_at: string
        }
        Insert: {
          address: string
          id?: string
          is_active?: boolean
          memo?: string | null
          min_deposit?: number
          network: Database["public"]["Enums"]["crypto_network"]
          updated_at?: string
        }
        Update: {
          address?: string
          id?: string
          is_active?: boolean
          memo?: string | null
          min_deposit?: number
          network?: Database["public"]["Enums"]["crypto_network"]
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          from_address: string | null
          id: string
          network: Database["public"]["Enums"]["crypto_network"]
          processed_at: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          from_address?: string | null
          id?: string
          network: Database["public"]["Enums"]["crypto_network"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          from_address?: string | null
          id?: string
          network?: Database["public"]["Enums"]["crypto_network"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          daily_earnings: number
          duration_days: number
          features: Json
          hash_rate_ghs: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Insert: {
          daily_earnings: number
          duration_days: number
          features?: Json
          hash_rate_ghs: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Update: {
          daily_earnings?: number
          duration_days?: number
          features?: Json
          hash_rate_ghs?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["plan_tier"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_id: string
          email: string | null
          full_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          login_alerts_enabled: boolean
          phone: string | null
          referral_code: string
          referred_by: string | null
          two_factor_enabled: boolean
          updated_at: string
          user_id: string
          vip_level: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_id: string
          email?: string | null
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          login_alerts_enabled?: boolean
          phone?: string | null
          referral_code: string
          referred_by?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id: string
          vip_level?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_id?: string
          email?: string | null
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          login_alerts_enabled?: boolean
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id?: string
          vip_level?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          commission_earned: number
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          commission_earned?: number
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          commission_earned?: number
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          code: string
          description: string | null
          id: string
          is_active: boolean
          is_repeatable: boolean
          reward: number
          sort_order: number
          title: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          reward: number
          sort_order?: number
          title: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          reward?: number
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_mining: {
        Row: {
          accrued: number
          created_at: string
          daily_earnings: number
          expires_at: string
          hash_rate_ghs: number
          id: string
          is_active: boolean
          last_claimed_at: string
          plan_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          accrued?: number
          created_at?: string
          daily_earnings: number
          expires_at: string
          hash_rate_ghs: number
          id?: string
          is_active?: boolean
          last_claimed_at?: string
          plan_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          accrued?: number
          created_at?: string
          daily_earnings?: number
          expires_at?: string
          hash_rate_ghs?: number
          id?: string
          is_active?: boolean
          last_claimed_at?: string
          plan_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mining_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tasks: {
        Row: {
          completed_at: string
          id: string
          reward: number
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          reward: number
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          reward?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          bonus_balance: number
          id: string
          main_balance: number
          mining_balance: number
          referral_balance: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_balance?: number
          id?: string
          main_balance?: number
          mining_balance?: number
          referral_balance?: number
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_balance?: number
          id?: string
          main_balance?: number
          mining_balance?: number
          referral_balance?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          fee: number
          id: string
          network: Database["public"]["Enums"]["crypto_network"]
          processed_at: string | null
          status: Database["public"]["Enums"]["tx_status"]
          to_address: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          fee?: number
          id?: string
          network: Database["public"]["Enums"]["crypto_network"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          to_address: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          network?: Database["public"]["Enums"]["crypto_network"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          to_address?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      crypto_network: "USDT_TRC20" | "USDT_BEP20" | "USDT_ERC20" | "BTC" | "ETH"
      kyc_status: "unverified" | "pending" | "verified" | "rejected"
      plan_tier: "starter" | "silver" | "gold" | "platinum"
      tx_status: "pending" | "completed" | "failed" | "cancelled"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "mining_reward"
        | "referral_reward"
        | "bonus"
        | "plan_purchase"
        | "checkin_reward"
        | "task_reward"
        | "transfer"
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
    Enums: {
      app_role: ["admin", "user"],
      crypto_network: ["USDT_TRC20", "USDT_BEP20", "USDT_ERC20", "BTC", "ETH"],
      kyc_status: ["unverified", "pending", "verified", "rejected"],
      plan_tier: ["starter", "silver", "gold", "platinum"],
      tx_status: ["pending", "completed", "failed", "cancelled"],
      tx_type: [
        "deposit",
        "withdrawal",
        "mining_reward",
        "referral_reward",
        "bonus",
        "plan_purchase",
        "checkin_reward",
        "task_reward",
        "transfer",
      ],
    },
  },
} as const
