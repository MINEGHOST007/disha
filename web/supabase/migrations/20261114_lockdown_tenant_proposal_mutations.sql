drop policy if exists "merchant members can write proposals" on public.disha_proposals;
revoke insert, update, delete on public.disha_proposals from anon, authenticated;
grant select, insert on public.disha_proposals to authenticated;
create policy disha_managers_create_proposals on public.disha_proposals
  for insert to authenticated
  with check (
    merchant_id is not null
    and exists (
      select 1 from public.disha_merchant_members m
      where m.merchant_id = disha_proposals.merchant_id
        and m.user_id = (select auth.uid())
        and m.role in ('owner','manager')
    )
  );
revoke all on public.disha_outbox, public.disha_purchase_drafts from anon, authenticated;
revoke update, delete on public.disha_audit_log from anon, authenticated;
