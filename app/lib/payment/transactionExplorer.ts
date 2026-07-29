import {
  paymentConfig,
} from "./paymentConfig";

const transactionIdPattern =
  /^[0-9a-fA-F]{64}$/;

export function getBitcoinTransactionExplorerUrl(
  transactionId: string,
) {
  const normalizedTransactionId =
    transactionId
      .trim()
      .toLowerCase();

  if (
    !transactionIdPattern.test(
      normalizedTransactionId,
    )
  ) {
    return null;
  }

  return `${paymentConfig.transactionExplorerBaseUrl}/${normalizedTransactionId}`;
}

export function formatBitcoinTransactionId(
  transactionId: string,
) {
  const normalizedTransactionId =
    transactionId.trim();

  if (
    normalizedTransactionId.length <=
    20
  ) {
    return normalizedTransactionId;
  }

  return `${normalizedTransactionId.slice(
    0,
    10,
  )}…${normalizedTransactionId.slice(
    -8,
  )}`;
}
