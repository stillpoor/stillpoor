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

import type {
  BlockCoordinate,
} from "../lib/board/boardTypes";

import {
  openFirstOrdinalMintModal,
} from "../lib/ordinals/ordinalMintState";

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
        customEvent.detail.username,
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

  const publicBlockNumber =
    getPublicBlockNumber(block);

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
          1
      ) {
        return;
      }

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

  if (occupiedBlock) {
    const hasConfirmedInscription =
      occupiedBlock
        .latestInscriptionVersion >
      0;

    return (
      <aside className="pointer-events-auto absolute bottom-8 left-1/2 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold">
          Block #{publicBlockNumber}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Occupied
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">
              Owned by
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

          {occupiedBlock
            .description && (
            <div>
              <dt className="text-gray-500">
                Description
              </dt>

              <dd className="mt-1">
                {
                  occupiedBlock
                    .description
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
              Transaction
            </dt>

            <dd className="mt-1 break-all font-mono text-xs">
              {
                occupiedBlock
                  .claimTransactionId
              }
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
                Ordinal
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

                {occupiedBlock
                  .latestInscribedAt && (
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Inscribed{" "}
                    {formatDate(
                      occupiedBlock
                        .latestInscribedAt,
                    )}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

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
                disabled={false}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Edit Block
              </button>

              <button
                type="button"
                onClick={
                  handleMintOrdinal
                }
                disabled={false}
                className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mint Ordinal
              </button>
            </div>
          )}

        {isOwnedByCurrentUser &&
          hasConfirmedInscription &&
          !occupiedBlock
            .inscriptionPending && (
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