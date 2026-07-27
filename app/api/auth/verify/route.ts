import { NextResponse } from "next/server";

import { Verifier } from "bip322-js";

import {
  walletAuthConfig,
} from "../../../lib/auth/authConfig";

import {
  createSessionToken,
  hashSessionToken,
} from "../../../lib/auth/sessionToken";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface VerifyRequestBody {
  challengeId?: unknown;
  signature?: unknown;
}

interface ChallengeRow {
  id: string;

  payment_address: string;
  ordinals_address: string;

  message: string;
  expires_at: string;
  used_at: string | null;
}

interface SessionResultRow {
  payment_address: string;
  ordinals_address: string;
  session_expires_at: string;
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
  let body: VerifyRequestBody;

  try {
    body =
      (await request.json()) as VerifyRequestBody;
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
      body.challengeId,
    ) ||
    !isNonEmptyString(
      body.signature,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A challenge ID and signature are required.",
      },
      {
        status: 400,
      },
    );
  }

  const challengeId =
    body.challengeId.trim();

  const signature =
    body.signature.trim();

  const {
  data: challengeData,
  error: challengeError,
} = await supabaseAdmin
  .from("wallet_auth_challenges")
  .select(`
    id,
    payment_address,
    ordinals_address,
    message,
    expires_at,
    used_at
  `)
  .eq("id", challengeId)
  .maybeSingle();

  if (
    challengeError ||
    !challengeData
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The authentication challenge does not exist.",
      },
      {
        status: 401,
      },
    );
  }

  const challenge =
    challengeData as ChallengeRow;

  if (challenge.used_at) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The authentication challenge has already been used.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    new Date(
      challenge.expires_at,
    ).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The authentication challenge has expired.",
      },
      {
        status: 401,
      },
    );
  }

  let isSignatureValid = false;

  try {
    /*
     * The final `true` enables strict verification.
     * We explicitly request a BIP-322 signature
     * from Xverse on the client.
     */
    isSignatureValid =
  Verifier.verifySignature(
    challenge.payment_address,
    challenge.message,
    signature,
  );
  } catch (error) {
    console.warn(
      "BIP-322 signature verification failed:",
      error,
    );
  }

  if (!isSignatureValid) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The wallet signature is invalid.",
      },
      {
        status: 401,
      },
    );
  }

  const sessionToken =
    createSessionToken();

  const sessionTokenHash =
    hashSessionToken(
      sessionToken,
    );

  const sessionExpiresAt =
    new Date(
      Date.now() +
        walletAuthConfig
          .sessionLifetimeDays *
          24 *
          60 *
          60 *
          1_000,
    );

  const {
    data: sessionData,
    error: sessionError,
  } = await supabaseAdmin.rpc(
    "create_wallet_session",
    {
      p_challenge_id:
        challenge.id,

      p_session_token_hash:
        sessionTokenHash,

      p_session_expires_at:
        sessionExpiresAt.toISOString(),
    },
  );

  if (sessionError) {
    console.error(
      "Unable to create wallet session:",
      sessionError,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          sessionError.message ||
          "Unable to create the wallet session.",
      },
      {
        status: 401,
      },
    );
  }

  const session =
    (
      sessionData as
        | SessionResultRow[]
        | null
    )?.[0];

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase returned an invalid session.",
      },
      {
        status: 500,
      },
    );
  }

  const response =
    NextResponse.json(
      {
        ok: true,

        paymentAddress:
          session.payment_address,

        ordinalsAddress:
          session.ordinals_address,

        expiresAt:
          session.session_expires_at,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );

  response.cookies.set({
    name:
      walletAuthConfig
        .sessionCookieName,

    value:
      sessionToken,

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax",
    path: "/",

    expires:
      sessionExpiresAt,
  });

  return response;
}