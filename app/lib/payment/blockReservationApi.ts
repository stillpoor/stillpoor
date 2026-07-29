import type {
  ActiveBlockReservation,
} from "./blockReservationState";

interface SuccessResponse {
  ok: true;

  reservations:
    ActiveBlockReservation[];
}

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export async function loadActiveBlockReservations(): Promise<
  ActiveBlockReservation[]
> {
  const response =
    await fetch(
      "/api/claim-orders/active-reservations",
      {
        method: "GET",

        credentials:
          "same-origin",

        cache:
          "no-store",
      },
    );

  let data:
    | SuccessResponse
    | ErrorResponse;

  try {
    data =
      (await response.json()) as
        | SuccessResponse
        | ErrorResponse;
  } catch {
    throw new Error(
      "The server returned an invalid reservation response.",
    );
  }

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      "error" in data &&
        typeof data.error ===
          "string"
        ? data.error
        : "Unable to load active Block reservations.",
    );
  }

  if (
    !Array.isArray(
      data.reservations,
    )
  ) {
    throw new Error(
      "The server returned invalid Block reservations.",
    );
  }

  return data.reservations;
}