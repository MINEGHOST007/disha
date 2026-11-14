-- GST due tracker: merchant-entered liabilities and merchant-recorded payments only.
create table if not exists public.disha_tax_obligations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.disha_merchants(id) on delete cascade,
  tax_type text not null default 'GST' check (tax_type = 'GST'),
  tax_period text not null check (length(trim(tax_period)) between 1 and 32),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  due_date date not null,
  payment_reference text check (payment_reference is null or length(payment_reference) <= 120),
  note text check (note is null or length(note) <= 300),
  status text not null default 'due' check (status in ('due','partially_paid','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (merchant_id,id),
  unique (merchant_id,tax_period)
);
create index if not exists disha_tax_obligations_due_idx on public.disha_tax_obligations(merchant_id,status,due_date);
alter table public.disha_tax_obligations enable row level security;
revoke all on public.disha_tax_obligations from anon,authenticated;
grant select on public.disha_tax_obligations to authenticated;
drop policy if exists disha_tax_obligations_member_read on public.disha_tax_obligations;
create policy disha_tax_obligations_member_read on public.disha_tax_obligations for select to authenticated
  using (exists(select 1 from public.disha_merchant_members m where m.merchant_id=disha_tax_obligations.merchant_id and m.user_id=(select auth.uid())));

create or replace function public.disha_create_tax_obligation(p_period text,p_amount numeric,p_due date,p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_id uuid;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_period),'') is null or length(trim(p_period))>32 or p_amount is null or p_amount<=0 or p_due is null or (p_note is not null and length(p_note)>300) then raise exception using errcode='22023',message='invalid GST obligation'; end if;
  insert into public.disha_tax_obligations(merchant_id,tax_period,amount,due_date,note) values(v_mid,trim(p_period),p_amount,p_due,nullif(trim(p_note),'')) returning id into v_id;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','gst_obligation_create',jsonb_build_object('obligation_id',v_id,'period',trim(p_period),'amount',p_amount,'due_date',p_due),'saved','gst_due_recorded',v_mid);
  return v_id;
end; $$;
revoke all on function public.disha_create_tax_obligation(text,numeric,date,text) from public,anon;
grant execute on function public.disha_create_tax_obligation(text,numeric,date,text) to authenticated;

create or replace function public.disha_record_tax_payment(p_id uuid,p_amount numeric default null,p_reference text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; o public.disha_tax_obligations%rowtype; v_take numeric;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  select * into o from public.disha_tax_obligations where id=p_id and merchant_id=v_mid for update;
  if not found or o.status='paid' then raise exception using errcode='P0002',message='unpaid GST record not found'; end if;
  v_take:=coalesce(p_amount,o.amount-o.paid_amount);
  if v_take<=0 or v_take>o.amount-o.paid_amount or (p_reference is not null and length(p_reference)>120) then raise exception using errcode='22023',message='invalid GST payment amount or reference'; end if;
  update public.disha_tax_obligations set paid_amount=paid_amount+v_take,status=case when paid_amount+v_take>=amount then 'paid' else 'partially_paid' end,
    payment_reference=coalesce(nullif(trim(p_reference),''),payment_reference),paid_at=case when paid_amount+v_take>=amount then now() else null end
    where id=o.id returning * into o;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values('merchant','gst_payment_record',jsonb_build_object('obligation_id',o.id,'amount',v_take,'reference',p_reference),'recorded',o.status,v_mid);
  return to_jsonb(o);
end; $$;
revoke all on function public.disha_record_tax_payment(uuid,numeric,text) from public,anon;
grant execute on function public.disha_record_tax_payment(uuid,numeric,text) to authenticated;

comment on table public.disha_tax_obligations is 'Merchant-entered GST amount and due date; not a tax calculation or payment gateway.';
