import { NextResponse } from "next/server";

import {
  supabaseAdmin,
} from "../../lib/supabase/serverClient";

export const dynamic = "force-dynamic";

interface BoardStatsRow {
  current_wealth_sats: number | string;

  available_blocks: number;
  claimed_blocks: number;
  active_reserved_blocks: number;

  current_price_sats:
    | number
    | string
    | null;

  next_price_sats:
    | number
    | string
    | null;

  blocks_until_price_increase:
    | number
    | null;

  next_available_block_number:
    | number
    | null;

  sold_out: boolean;
}

function readSafeInteger(
  value: unknown,
  fieldName: string,
): number {
  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < 0
  ) {
    throw new Error(
      `Invalid Board statistic: ${fieldName}.`,
    );
  }

  return parsedValue;
}

function readNullableSafeInteger(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === null) {
    return null;
  }

  return readSafeInteger(
    value,
    fieldName,
  );
}

export async function GET() {
  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "get_board_stats",
  );

  if (error) {
    console.error(
      "Unable to load Board statistics:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Board statistics.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const row =
    Array.isArray(data)
      ? (data[0] as
          | BoardStatsRow
          | undefined)
      : undefined;

  if (!row) {
    console.error(
      "The Board statistics function returned no data.",
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Board statistics.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    if (
      typeof row.sold_out !== "boolean"
    ) {
      throw new Error(
        "Invalid Board statistic: sold_out.",
      );
    }

    return NextResponse.json(
      {
        currentWealthSats:
          readSafeInteger(
            row.current_wealth_sats,
            "current_wealth_sats",
          ),

        availableBlocks:
          readSafeInteger(
            row.available_blocks,
            "available_blocks",
          ),

        claimedBlocks:
          readSafeInteger(
            row.claimed_blocks,
            "claimed_blocks",
          ),

        activeReservedBlocks:
          readSafeInteger(
            row.active_reserved_blocks,
            "active_reserved_blocks",
          ),

        currentPriceSats:
          readNullableSafeInteger(
            row.current_price_sats,
            "current_price_sats",
          ),

        nextPriceSats:
          readNullableSafeInteger(
            row.next_price_sats,
            "next_price_sats",
          ),

        blocksUntilPriceIncrease:
          readNullableSafeInteger(
            row.blocks_until_price_increase,
            "blocks_until_price_increase",
          ),

        nextAvailableBlockNumber:
          readNullableSafeInteger(
            row.next_available_block_number,
            "next_available_block_number",
          ),

        soldOut: row.sold_out,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (validationError) {
    console.error(
      "Invalid Board statistics:",
      validationError,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Board statistics.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}