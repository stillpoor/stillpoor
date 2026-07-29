import {
  NextResponse,
} from "next/server";

import {
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

import {
  PIXELS_PER_BLOCK,
} from "../../../lib/board/boardTypes";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ConfirmRequestBody {
  orderId?: unknown;
}

interface ClaimedBlockRow {
  block_number: number;
  block_row: number;
  block_column: number;

  owner_payment_address: string;

  pixels: string[];
  description: string | null;

  claimed_at: string;
  updated_at: string;

  claim_transaction_id: string;
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

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

  let body: ConfirmRequestBody;

  try {
    body =
      (await request.json()) as ConfirmRequestBody;
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

  if (
    !isNonEmptyString(
      body.orderId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The order ID is required.",
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
    "confirm_claim_order_simulated",
    {
      p_order_id:
        body.orderId.trim(),

      p_payment_address:
        session.paymentAddress,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to confirm the Claim order.";

    const lowerError =
      errorMessage.toLowerCase();

    let status = 400;

    if (
      lowerError.includes(
        "does not own",
      )
    ) {
      status = 403;
    } else if (
      lowerError.includes(
        "expired",
      )
    ) {
      status = 410;
    } else if (
      lowerError.includes(
        "no longer pending",
      )
    ) {
      status = 409;
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      {
        status,
      },
    );
  }

  const rows =
    (data ?? []) as ClaimedBlockRow[];

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const hasInvalidBlock =
    rows.some(
      (row) =>
        row.owner_payment_address !==
          session.paymentAddress ||
        !row.claimed_at ||
        !row.updated_at ||
        !row.claim_transaction_id ||
        !Array.isArray(
          row.pixels,
        ) ||
        row.pixels.length !==
          expectedPixelCount,
    );

  if (
    rows.length === 0 ||
    hasInvalidBlock
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The confirmed Blocks returned invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  const claimedBlocks =
    rows.map((row) => ({
      coordinate: {
        row: row.block_row,
        column:
          row.block_column,
      },

      ownerWalletAddress:
        row.owner_payment_address,

      pixels: [
        ...row.pixels,
      ],

      description:
        row.description,

      claimedAt:
        row.claimed_at,

      updatedAt:
        row.updated_at,

      claimTransactionId:
        row.claim_transaction_id,

      latestInscriptionVersion:
        0,

      latestInscriptionId:
        null,

      latestInscribedAt:
        null,

      inscriptionPending:
        false,
    }));

  return NextResponse.json(
    {
      ok: true,
      claimedBlocks,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}