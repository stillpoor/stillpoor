import {
  request,
} from "@sats-connect/core";

import {
  RpcErrorCode,
} from "sats-connect";

import {
  paymentConfig,
} from "./paymentConfig";

export class BitcoinPaymentError extends Error {
  readonly paymentMayHaveBeenSent:
    boolean;

  constructor(
    message: string,
    paymentMayHaveBeenSent: boolean,
  ) {
    super(message);

    this.name =
      "BitcoinPaymentError";

    this.paymentMayHaveBeenSent =
      paymentMayHaveBeenSent;
  }
}

function isValidPositiveAmount(
  amountSats: number,
) {
  return (
    Number.isSafeInteger(
      amountSats,
    ) &&
    amountSats > 0
  );
}

function isValidTransactionId(
  transactionId: string,
) {
  return /^[0-9a-fA-F]{64}$/.test(
    transactionId,
  );
}

export async function sendBitcoinPayment({
  receiverAddress,
  amountSats,
}: {
  receiverAddress: string;
  amountSats: number;
}) {
  const normalizedReceiverAddress =
    receiverAddress.trim();

  if (
    normalizedReceiverAddress === ""
  ) {
    throw new BitcoinPaymentError(
      "The payment receiver address is missing.",
      false,
    );
  }

  if (
    !isValidPositiveAmount(
      amountSats,
    )
  ) {
    throw new BitcoinPaymentError(
      "The payment amount is invalid.",
      false,
    );
  }

  try {
    const transferResponse =
      await request(
        "sendTransfer",
        {
          recipients: [
            {
              address:
                normalizedReceiverAddress,

              amount:
                amountSats,
            },
          ],
        },
      );

    if (
      transferResponse.status ===
      "error"
    ) {
      const wasCancelled =
        transferResponse.error.code ===
        RpcErrorCode.USER_REJECTION;

      throw new BitcoinPaymentError(
        wasCancelled
          ? "The Bitcoin payment was cancelled."
          : transferResponse.error
                .message ||
              `Xverse could not send the ${paymentConfig.networkLabel} payment.`,

        /*
         * An RPC error means Xverse did not
         * return a successful transaction.
         * The reservation may safely be released.
         */
        false,
      );
    }

    const transactionId =
      transferResponse.result.txid;

    if (
      typeof transactionId !==
        "string" ||
      !isValidTransactionId(
        transactionId,
      )
    ) {
      /*
       * Xverse reported success but returned
       * an invalid txid. The transaction may
       * already have been broadcast.
       */
      throw new BitcoinPaymentError(
        "Xverse returned an invalid transaction ID.",
        true,
      );
    }

    return transactionId
      .toLowerCase();
  } catch (error) {
    if (
      error instanceof
      BitcoinPaymentError
    ) {
      throw error;
    }

    /*
     * A communication failure could happen
     * after Xverse broadcasts the transaction.
     * We therefore keep the reservation.
     */
    throw new BitcoinPaymentError(
      "StillPoor lost contact with Xverse before the payment result was confirmed.",
      true,
    );
  }
}
