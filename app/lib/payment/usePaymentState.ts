"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getPaymentState,
  subscribeToPayment,
} from "./paymentState";

import type {
  PaymentState,
} from "./paymentState";

const serverPaymentState:
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

function getServerPaymentState() {
  return serverPaymentState;
}

export function usePaymentState() {
  return useSyncExternalStore(
    subscribeToPayment,
    getPaymentState,
    getServerPaymentState,
  );
}
