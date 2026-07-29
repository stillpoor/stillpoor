-- StillPoor network-independent Bitcoin Block payments
--
-- This migration keeps Signet active in the application,
-- while allowing the same payment flow to support Mainnet later.
--
-- Signet may use a reduced development amount.
-- Mainnet always keeps the official server-calculated Block price.

begin;

create or replace function
public.reserve_claim_blocks_paid(
  p_payment_address text,
  p_ordinals_address text,
  p_block_numbers smallint[],
  p_receiver_address text,
  p_payment_network text,
  p_signet_amount_sats_per_block bigint
)
returns table (
  order_id uuid,
  expires_at timestamptz,
  amount_sats bigint
)
language plpgsql
set search_path = public
as $function$
declare
  v_reserved_order record;

  v_payment_amount_sats bigint;
begin
  if p_payment_network not in (
    'signet',
    'mainnet'
  ) then
    raise exception
      'The Bitcoin payment network is invalid.';
  end if;

  if (
    p_payment_network = 'signet'
    and (
      p_signet_amount_sats_per_block
        is null
      or
      p_signet_amount_sats_per_block
        <= 0
    )
  ) then
    raise exception
      'The Signet payment amount is invalid.';
  end if;

  /*
   * The existing pricing function remains
   * the source of truth for:
   * - Block availability,
   * - sale positions,
   * - official Block prices,
   * - reservation expiry.
   */
  select
    reserved_order.order_id,
    reserved_order.expires_at,
    reserved_order.amount_sats
  into v_reserved_order
  from public.reserve_claim_blocks(
    p_payment_address,
    p_ordinals_address,
    p_block_numbers,
    p_receiver_address
  ) as reserved_order;

  if v_reserved_order.order_id
    is null then
    raise exception
      'The Bitcoin Claim order could not be created.';
  end if;

  v_payment_amount_sats :=
    v_reserved_order.amount_sats;

  if p_payment_network =
    'signet' then
    v_payment_amount_sats :=
      cardinality(
        p_block_numbers
      )::bigint
      *
      p_signet_amount_sats_per_block;
  end if;

  update public.claim_orders
  set
    amount_sats =
      v_payment_amount_sats,

    payment_network =
      p_payment_network
  where id =
    v_reserved_order.order_id;

  return query
  select
    v_reserved_order.order_id::uuid,
    v_reserved_order.expires_at::timestamptz,
    v_payment_amount_sats;
end;
$function$;

alter function
public.reserve_claim_blocks_paid(
  text,
  text,
  smallint[],
  text,
  text,
  bigint
)
owner to postgres;

revoke all
on function
public.reserve_claim_blocks_paid(
  text,
  text,
  smallint[],
  text,
  text,
  bigint
)
from public;

revoke all
on function
public.reserve_claim_blocks_paid(
  text,
  text,
  smallint[],
  text,
  text,
  bigint
)
from anon;

revoke all
on function
public.reserve_claim_blocks_paid(
  text,
  text,
  smallint[],
  text,
  text,
  bigint
)
from authenticated;

grant execute
on function
public.reserve_claim_blocks_paid(
  text,
  text,
  smallint[],
  text,
  text,
  bigint
)
to service_role;

create or replace function
public.confirm_claim_order_paid(
  p_order_id uuid,
  p_payment_address text,
  p_payment_txid text
)
returns table (
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
  v_lock_id smallint;

  v_order
    public.claim_orders%rowtype;

  v_reserved_count integer;

  v_reserved_amount_sats
    bigint;
begin
  if (
    p_payment_txid is null
    or p_payment_txid
      !~ '^[0-9a-fA-F]{64}$'
  ) then
    raise exception
      'The Bitcoin transaction ID is invalid.';
  end if;

  select pricing_lock.id
  into v_lock_id
  from public.block_pricing_lock
    as pricing_lock
  where pricing_lock.id = 1
  for update;

  if not found then
    raise exception
      'The Block pricing lock is unavailable.';
  end if;

  select orders.*
  into v_order
  from public.claim_orders
    as orders
  where orders.id =
    p_order_id
  for update;

  if not found then
    raise exception
      'The Claim order does not exist.';
  end if;

  if v_order.payment_address
    <> p_payment_address then
    raise exception
      'The wallet does not own this order.';
  end if;

  if v_order.status <> 'pending' then
    raise exception
      'The Claim order is no longer pending.';
  end if;

  if v_order.payment_network
    not in (
      'signet',
      'mainnet'
    ) then
    raise exception
      'The Claim order payment network is invalid.';
  end if;

  if v_order.expires_at <= now() then
    raise exception
      'The Claim order has expired.';
  end if;

  if (
    v_order.amount_sats is null
    or v_order.amount_sats <= 0
  ) then
    raise exception
      'The Claim order amount is invalid.';
  end if;

  /*
   * A transaction ID only needs to be unique
   * inside its own Bitcoin network.
   */
  if exists (
    select 1
    from public.claim_orders
      as existing_order
    where
      lower(
        existing_order.payment_txid
      ) =
      lower(p_payment_txid)

      and existing_order.payment_network =
        v_order.payment_network

      and existing_order.id
        <> p_order_id
  ) then
    raise exception
      'This Bitcoin transaction has already been used.';
  end if;

  perform blocks.block_number
  from public.blocks
    as blocks
  where blocks.reservation_order_id =
    p_order_id
  order by blocks.block_number
  for update;

  get diagnostics
    v_reserved_count = row_count;

  if v_reserved_count <>
    cardinality(
      v_order.block_numbers
    ) then
    raise exception
      'The Block reservation is incomplete.';
  end if;

  if exists (
    select 1
    from public.blocks
      as blocks
    where
      blocks.reservation_order_id =
        p_order_id

      and (
        blocks.status <> 'reserved'
        or blocks.sale_position
          is null
        or blocks.price_sats
          is null
      )
  ) then
    raise exception
      'The reserved Block pricing is invalid.';
  end if;

  /*
   * Mainnet must always charge the official
   * sum of the reserved Block prices.
   *
   * Signet may deliberately use a reduced
   * development payment amount.
   */
  if v_order.payment_network =
    'mainnet' then
    select
      sum(
        blocks.price_sats
      )::bigint
    into v_reserved_amount_sats
    from public.blocks
      as blocks
    where blocks.reservation_order_id =
      p_order_id;

    if (
      v_reserved_amount_sats
        is null
      or v_reserved_amount_sats
        <> v_order.amount_sats
    ) then
      raise exception
        'The Mainnet payment amount is invalid.';
    end if;
  end if;

  update public.blocks
    as blocks
  set
    status =
      'claimed',

    owner_payment_address =
      v_order.payment_address,

    owner_ordinals_address =
      v_order.ordinals_address,

    pixels =
      array_fill(
        '#ffffff'::text,
        array[256]
      ),

    description =
      null,

    claimed_at =
      now(),

    claim_transaction_id =
      lower(p_payment_txid),

    reservation_order_id =
      null,

    reservation_expires_at =
      null
  where blocks.reservation_order_id =
    p_order_id;

  update public.claim_orders
  set
    status =
      'paid',

    payment_txid =
      lower(p_payment_txid),

    payment_verified_at =
      now()
  where id =
    p_order_id;

  return query
  select
    blocks.block_number,
    blocks.block_row,
    blocks.block_column,
    blocks.owner_payment_address,
    blocks.pixels,
    blocks.description,
    blocks.claimed_at,
    blocks.updated_at,
    blocks.claim_transaction_id
  from public.blocks
    as blocks
  where blocks.block_number =
    any(
      v_order.block_numbers
    )
  order by blocks.block_number;
end;
$function$;

alter function
public.confirm_claim_order_paid(
  uuid,
  text,
  text
)
owner to postgres;

revoke all
on function
public.confirm_claim_order_paid(
  uuid,
  text,
  text
)
from public;

revoke all
on function
public.confirm_claim_order_paid(
  uuid,
  text,
  text
)
from anon;

revoke all
on function
public.confirm_claim_order_paid(
  uuid,
  text,
  text
)
from authenticated;

grant execute
on function
public.confirm_claim_order_paid(
  uuid,
  text,
  text
)
to service_role;

commit;
