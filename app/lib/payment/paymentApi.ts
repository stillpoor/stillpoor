import type {
  Block,
  BlockCoordinate,
} from "../board/boardTypes";

import {
  clearStoredClaimPaymentSession,
  getAbandonedUnpaidClaimPaymentSession,
  storeReservedClaimPaymentSession,
} from "./paymentReservationSession";

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export interface ReservationResult {
  orderId: string;
  expiresAt: string;

  amountSats: number;
  receiverAddress: string;
}

interface ReserveResponse {
  ok: true;

  orderId: string;
  expiresAt: string;

  amountSats: number;
  receiverAddress: string;
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
   * The authenticated server session
   * remains the source of truth.
   */
  paymentAddress: string;
  ordinalsAddress: string;

  blocks:
    readonly BlockCoordinate[];
}

interface OrderActionOptions {
  orderId: string;

  /*
   * Kept for compatibility with the
   * existing PaymentModal interface.
   */
  paymentAddress: string;
}

interface ConfirmPaidOrderOptions {
  orderId: string;
  paymentTxid: string;
}

let abandonedReservationReleasePromise:
  Promise<void> | null = null;

function refreshBoardStats() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new Event(
      "board-stats:refresh",
    ),
  );
}

async function readResponse(
  response: Response,
): Promise<
  Record<string, unknown>
> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getResponseError(
  data:
    Record<string, unknown>,

  fallbackMessage: string,
) {
  const errorResponse =
    data as ErrorResponse;

  return typeof errorResponse
    .error === "string"
    ? errorResponse.error
    : fallbackMessage;
}

export async function reserveClaimOrder(
  options:
    ReserveClaimOrderOptions,
): Promise<ReservationResult> {
  const response =
    await fetch(
      "/api/claim-orders/reserve",
      {
        method: "POST",

        credentials:
          "same-origin",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          blocks:
            options.blocks,
        }),
      },
    );

  const data =
    await readResponse(
      response,
    );

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
    data as unknown as
      ReserveResponse;

  if (
    !reservation
      .receiverAddress
  ) {
    throw new Error(
      "The reservation did not return a payment address.",
    );
  }

  storeReservedClaimPaymentSession({
    orderId:
      reservation.orderId,

    paymentAddress:
      options.paymentAddress,
  });

  refreshBoardStats();

  return {
    orderId:
      reservation.orderId,

    expiresAt:
      reservation.expiresAt,

    amountSats:
      reservation.amountSats,

    receiverAddress:
      reservation
        .receiverAddress,
  };
}

export async function cancelClaimOrder(
  options:
    OrderActionOptions,
) {
  const response =
    await fetch(
      "/api/claim-orders/cancel",
      {
        method: "POST",

        credentials:
          "same-origin",

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
    await readResponse(
      response,
    );

  if (!response.ok) {
    /*
     * In these cases the order can no longer
     * hold an active reservation. The local
     * recovery record is therefore no longer
     * useful.
     */
    if (
      response.status ===
        404 ||
      response.status ===
        409 ||
      response.status ===
        410
    ) {
      clearStoredClaimPaymentSession(
        options.orderId,
      );

      refreshBoardStats();
    }

    throw new Error(
      getResponseError(
        data,

        "Unable to cancel the reservation.",
      ),
    );
  }

  const result =
    data as unknown as
      CancelResponse;

  if (result.ok) {
    clearStoredClaimPaymentSession(
      options.orderId,
    );

    refreshBoardStats();
  }

  return result.ok;
}

export async function releaseAbandonedUnpaidClaimReservation() {
  if (
    abandonedReservationReleasePromise
  ) {
    return abandonedReservationReleasePromise;
  }

  const abandonedSession =
    getAbandonedUnpaidClaimPaymentSession();

  if (!abandonedSession) {
    return;
  }

  abandonedReservationReleasePromise =
    cancelClaimOrder({
      orderId:
        abandonedSession.orderId,

      paymentAddress:
        abandonedSession
          .paymentAddress,
    })
      .then(() => undefined)
      .finally(() => {
        abandonedReservationReleasePromise =
          null;
      });

  return abandonedReservationReleasePromise;
}

export async function confirmPaidClaimOrder(
  options:
    ConfirmPaidOrderOptions,
) {
  const response =
    await fetch(
      "/api/claim-orders/confirm-paid",
      {
        method: "POST",

        credentials:
          "same-origin",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          orderId:
            options.orderId,

          paymentTxid:
            options.paymentTxid,
        }),
      },
    );

  const data =
    await readResponse(
      response,
    );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      getResponseError(
        data,

        "The Bitcoin payment could not be verified.",
      ),
    );
  }

  const result =
    data as unknown as
      ConfirmResponse;

  clearStoredClaimPaymentSession(
    options.orderId,
  );

  refreshBoardStats();

  return result.claimedBlocks;
}
