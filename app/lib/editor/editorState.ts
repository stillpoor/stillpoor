import {
  getAppMode,
  setAppMode,
} from "../app/appState";
import {
  getBlock,
  getBlockKey,
  setBlock,
} from "../board/boardStore";
import { PIXELS_PER_BLOCK } from "../board/boardTypes";
import { editorConfig } from "./editorConfig";

import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";
import type { PixelCoordinate } from "./editorCoordinates";
import type {
  BlockDraft,
  EditorState,
} from "./editorTypes";

type EditorListener = () => void;

let editorState: EditorState = {
  isActive: false,
  blocks: [],
  currentBlockIndex: 0,
  selectedColor: editorConfig.defaultColor,
  drafts: new Map(),
};

const listeners = new Set<EditorListener>();

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
    selectedColor: editorConfig.defaultColor,
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
    selectedColor: editorConfig.defaultColor,
    drafts,
  };

  notifyListeners();
}

export function setCurrentEditorBlockIndex(
  index: number,
) {
  if (
    getAppMode() !== "editor" ||
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
  if (getAppMode() !== "editor") {
    return;
  }

  if (editorState.selectedColor === color) {
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
  color: PixelColor = editorState.selectedColor,
) {
  if (getAppMode() !== "editor") {
    return;
  }

  const blockKey = getBlockKey(block);
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
    pixelIndex >= existingDraft.pixels.length
  ) {
    return;
  }

  if (
    existingDraft.pixels[pixelIndex] === color
  ) {
    return;
  }

  const nextPixels = [
    ...existingDraft.pixels,
  ];

  nextPixels[pixelIndex] = color;

  const nextDrafts = new Map(
    editorState.drafts,
  );

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
  if (getAppMode() !== "editor") {
    return;
  }

  const blockKey = getBlockKey(block);
  const existingDraft =
    editorState.drafts.get(blockKey);

  if (!existingDraft) {
    return;
  }

  const nextDrafts = new Map(
    editorState.drafts,
  );

  nextDrafts.set(blockKey, {
    ...existingDraft,
    description: description.slice(0, 300),
  });

  editorState = {
    ...editorState,
    drafts: nextDrafts,
  };

  notifyListeners();
}

export function saveEditor() {
  if (getAppMode() !== "editor") {
    return;
  }

  const updatedAt = new Date().toISOString();

  editorState.blocks.forEach((coordinate) => {
    const blockKey =
      getBlockKey(coordinate);

    const draft =
      editorState.drafts.get(blockKey);

    const existingBlock =
      getBlock(coordinate);

    if (!draft || !existingBlock) {
      return;
    }

    const trimmedDescription =
      draft.description.trim();

    setBlock({
      ...existingBlock,
      pixels: [...draft.pixels],
      description:
        trimmedDescription.length > 0
          ? trimmedDescription
          : null,
      updatedAt,
    });
  });

  setAppMode("browsing");
  resetEditorState();
  notifyListeners();
}

export function closeEditor() {
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