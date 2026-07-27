import type {
  Block,
  BlockCoordinate,
} from "../board/boardTypes";

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export interface ReservationResult {
  orderId: string;
  expiresAt: string;
  amountSats: number;
}

interface ReserveResponse {
  ok: true;
  orderId: string;
  expiresAt: string;
  amountSats: number;
}

interface CancelResponse {
  ok: boolean;
}

interface ConfirmResponse {
  ok: true;
  claimedBlocks: Block[];
}

interface ReserveClaimOrderOptions {
  /*
   * Temporarily kept for compatibility
   * with BlockInspector.
   *
   * These addresses are no longer sent
   * to the server.
   */
  paymentAddress: string;
  ordinalsAddress: string;

  blocks:
    readonly BlockCoordinate[];
}

interface OrderActionOptions {
  orderId: string;

  /*
   * Temporarily kept for compatibility
   * with PaymentModal.
   *
   * This address no longer leaves
   * the browser.
   */
  paymentAddress: string;
}

function refreshBoardStats() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new Event("board-stats:refresh"),
  );
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

export async function reserveClaimOrder(
  options: ReserveClaimOrderOptions,
): Promise<ReservationResult> {
  const response = await fetch(
    "/api/claim-orders/reserve",
    {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        blocks: options.blocks,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      getResponseError(
        data,
        "Unable to reserve the selected Blocks.",
      ),
    );
  }

  const reservation =
    data as unknown as ReserveResponse;

  refreshBoardStats();

  return {
    orderId:
      reservation.orderId,

    expiresAt:
      reservation.expiresAt,

    amountSats:
      reservation.amountSats,
  };
}

export async function cancelClaimOrder(
  options: OrderActionOptions,
) {
  const response = await fetch(
    "/api/claim-orders/cancel",
    {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        orderId:
          options.orderId,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getResponseError(
        data,
        "Unable to cancel the reservation.",
      ),
    );
  }

  const result =
    data as unknown as CancelResponse;

  if (result.ok) {
    refreshBoardStats();
  }

  return result.ok;
}

export async function confirmSimulatedClaimOrder(
  options: OrderActionOptions,
) {
  const response = await fetch(
    "/api/claim-orders/confirm-simulated",
    {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        orderId:
          options.orderId,
      }),
    },
  );

  const data =
    await readResponse(response);

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      getResponseError(
        data,
        "Unable to confirm the Claim order.",
      ),
    );
  }

  const result =
    data as unknown as ConfirmResponse;

  refreshBoardStats();

  return result.claimedBlocks;
}