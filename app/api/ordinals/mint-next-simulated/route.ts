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

interface MintNextRequestBody {
  block?: unknown;
  expectedLatestVersion?: unknown;
  pixels?: unknown;
  description?: unknown;
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
    typeof coordinate.row ===
      "number" &&
    Number.isInteger(
      coordinate.row,
    ) &&
    coordinate.row >= 0 &&
    coordinate.row < rowCount &&

    typeof coordinate.column ===
      "number" &&
    Number.isInteger(
      coordinate.column,
    ) &&
    coordinate.column >= 0 &&
    coordinate.column <
      columnCount
  );
}

function isValidPixelColour(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(
      value,
    )
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

  let body: MintNextRequestBody;

  try {
    body =
      (await request.json()) as MintNextRequestBody;
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

  if (
    typeof body.expectedLatestVersion !==
      "number" ||
    !Number.isInteger(
      body.expectedLatestVersion,
    ) ||
    body.expectedLatestVersion < 1
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "A valid previous Ordinal version is required.",
      },
      {
        status: 400,
      },
    );
  }

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  if (
    !Array.isArray(
      body.pixels,
    ) ||
    body.pixels.length !==
      expectedPixelCount ||
    !body.pixels.every(
      isValidPixelColour,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Block must contain exactly 256 valid Pixels.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    body.description !==
      null &&
    body.description !==
      undefined &&
    typeof body.description !==
      "string"
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Block description must be text.",
      },
      {
        status: 400,
      },
    );
  }

  const description =
    typeof body.description ===
      "string"
      ? body.description
      : "";

  if (
    description.length > 300
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "A Block description cannot exceed 300 characters.",
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

  const expectedLatestVersion =
    body.expectedLatestVersion;

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "mint_next_block_ordinal_simulated",
    {
      p_payment_address:
        session.paymentAddress,

      p_destination_ordinals_address:
        session.ordinalsAddress,

      p_block_number:
        blockNumber,

      p_expected_latest_version:
        expectedLatestVersion,

      p_pixels: [
        ...body.pixels,
      ],

      p_description:
        description,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to create the new Ordinal version.";

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
        "version has changed",
      ) ||
      lowerError.includes(
        "already",
      ) ||
      lowerError.includes(
        "pending",
      ) ||
      lowerError.includes(
        "no changes",
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

  const expectedNextVersion =
    expectedLatestVersion + 1;

  if (
    rows.length !== 1 ||
    !row ||
    row.block_number !==
      blockNumber ||
    row.owner_payment_address !==
      session.paymentAddress ||
    row.destination_ordinals_address !==
      session.ordinalsAddress ||
    !Array.isArray(
      row.pixels,
    ) ||
    row.pixels.length !==
      expectedPixelCount ||
    row.latest_inscription_version !==
      expectedNextVersion ||
    row.inscription_version !==
      expectedNextVersion ||
    row.inscription_status !==
      "confirmed" ||
    !row.latest_inscription_id ||
    !row.latest_inscribed_at ||
    row.inscription_pending ||
    !row.inscription_record_id ||
    !row.commit_transaction_id ||
    !row.reveal_transaction_id
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The simulated Ordinal version returned invalid data.",
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