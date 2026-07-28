interface PublicProfileResponse {
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

export async function loadPublicWalletProfile(
  paymentAddress: string,
): Promise<PublicProfileResponse> {
  const searchParameters =
    new URLSearchParams({
      paymentAddress,
    });

  const response = await fetch(
    `/api/public-profile?${searchParameters.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok) {
    const errorResponse =
      data as ErrorResponse;

    throw new Error(
      typeof errorResponse.error ===
        "string"
        ? errorResponse.error
        : "Unable to load the public profile.",
    );
  }

  const profile =
    data as unknown as PublicProfileResponse;

  return {
    username:
      typeof profile.username ===
        "string"
        ? profile.username
        : null,
  };
}