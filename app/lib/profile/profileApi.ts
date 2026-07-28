interface ProfileResponse {
  username: string | null;
}

interface ErrorResponse {
  error?: string;
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

export async function loadWalletProfile():
  Promise<ProfileResponse> {
  const response = await fetch(
    "/api/profile",
    {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getResponseError(
        data,
        "Unable to load the profile.",
      ),
    );
  }

  const profile =
    data as unknown as ProfileResponse;

  return {
    username:
      typeof profile.username ===
        "string"
        ? profile.username
        : null,
  };
}

export async function updateWalletProfile(
  username: string | null,
): Promise<ProfileResponse> {
  const response = await fetch(
    "/api/profile",
    {
      method: "PATCH",
      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        username,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getResponseError(
        data,
        "Unable to update the profile.",
      ),
    );
  }

  const profile =
    data as unknown as ProfileResponse;

  return {
    username:
      typeof profile.username ===
        "string"
        ? profile.username
        : null,
  };
}