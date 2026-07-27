"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  completeSimulatedClaimPurchase,
} from "../lib/claim/claimPurchase";

import {
  cancelClaimOrder,
  confirmSimulatedClaimOrder,
} from "../lib/payment/paymentApi";

import {
  closePaymentModal,
} from "../lib/payment/paymentState";

import {
  usePaymentState,
} from "../lib/payment/usePaymentState";

function formatBtcFromSats(
  sats: number,
) {
  const wholeBtc =
    Math.floor(
      sats / 100_000_000,
    );

  const fractionalBtc =
    String(
      sats % 100_000_000,
    )
      .padStart(8, "0")
      .replace(/0+$/, "");

  return fractionalBtc
    ? `${wholeBtc}.${fractionalBtc} BTC`
    : `${wholeBtc} BTC`;
}

function formatExpiryTime(
  date: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(date));
}

export default function PaymentModal() {
  const paymentState =
    usePaymentState();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    isConfirming,
    setIsConfirming,
  ] = useState(false);

  const [
    isCancelling,
    setIsCancelling,
  ] = useState(false);

  useEffect(() => {
    if (!paymentState.isOpen) {
      return;
    }

    setErrorMessage(null);
    setIsConfirming(false);
    setIsCancelling(false);
  }, [paymentState.isOpen]);

  if (!paymentState.isOpen) {
    return null;
  }

  const blockCount =
    paymentState.blocks.length;

  const handleCancel = async () => {
    if (
      !paymentState.orderId ||
      !paymentState.paymentAddress
    ) {
      closePaymentModal();
      return;
    }

    setErrorMessage(null);
    setIsCancelling(true);

    try {
      await cancelClaimOrder({
        orderId:
          paymentState.orderId,

        paymentAddress:
          paymentState.paymentAddress,
      });

      /*
       * La sélection locale reste active.
       * L’utilisateur peut modifier sa sélection
       * et réessayer.
       */
      closePaymentModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel the reservation.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmPayment =
    async () => {
      if (
        !paymentState.orderId ||
        !paymentState.paymentAddress
      ) {
        setErrorMessage(
          "The Claim reservation is invalid.",
        );

        return;
      }

      setErrorMessage(null);
      setIsConfirming(true);

      try {
        const claimedBlocks =
          await confirmSimulatedClaimOrder({
            orderId:
              paymentState.orderId,

            paymentAddress:
              paymentState.paymentAddress,
          });

        const purchaseCompleted =
          completeSimulatedClaimPurchase(
            claimedBlocks,
          );

        if (!purchaseCompleted) {
          throw new Error(
            "The confirmed Blocks could not be opened in the Editor.",
          );
        }

        closePaymentModal();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The payment could not be confirmed.",
        );
      } finally {
        setIsConfirming(false);
      }
    };

  const isProcessing =
    isConfirming || isCancelling;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2
          id="payment-modal-title"
          className="text-lg font-semibold"
        >
          Complete payment
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Your Blocks are temporarily reserved.
        </p>

        <dl className="mt-6 space-y-4 border-y border-gray-200 py-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Selected
            </dt>

            <dd className="font-medium">
              {blockCount}{" "}
              {blockCount === 1
                ? "Block"
                : "Blocks"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Amount
            </dt>

            <dd className="font-semibold">
              {formatBtcFromSats(
                paymentState.totalPriceSats,
              )}
            </dd>
          </div>

          {paymentState.expiresAt && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">
                Reserved until
              </dt>

              <dd className="font-medium">
                {formatExpiryTime(
                  paymentState.expiresAt,
                )}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5 rounded-lg bg-gray-100 p-4 text-sm text-gray-600">
          Bitcoin payment is still simulated.
          Confirming will permanently claim the
          reserved Blocks in Supabase.
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCancelling
              ? "Cancelling..."
              : "Cancel"}
          </button>

          <button
            type="button"
            onClick={
              handleConfirmPayment
            }
            disabled={isProcessing}
            className="flex-1 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isConfirming
              ? "Confirming..."
              : "Confirm payment"}
          </button>
        </div>
      </div>
    </div>
  );
}