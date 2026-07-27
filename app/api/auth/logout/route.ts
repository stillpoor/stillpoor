import {
  NextResponse,
} from "next/server";

import {
  revokeServerWalletSession,
} from "../../../lib/auth/serverSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await revokeServerWalletSession();

    return NextResponse.json(
      {
        ok: true,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Wallet logout failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to disconnect the wallet session.",
      },
      {
        status: 500,
      },
    );
  }
}