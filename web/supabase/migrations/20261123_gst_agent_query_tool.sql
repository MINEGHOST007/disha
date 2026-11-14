-- Add the GST due reader to the read-only agent audit allowlist.
create or replace function public.disha_log_agent_query(p_tools jsonb, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_merchant_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_tools is null or jsonb_typeof(p_tools)<>'array' or jsonb_array_length(p_tools)>12 or p_language not in ('en','te')
    or exists(select 1 from jsonb_array_elements(p_tools) item where jsonb_typeof(item)<>'string'
      or item #>> '{}' not in ('find_payments_from','get_cashflow_summary','get_purchase_history','forecast_next_orders','get_customer_frequency','get_khata_summary','get_gst_summary')) then
    raise exception using errcode='22023',message='invalid query audit facts';
  end if;
  select merchant_id into v_merchant_id from public.disha_merchant_members where user_id=v_user_id order by created_at limit 1;
  if v_merchant_id is null then raise exception using errcode='42501',message='workspace membership required'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('agent','merchant_data_query',jsonb_build_object('tools',p_tools,'language',p_language),'read','answered_from_merchant_data',v_merchant_id);
end; $$;
revoke all on function public.disha_log_agent_query(jsonb,text) from public,anon;
grant execute on function public.disha_log_agent_query(jsonb,text) to authenticated;
