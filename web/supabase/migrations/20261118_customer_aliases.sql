create or replace function public.disha_save_customer_alias(p_customer text,p_alias text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_id uuid;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_customer),'') is null or length(p_customer)>120 or nullif(trim(p_alias),'') is null or length(p_alias)>120 then
    raise exception using errcode='22023',message='customer name and alias must be 1 to 120 characters';
  end if;
  insert into public.disha_customer_aliases(merchant_id,customer_name,alias) values(v_mid,trim(p_customer),trim(p_alias))
  on conflict(merchant_id,customer_name,alias) do update set alias=excluded.alias returning id into v_id;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','customer_alias_save',jsonb_build_object('customer',trim(p_customer),'alias',trim(p_alias)),'saved','customer_alias_added',v_mid);
  return v_id;
end; $$;
revoke all on function public.disha_save_customer_alias(text,text) from public,anon;
grant execute on function public.disha_save_customer_alias(text,text) to authenticated;

-- Prevent a re-imported transaction from being allocated twice; resolve local-language
-- aliases when applying a newly successful payment to an auto-match Khata entry.
create or replace function public.disha_import_transactions(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; r jsonb; v_id uuid; v_saved integer:=0; e record; v_left numeric; v_old_status text; v_take numeric;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 then raise exception using errcode='22023',message='transactions require 1 to 10000 rows'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if nullif(trim(r->>'external_id'),'') is null or length(r->>'external_id')>160
      or nullif(trim(r->>'customer_name'),'') is null or length(r->>'customer_name')>120
      or coalesce(r->>'occurred_at','') !~ '^\d{4}-\d{2}-\d{2}T'
      or coalesce(r->>'amount','') !~ '^([0-9]+)(\.[0-9]{1,2})?$' or (r->>'amount')::numeric<=0
      or nullif(trim(r->>'mode'),'') is null or length(r->>'mode')>40
      or coalesce(r->>'status','') not in ('success','failed','pending') then raise exception using errcode='22023',message='invalid transaction row'; end if;
    select status into v_old_status from public.disha_transactions where merchant_id=v_mid and external_id=trim(r->>'external_id') for update;
    insert into public.disha_transactions(merchant_id,external_id,occurred_at,customer_name,amount,mode,status)
    values(v_mid,trim(r->>'external_id'),(r->>'occurred_at')::timestamptz,trim(r->>'customer_name'),(r->>'amount')::numeric,trim(r->>'mode'),r->>'status')
    on conflict(merchant_id,external_id) do update set occurred_at=excluded.occurred_at,customer_name=excluded.customer_name,amount=excluded.amount,mode=excluded.mode,status=excluded.status
    returning id into v_id;
    v_saved:=v_saved+1;
    if r->>'status'='success' and coalesce(v_old_status,'')<>'success' then
      v_left:=(r->>'amount')::numeric;
      for e in select k.* from public.disha_khata_entries k
        where k.merchant_id=v_mid and k.auto_match and k.status<>'closed' and k.created_at <= (r->>'occurred_at')::timestamptz
          and (lower(trim(k.customer_name))=lower(trim(r->>'customer_name')) or exists(
            select 1 from public.disha_customer_aliases a where a.merchant_id=v_mid and lower(trim(a.alias))=lower(trim(r->>'customer_name')) and lower(trim(a.customer_name))=lower(trim(k.customer_name))))
        order by k.created_at for update loop
        exit when v_left<=0;
        v_take:=least(e.amount-e.paid_amount,v_left);
        if v_take>0 then
          insert into public.disha_khata_allocations(merchant_id,entry_id,transaction_id,amount,source) values(v_mid,e.id,v_id,v_take,'auto_transaction');
          update public.disha_khata_entries set paid_amount=paid_amount+v_take,status=case when paid_amount+v_take>=amount then 'closed' else 'partially_paid' end,closed_at=case when paid_amount+v_take>=amount then now() else null end where id=e.id;
          v_left:=v_left-v_take;
        end if;
      end loop;
    end if;
  end loop;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','transaction_import',jsonb_build_object('count',v_saved),'saved','merchant_transactions_imported',v_mid);
  return v_saved;
end; $$;
revoke all on function public.disha_import_transactions(jsonb) from public,anon;
grant execute on function public.disha_import_transactions(jsonb) to authenticated;
