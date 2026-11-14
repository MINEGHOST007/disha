-- One merchant-managed regional/festival planning scenario per store.
-- The uplift is a merchant estimate until the merchant has tagged event history.
create table if not exists public.disha_seasonal_order_scenarios (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.disha_merchants(id) on delete cascade,
  state text not null check(length(trim(state)) between 2 and 80),
  district text not null check(length(trim(district)) between 2 and 100),
  festival_name text not null check(length(trim(festival_name)) between 2 and 100),
  event_date date not null,
  uplift_percent numeric(5,2) not null check(uplift_percent between 0 and 200),
  source text not null default 'merchant_estimate' check(source in ('merchant_estimate','merchant_history')),
  updated_at timestamptz not null default now()
);

alter table public.disha_seasonal_order_scenarios enable row level security;
revoke all on public.disha_seasonal_order_scenarios from anon,authenticated;
grant select on public.disha_seasonal_order_scenarios to authenticated;
drop policy if exists disha_seasonal_order_scenarios_member_read on public.disha_seasonal_order_scenarios;
create policy disha_seasonal_order_scenarios_member_read on public.disha_seasonal_order_scenarios for select to authenticated
  using (exists(select 1 from public.disha_merchant_members m where m.merchant_id=disha_seasonal_order_scenarios.merchant_id and m.user_id=(select auth.uid())));

create or replace function public.disha_save_seasonal_order_scenario(
  p_state text,p_district text,p_festival text,p_event_date date,p_uplift_percent numeric
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_row public.disha_seasonal_order_scenarios%rowtype;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_state),'') is null or length(trim(p_state))>80 or nullif(trim(p_district),'') is null or length(trim(p_district))>100
    or nullif(trim(p_festival),'') is null or length(trim(p_festival))>100 or p_event_date is null
    or p_uplift_percent is null or p_uplift_percent<0 or p_uplift_percent>200 then
    raise exception using errcode='22023',message='invalid regional festival scenario';
  end if;
  insert into public.disha_seasonal_order_scenarios(merchant_id,state,district,festival_name,event_date,uplift_percent,source,updated_at)
    values(v_mid,trim(p_state),trim(p_district),trim(p_festival),p_event_date,p_uplift_percent,'merchant_estimate',now())
    on conflict(merchant_id) do update set state=excluded.state,district=excluded.district,festival_name=excluded.festival_name,
      event_date=excluded.event_date,uplift_percent=excluded.uplift_percent,source='merchant_estimate',updated_at=now()
    returning * into v_row;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('merchant','regional_festival_scenario_save',jsonb_build_object('state',v_row.state,'district',v_row.district,'festival',v_row.festival_name,
      'event_date',v_row.event_date,'uplift_percent',v_row.uplift_percent,'source',v_row.source),'saved','merchant_estimate_saved',v_mid);
  return to_jsonb(v_row);
end; $$;
revoke all on function public.disha_save_seasonal_order_scenario(text,text,text,date,numeric) from public,anon;
grant execute on function public.disha_save_seasonal_order_scenario(text,text,text,date,numeric) to authenticated;

comment on table public.disha_seasonal_order_scenarios is 'Merchant-entered region/event planning scenario; uplift is not a regional benchmark and requires merchant calibration.';

-- Allow read-only GST and local-festival forecast tools in the assistant audit log.
create or replace function public.disha_log_agent_query(p_tools jsonb, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_merchant_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_tools is null or jsonb_typeof(p_tools)<>'array' or jsonb_array_length(p_tools)>12 or p_language not in ('en','te')
    or exists(select 1 from jsonb_array_elements(p_tools) item where jsonb_typeof(item)<>'string'
      or item #>> '{}' not in ('find_payments_from','get_cashflow_summary','get_purchase_history','forecast_next_orders','get_customer_frequency','get_khata_summary','get_gst_summary','forecast_regional_festival_order')) then
    raise exception using errcode='22023',message='invalid query audit facts';
  end if;
  select merchant_id into v_merchant_id from public.disha_merchant_members where user_id=v_user_id order by created_at limit 1;
  if v_merchant_id is null then raise exception using errcode='42501',message='workspace membership required'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('agent','merchant_data_query',jsonb_build_object('tools',p_tools,'language',p_language),'read','answered_from_merchant_data',v_merchant_id);
end; $$;
revoke all on function public.disha_log_agent_query(jsonb,text) from public,anon;
grant execute on function public.disha_log_agent_query(jsonb,text) to authenticated;
