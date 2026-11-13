export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      disha_demo_state: {
        Row: { id: string; payload: Json; audit_cursor: number; updated_at: string };
        Insert: { id: string; payload: Json; audit_cursor?: number; updated_at?: string };
        Update: { payload?: Json; audit_cursor?: number; updated_at?: string };
        Relationships: [];
      };
      disha_proposals: {
        Row: { id: string; type: string; status: string; facts: Json; reason: string; narration: string | null; fallback_used: boolean; created_at: string; resolved_at: string | null; outcome: string | null; result: Json | null };
        Insert: { id?: string; type: string; status?: string; facts: Json; reason: string; narration?: string | null; fallback_used?: boolean; created_at?: string; resolved_at?: string | null; outcome?: string | null; result?: Json | null };
        Update: { status?: string; facts?: Json; reason?: string; narration?: string | null; fallback_used?: boolean; resolved_at?: string | null; outcome?: string | null; result?: Json | null };
        Relationships: [];
      };
      disha_audit_log: {
        Row: { id: number; created_at: string; actor: string; tool: string; facts: Json; narration: string | null; validation_result: string | null; decision: string; outcome: string | null; fallback_used: boolean };
        Insert: { id?: number; created_at?: string; actor: string; tool: string; facts?: Json; narration?: string | null; validation_result?: string | null; decision: string; outcome?: string | null; fallback_used?: boolean };
        Update: never;
        Relationships: [];
      };
      disha_outbox: {
        Row: { id: string; proposal_id: string; customer_id: string; language: string; message_text: string; sent_at: string; simulated: boolean };
        Insert: { id?: string; proposal_id: string; customer_id: string; language: string; message_text: string; sent_at?: string; simulated?: boolean };
        Update: never;
        Relationships: [];
      };
      disha_purchase_drafts: {
        Row: { id: string; proposal_id: string; sku_id: string; quantity: number; supplier_name: string; created_at: string; status: string };
        Insert: { id?: string; proposal_id: string; sku_id: string; quantity: number; supplier_name: string; created_at?: string; status?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      disha_create_proposal: { Args: { p_type: string; p_facts: Json; p_reason: string; p_narration?: string | null; p_fallback_used?: boolean }; Returns: Json };
      disha_approve_proposal: { Args: { p_proposal_id: string; p_language?: string; p_message_text?: string | null }; Returns: Json };
      disha_reject_proposal: { Args: { p_proposal_id: string; p_reason?: string }; Returns: Json };
      disha_update_demo_stock: { Args: { p_on_hand: number }; Returns: Json };
      disha_reset_demo: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
