import { NextResponse } from "next/server";

import {
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

import {
  boardConfig,
} from "../../../lib/board/boardConfig";

import type {
  BlockCoordinate,
} from "../../../lib/board/boardTypes";

import {
  paymentConfig,
} from "../../../lib/payment/paymentConfig";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ReserveRequestBody {
  blocks?: unknown;
}

interface ReservationRow {
  order_id?: unknown;
  expires_at?: unknown;
  amount_sats?: unknown;
}

function isBlockCoordinate(
  value: unknown,
): value is BlockCoordinate {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const coordinate =
    value as Partial<BlockCoordinate>;

  const rowCount =
    boardConfig.height /
    boardConfig.blockSize;

  const columnCount =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    typeof coordinate.row === "number" &&
    Number.isInteger(coordinate.row) &&
    coordinate.row >= 0 &&
    coordinate.row < rowCount &&

    typeof coordinate.column === "number" &&
    Number.isInteger(coordinate.column) &&
    coordinate.column >= 0 &&
    coordinate.column < columnCount
  );
}

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.row * blocksPerRow +
    block.column +
    1
  );
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isPositiveSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
) {
  const session =
    await getServerWalletSession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A verified wallet session is required.",
      },
      {
        status: 401,
      },
    );
  }

  let body: ReserveRequestBody;

  try {
    body =
      (await request.json()) as ReserveRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The request body is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (!Array.isArray(body.blocks)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A Block selection is required.",
      },
      {
        status: 400,
      },
    );
  }

  const blocks =
    body.blocks.filter(
      isBlockCoordinate,
    );

  if (
    blocks.length === 0 ||
    blocks.length !==
      body.blocks.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "One or more Block coordinates are invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (blocks.length > 100) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A maximum of 100 Blocks may be reserved.",
      },
      {
        status: 400,
      },
    );
  }

  const blockNumbers =
    blocks.map(
      getPublicBlockNumber,
    );

  const uniqueBlockNumbers =
    new Set(blockNumbers);

  if (
    uniqueBlockNumbers.size !==
    blockNumbers.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The Block selection contains duplicates.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "reserve_claim_blocks",
    {
      p_payment_address:
        session.paymentAddress,

      p_ordinals_address:
        session.ordinalsAddress,

      p_block_numbers:
        blockNumbers,

      p_receiver_address:
        paymentConfig.receiverAddress,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to reserve the Blocks.";

    const lowerError =
      errorMessage.toLowerCase();

    const isAvailabilityConflict =
      lowerError.includes(
        "no longer available",
      ) ||
      lowerError.includes(
        "no more blocks",
      );

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      {
        status:
          isAvailabilityConflict
            ? 409
            : 400,
      },
    );
  }

  const reservation =
    Array.isArray(data)
      ? (
          data[0] as
            | ReservationRow
            | undefined
        )
      : undefined;

  if (
    !reservation ||
    !isNonEmptyString(
      reservation.order_id,
    ) ||
    !isNonEmptyString(
      reservation.expires_at,
    ) ||
    !isPositiveSafeInteger(
      reservation.amount_sats,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The reservation was created but returned invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      orderId:
        reservation.order_id,

      expiresAt:
        reservation.expires_at,

      amountSats:
        reservation.amount_sats,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}