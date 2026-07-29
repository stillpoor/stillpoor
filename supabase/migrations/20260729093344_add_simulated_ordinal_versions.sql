begin;

create or replace function
public.mint_next_block_ordinal_simulated(
  p_payment_address text,
  p_destination_ordinals_address text,
  p_block_number smallint,
  p_expected_latest_version integer,
  p_pixels text[],
  p_description text
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

  claim_transaction_id text,

  latest_inscription_version integer,
  latest_inscription_id text,
  latest_inscribed_at timestamptz,
  inscription_pending boolean,

  inscription_record_id uuid,
  inscription_version integer,
  inscription_status text,

  destination_ordinals_address text,

  commit_transaction_id text,
  reveal_transaction_id text
)
language plpgsql
set search_path = public
as $function$
declare
  v_block public.blocks%rowtype;

  v_next_version integer;

  v_description text;

  v_inscription_record_id uuid;

  v_confirmed_at timestamptz =
    now();

  v_commit_transaction_id text =
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    );

  v_reveal_transaction_id text =
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    );

  v_inscription_id text;
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
    p_destination_ordinals_address
      is null
    or btrim(
      p_destination_ordinals_address
    ) = ''
  ) then
    raise exception
      'An Ordinals destination address is required.';
  end if;

  if p_block_number is null then
    raise exception
      'A Block number is required.';
  end if;

  if (
    p_expected_latest_version
      is null
    or p_expected_latest_version < 1
  ) then
    raise exception
      'A valid previous Ordinal version is required.';
  end if;

  if (
    p_pixels is null
    or not coalesce(
      public.are_valid_block_pixels(
        p_pixels
      ),
      false
    )
  ) then
    raise exception
      'The Block Pixels are invalid.';
  end if;

  v_description =
    nullif(
      btrim(
        coalesce(
          p_description,
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

  select
    stored_block.*
  into v_block
  from public.blocks
    as stored_block
  where
    stored_block.block_number =
      p_block_number
  for update;

  if not found then
    raise exception
      'The requested Block does not exist.';
  end if;

  if (
    v_block.status <> 'claimed'
    or v_block.owner_payment_address
      is distinct from
      p_payment_address
  ) then
    raise exception
      'The requested Block is not owned by this wallet.';
  end if;

  if v_block.inscription_pending then
    raise exception
      'An Ordinal inscription is already pending for this Block.';
  end if;

  if (
    v_block.latest_inscription_version <
      1
  ) then
    raise exception
      'This Block has not been inscribed yet.';
  end if;

  if (
    v_block.latest_inscription_version <>
      p_expected_latest_version
  ) then
    raise exception
      'The Block Ordinal version has changed. Reload the Block before editing it.';
  end if;

  if (
    v_block.pixels
      is not distinct from
      p_pixels
    and v_block.description
      is not distinct from
      v_description
  ) then
    raise exception
      'No changes were provided for the new Ordinal version.';
  end if;

  v_next_version =
    v_block.latest_inscription_version +
    1;

  if exists (
    select 1
    from public.block_inscriptions
      as existing_inscription
    where
      existing_inscription.block_number =
        p_block_number
      and existing_inscription.version =
        v_next_version
      and existing_inscription.status
        in (
          'pending',
          'confirmed'
        )
  ) then
    raise exception
      'The next Ordinal version already exists.';
  end if;

  v_inscription_id =
    v_reveal_transaction_id
    || 'i0';

  update public.blocks
    as block_to_update
  set
    inscription_pending = true,
    updated_at =
      v_confirmed_at
  where
    block_to_update.block_number =
      p_block_number;

  insert into public.block_inscriptions (
    block_number,
    version,
    status,

    owner_payment_address,
    destination_ordinals_address,

    pixels,
    description
  )
  values (
    p_block_number,
    v_next_version,
    'pending',

    p_payment_address,
    p_destination_ordinals_address,

    p_pixels,
    v_description
  )
  returning id
  into v_inscription_record_id;

  update public.block_inscriptions
    as inscription_to_confirm
  set
    status = 'confirmed',

    inscription_id =
      v_inscription_id,

    commit_transaction_id =
      v_commit_transaction_id,

    reveal_transaction_id =
      v_reveal_transaction_id,

    updated_at =
      v_confirmed_at,

    confirmed_at =
      v_confirmed_at
  where
    inscription_to_confirm.id =
      v_inscription_record_id;

  update public.blocks
    as block_to_update
  set
    pixels =
      p_pixels,

    description =
      v_description,

    latest_inscription_version =
      v_next_version,

    latest_inscription_id =
      v_inscription_id,

    latest_inscribed_at =
      v_confirmed_at,

    inscription_pending = false,

    updated_at =
      v_confirmed_at
  where
    block_to_update.block_number =
      p_block_number;

  return query
  select
    stored_block.block_number,
    stored_block.block_row,
    stored_block.block_column,

    stored_block.owner_payment_address,

    stored_block.pixels,
    stored_block.description,

    stored_block.claimed_at,
    stored_block.updated_at,

    stored_block.claim_transaction_id,

    stored_block.latest_inscription_version,
    stored_block.latest_inscription_id,
    stored_block.latest_inscribed_at,
    stored_block.inscription_pending,

    confirmed_inscription.id,
    confirmed_inscription.version,
    confirmed_inscription.status,

    confirmed_inscription
      .destination_ordinals_address,

    confirmed_inscription
      .commit_transaction_id,

    confirmed_inscription
      .reveal_transaction_id
  from public.blocks
    as stored_block
  join public.block_inscriptions
    as confirmed_inscription
    on confirmed_inscription.id =
      v_inscription_record_id
  where
    stored_block.block_number =
      p_block_number;
end;
$function$;

revoke all
on function
public.mint_next_block_ordinal_simulated(
  text,
  text,
  smallint,
  integer,
  text[],
  text
)
from public;

revoke all
on function
public.mint_next_block_ordinal_simulated(
  text,
  text,
  smallint,
  integer,
  text[],
  text
)
from anon;

revoke all
on function
public.mint_next_block_ordinal_simulated(
  text,
  text,
  smallint,
  integer,
  text[],
  text
)
from authenticated;

grant execute
on function
public.mint_next_block_ordinal_simulated(
  text,
  text,
  smallint,
  integer,
  text[],
  text
)
to service_role;

comment on function
public.mint_next_block_ordinal_simulated(
  text,
  text,
  smallint,
  integer,
  text[],
  text
) is
  'Creates and confirms a simulated new Ordinal version for an already-inscribed StillPoor Block.';

commit;