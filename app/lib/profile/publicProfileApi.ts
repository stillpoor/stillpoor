interface PublicProfileResponse {
  username: string | null;
}

interface PublicProfilesResponse {
  profiles?: unknown;
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
    throw new Error(
      getResponseError(
        data,
        "Unable to load the public profile.",
      ),
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

export async function loadPublicWalletProfiles(
  paymentAddresses: string[],
): Promise<
  Record<string, string | null>
> {
  const uniquePaymentAddresses = [
    ...new Set(
      paymentAddresses
        .map(
          (paymentAddress) =>
            paymentAddress.trim(),
        )
        .filter(
          (paymentAddress) =>
            paymentAddress.length > 0,
        ),
    ),
  ];

  if (
    uniquePaymentAddresses.length ===
    0
  ) {
    return {};
  }

  const response = await fetch(
    "/api/public-profile",
    {
      method: "POST",
      cache: "no-store",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        paymentAddresses:
          uniquePaymentAddresses,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getResponseError(
        data,
        "Unable to load the public profiles.",
      ),
    );
  }

  const responseData =
    data as unknown as PublicProfilesResponse;

  const rawProfiles =
    responseData.profiles;

  const profiles:
    Record<string, string | null> =
      {};

  for (
    const paymentAddress of
    uniquePaymentAddresses
  ) {
    if (
      !rawProfiles ||
      typeof rawProfiles !==
        "object" ||
      Array.isArray(rawProfiles)
    ) {
      profiles[
        paymentAddress
      ] = null;

      continue;
    }

    const rawUsername =
      (
        rawProfiles as Record<
          string,
          unknown
        >
      )[paymentAddress];

    profiles[paymentAddress] =
      typeof rawUsername === "string"
        ? rawUsername
        : null;
  }

  return profiles;
}