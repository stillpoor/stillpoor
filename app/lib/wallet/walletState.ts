import {
  request,
} from "@sats-connect/core";

import {
  AddressPurpose,
  RpcErrorCode,
} from "sats-connect";

export interface ConnectedWalletAddress {
  address: string;
  publicKey: string;
}

export interface WalletState {
  isConnecting: boolean;
  isRestoring: boolean;

  paymentAddress:
    | ConnectedWalletAddress
    | null;

  ordinalsAddress:
    | ConnectedWalletAddress
    | null;

  errorMessage: string | null;
}

interface WalletAddressResponse {
  address: string;
  publicKey: string;
  purpose: string;
}

type WalletListener = () => void;

const disconnectedWalletState: WalletState = {
  isConnecting: false,
  isRestoring: false,

  paymentAddress: null,
  ordinalsAddress: null,

  errorMessage: null,
};

let walletState: WalletState = {
  ...disconnectedWalletState,
};

let hasAttemptedAutomaticRestore = false;

const listeners =
  new Set<WalletListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

function setWalletState(
  nextWalletState: WalletState,
) {
  walletState = nextWalletState;
  notifyListeners();
}

function isMissingProviderError(
  error: unknown,
) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "";

  return errorMessage
    .toLowerCase()
    .includes("wallet provider");
}

function setConnectedAddresses(
  addresses:
    readonly WalletAddressResponse[],
) {
  const paymentAddress =
    addresses.find(
      (walletAddress) =>
        walletAddress.purpose ===
        AddressPurpose.Payment,
    );

  const ordinalsAddress =
    addresses.find(
      (walletAddress) =>
        walletAddress.purpose ===
        AddressPurpose.Ordinals,
    );

  if (
    !paymentAddress ||
    !ordinalsAddress
  ) {
    return false;
  }

  setWalletState({
    isConnecting: false,
    isRestoring: false,

    paymentAddress: {
      address:
        paymentAddress.address,

      publicKey:
        paymentAddress.publicKey,
    },

    ordinalsAddress: {
      address:
        ordinalsAddress.address,

      publicKey:
        ordinalsAddress.publicKey,
    },

    errorMessage: null,
  });

  return true;
}

export function getWalletState() {
  return walletState;
}

export async function restoreWalletConnection() {
  if (
    hasAttemptedAutomaticRestore ||
    walletState.isRestoring ||
    walletState.isConnecting
  ) {
    return Boolean(
      walletState.paymentAddress &&
        walletState.ordinalsAddress,
    );
  }

  if (
    walletState.paymentAddress &&
    walletState.ordinalsAddress
  ) {
    return true;
  }

  hasAttemptedAutomaticRestore = true;

  setWalletState({
    ...walletState,

    isRestoring: true,
    errorMessage: null,
  });

  try {
    const response = await request(
      "wallet_getAccount",
      null,
    );

    if (response.status === "error") {
      setWalletState({
        ...disconnectedWalletState,
      });

      return false;
    }

    const addresses =
      response.result.addresses ?? [];

    const wasRestored =
      setConnectedAddresses(
        addresses,
      );

    if (!wasRestored) {
      setWalletState({
        ...disconnectedWalletState,
      });
    }

    return wasRestored;
  } catch {
    setWalletState({
      ...disconnectedWalletState,
    });

    return false;
  }
}

export async function connectWallet() {
  if (
    walletState.paymentAddress &&
    walletState.ordinalsAddress
  ) {
    return true;
  }

  if (
    walletState.isConnecting ||
    walletState.isRestoring
  ) {
    return false;
  }

  setWalletState({
    ...walletState,

    isConnecting: true,
    isRestoring: false,
    errorMessage: null,
  });

  try {
    const response = await request(
      "wallet_connect",
      {
        addresses: [
          AddressPurpose.Payment,
          AddressPurpose.Ordinals,
        ],

        message:
          "Connect your Bitcoin wallet to StillPoor.",
      },
    );

    if (response.status === "error") {
      const wasCancelled =
        response.error.code ===
        RpcErrorCode.USER_REJECTION;

      setWalletState({
        ...disconnectedWalletState,

        errorMessage: wasCancelled
          ? "Connection cancelled."
          : response.error.message,
      });

      return false;
    }

    const addresses =
      response.result.addresses ?? [];

    const wasConnected =
      setConnectedAddresses(
        addresses,
      );

    if (!wasConnected) {
      setWalletState({
        ...disconnectedWalletState,

        errorMessage:
          "Xverse did not return the required Bitcoin addresses.",
      });

      return false;
    }

    return true;
  } catch (error) {
    const isMissingProvider =
      isMissingProviderError(error);

    if (!isMissingProvider) {
      console.warn(
        "Wallet connection failed:",
        error,
      );
    }

    setWalletState({
      ...disconnectedWalletState,

      errorMessage: isMissingProvider
        ? "Xverse is not installed or is disabled."
        : "Unable to connect to Xverse.",
    });

    return false;
  }
}

export async function disconnectWallet() {
  /*
   * The StillPoor session is revoked separately
   * before this function is called.
   */
  try {
    const response = await request(
      "wallet_disconnect",
      null,
    );

    hasAttemptedAutomaticRestore = true;

    if (response.status === "error") {
      setWalletState({
        ...disconnectedWalletState,

        errorMessage:
          response.error.message ||
          "Xverse could not be disconnected.",
      });

      return false;
    }

    setWalletState({
      ...disconnectedWalletState,
    });

    return true;
  } catch (error) {
    const isMissingProvider =
      isMissingProviderError(error);

    if (!isMissingProvider) {
      console.warn(
        "Wallet disconnection failed:",
        error,
      );
    }

    /*
     * Still clear the local wallet state.
     * The authenticated server session has already
     * been revoked at this point.
     */
    hasAttemptedAutomaticRestore = true;

    setWalletState({
      ...disconnectedWalletState,

      errorMessage: isMissingProvider
        ? null
        : "Xverse could not be disconnected.",
    });

    return false;
  }
}

export function clearWalletError() {
  if (!walletState.errorMessage) {
    return;
  }

  setWalletState({
    ...walletState,
    errorMessage: null,
  });
}

export function subscribeToWallet(
  listener: WalletListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}