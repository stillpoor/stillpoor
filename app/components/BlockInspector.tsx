"use client";

import { boardConfig } from "../lib/board/boardConfig";
import { getBlock } from "../lib/board/boardStore";

import { claimConfig } from "../lib/claim/claimConfig";
import { cancelClaim } from "../lib/claim/claimState";
import { useClaimState } from "../lib/claim/useClaimState";

import {
  startEditorForExistingBlock,
} from "../lib/editor/editorState";

import { openPaymentModal } from "../lib/payment/paymentState";

import {
  useState,
} from "react";

import {
  reserveClaimOrder,
} from "../lib/payment/paymentApi";

import {
  getWalletState,
} from "../lib/wallet/walletState";

import { setSelectedBlock } from "../lib/selection/selectionState";

import {
  connectWallet,
} from "../lib/wallet/walletState";
import { useWalletState } from "../lib/wallet/useWalletState";

import type { BlockCoordinate } from "../lib/board/boardTypes";

interface BlockInspectorProps {
  block: BlockCoordinate;
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

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(date));
}

function formatBtcFromSats(
  sats: number,
) {
  return `${(
    sats / 100_000_000
  ).toFixed(3)} BTC`;
}

export default function BlockInspector({
  block,
}: BlockInspectorProps) {
  const claimState = useClaimState();

  const walletState =
  useWalletState();

  const [
    isReserving,
    setIsReserving,
  ] = useState(false);

  const [
    reservationError,
   setReservationError,
  ] = useState<string | null>(null);

  const currentWalletAddress =
    walletState.paymentAddress?.address ??
    null;

  const occupiedBlock =
    getBlock(block);

  const publicBlockNumber =
    getPublicBlockNumber(block);

  const selectedBlockCount =
    claimState.blocks.length;

  const totalPriceSats =
    selectedBlockCount *
    claimConfig.blockPriceSats;

  const isOwnedByCurrentUser =
  Boolean(
    occupiedBlock &&
      currentWalletAddress &&
      occupiedBlock.ownerWalletAddress ===
        currentWalletAddress,
  );

  const handleCancelClaimMode = () => {
    cancelClaim();
    setSelectedBlock(null);
  };

  const handleClaim = async () => {
  setReservationError(null);

  let currentWalletState =
    getWalletState();

  if (
    !currentWalletState.paymentAddress ||
    !currentWalletState.ordinalsAddress
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
      .paymentAddress?.address;

  const ordinalsAddress =
    currentWalletState
      .ordinalsAddress?.address;

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

  const handleEditBlock = () => {
    if (
      !occupiedBlock ||
      !isOwnedByCurrentUser
    ) {
      return;
    }

    startEditorForExistingBlock(
      block,
    );
  };

  if (occupiedBlock) {
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

            <dd className="mt-1 font-medium">
              {formatWalletAddress(
                occupiedBlock
                  .ownerWalletAddress,
              )}
            </dd>
          </div>

          {occupiedBlock.description && (
            <div>
              <dt className="text-gray-500">
                Description
              </dt>

              <dd className="mt-1">
                {
                  occupiedBlock.description
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
                occupiedBlock.claimedAt,
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
        </dl>

        {isOwnedByCurrentUser && (
          <button
            type="button"
            onClick={handleEditBlock}
            className="mt-5 w-full rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white"
          >
            Edit Block
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="pointer-events-auto absolute bottom-8 left-1/2 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold">
        Block #{publicBlockNumber}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        Available
      </p>

      {claimState.isActive && (
        <>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">
                  Selected
                </dt>

                <dd className="font-medium">
                  {selectedBlockCount}{" "}
                  {selectedBlockCount === 1
                    ? "Block"
                    : "Blocks"}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">
                  Total
                </dt>

                <dd className="font-medium">
                  {formatBtcFromSats(
                    totalPriceSats,
                  )}
                </dd>
              </div>
            </dl>
          </div>

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
  : walletState.isConnecting
    ? "Connecting..."
    : walletState.paymentAddress
      ? (
        <>
          Claim ·{" "}
          {formatBtcFromSats(
            totalPriceSats,
          )}
        </>
      )
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

        </>
      )}
    </aside>
  );
}