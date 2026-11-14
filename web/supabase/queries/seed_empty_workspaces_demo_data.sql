-- OPTIONAL DEMO SEED. Run only after migrations through 123.
-- Each merchant receives illustrative rows only when all core data tables are empty.
-- All inserted values carry DEMO markers. Reruns do not duplicate records.
-- No supplier call is placed; no customer messages are sent; no phone numbers are added.
do $$
declare
  m record;
  v_supplier_id uuid;
  v_order_id uuid;
  base_date date := current_date;
begin
  for m in
    select distinct dm.id, dm.name
    from public.disha_merchants dm
    join public.disha_merchant_members mm on mm.merchant_id=dm.id and mm.role in ('owner','manager')
    where not exists (select 1 from public.disha_purchase_bills b where b.merchant_id=dm.id)
      and not exists (select 1 from public.disha_transactions t where t.merchant_id=dm.id)
      and not exists (select 1 from public.disha_khata_entries k where k.merchant_id=dm.id)
      and not exists (select 1 from public.disha_order_drafts o where o.merchant_id=dm.id)
  loop
    insert into public.disha_suppliers(merchant_id,name)
      values(m.id,'DEMO · Lakshmi Wholesale')
      on conflict(merchant_id,normalized_name) do update set name=excluded.name
      returning id into v_supplier_id;

    insert into public.disha_purchase_bills(merchant_id,supplier_id,bill_number,bill_date,total_amount,credit_days,source,source_file_name)
      select m.id,v_supplier_id,v.number,v.date,(v.rice_qty*42 + v.sugar_qty*38),v.credit_days,'csv','DEMO_DATA · sample history'
      from (values
        ('DEMO-001',base_date-60,80::numeric,40::numeric,5),
        ('DEMO-002',base_date-30,96::numeric,48::numeric,5),
        ('DEMO-003',base_date-1,72::numeric,36::numeric,5)
      ) as v(number,date,rice_qty,sugar_qty,credit_days)
      on conflict(merchant_id,supplier_id,bill_date,bill_number) do nothing;

    insert into public.disha_purchase_bill_lines(merchant_id,purchase_bill_id,item_name,quantity,unit,unit_price,line_total)
      select b.merchant_id,b.id,x.item_name,x.qty,'kg',x.price,x.qty*x.price
      from public.disha_purchase_bills b
      cross join lateral (values
        ('DEMO Rice',case b.bill_number when 'DEMO-001' then 80::numeric when 'DEMO-002' then 96::numeric else 72::numeric end,42::numeric),
        ('DEMO Sugar',case b.bill_number when 'DEMO-001' then 40::numeric when 'DEMO-002' then 48::numeric else 36::numeric end,38::numeric)
      ) x(item_name,qty,price)
      where b.merchant_id=m.id and b.bill_number like 'DEMO-%'
        and not exists(select 1 from public.disha_purchase_bill_lines l where l.merchant_id=b.merchant_id and l.purchase_bill_id=b.id);

    insert into public.disha_order_drafts(merchant_id,supplier_name,order_date,status,order_total)
      values(m.id,'DEMO · Lakshmi Wholesale',base_date+1,'draft',4392) returning id into v_order_id;
    insert into public.disha_order_draft_lines(merchant_id,order_id,item_name,quantity,unit,unit_price,line_total)
      values(m.id,v_order_id,'DEMO Rice',72,'kg',42,3024),(m.id,v_order_id,'DEMO Sugar',36,'kg',38,1368);

    insert into public.disha_transactions(merchant_id,external_id,occurred_at,customer_name,amount,mode,status)
      select m.id,'DEMO-TX-'||g::text,((base_date - (g%24))::text||' '||((9+(g%10))::text||':15:00'))::timestamptz,
        case when g%3=0 then 'DEMO · Ramesh' when g%3=1 then 'DEMO · Asha' else 'DEMO · Kumar' end,
        350 + (g*73)%1800,case when g%4=0 then 'UPI' else 'Paytm digital' end,'success'
      from generate_series(1,36) g
      on conflict(merchant_id,external_id) do nothing;

    insert into public.disha_khata_entries(merchant_id,customer_name,amount,paid_amount,note,due_date,contact_phone,auto_match,status,created_at,closed_at)
      values
        (m.id,'DEMO · Ramesh',1200,0,'[DEMO DATA] Overdue reminder example',base_date-2,null,false,'open',now()-interval '12 days',null),
        (m.id,'DEMO · Asha',900,300,'[DEMO DATA] Partially paid example',base_date-1,null,false,'partially_paid',now()-interval '9 days',null),
        (m.id,'DEMO · Kumar',500,500,'[DEMO DATA] Closed Khata example',base_date-20,null,false,'closed',now()-interval '30 days',now()-interval '19 days')
      on conflict do nothing;

    insert into public.disha_khata_allocations(merchant_id,entry_id,amount,source)
      select m.id,k.id,500,'manual' from public.disha_khata_entries k
      where k.merchant_id=m.id and k.customer_name='DEMO · Kumar' and k.note='[DEMO DATA] Closed Khata example'
        and not exists(select 1 from public.disha_khata_allocations a where a.merchant_id=k.merchant_id and a.entry_id=k.id);

    insert into public.disha_tax_obligations(merchant_id,tax_period,amount,paid_amount,due_date,note,status)
      values(m.id,'DEMO · GST sample period',5200,0,base_date+7,'[DEMO DATA] Illustrative manually entered GST due','due')
      on conflict(merchant_id,tax_period) do nothing;
    insert into public.disha_khata_allocations(merchant_id,entry_id,amount,source)
      select m.id,k.id,300,'manual' from public.disha_khata_entries k
      where k.merchant_id=m.id and k.customer_name='DEMO · Asha' and k.note='[DEMO DATA] Partially paid example'
        and not exists(select 1 from public.disha_khata_allocations a where a.merchant_id=k.merchant_id and a.entry_id=k.id);

    insert into public.disha_audit_log(actor,tool,facts,decision,outcome,merchant_id)
      values('system','demo_data_seed',jsonb_build_object('merchant_name',m.name,'sample','DEMO_DATA'),'seeded','demo_workspace_seeded',m.id);
  end loop;
end $$;

-- Verify the seeded workspaces. DEMO rows are illustrative and should never be mistaken for merchant data.
select m.id as merchant_id,m.name as merchant_name,
  (select count(*) from public.disha_purchase_bills b where b.merchant_id=m.id and b.bill_number like 'DEMO-%') as demo_bills,
  (select count(*) from public.disha_transactions t where t.merchant_id=m.id and t.external_id like 'DEMO-%') as demo_transactions,
  (select count(*) from public.disha_khata_entries k where k.merchant_id=m.id and k.note like '[DEMO DATA]%') as demo_khata_entries
  ,(select count(*) from public.disha_tax_obligations g where g.merchant_id=m.id and g.tax_period like 'DEMO%') as demo_gst_entries
from public.disha_merchants m
where exists(select 1 from public.disha_audit_log a where a.merchant_id=m.id and a.tool='demo_data_seed' and a.outcome='demo_workspace_seeded')
order by m.name;
