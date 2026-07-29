-- StillPoor real Signet Block payments
--
-- Signet uses a deliberately low test payment:
-- 1,000 sats per Block.
--
-- Official Block prices and sale positions remain unchanged.
-- The reduced amount only applies to the Bitcoin transaction
-- used during Signet development.

begin;

alter table public.claim_orders
  add column payment_network text
    not null
    default 'simulated',

  add column payment_verified_at
    timestamptz;

alter table public.claim_orders
  add constraint
    claim_orders_payment_network_check
  check (
    payment_network in (
      'simulated',
      'signet',
      'mainnet'
    )
  );

-- A single Bitcoin transaction can purchase several Blocks.
-- Those Blocks must therefore be allowed to share the same txid.
alter table public.blocks
  drop constraint if exists
    blocks_claim_transaction_id_key;

create index if not exists
  blocks_claim_transaction_id_index
on public.blocks (
  claim_transaction_id
)
where claim_transaction_id is not null;

create or replace function
public.reserve_claim_blocks_signet(
  p_payment_address text,
  p_ordinals_address text,
  p_block_numbers smallint[],
  p_receiver_address text
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

  v_test_amount_sats bigint;
begin
  /*
   * The existing function still allocates:
   * - the Blocks,
   * - their sale positions,
   * - their official StillPoor prices.
   *
   * Everything remains atomic because this wrapper and
   * the existing function run inside the same transaction.
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

  if v_reserved_order.order_id is null then
    raise exception
      'The Signet Claim order could not be created.';
  end if;

  v_test_amount_sats :=
    cardinality(p_block_numbers)::bigint
    * 1000;

  update public.claim_orders
  set
    amount_sats =
      v_test_amount_sats,

    payment_network =
      'signet'
  where id =
    v_reserved_order.order_id;

  return query
  select
    v_reserved_order.order_id::uuid,
    v_reserved_order.expires_at::timestamptz,
    v_test_amount_sats;
end;
$function$;

alter function
public.reserve_claim_blocks_signet(
  text,
  text,
  smallint[],
  text
)
owner to postgres;

revoke all
on function
public.reserve_claim_blocks_signet(
  text,
  text,
  smallint[],
  text
)
from public;

revoke all
on function
public.reserve_claim_blocks_signet(
  text,
  text,
  smallint[],
  text
)
from anon;

revoke all
on function
public.reserve_claim_blocks_signet(
  text,
  text,
  smallint[],
  text
)
from authenticated;

grant execute
on function
public.reserve_claim_blocks_signet(
  text,
  text,
  smallint[],
  text
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

  v_expected_test_amount_sats
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
    <> 'signet' then
    raise exception
      'The Claim order is not a Signet order.';
  end if;

  if v_order.expires_at <= now() then
    raise exception
      'The Claim order has expired.';
  end if;

  v_expected_test_amount_sats :=
    cardinality(
      v_order.block_numbers
    )::bigint
    * 1000;

  if v_order.amount_sats
    <> v_expected_test_amount_sats then
    raise exception
      'The Signet payment amount is invalid.';
  end if;

  if exists (
    select 1
    from public.claim_orders
      as existing_order
    where
      lower(
        existing_order.payment_txid
      ) =
      lower(p_payment_txid)

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