export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      disha_demo_state: {
        Row: { id: string; payload: Json; audit_cursor: number; updated_at: string; merchant_id: string | null };
        Insert: { id: string; payload: Json; audit_cursor?: number; updated_at?: string; merchant_id?: string | null };
        Update: { payload?: Json; audit_cursor?: number; updated_at?: string; merchant_id?: string | null };
        Relationships: [];
      };
      disha_workspace_state: {
        Row: { merchant_id: string; payload: Json; updated_at: string };
        Insert: { merchant_id: string; payload?: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      disha_proposals: {
        Row: { id: string; type: string; status: string; facts: Json; reason: string; narration: string | null; fallback_used: boolean; created_at: string; resolved_at: string | null; outcome: string | null; result: Json | null; merchant_id: string | null };
        Insert: { id?: string; type: string; status?: string; facts: Json; reason: string; narration?: string | null; fallback_used?: boolean; created_at?: string; resolved_at?: string | null; outcome?: string | null; result?: Json | null; merchant_id?: string | null };
        Update: { status?: string; facts?: Json; reason?: string; narration?: string | null; fallback_used?: boolean; resolved_at?: string | null; outcome?: string | null; result?: Json | null; merchant_id?: string | null };
        Relationships: [];
      };
      disha_audit_log: {
        Row: { id: number; created_at: string; actor: string; tool: string; facts: Json; narration: string | null; validation_result: string | null; decision: string; outcome: string | null; fallback_used: boolean; merchant_id: string | null };
        Insert: { id?: number; created_at?: string; actor: string; tool: string; facts?: Json; narration?: string | null; validation_result?: string | null; decision: string; outcome?: string | null; fallback_used?: boolean; merchant_id?: string | null };
        Update: never;
        Relationships: [];
      };
      disha_outbox: {
        Row: { id: string; proposal_id: string; customer_id: string; language: string; message_text: string; sent_at: string; simulated: boolean; merchant_id: string | null };
        Insert: { id?: string; proposal_id: string; customer_id: string; language: string; message_text: string; sent_at?: string; simulated?: boolean; merchant_id?: string | null };
        Update: never;
        Relationships: [];
      };
      disha_purchase_drafts: {
        Row: { id: string; proposal_id: string; sku_id: string; quantity: number; supplier_name: string; created_at: string; status: string; merchant_id: string | null };
        Insert: { id?: string; proposal_id: string; sku_id: string; quantity: number; supplier_name: string; created_at?: string; status?: string; merchant_id?: string | null };
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
      disha_update_demo_state: { Args: { p_patch: Json; p_tool: string; p_facts?: Json }; Returns: Json };
      disha_reset_demo: { Args: Record<string, never>; Returns: Json };
      disha_create_workspace: { Args: { p_name: string }; Returns: string };
      disha_update_workspace_state: { Args: { p_merchant_id: string; p_patch: Json; p_tool: string }; Returns: Json };
      disha_resolve_workspace_proposal: { Args: { p_merchant_id: string; p_proposal_id: string; p_decision: string; p_language?: string; p_message_text?: string | null; p_reason?: string | null }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
