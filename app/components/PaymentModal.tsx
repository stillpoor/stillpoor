"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  completeClaimPurchase,
} from "../lib/claim/claimPurchase";

import {
  cancelClaimOrder,
  confirmPaidClaimOrder,
  releaseAbandonedUnpaidClaimReservation,
} from "../lib/payment/paymentApi";

import {
  BitcoinPaymentError,
  sendBitcoinPayment,
} from "../lib/payment/bitcoinPayment";

import {
  paymentConfig,
} from "../lib/payment/paymentConfig";

import {
  markClaimPaymentStarted,
  storeClaimPaymentTransaction,
} from "../lib/payment/paymentReservationSession";

import {
  closePaymentModal,
} from "../lib/payment/paymentState";

import {
  formatBitcoinTransactionId,
  getBitcoinTransactionExplorerUrl,
} from "../lib/payment/transactionExplorer";

import {
  usePaymentState,
} from "../lib/payment/usePaymentState";

import type {
  Block,
} from "../lib/board/boardTypes";

function formatBtcFromSats(
  sats: number,
) {
  const wholeBtc =
    Math.floor(
      sats / 100_000_000,
    );

  const fractionalBtc =
    String(
      sats %
        100_000_000,
    )
      .padStart(
        8,
        "0",
      )
      .replace(
        /0+$/,
        "",
      );

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
  ).format(
    new Date(date),
  );
}

export default function PaymentModal() {
  const paymentState =
    usePaymentState();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    paymentTxid,
    setPaymentTxid,
  ] = useState<string | null>(
    null,
  );

  const [
    verifiedClaimedBlocks,
    setVerifiedClaimedBlocks,
  ] = useState<Block[] | null>(
    null,
  );

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  const [
    isVerifying,
    setIsVerifying,
  ] = useState(false);

  const [
    isCancelling,
    setIsCancelling,
  ] = useState(false);

  const [
    isOpeningEditor,
    setIsOpeningEditor,
  ] = useState(false);

  const [
    isReservationReleased,
    setIsReservationReleased,
  ] = useState(false);

  const [
    isPaymentStatusUncertain,
    setIsPaymentStatusUncertain,
  ] = useState(false);

  /*
   * A reservation that was created but never
   * reached Xverse is safe to release after a
   * refresh. Reservations whose payment started
   * are deliberately kept.
   */
  useEffect(() => {
    void releaseAbandonedUnpaidClaimReservation()
      .catch((error) => {
        console.warn(
          "Unable to release the abandoned unpaid Claim reservation:",
          error,
        );
      });
  }, []);

  useEffect(() => {
    if (
      !paymentState.isOpen
    ) {
      return;
    }

    setErrorMessage(null);
    setPaymentTxid(null);

    setVerifiedClaimedBlocks(
      null,
    );

    setIsSending(false);
    setIsVerifying(false);
    setIsCancelling(false);
    setIsOpeningEditor(false);

    setIsReservationReleased(
      false,
    );

    setIsPaymentStatusUncertain(
      false,
    );
  }, [
    paymentState.isOpen,
    paymentState.orderId,
  ]);

  if (
    !paymentState.isOpen
  ) {
    return null;
  }

  const blockCount =
    paymentState.blocks.length;

  const isPaymentConfirmed =
    Boolean(
      verifiedClaimedBlocks,
    );

  const paymentTransactionUrl =
    paymentTxid
      ? getBitcoinTransactionExplorerUrl(
          paymentTxid,
        )
      : null;

  const handleCancel =
    async () => {
      if (
        isReservationReleased ||
        isPaymentStatusUncertain
      ) {
        closePaymentModal();

        return;
      }

      if (
        paymentTxid ||
        isPaymentConfirmed
      ) {
        return;
      }

      if (
        !paymentState.orderId ||
        !paymentState
          .paymentAddress
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
            paymentState
              .paymentAddress,
        });

        closePaymentModal();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to cancel the reservation.",
        );
      } finally {
        setIsCancelling(
          false,
        );
      }
    };

  const releaseFailedPaymentReservation =
    async (
      paymentErrorMessage:
        string,
    ) => {
      if (
        !paymentState.orderId ||
        !paymentState
          .paymentAddress
      ) {
        setErrorMessage(
          paymentErrorMessage,
        );

        return;
      }

      setIsCancelling(true);

      try {
        await cancelClaimOrder({
          orderId:
            paymentState.orderId,

          paymentAddress:
            paymentState
              .paymentAddress,
        });

        setIsReservationReleased(
          true,
        );

        setErrorMessage(
          `${paymentErrorMessage} No payment was sent, so the Block reservation was released.`,
        );
      } catch (error) {
        const cancellationMessage =
          error instanceof Error
            ? error.message
            : "Unable to release the reservation.";

        setErrorMessage(
          `${paymentErrorMessage} The reservation could not be released automatically: ${cancellationMessage}`,
        );
      } finally {
        setIsCancelling(
          false,
        );
      }
    };

  const handlePayment =
    async () => {
      if (
        !paymentState.orderId ||
        !paymentState
          .paymentAddress ||
        !paymentState
          .receiverAddress
      ) {
        setErrorMessage(
          "The Claim reservation is invalid.",
        );

        return;
      }

      setErrorMessage(null);

      let currentPaymentTxid =
        paymentTxid;

      try {
        if (
          !currentPaymentTxid
        ) {
          /*
           * From this point onward, a transaction
           * could potentially be broadcast. A
           * refresh must no longer auto-cancel
           * the reservation.
           */
          markClaimPaymentStarted(
            paymentState.orderId,
          );

          setIsSending(true);

          currentPaymentTxid =
            await sendBitcoinPayment({
              receiverAddress:
                paymentState
                  .receiverAddress,

              amountSats:
                paymentState
                  .totalPriceSats,
            });

          storeClaimPaymentTransaction({
            orderId:
              paymentState.orderId,

            paymentTxid:
              currentPaymentTxid,
          });

          setPaymentTxid(
            currentPaymentTxid,
          );

          setIsSending(false);
        }

        setIsVerifying(true);

        const claimedBlocks =
          await confirmPaidClaimOrder({
            orderId:
              paymentState.orderId,

            paymentTxid:
              currentPaymentTxid,
          });

        setVerifiedClaimedBlocks(
          claimedBlocks,
        );

        setErrorMessage(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The payment could not be completed.";

        if (
          currentPaymentTxid
        ) {
          setErrorMessage(
            `Payment sent. ${message}`,
          );

          return;
        }

        if (
          error instanceof
            BitcoinPaymentError &&
          !error
            .paymentMayHaveBeenSent
        ) {
          await releaseFailedPaymentReservation(
            message,
          );

          return;
        }

        setIsPaymentStatusUncertain(
          true,
        );

        setErrorMessage(
          `${message} The reservation was kept because the payment status is uncertain.`,
        );
      } finally {
        setIsSending(false);
        setIsVerifying(false);
      }
    };

  const handleStartCreating =
    () => {
      if (
        !verifiedClaimedBlocks ||
        verifiedClaimedBlocks.length ===
          0 ||
        isOpeningEditor
      ) {
        return;
      }

      setErrorMessage(null);
      setIsOpeningEditor(true);

      const purchaseCompleted =
        completeClaimPurchase(
          verifiedClaimedBlocks,
        );

      if (
        !purchaseCompleted
      ) {
        setErrorMessage(
          "Your payment was confirmed, but the Blocks could not be opened in the Editor.",
        );

        setIsOpeningEditor(false);

        return;
      }

      closePaymentModal();
    };

  const isProcessing =
    isSending ||
    isVerifying ||
    isCancelling ||
    isOpeningEditor;

  let paymentButtonText =
    "Pay with Xverse";

  if (isSending) {
    paymentButtonText =
      "Open Xverse...";
  } else if (
    isVerifying
  ) {
    paymentButtonText =
      "Verifying...";
  } else if (
    paymentTxid
  ) {
    paymentButtonText =
      "Verify payment";
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        {isPaymentConfirmed ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path
                  d="M5 12.5l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2
              id="payment-modal-title"
              className="mt-4 text-lg font-semibold"
            >
              Payment confirmed
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              {blockCount === 1
                ? "Your Block is officially yours. You can now leave your mark on the Board."
                : "Your Blocks are officially yours. You can now leave your mark on the Board."}
            </p>
          </>
        ) : (
          <>
            <h2
              id="payment-modal-title"
              className="text-lg font-semibold"
            >
              Complete payment
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Your Blocks are
              temporarily reserved.
            </p>
          </>
        )}

        <dl className="mt-6 space-y-4 border-y border-gray-200 py-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              {isPaymentConfirmed
                ? "Claimed"
                : "Selected"}
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
                paymentState
                  .totalPriceSats,
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Network
            </dt>

            <dd className="font-semibold">
              {
                paymentConfig
                  .networkLabel
              }
            </dd>
          </div>

          {!isPaymentConfirmed &&
            paymentState
              .expiresAt && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">
                  Reserved until
                </dt>

                <dd className="font-medium">
                  {formatExpiryTime(
                    paymentState
                      .expiresAt,
                  )}
                </dd>
              </div>
            )}

          {paymentTxid && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500">
                Transaction
              </dt>

              <dd className="text-right">
                {paymentTransactionUrl ? (
                  <a
                    href={
                      paymentTransactionUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title={paymentTxid}
                    className="inline-flex items-center gap-1 font-mono text-xs font-medium underline decoration-black/20 underline-offset-2 transition hover:decoration-black"
                  >
                    {formatBitcoinTransactionId(
                      paymentTxid,
                    )}

                    <span
                      aria-hidden="true"
                      className="font-sans"
                    >
                      ↗
                    </span>
                  </a>
                ) : (
                  <span className="font-mono text-xs font-medium">
                    {formatBitcoinTransactionId(
                      paymentTxid,
                    )}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {isPaymentConfirmed ? (
          <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            Payment verified on{" "}
            {
              paymentConfig
                .networkLabel
            }
            . Your purchase is now
            confirmed in StillPoor.
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-gray-100 p-4 text-sm leading-5 text-gray-600">
            {isReservationReleased
              ? "No payment was sent. Your Block selection remains active and can be reserved again."
              : isPaymentStatusUncertain
                ? "The reservation remains active to prevent the Block from being sold twice."
                : paymentTxid
                  ? `The ${paymentConfig.networkLabel} transaction was sent. StillPoor is now verifying it.`
                  : `Xverse will display the ${paymentConfig.networkLabel} recipient, payment amount and network fee before sending.`}
          </div>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}

        {isPaymentConfirmed ? (
          <button
            type="button"
            onClick={
              handleStartCreating
            }
            disabled={
              isProcessing
            }
            className="mt-6 w-full rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isOpeningEditor
              ? "Opening Editor..."
              : "Start creating"}
          </button>
        ) : isReservationReleased ||
          isPaymentStatusUncertain ? (
          <button
            type="button"
            onClick={
              closePaymentModal
            }
            disabled={
              isProcessing
            }
            className="mt-6 w-full rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back to selection
          </button>
        ) : (
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={
                handleCancel
              }
              disabled={
                isProcessing ||
                Boolean(
                  paymentTxid,
                )
              }
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              {paymentTxid
                ? "Payment sent"
                : isCancelling
                  ? "Cancelling..."
                  : "Cancel"}
            </button>

            <button
              type="button"
              onClick={
                handlePayment
              }
              disabled={
                isProcessing
              }
              className="flex-1 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {
                paymentButtonText
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
