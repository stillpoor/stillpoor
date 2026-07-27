import { NextResponse } from "next/server";

import {
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface CancelRequestBody {
  orderId?: unknown;
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
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

  let body: CancelRequestBody;

  try {
    body =
      (await request.json()) as CancelRequestBody;
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
    "cancel_claim_order",
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
      "Unable to cancel the reservation.";

    const isOwnershipError =
      errorMessage
        .toLowerCase()
        .includes(
          "does not own",
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
            : 400,
      },
    );
  }

  return NextResponse.json(
    {
      ok: Boolean(data),
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}