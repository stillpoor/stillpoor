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

interface SaveBlockInput {
  coordinate?: unknown;
  pixels?: unknown;
  description?: unknown;
}

interface SaveRequestBody {
  blocks?: unknown;
}

interface SavedBlockRow {
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

  let body: SaveRequestBody;

  try {
    body =
      (await request.json()) as SaveRequestBody;
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
    !Array.isArray(
      body.blocks,
    ) ||
    body.blocks.length === 0 ||
    body.blocks.length > 100
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Between 1 and 100 Blocks must be provided.",
      },
      {
        status: 400,
      },
    );
  }

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const validatedBlocks = [];

  for (
    const rawBlock of
    body.blocks
  ) {
    if (
      !rawBlock ||
      typeof rawBlock !==
        "object"
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "One or more Blocks are invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const block =
      rawBlock as SaveBlockInput;

    if (
      !isBlockCoordinate(
        block.coordinate,
      ) ||
      !Array.isArray(
        block.pixels,
      ) ||
      block.pixels.length !==
        expectedPixelCount ||
      !block.pixels.every(
        isValidPixelColour,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "One or more Blocks contain invalid coordinates or Pixels.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      block.description !==
        null &&
      block.description !==
        undefined &&
      typeof block.description !==
        "string"
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "A Block description must be text.",
        },
        {
          status: 400,
        },
      );
    }

    const description =
      typeof block.description ===
        "string"
        ? block.description
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

    validatedBlocks.push({
      blockNumber:
        getPublicBlockNumber(
          block.coordinate,
        ),

      pixels: [
        ...block.pixels,
      ],

      description,
    });
  }

  const uniqueBlockNumbers =
    new Set(
      validatedBlocks.map(
        (block) =>
          block.blockNumber,
      ),
    );

  if (
    uniqueBlockNumbers.size !==
      validatedBlocks.length
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Blocks payload contains duplicates.",
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
    "save_owned_blocks",
    {
      p_payment_address:
        session.paymentAddress,

      p_blocks:
        validatedBlocks,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to save the Blocks.";

    const lowerErrorMessage =
      errorMessage.toLowerCase();

    const isOwnershipError =
      lowerErrorMessage.includes(
        "not owned",
      );

    const isOrdinalLockError =
      lowerErrorMessage.includes(
        "locked by an ordinal inscription",
      );

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
      },
      {
        status:
          isOwnershipError
            ? 403
            : isOrdinalLockError
              ? 409
              : 400,
      },
    );
  }

  const rows =
    (data ?? []) as SavedBlockRow[];

  const hasInvalidSavedBlock =
    rows.some(
      (row) =>
        row.owner_payment_address !==
          session.paymentAddress ||
        !Array.isArray(
          row.pixels,
        ) ||
        row.pixels.length !==
          expectedPixelCount ||
        !row.claimed_at ||
        !row.updated_at ||
        !row.claim_transaction_id,
    );

  if (
    rows.length !==
      validatedBlocks.length ||
    hasInvalidSavedBlock
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Supabase returned an invalid or incomplete save result.",
      },
      {
        status: 500,
      },
    );
  }

  const savedBlocks =
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
      savedBlocks,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}