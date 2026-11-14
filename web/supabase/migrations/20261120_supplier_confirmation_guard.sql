-- Require recorded seller words before marking a call placed or needing review.
create or replace function public.disha_record_supplier_call(p_order uuid,p_result text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_order_drafts%rowtype;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if p_result not in ('placed','needs_review','cancelled') or length(coalesce(p_confirmation,''))>500 then raise exception using errcode='22023',message='invalid call result'; end if;
  if p_result in ('placed','needs_review') and nullif(trim(coalesce(p_confirmation,'')),'') is null then
    raise exception using errcode='22023',message='seller confirmation is required for this outcome';
  end if;
  update public.disha_order_drafts set status=p_result,call_status=p_result,seller_confirmation=nullif(trim(p_confirmation),''),updated_at=now()
    where id=p_order and merchant_id=v_mid and status='calling' returning * into o;
  if not found then raise exception using errcode='P0001',message='there is no active supplier call for this order'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','supplier_call_result',jsonb_build_object('order_id',o.id,'confirmation',p_confirmation),'confirmed',p_result,v_mid);
  return to_jsonb(o);
end; $$;
revoke all on function public.disha_record_supplier_call(uuid,text,text) from public,anon;
grant execute on function public.disha_record_supplier_call(uuid,text,text) to authenticated;

create or replace function public.disha_log_supplier_call_stub(p_order uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_order_drafts%rowtype;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  select * into o from public.disha_order_drafts where id=p_order and merchant_id=v_mid for update;
  if not found or o.status<>'approved' then raise exception using errcode='P0001',message='only an explicitly approved order can use the demo call stub'; end if;
  if o.supplier_phone is null then raise exception using errcode='22023',message='add the supplier phone number before using the call stub'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('merchant','supplier_call_demo_stub',jsonb_build_object('order_id',o.id,'line_count',(select count(*) from public.disha_order_draft_lines where order_id=o.id and merchant_id=v_mid),'total',o.order_total),'simulated','no_supplier_contacted_order_remains_approved',v_mid);
  return jsonb_build_object('status','demo_stub','contacted',false,'order_id',o.id);
end; $$;
revoke all on function public.disha_log_supplier_call_stub(uuid) from public,anon;
grant execute on function public.disha_log_supplier_call_stub(uuid) to authenticated;
