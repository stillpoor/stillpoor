"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  boardConfig,
} from "../lib/board/boardConfig";

import {
  useBoardBlocks,
} from "../lib/board/useBoardBlocks";

import {
  cancelClaim,
} from "../lib/claim/claimState";

import {
  useClaimState,
} from "../lib/claim/useClaimState";

import {
  startEditorForExistingBlock,
  startEditorForNewOrdinalVersion,
} from "../lib/editor/editorState";

import {
  loadOrdinalBlockHistory,
} from "../lib/ordinals/ordinalHistoryApi";

import {
  openFirstOrdinalMintModal,
} from "../lib/ordinals/ordinalMintState";

import {
  clearOrdinalPreview,
  setOrdinalPreview,
} from "../lib/ordinals/ordinalPreviewState";

import {
  reserveClaimOrder,
} from "../lib/payment/paymentApi";

import {
  openPaymentModal,
} from "../lib/payment/paymentState";

import {
  loadPublicWalletProfile,
} from "../lib/profile/publicProfileApi";

import {
  setSelectedBlock,
} from "../lib/selection/selectionState";

import {
  connectWallet,
  getWalletState,
} from "../lib/wallet/walletState";

import {
  useWalletState,
} from "../lib/wallet/useWalletState";

import {
  formatBitcoinTransactionId,
  getBitcoinTransactionExplorerUrl,
} from "../lib/payment/transactionExplorer";

import type {
  BlockCoordinate,
} from "../lib/board/boardTypes";

import type {
  OrdinalBlockVersion,
} from "../lib/ordinals/ordinalHistoryApi";

interface BlockInspectorProps {
  block: BlockCoordinate;
}

interface ProfileUpdatedEventDetail {
  paymentAddress: string;
  username: string | null;
}

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const columnCount =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.row * columnCount +
    block.column +
    1
  );
}

function formatWalletAddress(
  walletAddress: string,
) {
  return `${walletAddress.slice(
    0,
    8,
  )}…${walletAddress.slice(-6)}`;
}

function formatDate(
  date: string,
) {
  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(date),
  );
}

function formatInscriptionId(
  inscriptionId: string,
) {
  return `${inscriptionId.slice(
    0,
    10,
  )}…${inscriptionId.slice(-8)}`;
}

export default function BlockInspector({
  block,
}: BlockInspectorProps) {
  const claimState =
    useClaimState();

  const walletState =
    useWalletState();

  const boardBlocks =
    useBoardBlocks();

  const [
    isReserving,
    setIsReserving,
  ] = useState(false);

  const [
    reservationError,
    setReservationError,
  ] = useState<string | null>(
    null,
  );

  const [
    ownerUsername,
    setOwnerUsername,
  ] = useState<string | null>(
    null,
  );

  const [
    ordinalVersions,
    setOrdinalVersions,
  ] = useState<
    OrdinalBlockVersion[]
  >([]);

  const [
    selectedOrdinalVersionIndex,
    setSelectedOrdinalVersionIndex,
  ] = useState<number | null>(
    null,
  );

  const [
    isOrdinalHistoryLoading,
    setIsOrdinalHistoryLoading,
  ] = useState(false);

  const [
    ordinalHistoryError,
    setOrdinalHistoryError,
  ] = useState<string | null>(
    null,
  );

  const [
    versionCreatorUsername,
    setVersionCreatorUsername,
  ] = useState<string | null>(
    null,
  );

  const currentWalletAddress =
    walletState.paymentAddress
      ?.address ?? null;

  const occupiedBlock =
    useMemo(
      () =>
        boardBlocks.find(
          (candidateBlock) =>
            candidateBlock.coordinate
              .row === block.row &&
            candidateBlock.coordinate
              .column ===
              block.column,
        ) ?? null,
      [
        block.column,
        block.row,
        boardBlocks,
      ],
    );

  const selectedOrdinalVersion =
    useMemo(
      () =>
        selectedOrdinalVersionIndex ===
        null
          ? null
          : ordinalVersions[
              selectedOrdinalVersionIndex
            ] ?? null,
      [
        ordinalVersions,
        selectedOrdinalVersionIndex,
      ],
    );

  const latestOrdinalVersionIndex =
    ordinalVersions.length - 1;

  const hasConfirmedInscription =
    Boolean(
      occupiedBlock &&
        occupiedBlock
          .latestInscriptionVersion >
          0,
    );

  const isViewingHistoricalVersion =
    Boolean(
      occupiedBlock &&
        selectedOrdinalVersion &&
        selectedOrdinalVersion.version <
          occupiedBlock
            .latestInscriptionVersion,
    );

  const isViewingLatestVersion =
    !selectedOrdinalVersion ||
    !occupiedBlock ||
    selectedOrdinalVersion.version ===
      occupiedBlock
        .latestInscriptionVersion;

  useEffect(() => {
    let isActive = true;

    const ownerWalletAddress =
      occupiedBlock
        ?.ownerWalletAddress;

    if (!ownerWalletAddress) {
      setOwnerUsername(null);

      return () => {
        isActive = false;
      };
    }

    setOwnerUsername(null);

    const handleProfileUpdated = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<ProfileUpdatedEventDetail>;

      if (
        customEvent.detail
          ?.paymentAddress !==
        ownerWalletAddress
      ) {
        return;
      }

      setOwnerUsername(
        customEvent.detail
          .username,
      );
    };

    window.addEventListener(
      "profile:updated",
      handleProfileUpdated,
    );

    void loadPublicWalletProfile(
      ownerWalletAddress,
    )
      .then((profile) => {
        if (!isActive) {
          return;
        }

        setOwnerUsername(
          profile.username,
        );
      })
      .catch((error) => {
        console.warn(
          "Unable to load Block owner profile:",
          error,
        );

        if (isActive) {
          setOwnerUsername(null);
        }
      });

    return () => {
      isActive = false;

      window.removeEventListener(
        "profile:updated",
        handleProfileUpdated,
      );
    };
  }, [
    occupiedBlock
      ?.ownerWalletAddress,
  ]);

  useEffect(() => {
    clearOrdinalPreview();

    setOrdinalVersions([]);
    setSelectedOrdinalVersionIndex(
      null,
    );
    setOrdinalHistoryError(
      null,
    );
    setVersionCreatorUsername(
      null,
    );

    if (
      !occupiedBlock ||
      occupiedBlock
        .latestInscriptionVersion <
        1 ||
      occupiedBlock
        .inscriptionPending
    ) {
      setIsOrdinalHistoryLoading(
        false,
      );

      return;
    }

    let isActive = true;

    setIsOrdinalHistoryLoading(
      true,
    );

    void loadOrdinalBlockHistory(
      block,
    )
      .then((versions) => {
        if (!isActive) {
          return;
        }

        setOrdinalVersions(
          versions,
        );

        setSelectedOrdinalVersionIndex(
          versions.length > 0
            ? versions.length - 1
            : null,
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setOrdinalHistoryError(
          error instanceof Error
            ? error.message
            : "Unable to load Ordinal history.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsOrdinalHistoryLoading(
            false,
          );
        }
      });

    return () => {
      isActive = false;

      clearOrdinalPreview();
    };
  }, [
    block.column,
    block.row,
    occupiedBlock
      ?.inscriptionPending,
    occupiedBlock
      ?.latestInscriptionVersion,
  ]);

  useEffect(() => {
    if (
      !occupiedBlock ||
      !selectedOrdinalVersion ||
      selectedOrdinalVersion.version ===
        occupiedBlock
          .latestInscriptionVersion
    ) {
      clearOrdinalPreview();

      return;
    }

    setOrdinalPreview({
      block: {
        ...block,
      },

      version:
        selectedOrdinalVersion.version,

      pixels:
        selectedOrdinalVersion.pixels,
    });

    return () => {
      clearOrdinalPreview();
    };
  }, [
    block.column,
    block.row,
    occupiedBlock,
    selectedOrdinalVersion,
  ]);

  useEffect(() => {
    const creatorPaymentAddress =
      selectedOrdinalVersion
        ?.ownerPaymentAddress;

    if (!creatorPaymentAddress) {
      setVersionCreatorUsername(
        null,
      );

      return;
    }

    let isActive = true;

    setVersionCreatorUsername(
      null,
    );

    void loadPublicWalletProfile(
      creatorPaymentAddress,
    )
      .then((profile) => {
        if (!isActive) {
          return;
        }

        setVersionCreatorUsername(
          profile.username,
        );
      })
      .catch((error) => {
        console.warn(
          "Unable to load Ordinal creator profile:",
          error,
        );

        if (isActive) {
          setVersionCreatorUsername(
            null,
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    selectedOrdinalVersion
      ?.ownerPaymentAddress,
  ]);

  const publicBlockNumber =
    getPublicBlockNumber(
      block,
    );

  const selectedBlockCount =
    claimState.blocks.length;

  const isOwnedByCurrentUser =
    Boolean(
      occupiedBlock &&
        currentWalletAddress &&
        occupiedBlock
          .ownerWalletAddress ===
          currentWalletAddress,
    );

  const handleCancelClaimMode =
    () => {
      clearOrdinalPreview();
      cancelClaim();
      setSelectedBlock(null);
    };

  const handleClaim =
    async () => {
      setReservationError(null);

      let currentWalletState =
        getWalletState();

      if (
        !currentWalletState
          .paymentAddress ||
        !currentWalletState
          .ordinalsAddress
      ) {
        const connected =
          await connectWallet();

        if (!connected) {
          return;
        }

        currentWalletState =
          getWalletState();
      }

      const paymentAddress =
        currentWalletState
          .paymentAddress
          ?.address;

      const ordinalsAddress =
        currentWalletState
          .ordinalsAddress
          ?.address;

      if (
        !paymentAddress ||
        !ordinalsAddress
      ) {
        setReservationError(
          "Both Bitcoin wallet addresses are required.",
        );

        return;
      }

      setIsReserving(true);

      try {
        const reservation =
          await reserveClaimOrder({
            paymentAddress,
            ordinalsAddress,

            blocks:
              claimState.blocks,
          });

        openPaymentModal({
          orderId:
            reservation.orderId,

          expiresAt:
            reservation.expiresAt,

          paymentAddress,

          receiverAddress:
            reservation.receiverAddress,

          blocks:
            claimState.blocks,

          totalPriceSats:
            reservation.amountSats,
        });
      } catch (error) {
        setReservationError(
          error instanceof Error
            ? error.message
            : "Unable to reserve the selected Blocks.",
        );
      } finally {
        setIsReserving(false);
      }
    };

  const handleEditBlock =
    () => {
      if (
        !occupiedBlock ||
        !isOwnedByCurrentUser ||
        occupiedBlock
          .inscriptionPending ||
        occupiedBlock
          .latestInscriptionVersion >
          0
      ) {
        return;
      }

      clearOrdinalPreview();

      startEditorForExistingBlock(
        block,
      );
    };

  const handleEditAndMintNewVersion =
    () => {
      if (
        !occupiedBlock ||
        !isOwnedByCurrentUser ||
        occupiedBlock
          .inscriptionPending ||
        occupiedBlock
          .latestInscriptionVersion <
          1 ||
        !isViewingLatestVersion
      ) {
        return;
      }

      clearOrdinalPreview();

      startEditorForNewOrdinalVersion(
        block,
      );
    };

  const handleMintOrdinal =
    () => {
      if (
        !occupiedBlock ||
        !isOwnedByCurrentUser ||
        occupiedBlock
          .inscriptionPending ||
        occupiedBlock
          .latestInscriptionVersion >
          0
      ) {
        return;
      }

      clearOrdinalPreview();

      openFirstOrdinalMintModal({
        block: {
          ...block,
        },

        pixels: [
          ...occupiedBlock.pixels,
        ],

        description:
          occupiedBlock.description ??
          "",
      });
    };

  const handlePreviousVersion =
    () => {
      setSelectedOrdinalVersionIndex(
        (currentIndex) => {
          if (
            currentIndex === null
          ) {
            return null;
          }

          return Math.max(
            currentIndex - 1,
            0,
          );
        },
      );
    };

  const handleNextVersion =
    () => {
      setSelectedOrdinalVersionIndex(
        (currentIndex) => {
          if (
            currentIndex === null
          ) {
            return null;
          }

          return Math.min(
            currentIndex + 1,
            latestOrdinalVersionIndex,
          );
        },
      );
    };

  if (occupiedBlock) {
  const claimTransactionUrl =
    getBitcoinTransactionExplorerUrl(
      occupiedBlock
        .claimTransactionId,
    );

  const displayedDescription =
      selectedOrdinalVersion
        ?.description ??
      occupiedBlock.description;

    return (
      <aside className="pointer-events-auto absolute bottom-8 left-1/2 max-h-[calc(100vh-4rem)] w-80 -translate-x-1/2 overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold">
          Block #{publicBlockNumber}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Occupied
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">
              Current owner
            </dt>

            <dd className="mt-1">
              {ownerUsername && (
                <span className="block font-medium">
                  {ownerUsername}
                </span>
              )}

              <span
                title={
                  occupiedBlock
                    .ownerWalletAddress
                }
                className={
                  ownerUsername
                    ? "mt-0.5 block font-mono text-xs text-gray-500"
                    : "block font-medium"
                }
              >
                {formatWalletAddress(
                  occupiedBlock
                    .ownerWalletAddress,
                )}
              </span>
            </dd>
          </div>

          {!hasConfirmedInscription &&
            displayedDescription && (
              <div>
                <dt className="text-gray-500">
                  Description
                </dt>

                <dd className="mt-1">
                  {
                    displayedDescription
                  }
                </dd>
              </div>
            )}

          <div>
            <dt className="text-gray-500">
              Claimed
            </dt>

            <dd className="mt-1">
              {formatDate(
                occupiedBlock
                  .claimedAt,
              )}
            </dd>
          </div>

          <div>
  <dt className="text-gray-500">
    Claim transaction
  </dt>

  <dd className="mt-1">
    {claimTransactionUrl ? (
      <a
        href={
          claimTransactionUrl
        }
        target="_blank"
        rel="noopener noreferrer"
        title={
          occupiedBlock
            .claimTransactionId
        }
        className="inline-flex items-center gap-1 font-mono text-xs font-medium underline decoration-black/20 underline-offset-2 transition hover:decoration-black"
      >
        {formatBitcoinTransactionId(
          occupiedBlock
            .claimTransactionId,
        )}

        <span
          aria-hidden="true"
          className="font-sans"
        >
          ↗
        </span>
      </a>
    ) : (
      <span className="break-all font-mono text-xs">
        {
          occupiedBlock
            .claimTransactionId
        }
      </span>
    )}
  </dd>
</div>

          {occupiedBlock
            .inscriptionPending && (
            <div>
              <dt className="text-gray-500">
                Ordinal
              </dt>

              <dd className="mt-1 font-medium">
                Inscription pending
              </dd>
            </div>
          )}

          {hasConfirmedInscription && (
            <div>
              <dt className="text-gray-500">
                Ordinal history
              </dt>

              <dd className="mt-2">
                {isOrdinalHistoryLoading ? (
                  <p className="text-xs text-gray-500">
                    Loading versions...
                  </p>
                ) : ordinalHistoryError ? (
                  <p
                    role="alert"
                    className="text-xs text-red-600"
                  >
                    {
                      ordinalHistoryError
                    }
                  </p>
                ) : selectedOrdinalVersion ? (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={
                        handlePreviousVersion
                      }
                      disabled={
                        selectedOrdinalVersionIndex ===
                        null ||
                        selectedOrdinalVersionIndex <=
                          0
                      }
                      aria-label="Previous Ordinal version"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 font-medium disabled:cursor-default disabled:opacity-30"
                    >
                      ←
                    </button>

                    <span className="min-w-0 flex-1 text-center font-semibold">
                      Version{" "}
                      {
                        selectedOrdinalVersion.version
                      }{" "}
                      of{" "}
                      {
                        occupiedBlock.latestInscriptionVersion
                      }
                    </span>

                    <button
                      type="button"
                      onClick={
                        handleNextVersion
                      }
                      disabled={
                        selectedOrdinalVersionIndex ===
                        null ||
                        selectedOrdinalVersionIndex >=
                          latestOrdinalVersionIndex
                      }
                      aria-label="Next Ordinal version"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 font-medium disabled:cursor-default disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    No confirmed version
                    found.
                  </p>
                )}
              </dd>
            </div>
          )}

          {selectedOrdinalVersion && (
            <>
              {displayedDescription && (
                <div>
                  <dt className="text-gray-500">
                    Description
                  </dt>

                  <dd className="mt-1">
                    {
                      displayedDescription
                    }
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-gray-500">
                  Created by
                </dt>

                <dd className="mt-1">
                  {versionCreatorUsername && (
                    <span className="block font-medium">
                      {
                        versionCreatorUsername
                      }
                    </span>
                  )}

                  <span
                    title={
                      selectedOrdinalVersion
                        .ownerPaymentAddress
                    }
                    className={
                      versionCreatorUsername
                        ? "mt-0.5 block font-mono text-xs text-gray-500"
                        : "block font-mono text-xs"
                    }
                  >
                    {formatWalletAddress(
                      selectedOrdinalVersion
                        .ownerPaymentAddress,
                    )}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-gray-500">
                  Inscribed to
                </dt>

                <dd
                  title={
                    selectedOrdinalVersion
                      .destinationOrdinalsAddress
                  }
                  className="mt-1 font-mono text-xs"
                >
                  {formatWalletAddress(
                    selectedOrdinalVersion
                      .destinationOrdinalsAddress,
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-gray-500">
                  Inscribed
                </dt>

                <dd className="mt-1">
                  {formatDate(
                    selectedOrdinalVersion
                      .confirmedAt,
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-gray-500">
                  Inscription ID
                </dt>

                <dd
                  title={
                    selectedOrdinalVersion
                      .inscriptionId
                  }
                  className="mt-1 font-mono text-xs"
                >
                  {formatInscriptionId(
                    selectedOrdinalVersion
                      .inscriptionId,
                  )}
                </dd>
              </div>
            </>
          )}

          {hasConfirmedInscription &&
            !selectedOrdinalVersion &&
            !isOrdinalHistoryLoading && (
              <div>
                <dt className="text-gray-500">
                  Latest Ordinal
                </dt>

                <dd className="mt-1">
                  <span className="block font-medium">
                    Version{" "}
                    {
                      occupiedBlock
                        .latestInscriptionVersion
                    }
                  </span>

                  {occupiedBlock
                    .latestInscriptionId && (
                    <span
                      title={
                        occupiedBlock
                          .latestInscriptionId
                      }
                      className="mt-0.5 block font-mono text-xs text-gray-500"
                    >
                      {formatInscriptionId(
                        occupiedBlock
                          .latestInscriptionId,
                      )}
                    </span>
                  )}
                </dd>
              </div>
            )}
        </dl>

        {isViewingHistoricalVersion && (
          <div className="mt-5 rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
            <span className="block font-semibold">
              Viewing historical
              version
            </span>

            <span className="mt-0.5 block">
              The Board currently uses
              Ordinal v
              {
                occupiedBlock
                  .latestInscriptionVersion
              }
              .
            </span>
          </div>
        )}

        {isOwnedByCurrentUser &&
          !occupiedBlock
            .inscriptionPending &&
          !hasConfirmedInscription && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={
                  handleEditBlock
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
              >
                Edit Block
              </button>

              <button
                type="button"
                onClick={
                  handleMintOrdinal
                }
                className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white"
              >
                Mint Ordinal
              </button>
            </div>
          )}

        {isOwnedByCurrentUser &&
          hasConfirmedInscription &&
          !occupiedBlock
            .inscriptionPending &&
          isViewingLatestVersion && (
            <div className="mt-5">
              <button
                type="button"
                onClick={
                  handleEditAndMintNewVersion
                }
                className="w-full rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white"
              >
                Edit & Mint New Version
              </button>

              <p className="mt-2 text-xs leading-5 text-black/50">
                Changes will create
                Ordinal v
                {occupiedBlock
                  .latestInscriptionVersion +
                  1}
                .
              </p>
            </div>
          )}
      </aside>
    );
  }

  if (!claimState.isActive) {
    return null;
  }

  return (
    <aside className="pointer-events-auto absolute bottom-8 left-1/2 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg">
      <p className="text-center text-sm font-semibold">
        {selectedBlockCount}{" "}
        {selectedBlockCount === 1
          ? "Block selected"
          : "Blocks selected"}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={
            handleCancelClaimMode
          }
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleClaim}
          disabled={
            selectedBlockCount === 0 ||
            walletState.isConnecting ||
            isReserving
          }
          className="flex-1 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isReserving
            ? "Reserving..."
            : walletState
                .isConnecting
              ? "Connecting..."
              : walletState
                  .paymentAddress
                ? "Claim"
                : "Connect to Claim"}
        </button>
      </div>

      {reservationError && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-600"
        >
          {reservationError}
        </p>
      )}
    </aside>
  );
}