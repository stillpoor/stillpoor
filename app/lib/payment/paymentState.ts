import type {
  BlockCoordinate,
} from "../board/boardTypes";

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
}: {
  orderId: string;
  expiresAt: string;

  paymentAddress: string;
  receiverAddress: string;

  blocks:
    readonly BlockCoordinate[];

  totalPriceSats: number;
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