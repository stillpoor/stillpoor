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
  claimConfig,
} from "../../../lib/claim/claimConfig";

import {
  paymentConfig,
} from "../../../lib/payment/paymentConfig";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ReserveRequestBody {
  blocks?: unknown;
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

  const amountSats =
    blockNumbers.length *
    claimConfig.blockPriceSats;

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

      p_amount_sats:
        amountSats,

      p_receiver_address:
        paymentConfig.receiverAddress,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to reserve the Blocks.";

    const isAvailabilityConflict =
      errorMessage
        .toLowerCase()
        .includes(
          "no longer available",
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
      ? data[0]
      : null;

  if (
    !reservation?.order_id ||
    !reservation?.expires_at
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

      amountSats,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}