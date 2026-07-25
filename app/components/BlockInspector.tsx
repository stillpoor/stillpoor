"use client";

import { boardConfig } from "../lib/board/boardConfig";
import { getBlock } from "../lib/board/boardStore";

import { claimConfig } from "../lib/claim/claimConfig";
import { simulateClaimPurchase } from "../lib/claim/claimPurchase";
import { cancelClaim } from "../lib/claim/claimState";
import { useClaimState } from "../lib/claim/useClaimState";

import { setSelectedBlock } from "../lib/selection/selectionState";

import type { BlockCoordinate } from "../lib/board/boardTypes";

interface BlockInspectorProps {
  block: BlockCoordinate;
}

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const columnCount =
    boardConfig.width / boardConfig.blockSize;

  return (
    block.row * columnCount +
    block.column +
    1
  );
}

function formatWalletAddress(
  walletAddress: string,
) {
  return `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatBtcFromSats(sats: number) {
  return `${(
    sats / 100_000_000
  ).toFixed(3)} BTC`;
}

export default function BlockInspector({
  block,
}: BlockInspectorProps) {
  const claimState = useClaimState();
  const occupiedBlock = getBlock(block);

  const publicBlockNumber =
    getPublicBlockNumber(block);

  const selectedBlockCount =
    claimState.blocks.length;

  const totalPriceSats =
    selectedBlockCount *
    claimConfig.blockPriceSats;

  const handleCancelClaimMode = () => {
    cancelClaim();
    setSelectedBlock(null);
  };

  const handleClaim = () => {
    simulateClaimPurchase();
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
                occupiedBlock.ownerWalletAddress,
              )}
            </dd>
          </div>

          {occupiedBlock.description && (
            <div>
              <dt className="text-gray-500">
                Description
              </dt>

              <dd className="mt-1">
                {occupiedBlock.description}
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
              {occupiedBlock.claimTransactionId}
            </dd>
          </div>
        </dl>
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
              onClick={handleCancelClaimMode}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleClaim}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Claim ·{" "}
              {formatBtcFromSats(
                totalPriceSats,
              )}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}