"use client";

import {
  useEffect,
  useState,
} from "react";

import BlockThumbnail from "./BlockThumbnail";

import {
  boardConfig,
} from "../lib/board/boardConfig";

import {
  setBlock,
} from "../lib/board/boardStore";

import {
  closeEditor,
  completeOrdinalVersionEditor,
} from "../lib/editor/editorState";

import {
  mintBlockOrdinalSimulated,
  mintNextBlockOrdinalSimulated,
} from "../lib/ordinals/ordinalApi";

import {
  closeOrdinalMintModal,
} from "../lib/ordinals/ordinalMintState";

import {
  useOrdinalMintState,
} from "../lib/ordinals/useOrdinalMintState";

import {
  setSelectedBlock,
} from "../lib/selection/selectionState";

import {
  useWalletState,
} from "../lib/wallet/useWalletState";

import type {
  Block,
  BlockCoordinate,
} from "../lib/board/boardTypes";

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.row *
      blocksPerRow +
    block.column +
    1
  );
}

function formatWalletAddress(
  address: string,
) {
  return `${address.slice(
    0,
    10,
  )}…${address.slice(-8)}`;
}

function updateBoardBlock(
  block: Block,
) {
  setBlock({
    ...block,

    coordinate: {
      ...block.coordinate,
    },

    pixels: [
      ...block.pixels,
    ],
  });
}

export default function OrdinalMintModal() {
  const mintState =
    useOrdinalMintState();

  const walletState =
    useWalletState();

  const [
    isConfirming,
    setIsConfirming,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!mintState.isOpen) {
      return;
    }

    setIsConfirming(false);
    setErrorMessage(null);
  }, [
    mintState.isOpen,
  ]);

  useEffect(() => {
    if (!mintState.isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        !isConfirming
      ) {
        closeOrdinalMintModal();
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
  }, [
    isConfirming,
    mintState.isOpen,
  ]);

  if (
    !mintState.isOpen ||
    !mintState.block
  ) {
    return null;
  }

  const block =
    mintState.block;

  const ordinalsAddress =
    walletState.ordinalsAddress
      ?.address ?? null;

  const blockNumber =
    getPublicBlockNumber(
      block,
    );

  const isNewVersion =
    mintState.mode ===
    "new-version";

  const handleCancel =
    () => {
      if (isConfirming) {
        return;
      }

      closeOrdinalMintModal();
    };

  const handleConfirm =
    async () => {
      if (!ordinalsAddress) {
        setErrorMessage(
          "An Ordinals wallet address is required.",
        );

        return;
      }

      setErrorMessage(null);
      setIsConfirming(true);

      try {
        if (isNewVersion) {
          const expectedLatestVersion =
            mintState
              .expectedLatestVersion;

          if (
            expectedLatestVersion ===
            null
          ) {
            throw new Error(
              "The previous Ordinal version is missing.",
            );
          }

          const result =
            await mintNextBlockOrdinalSimulated(
              {
                block,

                expectedLatestVersion,

                pixels:
                  mintState.pixels,

                description:
                  mintState.description,
              },
            );

          const editorCompleted =
            completeOrdinalVersionEditor(
              result.block,
            );

          if (!editorCompleted) {
            updateBoardBlock(
              result.block,
            );

            closeEditor();

            setSelectedBlock({
              ...result.block
                .coordinate,
            });
          }
        } else {
          const result =
            await mintBlockOrdinalSimulated(
              block,
            );

          updateBoardBlock(
            result.block,
          );

          setSelectedBlock({
            ...result.block
              .coordinate,
          });
        }

        closeOrdinalMintModal();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to create the Ordinal inscription.",
        );
      } finally {
        setIsConfirming(false);
      }
    };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ordinal-mint-modal-title"
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-4">
          <BlockThumbnail
            block={{
              pixels:
                mintState.pixels,

              latestInscriptionVersion:
                mintState.targetVersion,
            }}
          />

          <div>
            <h2
              id="ordinal-mint-modal-title"
              className="text-lg font-semibold"
            >
              Confirm Ordinal
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Block #{blockNumber}
              {" · "}
              Ordinal v
              {mintState.targetVersion}
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4 border-y border-gray-200 py-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Version
            </dt>

            <dd className="font-semibold">
              Ordinal v
              {mintState.targetVersion}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-gray-500">
              Destination
            </dt>

            <dd
              title={
                ordinalsAddress ??
                undefined
              }
              className="min-w-0 truncate font-mono text-xs font-medium"
            >
              {ordinalsAddress
                ? formatWalletAddress(
                    ordinalsAddress,
                  )
                : "Unavailable"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Network fee
            </dt>

            <dd className="font-medium">
              Simulated
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">
              Total today
            </dt>

            <dd className="font-semibold">
              0 sats
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-5 text-amber-900">
          {isNewVersion
            ? "This will permanently create a new version of the Block."
            : "This will permanently inscribe the current version of the Block."}
        </div>

        <p className="mt-3 text-xs leading-5 text-black/45">
          Bitcoin payment and the
          inscription transaction are
          still simulated during
          development.
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={
              handleCancel
            }
            disabled={
              isConfirming
            }
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              handleConfirm
            }
            disabled={
              isConfirming ||
              !ordinalsAddress
            }
            className="flex-1 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isConfirming
              ? "Minting..."
              : "Confirm & Mint"}
          </button>
        </div>
      </div>
    </div>
  );
}