"use client";

import {
  useState,
} from "react";

import {
  boardConfig,
} from "../lib/board/boardConfig";

import {
  editorConfig,
} from "../lib/editor/editorConfig";

import {
  closeEditor,
  saveEditor,
  setCurrentEditorBlockIndex,
  setSelectedEditorColor,
  updateEditorDescription,
} from "../lib/editor/editorState";

import {
  useEditorState,
} from "../lib/editor/useEditorState";

import {
  useWalletState,
} from "../lib/wallet/useWalletState";

function getPublicBlockNumber(
  row: number,
  column: number,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    row * blocksPerRow +
    column +
    1
  );
}

export default function BlockEditor() {
  const editorState =
    useEditorState();

  const walletState =
    useWalletState();

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    saveError,
    setSaveError,
  ] = useState<
    string | null
  >(null);

  if (
    !editorState.isActive ||
    editorState.blocks.length ===
      0
  ) {
    return null;
  }

  const currentBlock =
    editorState.blocks[
      editorState
        .currentBlockIndex
    ];

  if (!currentBlock) {
    return null;
  }

  const draft =
    editorState.drafts.get(
      `${currentBlock.row}:${currentBlock.column}`,
    );

  if (!draft) {
    return null;
  }

  const blockCount =
    editorState.blocks.length;

  const hasPreviousBlock =
    editorState
      .currentBlockIndex > 0;

  const hasNextBlock =
    editorState
      .currentBlockIndex <
    blockCount - 1;

  const showBlockNavigation =
    blockCount > 1;

  const isOrdinalVersion =
    editorState.saveMode ===
    "ordinal-version";

  const nextOrdinalVersion =
    (
      editorState
        .expectedLatestInscriptionVersion ??
      0
    ) + 1;

  const handleSave =
    async () => {
      const paymentAddress =
        walletState
          .paymentAddress
          ?.address;

      if (!paymentAddress) {
        setSaveError(
          "Connect the wallet that owns this Block before saving.",
        );

        return;
      }

      setSaveError(null);
      setIsSaving(true);

      try {
        await saveEditor(
          paymentAddress,
        );
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : isOrdinalVersion
              ? "Unable to create the new Ordinal version."
              : "Unable to save the Blocks.",
        );
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <aside className="pointer-events-auto absolute bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg sm:bottom-8 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Block #
            {getPublicBlockNumber(
              currentBlock.row,
              currentBlock.column,
            )}
          </h2>

          {isOrdinalVersion && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Creating Ordinal v
              {nextOrdinalVersion}
            </p>
          )}
        </div>

        {showBlockNavigation && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous Block"
              disabled={
                !hasPreviousBlock ||
                isSaving
              }
              onClick={() =>
                setCurrentEditorBlockIndex(
                  editorState
                    .currentBlockIndex -
                    1,
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-sm disabled:cursor-not-allowed disabled:opacity-35"
            >
              ←
            </button>

            <span className="min-w-20 text-center text-sm text-gray-600">
              Block{" "}
              {editorState
                .currentBlockIndex +
                1}{" "}
              of {blockCount}
            </span>

            <button
              type="button"
              aria-label="Next Block"
              disabled={
                !hasNextBlock ||
                isSaving
              }
              onClick={() =>
                setCurrentEditorBlockIndex(
                  editorState
                    .currentBlockIndex +
                    1,
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-sm disabled:cursor-not-allowed disabled:opacity-35"
            >
              →
            </button>
          </div>
        )}
      </div>

      {isOrdinalVersion && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          Saving these changes will
          create a permanent new
          Ordinal version.
        </p>
      )}

      <div className="mt-5">
        <label
          htmlFor="block-description"
          className="mb-2 block text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="block-description"
          value={
            draft.description
          }
          disabled={isSaving}
          onChange={(event) =>
            updateEditorDescription(
              currentBlock,
              event.target.value,
            )
          }
          maxLength={300}
          placeholder="Describe your Block..."
          className="h-24 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-60"
        />
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-medium">
          Color
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max flex-col gap-2">
            {editorConfig.paletteRows.map(
              (
                row,
                rowIndex,
              ) => (
                <div
                  key={rowIndex}
                  className="flex gap-2"
                >
                  {row.map(
                    (color) => {
                      const isSelected =
                        editorState
                          .selectedColor ===
                        color;

                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={
                            isSaving
                          }
                          aria-label={`Select color ${color}`}
                          aria-pressed={
                            isSelected
                          }
                          title={color}
                          onClick={() =>
                            setSelectedEditorColor(
                              color,
                            )
                          }
                          className={[
                            "h-8 w-8 shrink-0 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50",

                            isSelected
                              ? "border-black ring-2 ring-black ring-offset-2"
                              : "border-gray-950 hover:scale-105",
                          ].join(
                            " ",
                          )}
                          style={{
                            backgroundColor:
                              color,
                          }}
                        />
                      );
                    },
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {saveError && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-600"
        >
          {saveError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={closeEditor}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={
            handleSave
          }
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving
            ? isOrdinalVersion
              ? "Minting..."
              : "Saving..."
            : isOrdinalVersion
              ? "Save & Mint"
              : "Done"}
        </button>
      </div>
    </aside>
  );
}