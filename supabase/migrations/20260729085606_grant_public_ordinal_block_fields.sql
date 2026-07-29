begin;

grant select (
  latest_inscription_version,
  latest_inscription_id,
  latest_inscribed_at,
  inscription_pending
)
on table public.blocks
to anon, authenticated;

commit;