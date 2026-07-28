import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "../../lib/supabase/serverClient";

export const dynamic = "force-dynamic";

interface PublicProfileRow {
  username: string | null;
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}

export async function GET(
  request: NextRequest,
) {
  const paymentAddress =
    request.nextUrl.searchParams
      .get("paymentAddress")
      ?.trim();

  if (
    !paymentAddress ||
    paymentAddress.length > 200
  ) {
    return NextResponse.json(
      {
        error:
          "A valid payment address is required.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("wallet_profiles")
    .select("username")
    .eq(
      "payment_address",
      paymentAddress,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load public wallet profile:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load the public profile.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }

  const profile =
    data as PublicProfileRow | null;

  return NextResponse.json(
    {
      username:
        profile?.username ?? null,
    },
    {
      headers: noStoreHeaders(),
    },
  );
}