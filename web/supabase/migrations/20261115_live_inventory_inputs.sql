-- Supplier purchase history is the source for Disha's first replenishment forecast.
-- New workspaces stay empty; legacy state rows are preserved and no longer read by the app.
alter table public.disha_workspace_state alter column payload set default '{}'::jsonb;

-- Retire write functions used by the old synthetic demo interface.
revoke all on function public.disha_update_demo_state(jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.disha_reset_demo() from public, anon, authenticated;
revoke all on function public.disha_update_workspace_state(uuid,jsonb,text) from public, anon, authenticated;
revoke all on function public.disha_resolve_workspace_proposal(uuid,uuid,text,text,text,text) from public, anon, authenticated;

grant select on public.disha_merchants to authenticated;
drop policy if exists disha_merchants_member_read on public.disha_merchants;
create policy disha_merchants_member_read on public.disha_merchants
  for select to authenticated using (exists (
    select 1 from public.disha_merchant_members m
    where m.merchant_id = disha_merchants.id and m.user_id = (select auth.uid())
  ));

-- Merchant sales bills carry the tender field used for the digital-collections projection.
create table if not exists public.disha_store_bills (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  bill_number text not null check (length(trim(bill_number)) between 1 and 80),
  bill_date date not null,
  customer_name text check (customer_name is null or length(trim(customer_name)) <= 120),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  payment_mode text check (payment_mode is null or length(trim(payment_mode)) <= 40),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  source text not null check (source in ('csv','manual')),
  created_at timestamptz not null default now(),
  unique (merchant_id, bill_date, bill_number)
);
create index if not exists disha_store_bills_merchant_date_idx on public.disha_store_bills (merchant_id,bill_date desc);
alter table public.disha_store_bills enable row level security;
revoke all on public.disha_store_bills from anon, authenticated;
grant select on public.disha_store_bills to authenticated;
drop policy if exists disha_store_bills_member_read on public.disha_store_bills;
create policy disha_store_bills_member_read on public.disha_store_bills for select to authenticated
  using (exists (select 1 from public.disha_merchant_members m where m.merchant_id=disha_store_bills.merchant_id and m.user_id=(select auth.uid())));

create table if not exists public.disha_suppliers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  unique (merchant_id, normalized_name),
  unique (merchant_id, id)
);

create table if not exists public.disha_purchase_bills (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  supplier_id uuid not null,
  bill_number text not null check (length(trim(bill_number)) between 1 and 80),
  bill_date date not null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  credit_days integer not null default 0 check (credit_days between 0 and 365),
  source text not null check (source in ('csv', 'sarvam_vision', 'openrouter_vision')),
  source_file_name text check (source_file_name is null or length(source_file_name) <= 180),
  created_at timestamptz not null default now(),
  foreign key (merchant_id, supplier_id) references public.disha_suppliers(merchant_id, id) on delete cascade,
  unique (merchant_id, supplier_id, bill_date, bill_number),
  unique (merchant_id, id)
);

create table if not exists public.disha_purchase_bill_lines (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  purchase_bill_id uuid not null,
  item_name text not null check (length(trim(item_name)) between 1 and 120),
  normalized_item_name text generated always as (lower(regexp_replace(trim(item_name), '\s+', ' ', 'g'))) stored,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) between 1 and 24),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  foreign key (merchant_id, purchase_bill_id) references public.disha_purchase_bills(merchant_id, id) on delete cascade
);

create index if not exists disha_purchase_bills_merchant_date_idx
  on public.disha_purchase_bills (merchant_id, bill_date desc);
create index if not exists disha_purchase_bills_supplier_date_idx
  on public.disha_purchase_bills (merchant_id, supplier_id, bill_date desc);
create index if not exists disha_purchase_lines_merchant_item_idx
  on public.disha_purchase_bill_lines (merchant_id, normalized_item_name);

alter table public.disha_suppliers enable row level security;
alter table public.disha_purchase_bills enable row level security;
alter table public.disha_purchase_bill_lines enable row level security;
revoke all on public.disha_suppliers, public.disha_purchase_bills, public.disha_purchase_bill_lines from anon, authenticated;
grant select on public.disha_suppliers, public.disha_purchase_bills, public.disha_purchase_bill_lines to authenticated;

drop policy if exists disha_suppliers_member_read on public.disha_suppliers;
create policy disha_suppliers_member_read on public.disha_suppliers for select to authenticated
  using (exists (select 1 from public.disha_merchant_members m where m.merchant_id=disha_suppliers.merchant_id and m.user_id=(select auth.uid())));
drop policy if exists disha_purchase_bills_member_read on public.disha_purchase_bills;
create policy disha_purchase_bills_member_read on public.disha_purchase_bills for select to authenticated
  using (exists (select 1 from public.disha_merchant_members m where m.merchant_id=disha_purchase_bills.merchant_id and m.user_id=(select auth.uid())));
drop policy if exists disha_purchase_lines_member_read on public.disha_purchase_bill_lines;
create policy disha_purchase_lines_member_read on public.disha_purchase_bill_lines for select to authenticated
  using (exists (select 1 from public.disha_merchant_members m where m.merchant_id=disha_purchase_bill_lines.merchant_id and m.user_id=(select auth.uid())));

create or replace function public.disha_log_agent_query(p_tools jsonb, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_merchant_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  if p_tools is null or jsonb_typeof(p_tools) <> 'array' or jsonb_array_length(p_tools) > 12 or p_language not in ('en','te')
    or exists (select 1 from jsonb_array_elements(p_tools) item where jsonb_typeof(item) <> 'string'
      or item #>> '{}' not in ('get_sales_summary','search_bills','get_supplier_purchase_history','search_purchase_bills','forecast_next_orders','project_order_cash_gap')) then
    raise exception using errcode = '22023', message = 'invalid query audit facts';
  end if;
  select m.merchant_id into v_merchant_id from public.disha_merchant_members m
  where m.user_id=v_user_id order by m.created_at asc limit 1;
  if v_merchant_id is null then raise exception using errcode = '42501', message = 'workspace membership required'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
  values ('agent','merchant_data_query',jsonb_build_object('tools',p_tools,'language',p_language),'read','answered_from_merchant_data',v_merchant_id);
end; $$;
revoke all on function public.disha_log_agent_query(jsonb,text) from public, anon;
grant execute on function public.disha_log_agent_query(jsonb,text) to authenticated;

create or replace function public.disha_import_purchase_bills(p_bills jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_merchant_id uuid;
  v_role text;
  v_bill jsonb;
  v_line jsonb;
  v_supplier_id uuid;
  v_bill_id uuid;
  v_sum numeric(14,2);
  v_saved_count integer := 0;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  if p_bills is null or jsonb_typeof(p_bills) <> 'array' or jsonb_array_length(p_bills) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'purchase import requires 1 to 50 invoices';
  end if;
  select m.merchant_id, m.role into v_merchant_id, v_role
  from public.disha_merchant_members m where m.user_id=v_user_id and m.role in ('owner','manager')
  order by m.created_at asc limit 1;
  if v_merchant_id is null then raise exception using errcode = '42501', message = 'manager role required'; end if;

  for v_bill in select value from jsonb_array_elements(p_bills) loop
    if jsonb_typeof(v_bill) <> 'object'
      or nullif(trim(v_bill->>'supplier_name'),'') is null or length(trim(v_bill->>'supplier_name')) > 120
      or nullif(trim(v_bill->>'bill_number'),'') is null or length(trim(v_bill->>'bill_number')) > 80
      or coalesce(v_bill->>'bill_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(v_bill->>'total_amount','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
      or (v_bill->>'total_amount')::numeric < 0
      or coalesce(v_bill->>'credit_days','0') !~ '^\d{1,3}$'
      or coalesce((v_bill->>'credit_days')::integer,0) > 365
      or jsonb_typeof(v_bill->'items') <> 'array'
      or jsonb_array_length(v_bill->'items') not between 1 and 200 then
      raise exception using errcode = '22023', message = 'invalid purchase invoice';
    end if;
    v_sum := 0;
    for v_line in select value from jsonb_array_elements(v_bill->'items') loop
      if jsonb_typeof(v_line) <> 'object'
        or nullif(trim(v_line->>'name'),'') is null or length(trim(v_line->>'name')) > 120
        or nullif(trim(v_line->>'unit'),'') is null or length(trim(v_line->>'unit')) > 24
        or coalesce(v_line->>'quantity','') !~ '^([0-9]+)(\.[0-9]{1,3})?$'
        or (v_line->>'quantity')::numeric <= 0
        or coalesce(v_line->>'unit_price','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
        or coalesce(v_line->>'line_total','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
        or (v_line->>'line_total')::numeric < 0
        or abs(round((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric,2) - (v_line->>'line_total')::numeric) > 0.01 then
        raise exception using errcode = '22023', message = 'invalid purchase invoice line';
      end if;
      v_sum := v_sum + (v_line->>'line_total')::numeric;
    end loop;
    if abs(round(v_sum,2) - (v_bill->>'total_amount')::numeric) > 0.01 then
      raise exception using errcode = '22023', message = 'purchase invoice lines do not match the total';
    end if;

    insert into public.disha_suppliers(merchant_id,name) values (v_merchant_id,trim(v_bill->>'supplier_name'))
    on conflict (merchant_id,normalized_name) do update set name=excluded.name returning id into v_supplier_id;

    insert into public.disha_purchase_bills(merchant_id,supplier_id,bill_number,bill_date,total_amount,credit_days,source,source_file_name)
    values (v_merchant_id,v_supplier_id,trim(v_bill->>'bill_number'),(v_bill->>'bill_date')::date,(v_bill->>'total_amount')::numeric,coalesce((v_bill->>'credit_days')::integer,0),coalesce(v_bill->>'source','csv'),nullif(v_bill->>'source_file_name',''))
    on conflict (merchant_id,supplier_id,bill_date,bill_number) do update set
      total_amount=excluded.total_amount,credit_days=excluded.credit_days,source=excluded.source,source_file_name=excluded.source_file_name
    returning id into v_bill_id;

    delete from public.disha_purchase_bill_lines where merchant_id=v_merchant_id and purchase_bill_id=v_bill_id;
    insert into public.disha_purchase_bill_lines(merchant_id,purchase_bill_id,item_name,quantity,unit,unit_price,line_total)
    select v_merchant_id,v_bill_id,x->>'name',(x->>'quantity')::numeric,x->>'unit',(x->>'unit_price')::numeric,(x->>'line_total')::numeric
    from jsonb_array_elements(v_bill->'items') x;
    v_saved_count := v_saved_count + 1;
  end loop;

  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
  values ('merchant','supplier_invoice_import',jsonb_build_object('invoice_count',v_saved_count),'saved','supplier_purchase_history_imported',v_merchant_id);
  return v_saved_count;
end; $$;
revoke all on function public.disha_import_purchase_bills(jsonb) from public, anon;
grant execute on function public.disha_import_purchase_bills(jsonb) to authenticated;

create or replace function public.disha_import_store_bills(p_bills jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_merchant_id uuid;
  v_bill jsonb;
  v_saved_count integer := 0;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  if jsonb_typeof(p_bills) <> 'array' or jsonb_array_length(p_bills) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'sales import requires 1 to 5000 bills';
  end if;
  select m.merchant_id into v_merchant_id from public.disha_merchant_members m
  where m.user_id=v_user_id and m.role in ('owner','manager')
  order by m.created_at asc limit 1;
  if v_merchant_id is null then raise exception using errcode = '42501', message = 'manager role required'; end if;

  for v_bill in select value from jsonb_array_elements(p_bills) loop
    if nullif(trim(v_bill->>'bill_number'),'') is null or length(trim(v_bill->>'bill_number')) > 80
      or coalesce(v_bill->>'bill_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(v_bill->>'total_amount','') !~ '^([0-9]+)(\.[0-9]{1,2})?$'
      or (v_bill->>'total_amount')::numeric < 0
      or jsonb_typeof(v_bill->'items') <> 'array'
      or jsonb_array_length(v_bill->'items') not between 1 and 200 then
      raise exception using errcode = '22023', message = 'invalid sales bill';
    end if;
    insert into public.disha_store_bills(merchant_id,bill_number,bill_date,customer_name,total_amount,payment_mode,items,source)
    values (v_merchant_id,trim(v_bill->>'bill_number'),(v_bill->>'bill_date')::date,nullif(trim(v_bill->>'customer_name'),''),(v_bill->>'total_amount')::numeric,nullif(trim(v_bill->>'payment_mode'),''),v_bill->'items','csv')
    on conflict (merchant_id,bill_date,bill_number) do update set
      customer_name=excluded.customer_name,total_amount=excluded.total_amount,payment_mode=excluded.payment_mode,items=excluded.items,source='csv';
    v_saved_count := v_saved_count + 1;
  end loop;

  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
  values ('merchant','sales_bill_import',jsonb_build_object('bill_count',v_saved_count),'saved','merchant_sales_imported',v_merchant_id);
  return v_saved_count;
end; $$;
revoke all on function public.disha_import_store_bills(jsonb) from public, anon;
grant execute on function public.disha_import_store_bills(jsonb) to authenticated;
