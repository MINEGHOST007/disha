-- Merchant supplied activity: supplier orders, digital transactions, customer aliases, Khata.
-- No data is inserted here. Every row is scoped to the signed-in merchant.

create table if not exists public.disha_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  external_id text not null check (length(trim(external_id)) between 1 and 160),
  occurred_at timestamptz not null,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  mode text not null check (length(trim(mode)) between 1 and 40),
  status text not null check (status in ('success','failed','pending')),
  created_at timestamptz not null default now(),
  unique (merchant_id, external_id),
  unique (merchant_id, id)
);
create index if not exists disha_transactions_merchant_time_idx on public.disha_transactions(merchant_id, occurred_at desc);

create table if not exists public.disha_customer_aliases (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  alias text not null check (length(trim(alias)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (merchant_id, customer_name, alias)
);

create table if not exists public.disha_khata_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  note text check (note is null or length(note) <= 300),
  due_date date,
  auto_match boolean not null default false,
  status text not null default 'open' check (status in ('open','partially_paid','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (merchant_id, id)
);
create index if not exists disha_khata_merchant_status_idx on public.disha_khata_entries(merchant_id, status, created_at);

create table if not exists public.disha_khata_allocations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  entry_id uuid not null,
  transaction_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  source text not null check (source in ('auto_transaction','manual')),
  created_at timestamptz not null default now(),
  foreign key (merchant_id, entry_id) references public.disha_khata_entries(merchant_id,id) on delete cascade,
  foreign key (merchant_id, transaction_id) references public.disha_transactions(merchant_id,id) on delete restrict
);

create table if not exists public.disha_order_drafts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  supplier_name text not null check (length(trim(supplier_name)) between 1 and 120),
  supplier_phone text check (supplier_phone is null or supplier_phone ~ '^\+[1-9][0-9]{7,14}$'),
  order_date date,
  status text not null default 'draft' check (status in ('draft','approved','calling','placed','needs_review','cancelled')),
  order_total numeric(14,2) not null default 0 check (order_total >= 0),
  call_room text,
  call_status text,
  seller_confirmation text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, id)
);
create table if not exists public.disha_order_draft_lines (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  order_id uuid not null,
  item_name text not null check (length(trim(item_name)) between 1 and 120),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) between 1 and 24),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  foreign key (merchant_id, order_id) references public.disha_order_drafts(merchant_id,id) on delete cascade
);

alter table public.disha_transactions enable row level security;
alter table public.disha_customer_aliases enable row level security;
alter table public.disha_khata_entries enable row level security;
alter table public.disha_khata_allocations enable row level security;
alter table public.disha_order_drafts enable row level security;
alter table public.disha_order_draft_lines enable row level security;
revoke all on public.disha_transactions, public.disha_customer_aliases, public.disha_khata_entries,
  public.disha_khata_allocations, public.disha_order_drafts, public.disha_order_draft_lines from anon, authenticated;
grant select on public.disha_transactions, public.disha_customer_aliases, public.disha_khata_entries,
  public.disha_khata_allocations, public.disha_order_drafts, public.disha_order_draft_lines to authenticated;

do $$
declare t text;
begin
  foreach t in array array['disha_transactions','disha_customer_aliases','disha_khata_entries','disha_khata_allocations','disha_order_drafts','disha_order_draft_lines'] loop
    execute format('drop policy if exists %I on public.%I', t || '_member_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.disha_merchant_members m where m.merchant_id = %I.merchant_id and m.user_id = (select auth.uid())))', t || '_member_read', t, t);
  end loop;
end $$;

-- The audit log is append-only, including when called by authenticated database clients.
create or replace function public.disha_prevent_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception using errcode='42501', message='audit events are append-only'; end; $$;
drop trigger if exists disha_audit_no_mutation on public.disha_audit_log;
create trigger disha_audit_no_mutation before update or delete on public.disha_audit_log
for each row execute function public.disha_prevent_audit_mutation();

create or replace function public.disha_import_transactions(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_mid uuid; v_role text; r jsonb; v_id uuid; v_saved integer := 0; e record; v_left numeric;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id, role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 then raise exception using errcode='22023',message='transactions require 1 to 10000 rows'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if nullif(trim(r->>'external_id'),'') is null or length(r->>'external_id')>160
      or nullif(trim(r->>'customer_name'),'') is null or length(r->>'customer_name')>120
      or coalesce(r->>'occurred_at','') !~ '^\d{4}-\d{2}-\d{2}T'
      or coalesce(r->>'amount','') !~ '^([0-9]+)(\.[0-9]{1,2})?$' or (r->>'amount')::numeric<=0
      or nullif(trim(r->>'mode'),'') is null or length(r->>'mode')>40
      or coalesce(r->>'status','') not in ('success','failed','pending') then raise exception using errcode='22023',message='invalid transaction row'; end if;
    insert into public.disha_transactions(merchant_id,external_id,occurred_at,customer_name,amount,mode,status)
    values(v_mid,trim(r->>'external_id'),(r->>'occurred_at')::timestamptz,trim(r->>'customer_name'),(r->>'amount')::numeric,trim(r->>'mode'),r->>'status')
    on conflict(merchant_id,external_id) do update set occurred_at=excluded.occurred_at,customer_name=excluded.customer_name,amount=excluded.amount,mode=excluded.mode,status=excluded.status
    returning id into v_id;
    v_saved:=v_saved+1;
    if r->>'status'='success' then
      v_left:=(r->>'amount')::numeric;
      for e in select k.* from public.disha_khata_entries k
        where k.merchant_id=v_mid and k.auto_match and k.status<>'closed' and lower(trim(k.customer_name))=lower(trim(r->>'customer_name'))
          and k.created_at <= (r->>'occurred_at')::timestamptz order by k.created_at for update loop
        exit when v_left<=0;
        declare v_take numeric; begin
          v_take:=least(e.amount-e.paid_amount,v_left);
          if v_take>0 then
            insert into public.disha_khata_allocations(merchant_id,entry_id,transaction_id,amount,source) values(v_mid,e.id,v_id,v_take,'auto_transaction');
            update public.disha_khata_entries set paid_amount=paid_amount+v_take,status=case when paid_amount+v_take>=amount then 'closed' else 'partially_paid' end,closed_at=case when paid_amount+v_take>=amount then now() else null end where id=e.id;
            v_left:=v_left-v_take;
          end if;
        end;
      end loop;
    end if;
  end loop;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','transaction_import',jsonb_build_object('count',v_saved),'saved','merchant_transactions_imported',v_mid);
  return v_saved;
end; $$;
revoke all on function public.disha_import_transactions(jsonb) from public,anon;
grant execute on function public.disha_import_transactions(jsonb) to authenticated;

create or replace function public.disha_create_khata(p_customer text,p_amount numeric,p_due date,p_auto boolean,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_id uuid;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_customer),'') is null or length(p_customer)>120 or p_amount is null or p_amount<=0 or (p_note is not null and length(p_note)>300) then raise exception using errcode='22023',message='invalid Khata entry'; end if;
  insert into public.disha_khata_entries(merchant_id,customer_name,amount,due_date,auto_match,note) values(v_mid,trim(p_customer),p_amount,p_due,p_auto,nullif(trim(p_note),'')) returning id into v_id;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','khata_create',jsonb_build_object('entry_id',v_id,'customer',trim(p_customer),'amount',p_amount,'auto_match',p_auto),'saved','khata_opened',v_mid);
  return v_id;
end; $$;
revoke all on function public.disha_create_khata(text,numeric,date,boolean,text) from public,anon;
grant execute on function public.disha_create_khata(text,numeric,date,boolean,text) to authenticated;

create or replace function public.disha_settle_khata(p_entry uuid,p_amount numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; e public.disha_khata_entries%rowtype; v_take numeric;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  select * into e from public.disha_khata_entries where id=p_entry and merchant_id=v_mid for update;
  if not found or e.status='closed' then raise exception using errcode='P0002',message='open Khata entry not found'; end if;
  v_take:=coalesce(p_amount,e.amount-e.paid_amount);
  if v_take<=0 or v_take>e.amount-e.paid_amount then raise exception using errcode='22023',message='amount must be within the outstanding balance'; end if;
  insert into public.disha_khata_allocations(merchant_id,entry_id,amount,source) values(v_mid,e.id,v_take,'manual');
  update public.disha_khata_entries set paid_amount=paid_amount+v_take,status=case when paid_amount+v_take>=amount then 'closed' else 'partially_paid' end,closed_at=case when paid_amount+v_take>=amount then now() else null end where id=e.id returning * into e;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','khata_settle',jsonb_build_object('entry_id',e.id,'amount',v_take),'saved',e.status,v_mid);
  return to_jsonb(e);
end; $$;
revoke all on function public.disha_settle_khata(uuid,numeric) from public,anon;
grant execute on function public.disha_settle_khata(uuid,numeric) to authenticated;

create or replace function public.disha_save_order_draft(p_supplier text,p_phone text,p_order_date date,p_lines jsonb,p_approve boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_id uuid; v_total numeric(14,2):=0; l jsonb;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_supplier),'') is null or length(p_supplier)>120 or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$')
    or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception using errcode='22023',message='invalid order draft'; end if;
  for l in select value from jsonb_array_elements(p_lines) loop
    if nullif(trim(l->>'item_name'),'') is null or length(l->>'item_name')>120
      or coalesce(l->>'quantity','') !~ '^([0-9]+)(\.[0-9]{1,3})?$' or (l->>'quantity')::numeric<=0
      or nullif(trim(l->>'unit'),'') is null or length(l->>'unit')>24
      or coalesce(l->>'unit_price','') !~ '^([0-9]+)(\.[0-9]{1,2})?$' or (l->>'unit_price')::numeric<0 then
      raise exception using errcode='22023',message='invalid order line'; end if;
    v_total:=v_total+round((l->>'quantity')::numeric*(l->>'unit_price')::numeric,2);
  end loop;
  insert into public.disha_order_drafts(merchant_id,supplier_name,supplier_phone,order_date,status,order_total,approved_at)
  values(v_mid,trim(p_supplier),p_phone,p_order_date,case when p_approve then 'approved' else 'draft' end,v_total,case when p_approve then now() else null end) returning id into v_id;
  insert into public.disha_order_draft_lines(merchant_id,order_id,item_name,quantity,unit,unit_price,line_total)
  select v_mid,v_id,l->>'item_name',(l->>'quantity')::numeric,l->>'unit',(l->>'unit_price')::numeric,round((l->>'quantity')::numeric*(l->>'unit_price')::numeric,2)
  from jsonb_array_elements(p_lines) l;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','order_draft_create',jsonb_build_object('order_id',v_id,'supplier',trim(p_supplier),'total',v_total,'approved',p_approve),case when p_approve then 'approved' else 'saved' end,'order_draft_saved',v_mid);
  return v_id;
end; $$;
revoke all on function public.disha_save_order_draft(text,text,date,jsonb,boolean) from public,anon;
grant execute on function public.disha_save_order_draft(text,text,date,jsonb,boolean) to authenticated;

create or replace function public.disha_approve_order(p_order uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_order_drafts%rowtype;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  update public.disha_order_drafts set status='approved',approved_at=now(),updated_at=now()
    where id=p_order and merchant_id=v_mid and status='draft' returning * into o;
  if not found then raise exception using errcode='P0001',message='order draft is missing or already resolved'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','supplier_order_approve',jsonb_build_object('order_id',o.id,'total',o.order_total),'approved','order_approved_for_manual_placement',v_mid);
  return to_jsonb(o);
end; $$;
revoke all on function public.disha_approve_order(uuid) from public,anon;
grant execute on function public.disha_approve_order(uuid) to authenticated;
