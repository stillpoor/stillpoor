begin;

create table public.wallet_profiles (
  payment_address text primary key,

  username text,
  username_normalized text
    generated always as (
      lower(username)
    ) stored,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  constraint wallet_profiles_payment_address_not_empty
    check (
      length(trim(payment_address)) > 0
    ),

  constraint wallet_profiles_username_format
    check (
      username is null
      or username ~ '^[A-Za-z0-9_]{3,20}$'
    )
);

create unique index
  wallet_profiles_username_unique
on public.wallet_profiles (
  username_normalized
)
where username_normalized is not null;

alter table public.wallet_profiles
  enable row level security;

revoke all
on table public.wallet_profiles
from public;

revoke all
on table public.wallet_profiles
from anon;

revoke all
on table public.wallet_profiles
from authenticated;

grant select, insert, update
on table public.wallet_profiles
to service_role;

comment on table public.wallet_profiles is
  'Optional StillPoor profiles associated with authenticated Bitcoin payment addresses.';

comment on column public.wallet_profiles.username is
  'Optional public username. Unique without regard to letter casing.';

commit;