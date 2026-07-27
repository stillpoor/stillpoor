interface ErrorResponse {
  ok?: false;
  error?: string;
}

export interface WalletChallenge {
  challengeId: string;
  message: string;
  expiresAt: string;
}

export interface AuthenticatedWalletSession {
  paymentAddress: string;
  ordinalsAddress: string;
  expiresAt: string;
}

interface ChallengeResponse {
  ok: true;
  challengeId: string;
  message: string;
  expiresAt: string;
}

interface VerifyResponse {
  ok: true;
  paymentAddress: string;
  ordinalsAddress: string;
  expiresAt: string;
}

interface SessionResponse {
  ok: true;
  isAuthenticated: boolean;

  paymentAddress?: string;
  ordinalsAddress?: string;
  expiresAt?: string;
}

async function readResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getResponseError(
  data: Record<string, unknown>,
  fallbackMessage: string,
) {
  const errorResponse =
    data as ErrorResponse;

  return typeof errorResponse.error ===
    "string"
    ? errorResponse.error
    : fallbackMessage;
}

export async function createWalletChallenge({
  paymentAddress,
  ordinalsAddress,
}: {
  paymentAddress: string;
  ordinalsAddress: string;
}): Promise<WalletChallenge> {
  const response = await fetch(
    "/api/auth/challenge",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        paymentAddress,
        ordinalsAddress,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok || data.ok !== true) {
    throw new Error(
      getResponseError(
        data,
        "Unable to create the authentication challenge.",
      ),
    );
  }

  const challenge =
    data as unknown as ChallengeResponse;

  return {
    challengeId:
      challenge.challengeId,

    message:
      challenge.message,

    expiresAt:
      challenge.expiresAt,
  };
}

export async function verifyWalletSignature({
  challengeId,
  signature,
}: {
  challengeId: string;
  signature: string;
}): Promise<AuthenticatedWalletSession> {
  const response = await fetch(
    "/api/auth/verify",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        challengeId,
        signature,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok || data.ok !== true) {
    throw new Error(
      getResponseError(
        data,
        "Unable to verify the wallet signature.",
      ),
    );
  }

  const session =
    data as unknown as VerifyResponse;

  return {
    paymentAddress:
      session.paymentAddress,

    ordinalsAddress:
      session.ordinalsAddress,

    expiresAt:
      session.expiresAt,
  };
}

export async function getWalletSession():
  Promise<AuthenticatedWalletSession | null> {
  const response = await fetch(
    "/api/auth/session",
    {
      method: "GET",
      credentials: "same-origin",

      headers: {
        Accept: "application/json",
      },

      cache: "no-store",
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok || data.ok !== true) {
    throw new Error(
      getResponseError(
        data,
        "Unable to restore the wallet session.",
      ),
    );
  }

  const session =
    data as unknown as SessionResponse;

  if (!session.isAuthenticated) {
    return null;
  }

  if (
    typeof session.paymentAddress !==
      "string" ||
    typeof session.ordinalsAddress !==
      "string" ||
    typeof session.expiresAt !==
      "string"
  ) {
    throw new Error(
      "The server returned an invalid wallet session.",
    );
  }

  return {
    paymentAddress:
      session.paymentAddress,

    ordinalsAddress:
      session.ordinalsAddress,

    expiresAt:
      session.expiresAt,
  };
}