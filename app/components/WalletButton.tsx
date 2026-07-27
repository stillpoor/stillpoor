"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  authenticateWallet,
  clearAuthentication,
  clearAuthError,
  restoreAuthenticationSession,
} from "../lib/auth/authState";

import {
  logoutWalletSession,
} from "../lib/auth/logoutApi";

import {
  useAuthState,
} from "../lib/auth/useAuthState";

import {
  clearWalletError,
  connectWallet,
  disconnectWallet,
  restoreWalletConnection,
} from "../lib/wallet/walletState";

import {
  useWalletState,
} from "../lib/wallet/useWalletState";

function formatWalletAddress(
  walletAddress: string,
) {
  return `${walletAddress.slice(
    0,
    6,
  )}…${walletAddress.slice(-6)}`;
}

export default function WalletButton() {
  const walletState =
    useWalletState();

  const authState =
    useAuthState();

  const [
    isDisconnecting,
    setIsDisconnecting,
  ] = useState(false);

  const [
    disconnectError,
    setDisconnectError,
  ] = useState<string | null>(null);

  const paymentAddress =
    walletState.paymentAddress?.address;

  useEffect(() => {
    void (async () => {
      const walletWasRestored =
        await restoreWalletConnection();

      if (walletWasRestored) {
        await restoreAuthenticationSession();
      }
    })();
  }, []);

  const handleWalletAction =
    async () => {
      setDisconnectError(null);

      clearWalletError();
      clearAuthError();

      let isConnected =
        Boolean(
          walletState.paymentAddress &&
            walletState.ordinalsAddress,
        );

      if (!isConnected) {
        isConnected =
          await connectWallet();
      }

      if (!isConnected) {
        return;
      }

      await authenticateWallet();
    };

  const handleDisconnect =
    async () => {
      if (isDisconnecting) {
        return;
      }

      setDisconnectError(null);
      clearWalletError();
      clearAuthError();
      setIsDisconnecting(true);

      try {
        /*
         * Revoke the secure StillPoor session first.
         * We only clear the UI after the server
         * confirms the revocation.
         */
        await logoutWalletSession();

        clearAuthentication();

        /*
         * Then remove StillPoor's Xverse
         * permissions and clear the local wallet.
         */
        await disconnectWallet();
      } catch (error) {
        setDisconnectError(
          error instanceof Error
            ? error.message
            : "Unable to disconnect the wallet.",
        );
      } finally {
        setIsDisconnecting(false);
      }
    };

  const isWalletBusy =
    walletState.isRestoring ||
    walletState.isConnecting ||
    authState.isRestoringSession ||
    authState.isAuthenticating ||
    isDisconnecting;

  const errorMessage =
    disconnectError ??
    authState.errorMessage ??
    walletState.errorMessage;

  let buttonText =
    "Connect Wallet";

  if (walletState.isRestoring) {
    buttonText =
      "Checking wallet...";
  } else if (
    authState.isRestoringSession
  ) {
    buttonText =
      "Checking session...";
  } else if (
    walletState.isConnecting
  ) {
    buttonText =
      "Connecting...";
  } else if (
    authState.isAuthenticating
  ) {
    buttonText =
      "Verifying...";
  } else if (isDisconnecting) {
    buttonText =
      "Disconnecting...";
  } else if (
    authState.isAuthenticated &&
    paymentAddress
  ) {
    buttonText =
      formatWalletAddress(
        paymentAddress,
      );
  } else if (paymentAddress) {
    buttonText =
      "Verify Wallet";
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleWalletAction}
        disabled={
          isWalletBusy ||
          authState.isAuthenticated
        }
        className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-default disabled:opacity-70"
      >
        {buttonText}
      </button>

      {authState.isAuthenticated &&
        !isDisconnecting && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs font-medium text-gray-700 underline underline-offset-2"
          >
            Disconnect
          </button>
        )}

      {errorMessage && (
        <div
          role="alert"
          className="max-w-64 rounded-lg bg-white px-3 py-2 text-right text-xs shadow"
        >
          <p className="text-red-600">
            {errorMessage}
          </p>

          {errorMessage ===
            "Xverse is not installed or is disabled." && (
            <a
              href="https://www.xverse.app/"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-medium text-gray-950 underline"
            >
              Install Xverse
            </a>
          )}
        </div>
      )}
    </div>
  );
}