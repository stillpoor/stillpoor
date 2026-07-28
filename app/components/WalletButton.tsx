"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import BlockThumbnail from "./BlockThumbnail";

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
  boardConfig,
} from "../lib/board/boardConfig";

import {
  useBoardBlocks,
} from "../lib/board/useBoardBlocks";

import {
  setSelectedBlock,
} from "../lib/selection/selectionState";

import {
  clearWalletError,
  connectWallet,
  disconnectWallet,
  restoreWalletConnection,
} from "../lib/wallet/walletState";

import {
  useWalletState,
} from "../lib/wallet/useWalletState";

import type {
  Block,
} from "../lib/board/boardTypes";

function formatWalletAddress(
  walletAddress: string,
) {
  return `${walletAddress.slice(
    0,
    6,
  )}…${walletAddress.slice(-6)}`;
}

function formatClaimDate(
  claimedAt: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(claimedAt),
  );
}

function getPublicBlockNumber(
  block: Block,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.coordinate.row *
      blocksPerRow +
    block.coordinate.column +
    1
  );
}

export default function WalletButton() {
  const menuRef =
    useRef<HTMLDivElement>(null);

  const walletState =
    useWalletState();

  const authState =
    useAuthState();

  const boardBlocks =
    useBoardBlocks();

  const [
    isMenuOpen,
    setIsMenuOpen,
  ] = useState(false);

  const [
    isDisconnecting,
    setIsDisconnecting,
  ] = useState(false);

  const [
    disconnectError,
    setDisconnectError,
  ] = useState<string | null>(
    null,
  );

  const paymentAddress =
    walletState.paymentAddress?.address ??
    null;

  const ownedBlocks =
    useMemo(() => {
      if (
        !paymentAddress ||
        !authState.isAuthenticated
      ) {
        return [];
      }

      return boardBlocks
        .filter(
          (block) =>
            block.ownerWalletAddress ===
            paymentAddress,
        )
        .sort(
          (
            firstBlock,
            secondBlock,
          ) =>
            new Date(
              secondBlock.claimedAt,
            ).getTime() -
            new Date(
              firstBlock.claimedAt,
            ).getTime(),
        );
    }, [
      authState.isAuthenticated,
      boardBlocks,
      paymentAddress,
    ]);

  useEffect(() => {
    void (async () => {
      const walletWasRestored =
        await restoreWalletConnection();

      if (walletWasRestored) {
        await restoreAuthenticationSession();
      }
    })();
  }, []);

useEffect(() => {
  if (!isMenuOpen) {
    return;
  }

  const handleKeyDown = (
    event: KeyboardEvent,
  ) => {
    if (event.key === "Escape") {
      setIsMenuOpen(false);
    }
  };

  document.addEventListener(
    "keydown",
    handleKeyDown,
  );

  return () => {
    document.removeEventListener(
      "keydown",
      handleKeyDown,
    );
  };
}, [isMenuOpen]);

  const handleWalletAction =
    async () => {
      if (
        authState.isAuthenticated &&
        paymentAddress
      ) {
        setIsMenuOpen(
          (currentValue) =>
            !currentValue,
        );

        return;
      }

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

  const handleOwnedBlockClick = (
    block: Block,
  ) => {
    setSelectedBlock(
      block.coordinate,
    );

    window.dispatchEvent(
      new CustomEvent(
        "board:focus-owned-block",
        {
          detail: {
            block:
              block.coordinate,
          },
        },
      ),
    );
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
        await logoutWalletSession();

        clearAuthentication();

        await disconnectWallet();

        setIsMenuOpen(false);
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
    <div
      ref={menuRef}
      className="relative flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={handleWalletAction}
        disabled={isWalletBusy}
        aria-expanded={
          authState.isAuthenticated
            ? isMenuOpen
            : undefined
        }
        aria-haspopup={
          authState.isAuthenticated
            ? "menu"
            : undefined
        }
        className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-default disabled:opacity-70"
      >
        {buttonText}
      </button>

      {isMenuOpen &&
        authState.isAuthenticated &&
        paymentAddress && (
          <div
            role="menu"
            className="absolute top-full right-0 mt-2 flex max-h-[calc(100vh-7rem)] w-80 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-md"
          >
            <header className="relative border-b border-black/10 px-4 py-4 pr-12">
  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
    Wallet
  </p>

  <p
    title={paymentAddress}
    className="mt-1 font-mono text-sm font-semibold text-black"
  >
    {formatWalletAddress(
      paymentAddress,
    )}
  </p>

  <button
    type="button"
    onClick={() =>
      setIsMenuOpen(false)
    }
    aria-label="Close profile menu"
    className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-black/50 transition hover:bg-black/5 hover:text-black"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </button>
</header>

            <section className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                  My Blocks
                </p>

                <p className="text-xs font-semibold text-black/45">
                  {ownedBlocks.length}
                </p>
              </div>

              {ownedBlocks.length === 0 ? (
                <p className="rounded-xl bg-black/5 px-3 py-4 text-sm text-black/55">
                  You do not own any Blocks yet.
                </p>
              ) : (
                <div className="space-y-1">
                  {ownedBlocks.map(
                    (block) => {
                      const blockNumber =
                        getPublicBlockNumber(
                          block,
                        );

                      return (
                        <button
                          key={`${block.coordinate.row}:${block.coordinate.column}`}
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            handleOwnedBlockClick(
                              block,
                            )
                          }
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                        >
                          <BlockThumbnail
                            block={block}
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-black">
                              Block #
                              {blockNumber}
                            </span>

                            <span className="mt-0.5 block text-xs text-black/45">
                              Claimed{" "}
                              {formatClaimDate(
                                block.claimedAt,
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </section>

            <footer className="border-t border-black/10 p-3">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="w-full rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                {isDisconnecting
                  ? "Disconnecting..."
                  : "Disconnect"}
              </button>
            </footer>
          </div>
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