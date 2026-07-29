import {
  NextResponse,
} from "next/server";

import {
  boardConfig,
} from "../../../lib/board/boardConfig";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ActiveReservationRow {
  block_row: number;
  block_column: number;

  reservation_expires_at:
    string | null;
}

function isValidReservation(
  row: ActiveReservationRow,
) {
  const rowCount =
    boardConfig.height /
    boardConfig.blockSize;

  const columnCount =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    Number.isInteger(
      row.block_row,
    ) &&
    row.block_row >= 0 &&
    row.block_row < rowCount &&

    Number.isInteger(
      row.block_column,
    ) &&
    row.block_column >= 0 &&
    row.block_column <
      columnCount &&

    typeof row
      .reservation_expires_at ===
      "string" &&

    new Date(
      row.reservation_expires_at,
    ).getTime() > Date.now()
  );
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("blocks")
    .select(`
      block_row,
      block_column,
      reservation_expires_at
    `)
    .eq(
      "status",
      "reserved",
    )
    .gt(
      "reservation_expires_at",
      now,
    );

  if (error) {
    console.error(
      "Unable to load active Block reservations:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          "Unable to load active Block reservations.",
      },
      {
        status: 500,
      },
    );
  }

  const rows =
    (data ?? []) as
      ActiveReservationRow[];

  if (
    rows.some(
      (row) =>
        !isValidReservation(
          row,
        ),
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The active reservations contain invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      reservations:
        rows.map(
          (row) => ({
            coordinate: {
              row:
                row.block_row,

              column:
                row.block_column,
            },

            expiresAt:
              row.reservation_expires_at,
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