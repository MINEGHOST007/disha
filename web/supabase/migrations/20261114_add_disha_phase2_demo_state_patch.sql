create or replace function public.disha_update_demo_state(p_patch jsonb, p_tool text, p_facts jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload jsonb;
  v_audit_id bigint;
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Demo state patch must be an object' using errcode = '22023';
  end if;
  if p_tool not in ('demo_stock_editor', 'demo_bill_editor', 'festival_multiplier') then
    raise exception 'Unsupported demo state action' using errcode = '22023';
  end if;

  select payload into v_payload
  from public.disha_demo_state
  where id = 'demo'
  for update;

  if not found then
    raise exception 'Disha demo state is not initialized' using errcode = 'P0002';
  end if;

  v_payload := v_payload || p_patch;

  insert into public.disha_audit_log (actor, tool, facts, decision, outcome)
  values ('merchant', p_tool, coalesce(p_facts, '{}'::jsonb), 'edited', 'saved_in_sandbox')
  returning id into v_audit_id;

  update public.disha_demo_state
  set payload = v_payload, updated_at = now()
  where id = 'demo';

  return v_payload;
end;
$function$;

revoke all on function public.disha_update_demo_state(jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.disha_update_demo_state(jsonb, text, jsonb) to service_role;
