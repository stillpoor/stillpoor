import {
  getBlockKey,
  getBlocks,
} from "./boardStore";

import {
  getClaimState,
  isBlockClaimed,
} from "../claim/claimState";

import {
  getEditorState,
} from "../editor/editorState";

import {
  getHoveredPixel,
} from "../editor/editorHoverState";

import {
  hoverState,
} from "../hover/hoverState";

import {
  getOrdinalPreviewState,
} from "../ordinals/ordinalPreviewState";

import {
  getActiveBlockReservations,
  isBlockReserved,
} from "../payment/blockReservationState";

import {
  PIXELS_PER_BLOCK,
} from "./boardTypes";

import type {
  CameraState,
} from "../camera/cameraTypes";

import type {
  BoardState,
} from "./boardTypes";

interface ViewportSize {
  width: number;
  height: number;
}

interface PixelTextureEntry {
  pixels:
    readonly string[];

  row: number;
  column: number;
}

let pixelTextureCanvas:
  HTMLCanvasElement | null =
    null;

let pixelTextureContext:
  CanvasRenderingContext2D | null =
    null;

let pixelTextureWidth =
  0;

let pixelTextureHeight =
  0;

const pixelTextureEntries =
  new Map<
    string,
    PixelTextureEntry
  >();

function renderBackground(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    boardState.width,
    boardState.height,
  );
}

function getPixelTexture(
  boardState:
    BoardState,
) {
  const rowCount =
    boardState.height /
    boardState.blockSize;

  const columnCount =
    boardState.width /
    boardState.blockSize;

  const requiredWidth =
    columnCount *
    PIXELS_PER_BLOCK;

  const requiredHeight =
    rowCount *
    PIXELS_PER_BLOCK;

  const needsNewTexture =
    !pixelTextureCanvas ||
    !pixelTextureContext ||
    pixelTextureWidth !==
      requiredWidth ||
    pixelTextureHeight !==
      requiredHeight;

  if (needsNewTexture) {
    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      requiredWidth;

    canvas.height =
      requiredHeight;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      return null;
    }

    pixelTextureCanvas =
      canvas;

    pixelTextureContext =
      context;

    pixelTextureWidth =
      requiredWidth;

    pixelTextureHeight =
      requiredHeight;

    pixelTextureEntries.clear();
  }

  const canvas =
    pixelTextureCanvas;

  const context =
    pixelTextureContext;

  if (
    !canvas ||
    !context
  ) {
    return null;
  }

  return {
    canvas,
    context,
  };
}

function updatePixelTexture(
  boardState:
    BoardState,
) {
  const texture =
    getPixelTexture(
      boardState,
    );

  if (!texture) {
    return null;
  }

  const editorState =
    getEditorState();

  const ordinalPreview =
    getOrdinalPreviewState();

  const activeBlockKeys =
    new Set<string>();

  for (
    const block of getBlocks()
  ) {
    const {
      row,
      column,
    } =
      block.coordinate;

    const blockKey =
      getBlockKey(
        block.coordinate,
      );

    activeBlockKeys.add(
      blockKey,
    );

    const editorDraft =
      editorState.isActive
        ? editorState.drafts.get(
            blockKey,
          )
        : undefined;

    const isPreviewedBlock =
      ordinalPreview.block
        ?.row === row &&
      ordinalPreview.block
        ?.column === column;

    const previewPixels =
      isPreviewedBlock
        ? ordinalPreview.pixels
        : null;

    const pixels =
      editorDraft?.pixels ??
      previewPixels ??
      block.pixels;

    const existingEntry =
      pixelTextureEntries.get(
        blockKey,
      );

    if (
      existingEntry?.pixels ===
      pixels
    ) {
      continue;
    }

    const textureX =
      column *
      PIXELS_PER_BLOCK;

    const textureY =
      row *
      PIXELS_PER_BLOCK;

    texture.context.clearRect(
      textureX,
      textureY,
      PIXELS_PER_BLOCK,
      PIXELS_PER_BLOCK,
    );

    pixels.forEach(
      (
        pixelColor,
        pixelIndex,
      ) => {
        const pixelRow =
          Math.floor(
            pixelIndex /
              PIXELS_PER_BLOCK,
          );

        const pixelColumn =
          pixelIndex %
          PIXELS_PER_BLOCK;

        texture.context.fillStyle =
          pixelColor;

        texture.context.fillRect(
          textureX +
            pixelColumn,

          textureY +
            pixelRow,

          1,
          1,
        );
      },
    );

    pixelTextureEntries.set(
      blockKey,
      {
        pixels,
        row,
        column,
      },
    );
  }

  pixelTextureEntries.forEach(
    (
      entry,
      blockKey,
    ) => {
      if (
        activeBlockKeys.has(
          blockKey,
        )
      ) {
        return;
      }

      texture.context.clearRect(
        entry.column *
          PIXELS_PER_BLOCK,

        entry.row *
          PIXELS_PER_BLOCK,

        PIXELS_PER_BLOCK,
        PIXELS_PER_BLOCK,
      );

      pixelTextureEntries.delete(
        blockKey,
      );
    },
  );

  return texture.canvas;
}

function renderPixels(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  const textureCanvas =
    updatePixelTexture(
      boardState,
    );

  if (!textureCanvas) {
    return;
  }

  const claimState =
    getClaimState();

  context.save();

  if (
    claimState.isActive
  ) {
    context.globalAlpha =
      0.45;
  }

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    textureCanvas,

    0,
    0,

    textureCanvas.width,
    textureCanvas.height,

    0,
    0,

    boardState.width,
    boardState.height,
  );

  context.restore();
}

function renderReservedBlocks(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  const screenScale =
    Math.abs(
      context.getTransform().a,
    ) || 1;

  const borderWidth =
    1 / screenScale;

  context.save();

  for (
    const reservation of
      getActiveBlockReservations()
  ) {
    const blockX =
      reservation.coordinate
        .column *
      boardState.blockSize;

    const blockY =
      reservation.coordinate
        .row *
      boardState.blockSize;

    context.fillStyle =
      "#e5e7eb";

    context.fillRect(
      blockX,
      blockY,
      boardState.blockSize,
      boardState.blockSize,
    );

    context.strokeStyle =
      "#9ca3af";

    context.lineWidth =
      borderWidth;

    context.strokeRect(
      blockX +
        borderWidth / 2,

      blockY +
        borderWidth / 2,

      boardState.blockSize -
        borderWidth,

      boardState.blockSize -
        borderWidth,
    );
  }

  context.restore();
}

function renderClaimSelection(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  const claimState =
    getClaimState();

  if (
    !claimState.isActive
  ) {
    return;
  }

  const columnCount =
    boardState.width /
    boardState.blockSize;

  context.save();

  claimState.blocks.forEach(
    (block) => {
      const blockX =
        block.column *
        boardState.blockSize;

      const blockY =
        block.row *
        boardState.blockSize;

      const publicBlockNumber =
        block.row *
          columnCount +
        block.column +
        1;

      const label =
        String(
          publicBlockNumber,
        );

      const fontSize =
        label.length >= 4
          ? 5
          : label.length === 3
            ? 6
            : 7;

      context.fillStyle =
        "#a7f3d0";

      context.fillRect(
        blockX,
        blockY,
        boardState.blockSize,
        boardState.blockSize,
      );

      context.fillStyle =
        "#047857";

      context.font =
        `700 ${fontSize}px sans-serif`;

      context.textAlign =
        "center";

      context.textBaseline =
        "middle";

      context.fillText(
        label,

        blockX +
          boardState.blockSize /
            2,

        blockY +
          boardState.blockSize /
            2,
      );
    },
  );

  context.restore();
}

function renderHover(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  const editorState =
    getEditorState();

  if (
    editorState.isActive ||
    !hoverState.block
  ) {
    return;
  }

  if (
    isBlockReserved(
      hoverState.block,
    )
  ) {
    return;
  }

  if (
    getClaimState()
      .isActive &&
    isBlockClaimed(
      hoverState.block,
    )
  ) {
    return;
  }

  context.save();

  context.globalAlpha =
    0.35;

  context.fillStyle =
    "#d1d5db";

  context.fillRect(
    hoverState.block.column *
      boardState.blockSize,

    hoverState.block.row *
      boardState.blockSize,

    boardState.blockSize,
    boardState.blockSize,
  );

  context.restore();
}

function renderEditorOverlay(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,
) {
  const editorState =
    getEditorState();

  const hoveredPixel =
    getHoveredPixel();

  if (
    !editorState.isActive ||
    !hoveredPixel
  ) {
    return;
  }

  const currentBlock =
    editorState.blocks[
      editorState
        .currentBlockIndex
    ];

  if (!currentBlock) {
    return;
  }

  const pixelSize =
    boardState.blockSize /
    PIXELS_PER_BLOCK;

  const pixelX =
    currentBlock.column *
      boardState.blockSize +
    hoveredPixel.column *
      pixelSize;

  const pixelY =
    currentBlock.row *
      boardState.blockSize +
    hoveredPixel.row *
      pixelSize;

  const screenScale =
    Math.abs(
      context.getTransform().a,
    ) || 1;

  const strokeWidth =
    3 / screenScale;

  const inset =
    strokeWidth / 2;

  const innerSize =
    pixelSize -
    strokeWidth;

  if (
    innerSize <= 0
  ) {
    return;
  }

  const hoverColor =
    editorState.selectedColor
      .toLowerCase() ===
    "#ffffff"
      ? "#e5e7eb"
      : editorState
          .selectedColor;

  context.save();

  context.strokeStyle =
    hoverColor;

  context.lineWidth =
    strokeWidth;

  context.strokeRect(
    pixelX +
      inset,

    pixelY +
      inset,

    innerSize,
    innerSize,
  );

  context.restore();
}

export function renderBoard(
  context:
    CanvasRenderingContext2D,

  boardState:
    BoardState,

  cameraState:
    CameraState,

  viewportSize:
    ViewportSize,
) {
  context.clearRect(
    0,
    0,
    viewportSize.width,
    viewportSize.height,
  );

  context.save();

  context.translate(
    viewportSize.width /
      2 +
      cameraState.x,

    viewportSize.height /
      2 +
      cameraState.y,
  );

  context.scale(
    cameraState.zoom,
    cameraState.zoom,
  );

  context.translate(
    -boardState.width /
      2,

    -boardState.height /
      2,
  );

  renderBackground(
    context,
    boardState,
  );

  renderPixels(
    context,
    boardState,
  );

  renderReservedBlocks(
    context,
    boardState,
  );

  renderClaimSelection(
    context,
    boardState,
  );

  renderHover(
    context,
    boardState,
  );

  renderEditorOverlay(
    context,
    boardState,
  );

  context.restore();
}