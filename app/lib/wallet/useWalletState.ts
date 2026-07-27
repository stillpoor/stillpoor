"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getWalletState,
  subscribeToWallet,
} from "./walletState";

import type {
  WalletState,
} from "./walletState";

const serverWalletState: WalletState = {
  isConnecting: false,
  isRestoring: false,

  paymentAddress: null,
  ordinalsAddress: null,

  errorMessage: null,
};

function getServerWalletState() {
  return serverWalletState;
}

export function useWalletState() {
  return useSyncExternalStore(
    subscribeToWallet,
    getWalletState,
    getServerWalletState,
  );
}