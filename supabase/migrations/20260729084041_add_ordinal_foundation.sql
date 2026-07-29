begin;

alter table public.blocks
add column latest_inscription_version integer
  not null
  default 0,

add column latest_inscription_id text,

add column latest_inscribed_at
  timestamptz,

add column inscription_pending boolean
  not null
  default false;

alter table public.blocks
add constraint blocks_latest_inscription_version_valid
check (
  latest_inscription_version >= 0
);

alter table public.blocks
add constraint blocks_latest_inscription_metadata_valid
check (
  (
    latest_inscription_version = 0
    and latest_inscription_id is null
    and latest_inscribed_at is null
  )
  or
  (
    latest_inscription_version > 0
    and latest_inscription_id is not null
    and latest_inscribed_at is not null
  )
);

create or replace function
public.are_valid_block_pixels(
  p_pixels text[]
)
returns boolean
language sql
immutable
strict
set search_path = public
as $function$
  select
    cardinality(p_pixels) = 256
    and not exists (
      select 1
      from unnest(p_pixels)
        as pixel(colour)
      where pixel.colour
        !~ '^#[0-9a-fA-F]{6}$'
    );
$function$;

revoke all
on function
public.are_valid_block_pixels(text[])
from public;

revoke all
on function
public.are_valid_block_pixels(text[])
from anon;

revoke all
on function
public.are_valid_block_pixels(text[])
from authenticated;

grant execute
on function
public.are_valid_block_pixels(text[])
to service_role;

create table public.block_inscriptions (
  id uuid
    primary key
    default gen_random_uuid(),

  block_number smallint
    not null
    references public.blocks(
      block_number
    )
    on update restrict
    on delete restrict,

  version integer
    not null,

  status text
    not null
    default 'pending',

  owner_payment_address text
    not null,

  destination_ordinals_address text
    not null,

  pixels text[]
    not null,

  description text,

  inscription_id text,

  commit_transaction_id text,

  reveal_transaction_id text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  confirmed_at timestamptz,

  failed_at timestamptz,

  failure_reason text,

  constraint block_inscriptions_version_valid
    check (
      version > 0
    ),

  constraint block_inscriptions_status_valid
    check (
      status in (
        'pending',
        'confirmed',
        'failed'
      )
    ),

  constraint block_inscriptions_payment_address_not_empty
    check (
      length(
        btrim(
          owner_payment_address
        )
      ) > 0
    ),

  constraint block_inscriptions_ordinals_address_not_empty
    check (
      length(
        btrim(
          destination_ordinals_address
        )
      ) > 0
    ),

  constraint block_inscriptions_pixels_valid
    check (
      public.are_valid_block_pixels(
        pixels
      )
    ),

  constraint block_inscriptions_description_valid
    check (
      description is null
      or char_length(
        description
      ) <= 300
    ),

  constraint block_inscriptions_status_metadata_valid
    check (
      (
        status = 'pending'
        and confirmed_at is null
        and failed_at is null
      )
      or
      (
        status = 'confirmed'
        and inscription_id is not null
        and confirmed_at is not null
        and failed_at is null
        and failure_reason is null
      )
      or
      (
        status = 'failed'
        and confirmed_at is null
        and failed_at is not null
      )
    )
);

create unique index
block_inscriptions_active_version_unique
on public.block_inscriptions (
  block_number,
  version
)
where status in (
  'pending',
  'confirmed'
);

create unique index
block_inscriptions_one_pending_per_block
on public.block_inscriptions (
  block_number
)
where status = 'pending';

create unique index
block_inscriptions_inscription_id_unique
on public.block_inscriptions (
  inscription_id
)
where inscription_id is not null;

create index
block_inscriptions_confirmed_activity
on public.block_inscriptions (
  confirmed_at desc
)
where status = 'confirmed';

create index
block_inscriptions_block_versions
on public.block_inscriptions (
  block_number,
  version desc
)
where status = 'confirmed';

create or replace function
public.protect_block_inscription_history()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Block inscription history cannot be deleted.';
  end if;

  if (
    new.block_number
      is distinct from
      old.block_number
    or new.version
      is distinct from
      old.version
    or new.owner_payment_address
      is distinct from
      old.owner_payment_address
    or new.destination_ordinals_address
      is distinct from
      old.destination_ordinals_address
    or new.pixels
      is distinct from
      old.pixels
    or new.description
      is distinct from
      old.description
    or new.created_at
      is distinct from
      old.created_at
  ) then
    raise exception
      'A Block inscription snapshot cannot be changed.';
  end if;

  if old.status in (
    'confirmed',
    'failed'
  ) then
    raise exception
      'A finalised Block inscription cannot be changed.';
  end if;

  return new;
end;
$function$;

revoke all
on function
public.protect_block_inscription_history()
from public;

revoke all
on function
public.protect_block_inscription_history()
from anon;

revoke all
on function
public.protect_block_inscription_history()
from authenticated;

create trigger
protect_block_inscription_history_trigger
before update or delete
on public.block_inscriptions
for each row
execute function
public.protect_block_inscription_history();

alter table public.block_inscriptions
enable row level security;

revoke all
on table public.block_inscriptions
from public;

revoke all
on table public.block_inscriptions
from anon;

revoke all
on table public.block_inscriptions
from authenticated;

grant
  select,
  insert,
  update
on table public.block_inscriptions
to service_role;

create or replace function
public.save_owned_blocks(
  p_payment_address text,
  p_blocks jsonb
)
returns table(
  block_number smallint,
  block_row smallint,
  block_column smallint,
  owner_payment_address text,
  pixels text[],
  description text,
  claimed_at timestamptz,
  updated_at timestamptz,
  claim_transaction_id text
)
language plpgsql
set search_path = public
as $function$
declare
  v_requested_count integer;
  v_owned_count integer;
  v_locked_count integer;
  v_unique_count integer;

  v_block jsonb;
  v_block_number smallint;
  v_pixels text[];
  v_description text;
begin
  if (
    p_payment_address is null
    or btrim(
      p_payment_address
    ) = ''
  ) then
    raise exception
      'A payment address is required.';
  end if;

  if (
    p_blocks is null
    or jsonb_typeof(
      p_blocks
    ) <> 'array'
  ) then
    raise exception
      'The Blocks payload must be an array.';
  end if;

  v_requested_count =
    jsonb_array_length(
      p_blocks
    );

  if v_requested_count = 0 then
    raise exception
      'At least one Block is required.';
  end if;

  if v_requested_count > 100 then
    raise exception
      'A maximum of 100 Blocks may be saved.';
  end if;

  select count(
    distinct
    (
      item.value
      ->> 'blockNumber'
    )::integer
  )
  into v_unique_count
  from jsonb_array_elements(
    p_blocks
  ) as item(value);

  if (
    v_unique_count <>
    v_requested_count
  ) then
    raise exception
      'The Blocks payload contains duplicates.';
  end if;

  perform
    stored_blocks.block_number
  from public.blocks
    as stored_blocks
  where
    stored_blocks.block_number
    in (
      select
        (
          item.value
          ->> 'blockNumber'
        )::smallint
      from jsonb_array_elements(
        p_blocks
      ) as item(value)
    )
  order by
    stored_blocks.block_number
  for update;

  select count(*)
  into v_owned_count
  from public.blocks
    as stored_blocks
  where
    stored_blocks.block_number
    in (
      select
        (
          item.value
          ->> 'blockNumber'
        )::smallint
      from jsonb_array_elements(
        p_blocks
      ) as item(value)
    )
    and stored_blocks.status =
      'claimed'
    and stored_blocks
      .owner_payment_address =
      p_payment_address;

  if (
    v_owned_count <>
    v_requested_count
  ) then
    raise exception
      'One or more Blocks are not owned by this wallet.';
  end if;

  select count(*)
  into v_locked_count
  from public.blocks
    as stored_blocks
  where
    stored_blocks.block_number
    in (
      select
        (
          item.value
          ->> 'blockNumber'
        )::smallint
      from jsonb_array_elements(
        p_blocks
      ) as item(value)
    )
    and (
      stored_blocks
        .inscription_pending
      or stored_blocks
        .latest_inscription_version > 0
    );

  if v_locked_count > 0 then
    raise exception
      'One or more Blocks are locked by an Ordinal inscription.';
  end if;

  for v_block in
    select item.value
    from jsonb_array_elements(
      p_blocks
    ) as item(value)
  loop
    v_block_number =
      (
        v_block
        ->> 'blockNumber'
      )::smallint;

    select array_agg(
      pixel.colour
      order by
        pixel.position
    )
    into v_pixels
    from jsonb_array_elements_text(
      v_block -> 'pixels'
    )
    with ordinality
      as pixel(
        colour,
        position
      );

    if (
      cardinality(
        v_pixels
      ) <> 256
    ) then
      raise exception
        'Every Block must contain exactly 256 Pixels.';
    end if;

    if exists (
      select 1
      from unnest(
        v_pixels
      ) as colour(value)
      where colour.value
        !~ '^#[0-9a-fA-F]{6}$'
    ) then
      raise exception
        'One or more Pixel colours are invalid.';
    end if;

    v_description =
      nullif(
        btrim(
          coalesce(
            v_block
              ->> 'description',
            ''
          )
        ),
        ''
      );

    if (
      char_length(
        coalesce(
          v_description,
          ''
        )
      ) > 300
    ) then
      raise exception
        'A Block description cannot exceed 300 characters.';
    end if;

    update public.blocks
      as block_to_update
    set
      pixels =
        v_pixels,

      description =
        v_description
    where
      block_to_update
        .block_number =
        v_block_number;
  end loop;

  return query
  select
    stored_blocks.block_number,
    stored_blocks.block_row,
    stored_blocks.block_column,
    stored_blocks.owner_payment_address,
    stored_blocks.pixels,
    stored_blocks.description,
    stored_blocks.claimed_at,
    stored_blocks.updated_at,
    stored_blocks.claim_transaction_id
  from public.blocks
    as stored_blocks
  where
    stored_blocks.block_number
    in (
      select
        (
          item.value
          ->> 'blockNumber'
        )::smallint
      from jsonb_array_elements(
        p_blocks
      ) as item(value)
    )
  order by
    stored_blocks.block_number;
end;
$function$;

comment on table
public.block_inscriptions is
  'Immutable snapshots and statuses for StillPoor Block Ordinal inscription attempts.';

comment on column
public.blocks.latest_inscription_version is
  'Latest confirmed Ordinal version. Zero means that the Block has never been inscribed.';

comment on column
public.blocks.inscription_pending is
  'True while an Ordinal inscription or re-inscription is being processed.';

commit;