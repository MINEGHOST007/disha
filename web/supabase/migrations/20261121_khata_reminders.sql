-- Optional customer contact information for merchant-reviewed overdue reminders.
alter table public.disha_khata_entries
  add column if not exists contact_phone text
  check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$');

create or replace function public.disha_create_khata_with_phone(
  p_customer text,
  p_amount numeric,
  p_due date,
  p_auto boolean,
  p_note text,
  p_phone text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_mid uuid; v_role text; v_id uuid;
begin
  if v_user is null then raise exception using errcode='28000',message='authentication required'; end if;
  select merchant_id,role into v_mid,v_role from public.disha_merchant_members where user_id=v_user order by created_at limit 1;
  if v_mid is null or v_role not in ('owner','manager') then raise exception using errcode='42501',message='manager role required'; end if;
  if nullif(trim(p_customer),'') is null or length(p_customer)>120 or p_amount is null or p_amount<=0
    or (p_note is not null and length(p_note)>300)
    or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$') then
    raise exception using errcode='22023',message='invalid Khata entry';
  end if;
  insert into public.disha_khata_entries(merchant_id,customer_name,amount,due_date,contact_phone,auto_match,note)
    values(v_mid,trim(p_customer),p_amount,p_due,p_phone,p_auto,nullif(trim(p_note),'')) returning id into v_id;
  insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
    values('merchant','khata_create',jsonb_build_object('entry_id',v_id,'customer',trim(p_customer),'amount',p_amount,'has_contact',p_phone is not null,'auto_match',p_auto),'saved','khata_opened',v_mid);
  return v_id;
end; $$;
revoke all on function public.disha_create_khata_with_phone(text,numeric,date,boolean,text,text) from public,anon;
grant execute on function public.disha_create_khata_with_phone(text,numeric,date,boolean,text,text) to authenticated;

comment on column public.disha_khata_entries.contact_phone is 'Optional E.164 contact used only to prefill a merchant-reviewed WhatsApp reminder. Disha does not send messages.';
