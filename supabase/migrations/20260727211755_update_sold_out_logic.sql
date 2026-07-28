begin;

create or replace function public.get_board_stats()
returns table (
  current_wealth_sats bigint,
  available_blocks integer,
  claimed_blocks integer,
  active_reserved_blocks integer,
  current_price_sats bigint,
  next_price_sats bigint,
  blocks_until_price_increase integer,
  next_available_block_number smallint,
  sold_out boolean
)
language sql
stable
set search_path = public
as $$
  with effective_blocks as (
    select
      blocks.block_number,
      blocks.status,
      blocks.price_sats,

      case
        when
          blocks.status = 'reserved'
          and blocks.reservation_expires_at <= now()
        then 'available'
        else blocks.status
      end as effective_status,

      case
        when
          blocks.status = 'claimed'
          or (
            blocks.status = 'reserved'
            and blocks.reservation_expires_at > now()
          )
        then blocks.sale_position
        else null
      end as effective_sale_position
    from public.blocks as blocks
  ),

  board_summary as (
    select
      coalesce(
        sum(price_sats)
          filter (
            where status = 'claimed'
          ),
        0
      )::bigint as current_wealth_sats,

      count(*)
        filter (
          where effective_status = 'available'
        )::integer as available_blocks,

      count(*)
        filter (
          where status = 'claimed'
        )::integer as claimed_blocks,

      count(*)
        filter (
          where
            status = 'reserved'
            and effective_status = 'reserved'
        )::integer as active_reserved_blocks,

      min(block_number)
        filter (
          where effective_status = 'available'
        )::smallint as next_available_block_number
    from effective_blocks
  ),

  used_positions as (
    select effective_sale_position
    from effective_blocks
    where effective_sale_position is not null
  ),

  free_positions as (
    select
      candidate.sale_position::smallint
        as sale_position,

      least(
        100000
        + (
          (
            (
              candidate.sale_position::integer
              - 1
            ) / 100
          )
          * 10000
        ),
        500000
      )::bigint as price_sats
    from generate_series(1, 4096)
      as candidate(sale_position)
    where not exists (
      select 1
      from used_positions
      where
        used_positions.effective_sale_position =
          candidate.sale_position
    )
  ),

  next_pricing_position as (
    select
      min(sale_position)::smallint
        as sale_position
    from free_positions
  ),

  current_pricing as (
    select
      next_pricing_position.sale_position,

      free_positions.price_sats
        as current_price_sats
    from next_pricing_position
    left join free_positions
      on free_positions.sale_position =
        next_pricing_position.sale_position
  ),

  pricing_summary as (
    select
      current_pricing.current_price_sats,

      case
        when
          current_pricing.current_price_sats is null
          or current_pricing.current_price_sats >= 500000
        then null
        else
          current_pricing.current_price_sats + 10000
      end::bigint as next_price_sats,

      case
        when
          current_pricing.current_price_sats is null
          or current_pricing.current_price_sats >= 500000
        then null
        else (
          select count(*)::integer
          from free_positions
          where
            free_positions.price_sats =
              current_pricing.current_price_sats
        )
      end as blocks_until_price_increase
    from current_pricing
  )

  select
    board_summary.current_wealth_sats,
    board_summary.available_blocks,
    board_summary.claimed_blocks,
    board_summary.active_reserved_blocks,

    case
      when board_summary.available_blocks = 0
      then null
      else pricing_summary.current_price_sats
    end as current_price_sats,

    case
      when board_summary.available_blocks = 0
      then null
      else pricing_summary.next_price_sats
    end as next_price_sats,

    case
      when board_summary.available_blocks = 0
      then null
      else pricing_summary.blocks_until_price_increase
    end as blocks_until_price_increase,

    board_summary.next_available_block_number,

    (
      board_summary.available_blocks = 0
    ) as sold_out
  from board_summary
  cross join pricing_summary;
$$;

alter function public.get_board_stats()
  owner to postgres;

revoke all
on function public.get_board_stats()
from public;

grant execute
on function public.get_board_stats()
to service_role;

commit;