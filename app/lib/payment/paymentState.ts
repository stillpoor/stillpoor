import type {
  BlockCoordinate,
} from "../board/boardTypes";

import type {
  ClaimPaymentSessionStage,
} from "./paymentReservationSession";

export type PaymentRecoveryStage =
  Exclude<
    ClaimPaymentSessionStage,
    "reserved"
  >;

export interface PaymentState {
  isOpen: boolean;

  orderId: string | null;
  expiresAt: string | null;

  paymentAddress:
    string | null;

  receiverAddress:
    string | null;

  blocks:
    BlockCoordinate[];

  totalPriceSats:
    number;

  paymentTxid:
    string | null;

  recoveryStage:
    PaymentRecoveryStage | null;
}

type PaymentListener =
  () => void;

const closedPaymentState:
  PaymentState = {
    isOpen: false,

    orderId: null,
    expiresAt: null,

    paymentAddress: null,
    receiverAddress: null,

    blocks: [],
    totalPriceSats: 0,

    paymentTxid: null,
    recoveryStage: null,
  };

let paymentState:
  PaymentState =
    closedPaymentState;

const listeners =
  new Set<PaymentListener>();

function notifyListeners() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}

export function getPaymentState() {
  return paymentState;
}

export function openPaymentModal({
  orderId,
  expiresAt,
  paymentAddress,
  receiverAddress,
  blocks,
  totalPriceSats,
  paymentTxid = null,
  recoveryStage = null,
}: {
  orderId: string;
  expiresAt: string;

  paymentAddress: string;
  receiverAddress: string;

  blocks:
    readonly BlockCoordinate[];

  totalPriceSats: number;

  paymentTxid?: string | null;

  recoveryStage?:
    PaymentRecoveryStage | null;
}) {
  paymentState = {
    isOpen: true,

    orderId,
    expiresAt,

    paymentAddress,
    receiverAddress,

    blocks:
      blocks.map(
        (block) => ({
          ...block,
        }),
      ),

    totalPriceSats,

    paymentTxid,
    recoveryStage,
  };

  notifyListeners();
}

export function closePaymentModal() {
  if (
    !paymentState.isOpen
  ) {
    return;
  }

  paymentState =
    closedPaymentState;

  notifyListeners();
}

export function subscribeToPayment(
  listener:
    PaymentListener,
) {
  listeners.add(
    listener,
  );

  return () => {
    listeners.delete(
      listener,
    );
  };
}
