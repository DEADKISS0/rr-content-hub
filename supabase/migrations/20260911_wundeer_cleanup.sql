-- WUNDEER-only cleanup requested for the public working board.
-- Run after exporting the affected rows. Every delete is scoped and idempotent.
begin;

-- Remove non-working projects. Their dependent hub rows cascade by schema.
delete from public.rr_hub_projects where slug in ('boga', 'satiro');

-- Keep only the four visual ideas currently ready for this working session:
-- O1, O2, O6 and O9. This also removes ideas without a visual reference and
-- any item already in production/publication.
delete from public.rr_hub_ideas
where project_id = (select id from public.rr_hub_projects where slug = 'wundeer')
  and not (code in ('O1', 'O2', 'O6', 'O9')
           and status in ('approved', 'pending_approval')
           and jsonb_array_length(coalesce(reference_urls, '[]'::jsonb)) > 0);

update public.rr_hub_projects set public_audit = false where slug = 'wundeer';
commit;
