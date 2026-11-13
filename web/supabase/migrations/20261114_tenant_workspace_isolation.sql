create table if not exists public.disha_workspace_state (
  merchant_id uuid primary key references public.disha_merchants(id) on delete cascade,
  payload jsonb not null default '{"onHand":5,"billRecorded":69,"billExpected":96,"billNumber":1048,"salesTotal":14296,"billCount":62,"festivalMultiplier":1,"extraBills":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.disha_workspace_state enable row level security;
drop policy if exists disha_workspace_state_member_read on public.disha_workspace_state;
create policy disha_workspace_state_member_read on public.disha_workspace_state for select to authenticated using (exists (select 1 from public.disha_merchant_members m where m.merchant_id = disha_workspace_state.merchant_id and m.user_id = (select auth.uid())));
revoke all on public.disha_workspace_state from anon, authenticated;
grant select on public.disha_workspace_state to authenticated;

create or replace function public.disha_create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_merchant_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  if v_name is null or length(v_name) > 120 then raise exception using errcode = '22023', message = 'workspace name must be 1 to 120 characters'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  select m.merchant_id into v_merchant_id from public.disha_merchant_members m where m.user_id = v_user_id order by m.created_at asc limit 1;
  if v_merchant_id is not null then
    insert into public.disha_workspace_state (merchant_id) values (v_merchant_id) on conflict (merchant_id) do nothing;
    return v_merchant_id;
  end if;
  insert into public.disha_merchants (name) values (v_name) returning id into v_merchant_id;
  insert into public.disha_merchant_members (merchant_id, user_id, role) values (v_merchant_id, v_user_id, 'owner');
  insert into public.disha_workspace_state (merchant_id) values (v_merchant_id);
  return v_merchant_id;
end; $$;
revoke all on function public.disha_create_workspace(text) from public, anon;
grant execute on function public.disha_create_workspace(text) to authenticated;

alter table public.disha_purchase_drafts add column if not exists merchant_id uuid references public.disha_merchants(id) on delete cascade;

create or replace function public.disha_update_workspace_state(p_merchant_id uuid, p_patch jsonb, p_tool text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_role text; v_payload jsonb;
  v_decision text := case when p_tool = 'reset_demo' then 'reset' else 'edited' end;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  select m.role into v_role from public.disha_merchant_members m where m.user_id = v_user_id and m.merchant_id = p_merchant_id;
  if v_role is null then raise exception using errcode = '42501', message = 'workspace membership required'; end if;
  if p_tool = 'reset_demo' then
    if v_role <> 'owner' then raise exception using errcode = '42501', message = 'owner role required'; end if;
  elsif v_role not in ('owner','manager') then raise exception using errcode = '42501', message = 'manager role required'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or exists (select 1 from jsonb_object_keys(p_patch) as keys(key) where key not in ('onHand','billRecorded','billExpected','billNumber','salesTotal','billCount','festivalMultiplier','extraBills')) then raise exception using errcode = '22023', message = 'invalid workspace state patch'; end if;
  if p_tool not in ('demo_stock_editor','festival_multiplier','demo_bill_editor','reset_demo') then raise exception using errcode = '22023', message = 'invalid state change source'; end if;
  if p_patch ? 'onHand' and ((p_patch->>'onHand')::numeric < 0 or (p_patch->>'onHand')::numeric > 10000 or trunc((p_patch->>'onHand')::numeric) <> (p_patch->>'onHand')::numeric) then raise exception using errcode = '22023', message = 'invalid stock'; end if;
  if p_patch ? 'festivalMultiplier' and ((p_patch->>'festivalMultiplier')::numeric < 1 or (p_patch->>'festivalMultiplier')::numeric > 3) then raise exception using errcode = '22023', message = 'invalid festival multiplier'; end if;
  update public.disha_workspace_state s set payload = s.payload || p_patch, updated_at = now() where s.merchant_id = p_merchant_id returning payload into v_payload;
  if not found then raise exception using errcode = 'P0002', message = 'workspace state not found'; end if;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values ('merchant',p_tool,p_patch,v_decision,case when p_tool='reset_demo' then 'seed_state_restored' else 'saved' end,p_merchant_id);
  return v_payload;
end; $$;
revoke all on function public.disha_update_workspace_state(uuid, jsonb, text) from public, anon;
grant execute on function public.disha_update_workspace_state(uuid, jsonb, text) to authenticated;

create or replace function public.disha_resolve_workspace_proposal(p_merchant_id uuid, p_proposal_id uuid, p_decision text, p_language text default 'en', p_message_text text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_role text; v_proposal public.disha_proposals%rowtype; v_state jsonb;
  v_result jsonb := '{}'::jsonb; v_outcome text; v_message text; v_old numeric; v_new numeric;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'authentication required'; end if;
  select m.role into v_role from public.disha_merchant_members m where m.user_id=v_user_id and m.merchant_id=p_merchant_id;
  if v_role is null or v_role not in ('owner','manager') then raise exception using errcode = '42501', message = 'manager role required'; end if;
  if p_decision not in ('approve','reject') then raise exception using errcode = '22023', message = 'invalid decision'; end if;
  select * into v_proposal from public.disha_proposals p where p.id=p_proposal_id and p.merchant_id=p_merchant_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'proposal not found'; end if;
  if v_proposal.status <> 'PROPOSED' then raise exception using errcode = 'P0001', message = 'proposal already resolved'; end if;
  if p_decision = 'reject' then
    update public.disha_proposals set status='REJECTED',resolved_at=now(),outcome='rejected_by_merchant',result=jsonb_build_object('reason',left(coalesce(p_reason,'Dismissed by merchant'),300)) where id=p_proposal_id returning * into v_proposal;
    insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values ('merchant',v_proposal.type,v_proposal.facts,'rejected','rejected_by_merchant',p_merchant_id);
  else
    if v_proposal.type='billing_correction' then
      select payload into v_state from public.disha_workspace_state where merchant_id=p_merchant_id for update;
      v_old := (v_state->>'billRecorded')::numeric; v_new := (v_proposal.facts->>'expected')::numeric;
      update public.disha_workspace_state set payload=jsonb_set(payload,'{billRecorded}',to_jsonb(v_new),true),updated_at=now() where merchant_id=p_merchant_id;
      v_result := jsonb_build_object('old_value',v_old,'new_value',v_new); v_outcome := 'ledger_corrected_in_sandbox';
    elsif v_proposal.type='stock_update' then
      v_new := (v_proposal.facts->>'new_on_hand')::numeric;
      if v_new < 0 or v_new > 10000 or trunc(v_new)<>v_new then raise exception using errcode='22023',message='invalid stock update'; end if;
      select payload into v_state from public.disha_workspace_state where merchant_id=p_merchant_id for update;
      v_old := (v_state->>'onHand')::numeric;
      update public.disha_workspace_state set payload=jsonb_set(payload,'{onHand}',to_jsonb(v_new),true),updated_at=now() where merchant_id=p_merchant_id;
      v_result := jsonb_build_object('old_value',v_old,'new_value',v_new); v_outcome := 'stock_updated_in_sandbox';
    elsif v_proposal.type='message' then
      if p_language not in ('te','en') then raise exception using errcode='22023',message='unsupported language'; end if;
      v_message := coalesce(nullif(trim(p_message_text),''),case when p_language='te' then v_proposal.facts->>'message_text_te' else v_proposal.facts->>'message_text_en' end);
      if v_message is null or length(v_message)>500 or v_message ~* '(guaranteed|approved loan|pre-approved)' then raise exception using errcode='22023',message='invalid message'; end if;
      insert into public.disha_outbox(proposal_id,customer_id,language,message_text,simulated,merchant_id) values (p_proposal_id,coalesce(v_proposal.facts->>'customer_id','demo-customer'),p_language,v_message,true,p_merchant_id);
      v_result := jsonb_build_object('simulated',true,'message_text',v_message); v_outcome := 'sent_in_sandbox';
    elsif v_proposal.type='reorder' then
      if (v_proposal.facts->>'qty')::integer not between 1 and 10000 then raise exception using errcode='22023',message='invalid reorder quantity'; end if;
      insert into public.disha_purchase_drafts(proposal_id,sku_id,quantity,supplier_name,merchant_id) values (p_proposal_id,v_proposal.facts->>'sku_id',(v_proposal.facts->>'qty')::integer,coalesce(v_proposal.facts->>'supplier_name','Local supplier'),p_merchant_id);
      v_result := jsonb_build_object('draft_saved',true,'quantity',(v_proposal.facts->>'qty')::integer); v_outcome := 'purchase_draft_saved_in_sandbox';
    else raise exception using errcode='22023',message='unsupported proposal type'; end if;
    update public.disha_proposals set status='EXECUTED',resolved_at=now(),outcome=v_outcome,result=v_result where id=p_proposal_id returning * into v_proposal;
    insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id) values ('merchant',v_proposal.type,v_proposal.facts,'approved',v_outcome,p_merchant_id);
  end if;
  return to_jsonb(v_proposal);
end; $$;
revoke all on function public.disha_resolve_workspace_proposal(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.disha_resolve_workspace_proposal(uuid,uuid,text,text,text,text) to authenticated;
