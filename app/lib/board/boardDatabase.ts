import {
  supabaseBrowser,
} from "../supabase/browserClient";

import {
  PIXELS_PER_BLOCK,
} from "./boardTypes";

import type {
  Block,
  PixelColor,
} from "./boardTypes";

interface ClaimedBlockRow {
  block_row: number;
  block_column: number;

  owner_payment_address:
    string | null;

  pixels: string[] | null;
  description: string | null;

  claimed_at: string | null;
  updated_at: string;

  claim_transaction_id:
    string | null;

  latest_inscription_version:
    number;

  latest_inscription_id:
    string | null;

  latest_inscribed_at:
    string | null;

  inscription_pending:
    boolean;
}

export async function loadClaimedBlocks(): Promise<
  Block[]
> {
  const {
    data,
    error,
  } = await supabaseBrowser
    .from("blocks")
    .select(`
      block_row,
      block_column,
      owner_payment_address,
      pixels,
      description,
      claimed_at,
      updated_at,
      claim_transaction_id,
      latest_inscription_version,
      latest_inscription_id,
      latest_inscribed_at,
      inscription_pending
    `)
    .eq(
      "status",
      "claimed",
    );

  if (error) {
    throw new Error(
      `Unable to load the Board: ${error.message}`,
    );
  }

  const rows =
    (data ?? []) as ClaimedBlockRow[];

  return rows.map((row) => {
    const expectedPixelCount =
      PIXELS_PER_BLOCK *
      PIXELS_PER_BLOCK;

    const hasInvalidInscriptionVersion =
      !Number.isInteger(
        row.latest_inscription_version,
      ) ||
      row.latest_inscription_version < 0;

    const hasInvalidInscriptionMetadata =
      (
        row.latest_inscription_version ===
          0 &&
        (
          row.latest_inscription_id !==
            null ||
          row.latest_inscribed_at !==
            null
        )
      ) ||
      (
        row.latest_inscription_version >
          0 &&
        (
          !row.latest_inscription_id ||
          !row.latest_inscribed_at
        )
      );

    if (
      !row.owner_payment_address ||
      !row.pixels ||
      row.pixels.length !==
        expectedPixelCount ||
      !row.claimed_at ||
      !row.updated_at ||
      !row.claim_transaction_id ||
      hasInvalidInscriptionVersion ||
      hasInvalidInscriptionMetadata ||
      typeof row.inscription_pending !==
        "boolean"
    ) {
      throw new Error(
        `Invalid claimed Block at ${row.block_row}:${row.block_column}.`,
      );
    }

    return {
      coordinate: {
        row: row.block_row,
        column: row.block_column,
      },

      ownerWalletAddress:
        row.owner_payment_address,

      pixels: [
        ...row.pixels,
      ] as PixelColor[],

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
    };
  });
}