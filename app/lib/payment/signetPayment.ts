/*
 * Temporary compatibility layer.
 *
 * PaymentModal can keep its current imports
 * while the payment implementation is now
 * network-independent.
 */
export {
  BitcoinPaymentError as SignetPaymentError,
  sendBitcoinPayment as sendSignetPayment,
} from "./bitcoinPayment";
