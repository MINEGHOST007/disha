-- Keep database validation aligned with the merchant-facing ₹1 arithmetic tolerance.
create or replace function public.disha_import_purchase_bills(p_bills jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_merchant_id uuid; v_role text; v_bill jsonb; v_line jsonb;
  v_supplier_id uuid; v_bill_id uuid; v_sum numeric(14,2); v_saved_count integer := 0;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_bills is null or jsonb_typeof(p_bills)<>'array' or jsonb_array_length(p_bills) not between 1 and 50 then
    raise exception using errcode='22023',message='purchase import requires 1 to 50 invoices';
  end if;
  select merchant_id,role into v_merchant_id,v_role from public.disha_merchant_members
    where user_id=v_user_id and role in ('owner','manager') order by created_at limit 1;
  if v_merchant_id is null then raise exception using errcode='42501',message='manager role required'; end if;
  for v_bill in select value from jsonb_array_elements(p_bills) loop
    if jsonb_typeof(v_bill)<>'object'
      or nullif(trim(v_bill->>'supplier_name'),'') is null or length(trim(v_bill->>'supplier_name'))>120
      or nullif(trim(v_bill->>'bill_number'),'') is null or length(trim(v_bill->>'bill_number'))>80
      or coalesce(v_bill->>'bill_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(v_bill->>'total_amount','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
      or (v_bill->>'total_amount')::numeric<0
      or coalesce(v_bill->>'credit_days','0') !~ '^\d{1,3}$'
      or coalesce((v_bill->>'credit_days')::integer,0)>365
      or jsonb_typeof(v_bill->'items')<>'array' or jsonb_array_length(v_bill->'items') not between 1 and 200 then
      raise exception using errcode='22023',message='invalid purchase invoice';
    end if;
    v_sum:=0;
    for v_line in select value from jsonb_array_elements(v_bill->'items') loop
      if jsonb_typeof(v_line)<>'object'
        or nullif(trim(v_line->>'name'),'') is null or length(trim(v_line->>'name'))>120
        or nullif(trim(v_line->>'unit'),'') is null or length(trim(v_line->>'unit'))>24
        or coalesce(v_line->>'quantity','') !~ '^([0-9]+)(\.[0-9]{1,3})?$'
        or (v_line->>'quantity')::numeric<=0
        or coalesce(v_line->>'unit_price','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
        or coalesce(v_line->>'line_total','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
        or (v_line->>'line_total')::numeric<0
        or abs(round((v_line->>'quantity')::numeric*(v_line->>'unit_price')::numeric,2)-(v_line->>'line_total')::numeric)>1 then
        raise exception using errcode='22023',message='invalid purchase invoice line';
      end if;
      v_sum:=v_sum+(v_line->>'line_total')::numeric;
    end loop;
    if abs(round(v_sum,2)-(v_bill->>'total_amount')::numeric)>1 then
      raise exception using errcode='22023',message='purchase invoice lines do not match the total';
    end if;
    insert into public.disha_suppliers(merchant_id,name) values(v_merchant_id,trim(v_bill->>'supplier_name'))
      on conflict(merchant_id,normalized_name) do update set name=excluded.name returning id into v_supplier_id;
    insert into public.disha_purchase_bills(merchant_id,supplier_id,bill_number,bill_date,total_amount,credit_days,source,source_file_name)
      values(v_merchant_id,v_supplier_id,trim(v_bill->>'bill_number'),(v_bill->>'bill_date')::date,(v_bill->>'total_amount')::numeric,coalesce((v_bill->>'credit_days')::integer,0),coalesce(v_bill->>'source','csv'),nullif(v_bill->>'source_file_name',''))
      on conflict(merchant_id,supplier_id,bill_date,bill_number) do update set total_amount=excluded.total_amount,credit_days=excluded.credit_days,source=excluded.source,source_file_name=excluded.source_file_name returning id into v_bill_id;
    delete from public.disha_purchase_bill_lines where merchant_id=v_merchant_id and purchase_bill_id=v_bill_id;
    insert into public.disha_purchase_bill_lines(merchant_id,purchase_bill_id,item_name,quantity,unit,unit_price,line_total)
      select v_merchant_id,v_bill_id,x->>'name',(x->>'quantity')::numeric,x->>'unit',(x->>'unit_price')::numeric,(x->>'line_total')::numeric from jsonb_array_elements(v_bill->'items') x;
    v_saved_count:=v_saved_count+1;
  end loop;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('merchant','supplier_invoice_import',jsonb_build_object('invoice_count',v_saved_count),'saved','supplier_purchase_history_imported',v_merchant_id);
  return v_saved_count;
end; $$;
revoke all on function public.disha_import_purchase_bills(jsonb) from public,anon;
grant execute on function public.disha_import_purchase_bills(jsonb) to authenticated;
