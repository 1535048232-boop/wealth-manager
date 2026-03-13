export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Hand-written types matching supabase/migrations/
// Regenerate automatically with:
//   npx supabase gen types typescript --local > types/supabase.ts
export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: number;
          family_name: string;
          creator_id: string | null;
          family_avatar: string | null;
          description: string | null;
          currency: string;
          debt_warning_threshold: number;
          repayment_reminder_switch: 0 | 1;
          data_export_switch: 0 | 1;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          family_name: string;
          creator_id?: string | null;
          family_avatar?: string | null;
          description?: string | null;
          currency?: string;
          debt_warning_threshold?: number;
          repayment_reminder_switch?: 0 | 1;
          data_export_switch?: 0 | 1;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          family_name?: string;
          creator_id?: string | null;
          family_avatar?: string | null;
          description?: string | null;
          currency?: string;
          debt_warning_threshold?: number;
          repayment_reminder_switch?: 0 | 1;
          data_export_switch?: 0 | 1;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: number;
          family_id: number;
          user_id: string | null;
          profile_id: string | null;
          phone: string | null;
          password_hash: string | null;
          pay_password_hash: string | null;
          role: "admin" | "member" | "guest";
          join_time?: string;
          join_source?: "creator" | "invite";
          inviter_id?: number | null;
          biometric_login_switch?: 0 | 1;
          status?: 1 | 0 | -1;
          created_at?: string;
          updated_at?: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      asset_accounts: {
        Row: {
          id: number;
          member_id: number;
          account_type:
            | "银行卡"
            | "支付宝"
            | "微信"
            | "公积金"
            | "股票"
            | "期权"
            | "现金"
            | "保险"
            | "基金"
            | "其他";
          account_name: string;
          asset_quadrant: "A类保值" | "B类消费" | "C类投资" | "D类保障" | null;
          description: string | null;
          institution: string | null;
          status: 0 | 1;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          member_id: number;
          account_type:
            | "银行卡"
            | "支付宝"
            | "微信"
            | "公积金"
            | "股票"
            | "期权"
            | "现金"
            | "保险"
            | "基金"
            | "其他";
          account_name: string;
          asset_quadrant?: "A类保值" | "B类消费" | "C类投资" | "D类保障" | null;
          description?: string | null;
          institution?: string | null;
          status?: 0 | 1;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: number;
          account_type?:
            | "银行卡"
            | "支付宝"
            | "微信"
            | "公积金"
            | "股票"
            | "期权"
            | "现金"
            | "保险"
            | "基金"
            | "其他";
          account_name?: string;
          asset_quadrant?: "A类保值" | "B类消费" | "C类投资" | "D类保障" | null;
          description?: string | null;
          institution?: string | null;
          status?: 0 | 1;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_accounts_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "family_members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
