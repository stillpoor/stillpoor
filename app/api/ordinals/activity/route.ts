import {
  NextResponse,
} from "next/server";

import {
  boardConfig,
} from "../../../lib/board/boardConfig";

import {
  PIXELS_PER_BLOCK,
} from "../../../lib/board/boardTypes";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ConfirmedInscriptionRow {
  id: string;

  block_number: number;
  version: number;

  owner_payment_address: string;

  pixels: string[];
  description: string | null;

  inscription_id: string;
  confirmed_at: string;
}

const MAX_PUBLIC_INSCRIPTIONS =
  200;

function getBlockCoordinate(
  blockNumber: number,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  const zeroBasedBlockNumber =
    blockNumber - 1;

  return {
    row: Math.floor(
      zeroBasedBlockNumber /
        blocksPerRow,
    ),

    column:
      zeroBasedBlockNumber %
      blocksPerRow,
  };
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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("block_inscriptions")
    .select(`
      id,
      block_number,
      version,
      owner_payment_address,
      pixels,
      description,
      inscription_id,
      confirmed_at
    `)
    .eq(
      "status",
      "confirmed",
    )
    .order(
      "confirmed_at",
      {
        ascending: false,
      },
    )
    .limit(
      MAX_PUBLIC_INSCRIPTIONS,
    );

  if (error) {
    console.error(
      "Unable to load Ordinal activity:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "Unable to load Ordinal activity.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const rows =
    (data ??
      []) as ConfirmedInscriptionRow[];

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const maximumBlockNumber =
    (
      boardConfig.width /
      boardConfig.blockSize
    ) *
    (
      boardConfig.height /
      boardConfig.blockSize
    );

  const hasInvalidRow =
    rows.some(
      (row) =>
        !row.id ||
        !Number.isInteger(
          row.block_number,
        ) ||
        row.block_number < 1 ||
        row.block_number >
          maximumBlockNumber ||
        !Number.isInteger(
          row.version,
        ) ||
        row.version < 1 ||
        !row.owner_payment_address ||
        !Array.isArray(
          row.pixels,
        ) ||
        row.pixels.length !==
          expectedPixelCount ||
        !row.pixels.every(
          isValidPixelColour,
        ) ||
        !row.inscription_id ||
        !row.confirmed_at,
    );

  if (hasInvalidRow) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Ordinal activity contains invalid data.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const inscriptions =
    rows.map((row) => ({
      id: row.id,

      blockNumber:
        row.block_number,

      coordinate:
        getBlockCoordinate(
          row.block_number,
        ),

      version: row.version,

      ownerWalletAddress:
        row.owner_payment_address,

      pixels: [
        ...row.pixels,
      ],

      description:
        row.description,

      inscriptionId:
        row.inscription_id,

      confirmedAt:
        row.confirmed_at,
    }));

  return NextResponse.json(
    {
      ok: true,
      inscriptions,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}