import {
  request,
} from "@sats-connect/core";

import {
  MessageSigningProtocols,
  RpcErrorCode,
} from "sats-connect";

import {
  createWalletChallenge,
  getWalletSession,
  verifyWalletSignature,
} from "./authApi";

import {
  getWalletState,
} from "../wallet/walletState";

export interface AuthState {
  isAuthenticating: boolean;
  isRestoringSession: boolean;
  isAuthenticated: boolean;

  paymentAddress: string | null;
  ordinalsAddress: string | null;
  expiresAt: string | null;

  errorMessage: string | null;
}

type AuthListener = () => void;

const unauthenticatedState: AuthState = {
  isAuthenticating: false,
  isRestoringSession: false,
  isAuthenticated: false,

  paymentAddress: null,
  ordinalsAddress: null,
  expiresAt: null,

  errorMessage: null,
};

let authState: AuthState = {
  ...unauthenticatedState,
};

const listeners =
  new Set<AuthListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

function setAuthState(
  nextAuthState: AuthState,
) {
  authState = nextAuthState;
  notifyListeners();
}

export function getAuthState() {
  return authState;
}

export async function restoreAuthenticationSession() {
  if (authState.isAuthenticated) {
    return true;
  }

  if (
    authState.isAuthenticating ||
    authState.isRestoringSession
  ) {
    return false;
  }

  const walletState =
    getWalletState();

  const paymentAddress =
    walletState.paymentAddress?.address;

  const ordinalsAddress =
    walletState.ordinalsAddress?.address;

  if (
    !paymentAddress ||
    !ordinalsAddress
  ) {
    return false;
  }

  setAuthState({
    ...unauthenticatedState,
    isRestoringSession: true,
  });

  try {
    const session =
      await getWalletSession();

    if (!session) {
      setAuthState({
        ...unauthenticatedState,
      });

      return false;
    }

    const sessionMatchesWallet =
      session.paymentAddress ===
        paymentAddress &&
      session.ordinalsAddress ===
        ordinalsAddress;

    if (!sessionMatchesWallet) {
      setAuthState({
        ...unauthenticatedState,
      });

      return false;
    }

    setAuthState({
      isAuthenticating: false,
      isRestoringSession: false,
      isAuthenticated: true,

      paymentAddress:
        session.paymentAddress,

      ordinalsAddress:
        session.ordinalsAddress,

      expiresAt:
        session.expiresAt,

      errorMessage: null,
    });

    return true;
  } catch (error) {
    console.warn(
      "Wallet session restoration failed:",
      error,
    );

    setAuthState({
      ...unauthenticatedState,

      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to restore the wallet session.",
    });

    return false;
  }
}

export async function authenticateWallet() {
  if (
    authState.isAuthenticating ||
    authState.isRestoringSession
  ) {
    return false;
  }

  if (authState.isAuthenticated) {
    return true;
  }

  const walletState =
    getWalletState();

  const paymentAddress =
    walletState.paymentAddress?.address;

  const ordinalsAddress =
    walletState.ordinalsAddress?.address;

  if (
    !paymentAddress ||
    !ordinalsAddress
  ) {
    setAuthState({
      ...unauthenticatedState,

      errorMessage:
        "Connect your Bitcoin wallet before signing in.",
    });

    return false;
  }

  setAuthState({
    ...authState,

    isAuthenticating: true,
    isRestoringSession: false,
    errorMessage: null,
  });

  try {
    const challenge =
      await createWalletChallenge({
        paymentAddress,
        ordinalsAddress,
      });

    const signatureResponse =
      await request(
        "signMessage",
        {
          address:
            paymentAddress,

          message:
            challenge.message,

          protocol:
            MessageSigningProtocols.BIP322,
        },
      );

    if (
      signatureResponse.status ===
      "error"
    ) {
      const wasCancelled =
        signatureResponse.error.code ===
        RpcErrorCode.USER_REJECTION;

      setAuthState({
        ...unauthenticatedState,

        errorMessage: wasCancelled
          ? "Signature cancelled."
          : signatureResponse.error.message,
      });

      return false;
    }

    const signedAddress =
      signatureResponse.result.address;

    const signature =
      signatureResponse.result.signature;

    if (
      signedAddress !== paymentAddress
    ) {
      throw new Error(
        "Xverse signed with a different Bitcoin address.",
      );
    }

    const session =
      await verifyWalletSignature({
        challengeId:
          challenge.challengeId,

        signature,
      });

    if (
      session.paymentAddress !==
        paymentAddress ||
      session.ordinalsAddress !==
        ordinalsAddress
    ) {
      throw new Error(
        "The authenticated wallet does not match the connected wallet.",
      );
    }

    setAuthState({
      isAuthenticating: false,
      isRestoringSession: false,
      isAuthenticated: true,

      paymentAddress:
        session.paymentAddress,

      ordinalsAddress:
        session.ordinalsAddress,

      expiresAt:
        session.expiresAt,

      errorMessage: null,
    });

    return true;
  } catch (error) {
    console.warn(
      "Wallet authentication failed:",
      error,
    );

    setAuthState({
      ...unauthenticatedState,

      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to authenticate the wallet.",
    });

    return false;
  }
}

export function clearAuthError() {
  if (!authState.errorMessage) {
    return;
  }

  setAuthState({
    ...authState,
    errorMessage: null,
  });
}

export function clearAuthentication() {
  setAuthState({
    ...unauthenticatedState,
  });
}

export function subscribeToAuth(
  listener: AuthListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}