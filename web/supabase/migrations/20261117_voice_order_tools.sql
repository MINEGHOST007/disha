-- Agent tools and approval-gated outbound calls. This is additive to migration 116.
create or replace function public.disha_log_agent_query(p_tools jsonb, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_merchant_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_tools is null or jsonb_typeof(p_tools)<>'array' or jsonb_array_length(p_tools)>12 or p_language not in ('en','te')
    or exists(select 1 from jsonb_array_elements(p_tools) item where jsonb_typeof(item)<>'string'
      or item #>> '{}' not in ('find_payments_from','get_cashflow_summary','get_purchase_history','forecast_next_orders','get_customer_frequency','get_khata_summary')) then
    raise exception using errcode='22023',message='invalid query audit facts';
  end if;
  select merchant_id into v_merchant_id from public.disha_merchant_members where user_id=v_user_id order by created_at limit 1;
  if v_merchant_id is null then raise exception using errcode='42501',message='workspace membership required'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
  values('agent','merchant_data_query',jsonb_build_object('tools',p_tools,'language',p_language),'read','answered_from_merchant_data',v_merchant_id);
end; $$;
revoke all on function public.disha_log_agent_query(jsonb,text) from public,anon;
grant execute on function public.disha_log_agent_query(jsonb,text) to authenticated;

create or replace function public.disha_start_supplier_call(p_order uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_order_drafts%rowtype; v_lines jsonb;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  select * into o from public.disha_order_drafts where id=p_order and merchant_id=v_mid for update;
  if not found or o.status<>'approved' then raise exception using errcode='P0001',message='only an explicitly approved order can be called'; end if;
  if o.supplier_phone is null then raise exception using errcode='22023',message='add the supplier phone number before calling'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_name',item_name,'quantity',quantity,'unit',unit,'unit_price',unit_price,'line_total',line_total) order by item_name),'[]'::jsonb)
    into v_lines from public.disha_order_draft_lines where order_id=o.id and merchant_id=v_mid;
  if jsonb_array_length(v_lines)=0 then raise exception using errcode='22023',message='approved order has no lines'; end if;
  update public.disha_order_drafts set status='calling',call_status='initiating',updated_at=now() where id=o.id returning * into o;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','supplier_call_start',jsonb_build_object('order_id',o.id,'line_count',jsonb_array_length(v_lines),'total',o.order_total),'approved','outbound_call_initiated',v_mid);
  return jsonb_build_object('order',to_jsonb(o),'lines',v_lines);
end; $$;
revoke all on function public.disha_start_supplier_call(uuid) from public,anon;
grant execute on function public.disha_start_supplier_call(uuid) to authenticated;

create or replace function public.disha_record_supplier_call(p_order uuid,p_result text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_order_drafts%rowtype;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if p_result not in ('placed','needs_review','cancelled') or length(coalesce(p_confirmation,''))>500 then raise exception using errcode='22023',message='invalid call result'; end if;
  update public.disha_order_drafts set status=p_result,call_status=p_result,seller_confirmation=nullif(trim(p_confirmation),''),updated_at=now()
    where id=p_order and merchant_id=v_mid and status='calling' returning * into o;
  if not found then raise exception using errcode='P0001',message='there is no active supplier call for this order'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','supplier_call_result',jsonb_build_object('order_id',o.id,'confirmation',p_confirmation),'confirmed',p_result,v_mid);
  return to_jsonb(o);
end; $$;
revoke all on function public.disha_record_supplier_call(uuid,text,text) from public,anon;
grant execute on function public.disha_record_supplier_call(uuid,text,text) to authenticated;
