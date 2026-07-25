"use client";

import { boardConfig } from "../lib/board/boardConfig";
import { editorConfig } from "../lib/editor/editorConfig";
import {
  closeEditor,
  saveEditor,
  setSelectedEditorColor,
  updateEditorDescription,
} from "../lib/editor/editorState";
import { useEditorState } from "../lib/editor/useEditorState";

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
  const editorState = useEditorState();

  if (
    !editorState.isActive ||
    editorState.blocks.length === 0
  ) {
    return null;
  }

  const currentBlock =
    editorState.blocks[
      editorState.currentBlockIndex
    ];

  const draft =
    editorState.drafts.get(
      `${currentBlock.row}:${currentBlock.column}`,
    );

  if (!draft) {
    return null;
  }

  return (
    <aside className="pointer-events-auto absolute bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg sm:bottom-8 sm:p-5">
      <h2 className="text-lg font-semibold">
        Block #
        {getPublicBlockNumber(
          currentBlock.row,
          currentBlock.column,
        )}
      </h2>

      <div className="mt-5">
        <label
          htmlFor="block-description"
          className="mb-2 block text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="block-description"
          value={draft.description}
          onChange={(event) =>
            updateEditorDescription(
              currentBlock,
              event.target.value,
            )
          }
          maxLength={300}
          placeholder="Describe your Block..."
          className="h-24 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm"
        />
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-medium">
          Color
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max flex-col gap-2">
            {editorConfig.paletteRows.map(
              (row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex gap-2"
                >
                  {row.map((color) => {
                    const isSelected =
                      editorState.selectedColor ===
                      color;

                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Select color ${color}`}
                        aria-pressed={isSelected}
                        title={color}
                        onClick={() =>
                          setSelectedEditorColor(
                            color,
                          )
                        }
                        className={[
                          "h-8 w-8 shrink-0 rounded-full border-2 transition",
                          isSelected
                            ? "border-black ring-2 ring-black ring-offset-2"
                            : "border-gray-950 hover:scale-105",
                        ].join(" ")}
                        style={{
                          backgroundColor:
                            color,
                        }}
                      />
                    );
                  })}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={closeEditor}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={saveEditor}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white"
        >
          Done
        </button>
      </div>
    </aside>
  );
}