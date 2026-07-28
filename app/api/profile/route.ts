import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getServerWalletSession,
} from "../../lib/auth/serverSession";

import {
  supabaseAdmin,
} from "../../lib/supabase/serverClient";

export const dynamic = "force-dynamic";

interface WalletProfileRow {
  payment_address: string;
  username: string | null;
  created_at: string;
  updated_at: string;
}

interface UpdateProfileBody {
  username?: unknown;
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}

export async function GET() {
  const session =
    await getServerWalletSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      },
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("wallet_profiles")
    .select(`
      payment_address,
      username,
      created_at,
      updated_at
    `)
    .eq(
      "payment_address",
      session.paymentAddress,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load wallet profile:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load the profile.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }

  const profile =
    data as WalletProfileRow | null;

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

export async function PATCH(
  request: NextRequest,
) {
  const session =
    await getServerWalletSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      },
    );
  }

  let body: UpdateProfileBody;

  try {
    body =
      (await request.json()) as UpdateProfileBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  if (
    body.username !== null &&
    typeof body.username !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Username must be a string or null.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  const trimmedUsername =
    typeof body.username === "string"
      ? body.username.trim()
      : "";

  const username =
    trimmedUsername === ""
      ? null
      : trimmedUsername;

  if (
    username &&
    !/^[A-Za-z0-9_]{3,20}$/.test(
      username,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Username must contain 3–20 letters, numbers or underscores.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("wallet_profiles")
    .upsert(
      {
        payment_address:
          session.paymentAddress,

        username,

        updated_at: now,
      },
      {
        onConflict:
          "payment_address",
      },
    )
    .select(`
      payment_address,
      username,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error:
            "This username is already taken.",
        },
        {
          status: 409,
          headers: noStoreHeaders(),
        },
      );
    }

    console.error(
      "Unable to update wallet profile:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update the profile.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }

  const profile =
    data as WalletProfileRow;

  return NextResponse.json(
    {
      username: profile.username,
    },
    {
      headers: noStoreHeaders(),
    },
  );
}