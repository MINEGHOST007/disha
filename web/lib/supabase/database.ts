export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      disha_merchants: {
        Row: { id: string; name: string; locale: string; timezone: string; currency: string; status: "active" | "suspended"; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; locale?: string; timezone?: string; currency?: string; status?: "active" | "suspended"; created_at?: string; updated_at?: string };
        Update: { name?: string; locale?: string; timezone?: string; currency?: string; status?: "active" | "suspended"; updated_at?: string };
        Relationships: [];
      };
      disha_merchant_members: {
        Row: { merchant_id: string; user_id: string; role: "owner" | "manager" | "staff"; created_at: string; updated_at: string };
        Insert: { merchant_id: string; user_id: string; role?: "owner" | "manager" | "staff"; created_at?: string; updated_at?: string };
        Update: { role?: "owner" | "manager"; updated_at?: string };
        Relationships: [];
      };
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
      disha_store_bills: {
        Row: { id: string; merchant_id: string; bill_number: string; bill_date: string; customer_name: string | null; total_amount: number; payment_mode: string | null; items: Json; source: "csv" | "manual"; created_at: string };
        Insert: { id?: string; merchant_id: string; bill_number: string; bill_date: string; customer_name?: string | null; total_amount: number; payment_mode?: string | null; items: Json; source: "csv" | "manual"; created_at?: string };
        Update: { customer_name?: string | null; total_amount?: number; payment_mode?: string | null; items?: Json; source?: "csv" | "manual" };
        Relationships: [];
      };
      disha_suppliers: {
        Row: { id: string; merchant_id: string; name: string; normalized_name: string; created_at: string };
        Insert: { id?: string; merchant_id: string; name: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      disha_purchase_bills: {
        Row: { id: string; merchant_id: string; supplier_id: string; bill_number: string; bill_date: string; total_amount: number; credit_days: number; source: "csv" | "sarvam_vision" | "openrouter_vision"; source_file_name: string | null; created_at: string };
        Insert: { id?: string; merchant_id: string; supplier_id: string; bill_number: string; bill_date: string; total_amount: number; credit_days?: number; source: "csv" | "sarvam_vision" | "openrouter_vision"; source_file_name?: string | null; created_at?: string };
        Update: { total_amount?: number; credit_days?: number; source?: "csv" | "sarvam_vision" | "openrouter_vision"; source_file_name?: string | null };
        Relationships: [];
      };
      disha_purchase_bill_lines: {
        Row: { id: string; merchant_id: string; purchase_bill_id: string; item_name: string; normalized_item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
        Insert: { id?: string; merchant_id: string; purchase_bill_id: string; item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
        Update: never;
        Relationships: [];
      };
      disha_transactions: {
        Row: { id: string; merchant_id: string; external_id: string; occurred_at: string; customer_name: string; amount: number; mode: string; status: "success" | "failed" | "pending"; created_at: string };
        Insert: { id?: string; merchant_id: string; external_id: string; occurred_at: string; customer_name: string; amount: number; mode: string; status: "success" | "failed" | "pending"; created_at?: string };
        Update: never;
        Relationships: [];
      };
      disha_customer_aliases: {
        Row: { id: string; merchant_id: string; customer_name: string; alias: string; created_at: string };
        Insert: { id?: string; merchant_id: string; customer_name: string; alias: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      disha_khata_entries: {
        Row: { id: string; merchant_id: string; customer_name: string; amount: number; paid_amount: number; note: string | null; due_date: string | null; auto_match: boolean; status: "open" | "partially_paid" | "closed"; created_at: string; closed_at: string | null };
        Insert: { id?: string; merchant_id: string; customer_name: string; amount: number; paid_amount?: number; note?: string | null; due_date?: string | null; auto_match?: boolean; status?: "open" | "partially_paid" | "closed"; created_at?: string; closed_at?: string | null };
        Update: never;
        Relationships: [];
      };
      disha_khata_allocations: {
        Row: { id: string; merchant_id: string; entry_id: string; transaction_id: string | null; amount: number; source: "auto_transaction" | "manual"; created_at: string };
        Insert: { id?: string; merchant_id: string; entry_id: string; transaction_id?: string | null; amount: number; source: "auto_transaction" | "manual"; created_at?: string };
        Update: never;
        Relationships: [];
      };
      disha_order_drafts: {
        Row: { id: string; merchant_id: string; supplier_name: string; supplier_phone: string | null; order_date: string | null; status: "draft" | "approved" | "calling" | "placed" | "needs_review" | "cancelled"; order_total: number; call_room: string | null; call_status: string | null; seller_confirmation: string | null; approved_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; merchant_id: string; supplier_name: string; supplier_phone?: string | null; order_date?: string | null; status?: "draft" | "approved" | "calling" | "placed" | "needs_review" | "cancelled"; order_total?: number; call_room?: string | null; call_status?: string | null; seller_confirmation?: string | null; approved_at?: string | null; created_at?: string; updated_at?: string };
        Update: never;
        Relationships: [];
      };
      disha_order_draft_lines: {
        Row: { id: string; merchant_id: string; order_id: string; item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
        Insert: { id?: string; merchant_id: string; order_id: string; item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
        Update: never;
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
      disha_log_agent_query: { Args: { p_tools: Json; p_language: string }; Returns: undefined };
      disha_import_purchase_bills: { Args: { p_bills: Json }; Returns: number };
      disha_import_store_bills: { Args: { p_bills: Json }; Returns: number };
      disha_import_transactions: { Args: { p_rows: Json }; Returns: number };
      disha_create_khata: { Args: { p_customer: string; p_amount: number; p_due: string | null; p_auto: boolean; p_note: string | null }; Returns: string };
      disha_settle_khata: { Args: { p_entry: string; p_amount: number | null }; Returns: Json };
      disha_save_order_draft: { Args: { p_supplier: string; p_phone: string | null; p_order_date: string | null; p_lines: Json; p_approve?: boolean }; Returns: string };
      disha_approve_order: { Args: { p_order: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
