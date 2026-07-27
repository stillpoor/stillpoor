interface LogoutResponse {
  ok: true;
}

interface LogoutErrorResponse {
  ok?: false;
  error?: string;
}

export async function logoutWalletSession() {
  const response = await fetch(
    "/api/auth/logout",
    {
      method: "POST",

      credentials: "same-origin",

      headers: {
        Accept: "application/json",
      },
    },
  );

  let data:
    | LogoutResponse
    | LogoutErrorResponse;

  try {
    data =
      (await response.json()) as
        | LogoutResponse
        | LogoutErrorResponse;
  } catch {
    throw new Error(
      "The server returned an invalid response.",
    );
  }

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "Unable to disconnect the wallet session.",
    );
  }
}