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

const serverPaymentState: PaymentState = {
  isOpen: false,

  orderId: null,
  expiresAt: null,
  paymentAddress: null,

  blocks: [],
  totalPriceSats: 0,
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