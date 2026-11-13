create or replace function public.disha_reset_demo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_audit_id bigint;
  v_payload jsonb := '{"onHand":5,"billRecorded":69,"billExpected":96,"billNumber":1048,"salesTotal":14296,"billCount":62}'::jsonb;
begin
  delete from public.disha_proposals where id is not null;
  insert into public.disha_audit_log (actor, tool, facts, decision, outcome)
  values ('system', 'reset_demo', '{}'::jsonb, 'reset', 'seed_restored')
  returning id into v_audit_id;
  update public.disha_demo_state
  set payload = v_payload, audit_cursor = v_audit_id, updated_at = now()
  where id = 'demo';
  return v_payload;
end;
$function$;
