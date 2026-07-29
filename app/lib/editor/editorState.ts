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
  mintNextBlockOrdinalSimulated,
} from "../ordinals/ordinalApi";

import {
  setSelectedBlock,
} from "../selection/selectionState";

import {
  saveEditorBlocks,
} from "./editorApi";

import {
  editorConfig,
} from "./editorConfig";

import type {
  Block,
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

import type {
  PixelCoordinate,
} from "./editorCoordinates";

import type {
  BlockDraft,
  EditorSaveMode,
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

  saveMode: "standard",

  expectedLatestInscriptionVersion:
    null,
};

let isSaveInProgress = false;

const listeners =
  new Set<EditorListener>();

function notifyListeners() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}

function resetEditorState() {
  editorState = {
    isActive: false,

    blocks: [],
    currentBlockIndex: 0,

    selectedColor:
      editorConfig.defaultColor,

    drafts: new Map(),

    saveMode: "standard",

    expectedLatestInscriptionVersion:
      null,
  };
}

function activateEditor(
  blocks: BlockCoordinate[],
  drafts: Map<
    string,
    BlockDraft
  >,
  saveMode: EditorSaveMode,
  expectedLatestInscriptionVersion:
    number | null,
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

    saveMode,

    expectedLatestInscriptionVersion,
  };

  notifyListeners();
}

function copyBlockIntoDraft(
  existingBlock: Block,
) {
  const coordinate = {
    ...existingBlock.coordinate,
  };

  const drafts =
    new Map<
      string,
      BlockDraft
    >();

  drafts.set(
    getBlockKey(
      coordinate,
    ),
    {
      pixels: [
        ...existingBlock.pixels,
      ],

      description:
        existingBlock.description ??
        "",
    },
  );

  return {
    coordinate,
    drafts,
  };
}

function saveBlockToStore(
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

export function getEditorState() {
  return editorState;
}

export function startEditor(
  blocks: BlockCoordinate[],
  drafts: Map<
    string,
    BlockDraft
  >,
) {
  activateEditor(
    blocks,
    drafts,
    "standard",
    null,
  );
}

export function startEditorForExistingBlock(
  coordinate: BlockCoordinate,
) {
  const existingBlock =
    getBlock(coordinate);

  if (
    !existingBlock ||
    existingBlock
      .inscriptionPending ||
    existingBlock
      .latestInscriptionVersion >
      0
  ) {
    return false;
  }

  const editorData =
    copyBlockIntoDraft(
      existingBlock,
    );

  activateEditor(
    [
      editorData.coordinate,
    ],

    editorData.drafts,

    "standard",

    null,
  );

  return true;
}

export function startEditorForNewOrdinalVersion(
  coordinate: BlockCoordinate,
) {
  const existingBlock =
    getBlock(coordinate);

  if (
    !existingBlock ||
    existingBlock
      .inscriptionPending ||
    existingBlock
      .latestInscriptionVersion <
      1
  ) {
    return false;
  }

  const editorData =
    copyBlockIntoDraft(
      existingBlock,
    );

  activateEditor(
    [
      editorData.coordinate,
    ],

    editorData.drafts,

    "ordinal-version",

    existingBlock
      .latestInscriptionVersion,
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
    index >=
      editorState.blocks.length
  ) {
    return;
  }

  editorState = {
    ...editorState,

    currentBlockIndex:
      index,
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
    editorState.selectedColor ===
    color
  ) {
    return;
  }

  editorState = {
    ...editorState,

    selectedColor:
      color,
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
    editorState.drafts.get(
      blockKey,
    );

  if (!existingDraft) {
    return;
  }

  const pixelIndex =
    pixel.row *
      PIXELS_PER_BLOCK +
    pixel.column;

  if (
    pixelIndex < 0 ||
    pixelIndex >=
      existingDraft
        .pixels.length
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

  nextPixels[
    pixelIndex
  ] = color;

  const nextDrafts =
    new Map(
      editorState.drafts,
    );

  nextDrafts.set(
    blockKey,
    {
      ...existingDraft,

      pixels:
        nextPixels,
    },
  );

  editorState = {
    ...editorState,

    drafts:
      nextDrafts,
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
    editorState.drafts.get(
      blockKey,
    );

  if (!existingDraft) {
    return;
  }

  const nextDrafts =
    new Map(
      editorState.drafts,
    );

  nextDrafts.set(
    blockKey,
    {
      ...existingDraft,

      description:
        description.slice(
          0,
          300,
        ),
    },
  );

  editorState = {
    ...editorState,

    drafts:
      nextDrafts,
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

  if (
    !paymentAddress.trim()
  ) {
    throw new Error(
      "A connected wallet is required to save.",
    );
  }

  const blocksToSave =
    editorState.blocks.map(
      (coordinate) => {
        const draft =
          editorState.drafts.get(
            getBlockKey(
              coordinate,
            ),
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
    if (
      editorState.saveMode ===
      "ordinal-version"
    ) {
      if (
        blocksToSave.length !==
          1 ||
        editorState
          .expectedLatestInscriptionVersion ===
          null
      ) {
        throw new Error(
          "The Ordinal editor state is invalid.",
        );
      }

      const blockToMint =
        blocksToSave[0];

      const result =
        await mintNextBlockOrdinalSimulated(
          {
            block:
              blockToMint.coordinate,

            expectedLatestVersion:
              editorState
                .expectedLatestInscriptionVersion,

            pixels:
              blockToMint.pixels,

            description:
              blockToMint.description,
          },
        );

      saveBlockToStore(
        result.block,
      );

      setSelectedBlock({
        ...result.block
          .coordinate,
      });
    } else {
      const savedBlocks =
        await saveEditorBlocks({
          paymentAddress:
            paymentAddress.trim(),

          blocks:
            blocksToSave,
        });

      savedBlocks.forEach(
        saveBlockToStore,
      );

      setSelectedBlock(null);
    }

    setAppMode("browsing");

    resetEditorState();
    notifyListeners();

    return true;
  } finally {
    isSaveInProgress = false;
  }
}

export function completeOrdinalVersionEditor(
  block: Block,
) {
  if (
    getAppMode() !== "editor" ||
    isSaveInProgress ||
    editorState.saveMode !==
      "ordinal-version" ||
    editorState
      .expectedLatestInscriptionVersion ===
      null ||
    editorState.blocks.length !==
      1
  ) {
    return false;
  }

  const editedCoordinate =
    editorState.blocks[0];

  if (
    !editedCoordinate ||
    editedCoordinate.row !==
      block.coordinate.row ||
    editedCoordinate.column !==
      block.coordinate.column ||
    block.latestInscriptionVersion !==
      editorState
        .expectedLatestInscriptionVersion +
        1
  ) {
    return false;
  }

  saveBlockToStore(
    block,
  );

  setSelectedBlock({
    ...block.coordinate,
  });

  setAppMode("browsing");

  resetEditorState();
  notifyListeners();

  return true;
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
  listeners.add(
    listener,
  );

  return () => {
    listeners.delete(
      listener,
    );
  };
}