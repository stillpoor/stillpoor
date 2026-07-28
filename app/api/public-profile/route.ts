import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "../../lib/supabase/serverClient";

export const dynamic = "force-dynamic";

const MAX_BATCH_ADDRESSES = 4096;
const DATABASE_BATCH_SIZE = 200;

interface PublicProfileRow {
  payment_address: string;
  username: string | null;
}

interface PublicProfilesRequestBody {
  paymentAddresses?: unknown;
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}

function isValidPaymentAddress(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 200
  );
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
    .select(`
      payment_address,
      username
    `)
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

export async function POST(
  request: Request,
) {
  let body: PublicProfilesRequestBody;

  try {
    body =
      (await request.json()) as PublicProfilesRequestBody;
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
    !Array.isArray(
      body.paymentAddresses,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Payment addresses must be an array.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  if (
    body.paymentAddresses.length >
    MAX_BATCH_ADDRESSES
  ) {
    return NextResponse.json(
      {
        error:
          "Too many payment addresses were requested.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  const hasInvalidAddress =
    body.paymentAddresses.some(
      (paymentAddress) =>
        !isValidPaymentAddress(
          paymentAddress,
        ),
    );

  if (hasInvalidAddress) {
    return NextResponse.json(
      {
        error:
          "One or more payment addresses are invalid.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      },
    );
  }

  const paymentAddresses = [
    ...new Set(
      body.paymentAddresses.map(
        (paymentAddress) =>
          (
            paymentAddress as string
          ).trim(),
      ),
    ),
  ];

  const profiles:
    Record<string, string | null> =
      Object.fromEntries(
        paymentAddresses.map(
          (paymentAddress) => [
            paymentAddress,
            null,
          ],
        ),
      );

  for (
    let index = 0;
    index <
    paymentAddresses.length;
    index += DATABASE_BATCH_SIZE
  ) {
    const addressBatch =
      paymentAddresses.slice(
        index,
        index +
          DATABASE_BATCH_SIZE,
      );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("wallet_profiles")
      .select(`
        payment_address,
        username
      `)
      .in(
        "payment_address",
        addressBatch,
      );

    if (error) {
      console.error(
        "Unable to load public wallet profiles:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the public profiles.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    const rows =
      (data ?? []) as PublicProfileRow[];

    for (const row of rows) {
      profiles[
        row.payment_address
      ] = row.username;
    }
  }

  return NextResponse.json(
    {
      profiles,
    },
    {
      headers: noStoreHeaders(),
    },
  );
}