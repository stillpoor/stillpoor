import {
  NextResponse,
} from "next/server";

import {
  clearSessionCookie,
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session =
    await getServerWalletSession();

  if (!session) {
    await clearSessionCookie();

    return NextResponse.json(
      {
        ok: true,
        isAuthenticated: false,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      isAuthenticated: true,

      paymentAddress:
        session.paymentAddress,

      ordinalsAddress:
        session.ordinalsAddress,

      expiresAt:
        session.expiresAt,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}