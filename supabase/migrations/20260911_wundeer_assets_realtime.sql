-- Complete Wundeer's public collaborative loop: delivery metadata and live UI.
-- Scoped through rr_hub_is_wundeer_idea(), so no other project is exposed.

drop policy if exists rr_hub_wundeer_public_assets_read on public.rr_hub_assets;
create policy rr_hub_wundeer_public_assets_read on public.rr_hub_assets
  for select to anon using (public.rr_hub_is_wundeer_idea(idea_id));

drop policy if exists rr_hub_wundeer_public_assets_insert on public.rr_hub_assets;
create policy rr_hub_wundeer_public_assets_insert on public.rr_hub_assets
  for insert to anon with check (public.rr_hub_is_wundeer_idea(idea_id));

-- Realtime publication can be enabled repeatedly without failing a deployment.
do $$ begin
  alter publication supabase_realtime add table public.rr_hub_ideas;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.rr_hub_comments;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.rr_hub_assets;
exception when duplicate_object then null;
end $$;
