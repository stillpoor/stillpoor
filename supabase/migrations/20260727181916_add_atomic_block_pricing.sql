-- StillPoor atomic Block pricing
--
-- Public pricing rule:
-- The price increases by 10,000 sats every 100 Blocks sold.
--
-- Pricing positions are temporarily held while a Claim order is pending.
-- They are released if the order is cancelled or expires, and retained when
-- the order is confirmed. This prevents concurrent reservations from receiving
-- the same pricing positions.

begin;

create table public.block_pricing_lock (
  id smallint primary key,
  constraint block_pricing_lock_singleton
    check (id = 1)
);

insert into public.block_pricing_lock (id)
values (1);

alter table public.block_pricing_lock
  enable row level security;

revoke all on table public.block_pricing_lock
  from public, anon, authenticated;

grant select, update on table public.block_pricing_lock
  to service_role;

alter table public.blocks
  add column sale_position smallint,
  add column price_sats bigint;

-- Release reservations that had already expired before this migration.
update public.blocks
set
  status = 'available',
  reservation_order_id = null,
  reservation_expires_at = null
where
  status = 'reserved'
  and reservation_expires_at <= now();

update public.claim_orders
set status = 'expired'
where
  status = 'pending'
  and expires_at <= now();

-- Give existing claimed Blocks the earliest pricing positions, followed by
-- active reservations. This keeps the current simulated development data valid.
with ranked_blocks as (
  select
    blocks.block_number,
    row_number() over (
      order by
        case
          when blocks.status = 'claimed' then 0
          else 1
        end,
        case
          when blocks.status = 'claimed'
            then blocks.claimed_at
          else orders.created_at
        end nulls last,
        blocks.block_number
    )::smallint as sale_position
  from public.blocks as blocks
  left join public.claim_orders as orders
    on orders.id = blocks.reservation_order_id
  where blocks.status in ('claimed', 'reserved')
)
update public.blocks as blocks
set
  sale_position = ranked_blocks.sale_position,
  price_sats = least(
    100000
    + (
      ((ranked_blocks.sale_position::integer - 1) / 100)
      * 10000
    ),
    500000
  )::bigint
from ranked_blocks
where blocks.block_number = ranked_blocks.block_number;

-- Recalculate active and simulated-paid orders from the server-assigned prices.
with recalculated_orders as (
  select
    orders.id,
    sum(blocks.price_sats)::bigint as amount_sats
  from public.claim_orders as orders
  join public.blocks as blocks
    on (
      (
        orders.status = 'pending'
        and blocks.reservation_order_id = orders.id
      )
      or
      (
        orders.status = 'paid'
        and blocks.block_number = any(orders.block_numbers)
      )
    )
  where orders.status in ('pending', 'paid')
  group by orders.id
)
update public.claim_orders as orders
set amount_sats = recalculated_orders.amount_sats
from recalculated_orders
where orders.id = recalculated_orders.id;

alter table public.blocks
  add constraint blocks_sale_position_check
    check (
      sale_position is null
      or sale_position between 1 and 4096
    ),
  add constraint blocks_price_sats_check
    check (
      (
        sale_position is null
        and price_sats is null
      )
      or
      (
        sale_position is not null
        and price_sats = least(
          100000
          + (
            ((sale_position::integer - 1) / 100)
            * 10000
          ),
          500000
        )::bigint
      )
    ),
  add constraint blocks_sale_position_key
    unique (sale_position);

alter table public.blocks
  drop constraint blocks_valid_state;

alter table public.blocks
  add constraint blocks_valid_state
  check (
    (
      status = 'available'
      and reservation_order_id is null
      and reservation_expires_at is null
      and owner_payment_address is null
      and owner_ordinals_address is null
      and claim_transaction_id is null
      and sale_position is null
      and price_sats is null
    )
    or
    (
      status = 'reserved'
      and reservation_order_id is not null
      and reservation_expires_at is not null
      and owner_payment_address is null
      and owner_ordinals_address is null
      and claim_transaction_id is null
      and sale_position is not null
      and price_sats is not null
    )
    or
    (
      status = 'claimed'
      and reservation_order_id is null
      and reservation_expires_at is null
      and owner_payment_address is not null
      and owner_ordinals_address is not null
      and pixels is not null
      and cardinality(pixels) = 256
      and claimed_at is not null
      and claim_transaction_id is not null
      and sale_position is not null
      and price_sats is not null
    )
  );

-- New server-priced overload. The browser does not provide an amount.
create function public.reserve_claim_blocks(
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
as $$
declare
  v_lock_id smallint;
  v_order_id uuid;

  v_expires_at timestamptz :=
    now() + interval '10 minutes';

  v_requested_count integer;
  v_found_count integer;
  v_unavailable_count integer;

  v_sorted_block_numbers smallint[];
  v_sale_positions smallint[];
  v_prices_sats bigint[];
  v_amount_sats bigint;
begin
  if (
    p_payment_address is null
    or btrim(p_payment_address) = ''
  ) then
    raise exception
      'A payment address is required.';
  end if;

  if (
    p_ordinals_address is null
    or btrim(p_ordinals_address) = ''
  ) then
    raise exception
      'An Ordinals address is required.';
  end if;

  if (
    p_receiver_address is null
    or btrim(p_receiver_address) = ''
  ) then
    raise exception
      'A receiver address is required.';
  end if;

  if (
    p_block_numbers is null
    or cardinality(p_block_numbers) = 0
  ) then
    raise exception
      'At least one Block is required.';
  end if;

  if cardinality(p_block_numbers) > 100 then
    raise exception
      'A maximum of 100 Blocks may be reserved.';
  end if;

  if exists (
    select 1
    from unnest(p_block_numbers)
      as requested(block_number)
    where
      requested.block_number < 1
      or requested.block_number > 4096
  ) then
    raise exception
      'One or more Block numbers are invalid.';
  end if;

  select
    count(distinct requested.block_number),
    array_agg(
      requested.block_number
      order by requested.block_number
    )
  into
    v_requested_count,
    v_sorted_block_numbers
  from unnest(p_block_numbers)
    as requested(block_number);

  if (
    v_requested_count <>
    cardinality(p_block_numbers)
  ) then
    raise exception
      'The Block selection contains duplicates.';
  end if;

  -- Serialize all pricing allocations and releases.
  select pricing_lock.id
  into v_lock_id
  from public.block_pricing_lock as pricing_lock
  where pricing_lock.id = 1
  for update;

  if not found then
    raise exception
      'The Block pricing lock is unavailable.';
  end if;

  update public.blocks
  set
    status = 'available',
    reservation_order_id = null,
    reservation_expires_at = null,
    sale_position = null,
    price_sats = null
  where
    status = 'reserved'
    and reservation_expires_at <= now();

  update public.claim_orders as orders
  set status = 'expired'
  where
    orders.status = 'pending'
    and orders.expires_at <= now();

  perform blocks.block_number
  from public.blocks as blocks
  where blocks.block_number = any(v_sorted_block_numbers)
  order by blocks.block_number
  for update;

  get diagnostics
    v_found_count = row_count;

  if v_found_count <> v_requested_count then
    raise exception
      'One or more Blocks do not exist.';
  end if;

  select count(*)
  into v_unavailable_count
  from public.blocks as blocks
  where
    blocks.block_number = any(v_sorted_block_numbers)
    and blocks.status <> 'available';

  if v_unavailable_count > 0 then
    raise exception
      'One or more Blocks are no longer available.';
  end if;

  select array_agg(
    available_positions.sale_position
    order by available_positions.sale_position
  )
  into v_sale_positions
  from (
    select
      candidate.sale_position::smallint
        as sale_position
    from generate_series(1, 4096)
      as candidate(sale_position)
    where not exists (
      select 1
      from public.blocks as blocks
      where blocks.sale_position =
        candidate.sale_position
    )
    order by candidate.sale_position
    limit v_requested_count
  ) as available_positions;

  if coalesce(cardinality(v_sale_positions), 0)
    <> v_requested_count then
    raise exception
      'No more Blocks are available.';
  end if;

  select
    array_agg(
      least(
        100000
        + (
          ((positions.sale_position::integer - 1) / 100)
          * 10000
        ),
        500000
      )::bigint
      order by positions.item_index
    ),
    sum(
      least(
        100000
        + (
          ((positions.sale_position::integer - 1) / 100)
          * 10000
        ),
        500000
      )::bigint
    )::bigint
  into
    v_prices_sats,
    v_amount_sats
  from unnest(v_sale_positions)
    with ordinality
    as positions(sale_position, item_index);

  insert into public.claim_orders (
    payment_address,
    ordinals_address,
    block_numbers,
    amount_sats,
    receiver_address,
    status,
    expires_at
  )
  values (
    p_payment_address,
    p_ordinals_address,
    v_sorted_block_numbers,
    v_amount_sats,
    p_receiver_address,
    'pending',
    v_expires_at
  )
  returning id
  into v_order_id;

  with allocation as (
    select
      requested.block_number,
      positions.sale_position,
      prices.price_sats
    from unnest(v_sorted_block_numbers)
      with ordinality
      as requested(block_number, item_index)
    join unnest(v_sale_positions)
      with ordinality
      as positions(sale_position, item_index)
      using (item_index)
    join unnest(v_prices_sats)
      with ordinality
      as prices(price_sats, item_index)
      using (item_index)
  )
  update public.blocks as blocks
  set
    status = 'reserved',
    reservation_order_id = v_order_id,
    reservation_expires_at = v_expires_at,
    sale_position = allocation.sale_position,
    price_sats = allocation.price_sats
  from allocation
  where blocks.block_number = allocation.block_number;

  return query
  select
    v_order_id,
    v_expires_at,
    v_amount_sats;
end;
$$;

alter function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  text
) owner to postgres;

revoke all on function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  text
) from public;

grant execute on function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  text
) to service_role;

-- Temporary compatibility overload for the currently deployed route.
-- The client-provided amount is intentionally ignored.
create or replace function public.reserve_claim_blocks(
  p_payment_address text,
  p_ordinals_address text,
  p_block_numbers smallint[],
  p_amount_sats bigint,
  p_receiver_address text
)
returns table (
  order_id uuid,
  expires_at timestamptz
)
language plpgsql
set search_path = public
as $$
begin
  return query
  select
    priced_order.order_id,
    priced_order.expires_at
  from public.reserve_claim_blocks(
    p_payment_address,
    p_ordinals_address,
    p_block_numbers,
    p_receiver_address
  ) as priced_order;
end;
$$;

alter function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  bigint,
  text
) owner to postgres;

revoke all on function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  bigint,
  text
) from public;

grant execute on function public.reserve_claim_blocks(
  text,
  text,
  smallint[],
  bigint,
  text
) to service_role;

create or replace function public.cancel_claim_order(
  p_order_id uuid,
  p_payment_address text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_lock_id smallint;
  v_order public.claim_orders%rowtype;
begin
  select pricing_lock.id
  into v_lock_id
  from public.block_pricing_lock as pricing_lock
  where pricing_lock.id = 1
  for update;

  if not found then
    raise exception
      'The Block pricing lock is unavailable.';
  end if;

  select orders.*
  into v_order
  from public.claim_orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    return false;
  end if;

  if v_order.payment_address <> p_payment_address then
    raise exception
      'The wallet does not own this order.';
  end if;

  if v_order.status <> 'pending' then
    return false;
  end if;

  update public.blocks
  set
    status = 'available',
    reservation_order_id = null,
    reservation_expires_at = null,
    sale_position = null,
    price_sats = null
  where
    reservation_order_id = p_order_id
    and status = 'reserved';

  update public.claim_orders
  set status = 'cancelled'
  where id = p_order_id;

  return true;
end;
$$;

alter function public.cancel_claim_order(
  uuid,
  text
) owner to postgres;

revoke all on function public.cancel_claim_order(
  uuid,
  text
) from public;

grant execute on function public.cancel_claim_order(
  uuid,
  text
) to service_role;

create or replace function public.confirm_claim_order_simulated(
  p_order_id uuid,
  p_payment_address text
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
as $$
declare
  v_lock_id smallint;
  v_order public.claim_orders%rowtype;
  v_reserved_count integer;
  v_reserved_amount_sats bigint;
begin
  select pricing_lock.id
  into v_lock_id
  from public.block_pricing_lock as pricing_lock
  where pricing_lock.id = 1
  for update;

  if not found then
    raise exception
      'The Block pricing lock is unavailable.';
  end if;

  select orders.*
  into v_order
  from public.claim_orders as orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception
      'The Claim order does not exist.';
  end if;

  if v_order.payment_address <> p_payment_address then
    raise exception
      'The wallet does not own this order.';
  end if;

  if v_order.status <> 'pending' then
    raise exception
      'The Claim order is no longer pending.';
  end if;

  if v_order.expires_at <= now() then
    raise exception
      'The Claim order has expired.';
  end if;

  perform blocks.block_number
  from public.blocks as blocks
  where blocks.reservation_order_id = p_order_id
  order by blocks.block_number
  for update;

  get diagnostics
    v_reserved_count = row_count;

  if v_reserved_count <>
    cardinality(v_order.block_numbers) then
    raise exception
      'The Block reservation is incomplete.';
  end if;

  select sum(blocks.price_sats)::bigint
  into v_reserved_amount_sats
  from public.blocks as blocks
  where
    blocks.reservation_order_id = p_order_id
    and blocks.status = 'reserved'
    and blocks.sale_position is not null
    and blocks.price_sats is not null;

  if v_reserved_amount_sats is null
    or v_reserved_amount_sats <> v_order.amount_sats then
    raise exception
      'The Block reservation price is invalid.';
  end if;

  update public.blocks as blocks
  set
    status = 'claimed',
    owner_payment_address = v_order.payment_address,
    owner_ordinals_address = v_order.ordinals_address,
    pixels = array_fill(
      '#ffffff'::text,
      array[256]
    ),
    description = null,
    claimed_at = now(),
    claim_transaction_id =
      'simulated-'
      || p_order_id::text
      || '-'
      || blocks.block_number::text,
    reservation_order_id = null,
    reservation_expires_at = null
  where blocks.reservation_order_id = p_order_id;

  update public.claim_orders
  set
    status = 'paid',
    payment_txid =
      'simulated-' || p_order_id::text
  where id = p_order_id;

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
  from public.blocks as blocks
  where blocks.block_number = any(v_order.block_numbers)
  order by blocks.block_number;
end;
$$;

alter function public.confirm_claim_order_simulated(
  uuid,
  text
) owner to postgres;

revoke all on function public.confirm_claim_order_simulated(
  uuid,
  text
) from public;

grant execute on function public.confirm_claim_order_simulated(
  uuid,
  text
) to service_role;

commit;
