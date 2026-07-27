import {
  getAppMode,
  setAppMode,
} from "../app/appState";

import {
  getBlock,
  getBlockKey,
  setBlock,
} from "../board/boardStore";
import {
  PIXELS_PER_BLOCK,
} from "../board/boardTypes";

import {
  setSelectedBlock,
} from "../selection/selectionState";

import {
  saveEditorBlocks,
} from "./editorApi";
import { editorConfig } from "./editorConfig";

import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";
import type {
  PixelCoordinate,
} from "./editorCoordinates";
import type {
  BlockDraft,
  EditorState,
} from "./editorTypes";

type EditorListener = () => void;

let editorState: EditorState = {
  isActive: false,
  blocks: [],
  currentBlockIndex: 0,
  selectedColor:
    editorConfig.defaultColor,
  drafts: new Map(),
};

let isSaveInProgress = false;

const listeners =
  new Set<EditorListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

function resetEditorState() {
  editorState = {
    isActive: false,
    blocks: [],
    currentBlockIndex: 0,
    selectedColor:
      editorConfig.defaultColor,
    drafts: new Map(),
  };
}

export function getEditorState() {
  return editorState;
}

export function startEditor(
  blocks: BlockCoordinate[],
  drafts: Map<string, BlockDraft>,
) {
  if (blocks.length === 0) {
    return;
  }

  setAppMode("editor");

  editorState = {
    isActive: true,
    blocks,
    currentBlockIndex: 0,
    selectedColor:
      editorConfig.defaultColor,
    drafts,
  };

  notifyListeners();
}

export function startEditorForExistingBlock(
  coordinate: BlockCoordinate,
) {
  const existingBlock =
    getBlock(coordinate);

  if (!existingBlock) {
    return false;
  }

  const editorCoordinate = {
    ...existingBlock.coordinate,
  };

  const drafts =
    new Map<string, BlockDraft>();

  drafts.set(
    getBlockKey(editorCoordinate),
    {
      pixels: [
        ...existingBlock.pixels,
      ],

      description:
        existingBlock.description ?? "",
    },
  );

  startEditor(
    [editorCoordinate],
    drafts,
  );

  return true;
}

export function setCurrentEditorBlockIndex(
  index: number,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress ||
    index < 0 ||
    index >= editorState.blocks.length
  ) {
    return;
  }

  editorState = {
    ...editorState,
    currentBlockIndex: index,
  };

  notifyListeners();
}

export function setSelectedEditorColor(
  color: PixelColor,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress
  ) {
    return;
  }

  if (
    editorState.selectedColor === color
  ) {
    return;
  }

  editorState = {
    ...editorState,
    selectedColor: color,
  };

  notifyListeners();
}

export function paintPixel(
  block: BlockCoordinate,
  pixel: PixelCoordinate,
  color: PixelColor =
    editorState.selectedColor,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress
  ) {
    return;
  }

  const blockKey =
    getBlockKey(block);

  const existingDraft =
    editorState.drafts.get(blockKey);

  if (!existingDraft) {
    return;
  }

  const pixelIndex =
    pixel.row * PIXELS_PER_BLOCK +
    pixel.column;

  if (
    pixelIndex < 0 ||
    pixelIndex >=
      existingDraft.pixels.length
  ) {
    return;
  }

  if (
    existingDraft.pixels[
      pixelIndex
    ] === color
  ) {
    return;
  }

  const nextPixels = [
    ...existingDraft.pixels,
  ];

  nextPixels[pixelIndex] = color;

  const nextDrafts =
    new Map(editorState.drafts);

  nextDrafts.set(blockKey, {
    ...existingDraft,
    pixels: nextPixels,
  });

  editorState = {
    ...editorState,
    drafts: nextDrafts,
  };

  notifyListeners();
}

export function updateEditorDescription(
  block: BlockCoordinate,
  description: string,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress
  ) {
    return;
  }

  const blockKey =
    getBlockKey(block);

  const existingDraft =
    editorState.drafts.get(blockKey);

  if (!existingDraft) {
    return;
  }

  const nextDrafts =
    new Map(editorState.drafts);

  nextDrafts.set(blockKey, {
    ...existingDraft,

    description:
      description.slice(0, 300),
  });

  editorState = {
    ...editorState,
    drafts: nextDrafts,
  };

  notifyListeners();
}

export async function saveEditor(
  paymentAddress: string,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress
  ) {
    return false;
  }

  if (!paymentAddress.trim()) {
    throw new Error(
      "A connected wallet is required to save.",
    );
  }

  const blocksToSave =
    editorState.blocks.map(
      (coordinate) => {
        const draft =
          editorState.drafts.get(
            getBlockKey(coordinate),
          );

        if (!draft) {
          throw new Error(
            `Missing draft for Block ${getBlockKey(
              coordinate,
            )}.`,
          );
        }

        return {
          coordinate: {
            ...coordinate,
          },

          pixels: [
            ...draft.pixels,
          ],

          description:
            draft.description,
        };
      },
    );

  isSaveInProgress = true;

  try {
    const savedBlocks =
      await saveEditorBlocks({
        paymentAddress:
          paymentAddress.trim(),

        blocks: blocksToSave,
      });

    savedBlocks.forEach((block) => {
      setBlock({
        ...block,

        coordinate: {
          ...block.coordinate,
        },

        pixels: [
          ...block.pixels,
        ],
      });
    });

    setSelectedBlock(null);
    setAppMode("browsing");
    resetEditorState();
    notifyListeners();

    return true;
  } finally {
    isSaveInProgress = false;
  }
}

export function closeEditor() {
  if (isSaveInProgress) {
    return;
  }

  setAppMode("browsing");
  resetEditorState();
  notifyListeners();
}

export function subscribeToEditor(
  listener: EditorListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}