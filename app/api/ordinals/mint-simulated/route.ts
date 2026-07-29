import {
  NextResponse,
} from "next/server";

import {
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

import {
  boardConfig,
} from "../../../lib/board/boardConfig";

import {
  PIXELS_PER_BLOCK,
} from "../../../lib/board/boardTypes";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

import type {
  BlockCoordinate,
} from "../../../lib/board/boardTypes";

interface MintRequestBody {
  block?: unknown;
}

interface MintedOrdinalRow {
  block_number: number;
  block_row: number;
  block_column: number;

  owner_payment_address: string;

  pixels: string[];
  description: string | null;

  claimed_at: string;
  updated_at: string;

  claim_transaction_id: string;

  latest_inscription_version: number;
  latest_inscription_id: string;
  latest_inscribed_at: string;
  inscription_pending: boolean;

  inscription_record_id: string;
  inscription_version: number;
  inscription_status: string;

  destination_ordinals_address: string;

  commit_transaction_id: string;
  reveal_transaction_id: string;
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
    Number.isInteger(
      coordinate.row,
    ) &&
    coordinate.row >= 0 &&
    coordinate.row < rowCount &&

    typeof coordinate.column === "number" &&
    Number.isInteger(
      coordinate.column,
    ) &&
    coordinate.column >= 0 &&
    coordinate.column < columnCount
  );
}

function getPublicBlockNumber(
  coordinate: BlockCoordinate,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    coordinate.row *
      blocksPerRow +
    coordinate.column +
    1
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

  let body: MintRequestBody;

  try {
    body =
      (await request.json()) as MintRequestBody;
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
    !isBlockCoordinate(
      body.block,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A valid Block coordinate is required.",
      },
      {
        status: 400,
      },
    );
  }

  const blockNumber =
    getPublicBlockNumber(
      body.block,
    );

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "mint_first_block_ordinal_simulated",
    {
      p_payment_address:
        session.paymentAddress,

      p_destination_ordinals_address:
        session.ordinalsAddress,

      p_block_number:
        blockNumber,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to mint the Ordinal.";

    const lowerError =
      errorMessage.toLowerCase();

    let status = 400;

    if (
      lowerError.includes(
        "not owned",
      )
    ) {
      status = 403;
    } else if (
      lowerError.includes(
        "does not exist",
      )
    ) {
      status = 404;
    } else if (
      lowerError.includes(
        "already",
      ) ||
      lowerError.includes(
        "pending",
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
    (data ?? []) as MintedOrdinalRow[];

  const row =
    rows[0];

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  if (
    rows.length !== 1 ||
    !row ||
    row.owner_payment_address !==
      session.paymentAddress ||
    !Array.isArray(row.pixels) ||
    row.pixels.length !==
      expectedPixelCount ||
    row.latest_inscription_version !==
      1 ||
    row.inscription_version !== 1 ||
    row.inscription_status !==
      "confirmed" ||
    !row.latest_inscription_id ||
    !row.latest_inscribed_at ||
    row.inscription_pending ||
    !row.inscription_record_id
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The simulated inscription returned invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      block: {
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
          row.latest_inscription_version,

        latestInscriptionId:
          row.latest_inscription_id,

        latestInscribedAt:
          row.latest_inscribed_at,

        inscriptionPending:
          row.inscription_pending,
      },

      inscription: {
        id:
          row.inscription_record_id,

        version:
          row.inscription_version,

        status:
          row.inscription_status,

        inscriptionId:
          row.latest_inscription_id,

        destinationOrdinalsAddress:
          row.destination_ordinals_address,

        commitTransactionId:
          row.commit_transaction_id,

        revealTransactionId:
          row.reveal_transaction_id,
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}