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

interface InscriptionRow {
  id: string;

  block_number: number;
  version: number;

  owner_payment_address: string;
  destination_ordinals_address: string;

  pixels: string[];
  description: string | null;

  inscription_id: string;
  confirmed_at: string;
}

function isValidPixelColor(
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

export async function GET(
  request: Request,
) {
  const url =
    new URL(request.url);

  const row =
    Number(
      url.searchParams.get(
        "row",
      ),
    );

  const column =
    Number(
      url.searchParams.get(
        "column",
      ),
    );

  const rowCount =
    boardConfig.height /
    boardConfig.blockSize;

  const columnCount =
    boardConfig.width /
    boardConfig.blockSize;

  if (
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row >= rowCount ||
    column < 0 ||
    column >= columnCount
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
    row * columnCount +
    column +
    1;

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
      destination_ordinals_address,
      pixels,
      description,
      inscription_id,
      confirmed_at
    `)
    .eq(
      "block_number",
      blockNumber,
    )
    .eq(
      "status",
      "confirmed",
    )
    .order(
      "version",
      {
        ascending: true,
      },
    );

  if (error) {
    console.error(
      "Unable to load Block Ordinal history:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "Unable to load Ordinal history.",
      },
      {
        status: 500,
      },
    );
  }

  const rows =
    (data ??
      []) as InscriptionRow[];

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const hasInvalidRow =
    rows.some(
      (inscription) =>
        !inscription.id ||
        inscription.block_number !==
          blockNumber ||
        !Number.isInteger(
          inscription.version,
        ) ||
        inscription.version < 1 ||
        !inscription
          .owner_payment_address ||
        !inscription
          .destination_ordinals_address ||
        !Array.isArray(
          inscription.pixels,
        ) ||
        inscription.pixels.length !==
          expectedPixelCount ||
        !inscription.pixels.every(
          isValidPixelColor,
        ) ||
        !inscription.inscription_id ||
        !inscription.confirmed_at,
    );

  if (hasInvalidRow) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Ordinal history contains invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      versions:
        rows.map(
          (inscription) => ({
            id:
              inscription.id,

            blockNumber:
              inscription.block_number,

            version:
              inscription.version,

            ownerPaymentAddress:
              inscription
                .owner_payment_address,

            destinationOrdinalsAddress:
              inscription
                .destination_ordinals_address,

            pixels: [
              ...inscription.pixels,
            ],

            description:
              inscription.description,

            inscriptionId:
              inscription.inscription_id,

            confirmedAt:
              inscription.confirmed_at,
          }),
        ),
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}