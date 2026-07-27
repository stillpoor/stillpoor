import { NextResponse } from "next/server";

import {
  walletAuthConfig,
} from "../../../lib/auth/authConfig";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ChallengeRequestBody {
  paymentAddress?: unknown;
  ordinalsAddress?: unknown;
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

export async function POST(
  request: Request,
) {
  let body: ChallengeRequestBody;

  try {
    body =
      (await request.json()) as ChallengeRequestBody;
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
      body.paymentAddress,
    ) ||
    !isNonEmptyString(
      body.ordinalsAddress,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Both Bitcoin wallet addresses are required.",
      },
      {
        status: 400,
      },
    );
  }

  const paymentAddress =
    body.paymentAddress.trim();

  const ordinalsAddress =
    body.ordinalsAddress.trim();

  const issuedAt =
    new Date();

  const expiresAt =
    new Date(
      issuedAt.getTime() +
        walletAuthConfig
          .challengeLifetimeMinutes *
          60_000,
    );

  const challengeId =
    crypto.randomUUID();

  const origin =
    new URL(request.url).origin;

  const message = [
    "StillPoor wallet authentication",
    "",
    "Sign this message to prove you control this Bitcoin wallet.",
    "This request does not create a transaction or cost any fees.",
    "",
    `Domain: ${origin}`,
    `Payment address: ${paymentAddress}`,
    `Ordinals address: ${ordinalsAddress}`,
    `Challenge: ${challengeId}`,
    `Issued at: ${issuedAt.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
  ].join("\n");

  /*
   * Invalidate previous unused challenges
   * for this payment address.
   */
  const {
    error: invalidationError,
  } = await supabaseAdmin
    .from("wallet_auth_challenges")
    .update({
      used_at:
        issuedAt.toISOString(),
    })
    .eq(
      "payment_address",
      paymentAddress,
    )
    .is("used_at", null)
    .gt(
      "expires_at",
      issuedAt.toISOString(),
    );

  if (invalidationError) {
    console.error(
      "Unable to invalidate old wallet challenges:",
      invalidationError,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unable to create the authentication challenge.",
      },
      {
        status: 500,
      },
    );
  }

  const {
    error: insertionError,
  } = await supabaseAdmin
    .from("wallet_auth_challenges")
    .insert({
      id: challengeId,

      payment_address:
        paymentAddress,

      ordinals_address:
        ordinalsAddress,

      message,

      expires_at:
        expiresAt.toISOString(),
    });

  if (insertionError) {
    console.error(
      "Unable to insert wallet challenge:",
      insertionError,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unable to create the authentication challenge.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      challengeId,
      message,

      expiresAt:
        expiresAt.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}