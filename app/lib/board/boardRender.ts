import {
  getBlock,
  getBlockKey,
} from "./boardStore";

import { getClaimState } from "../claim/claimState";
import { getEditorState } from "../editor/editorState";
import { getHoveredPixel } from "../editor/editorHoverState";
import { hoverState } from "../hover/hoverState";

import { PIXELS_PER_BLOCK } from "./boardTypes";

import type { CameraState } from "../camera/cameraTypes";
import type { BoardState } from "./boardTypes";

interface ViewportSize {
  width: number;
  height: number;
}

interface PixelTextureEntry {
  pixels: readonly string[];
  row: number;
  column: number;
}

let pixelTextureCanvas:
  HTMLCanvasElement | null = null;

let pixelTextureContext:
  CanvasRenderingContext2D | null = null;

let pixelTextureWidth = 0;
let pixelTextureHeight = 0;

const pixelTextureEntries =
  new Map<string, PixelTextureEntry>();

function renderBackground(
  context: CanvasRenderingContext2D,
  boardState: BoardState,
) {
  context.fillStyle = "#ffffff";

  context.fillRect(
    0,
    0,
    boardState.width,
    boardState.height,
  );
}

function getPixelTexture(
  boardState: BoardState,
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
      document.createElement("canvas");

    canvas.width = requiredWidth;
    canvas.height = requiredHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return null;
    }

    pixelTextureCanvas = canvas;
    pixelTextureContext = context;

    pixelTextureWidth =
      requiredWidth;

    pixelTextureHeight =
      requiredHeight;

    pixelTextureEntries.clear();
  }

  const canvas = pixelTextureCanvas;
const context = pixelTextureContext;

if (!canvas || !context) {
  return null;
}

return {
  canvas,
  context,
  rowCount,
  columnCount,
};
}

function updatePixelTexture(
  boardState: BoardState,
) {
  const texture =
    getPixelTexture(boardState);

  if (!texture) {
    return null;
  }

  const editorState =
    getEditorState();

  const activeBlockKeys =
    new Set<string>();

  for (
    let row = 0;
    row < texture.rowCount;
    row++
  ) {
    for (
      let column = 0;
      column <
      texture.columnCount;
      column++
    ) {
      const block = getBlock({
        row,
        column,
      });

      if (!block) {
        continue;
      }

      const blockKey =
        getBlockKey(
          block.coordinate,
        );

      activeBlockKeys.add(blockKey);

      const editorDraft =
        editorState.isActive
          ? editorState.drafts.get(
              blockKey,
            )
          : undefined;

      const pixels =
        editorDraft?.pixels ??
        block.pixels;

      const existingEntry =
        pixelTextureEntries.get(
          blockKey,
        );

      /*
       * Pixel arrays are replaced whenever a
       * draft or saved Block changes. The same
       * reference therefore means that this
       * Block does not need to be redrawn.
       */
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
            textureY + pixelRow,
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
  }

  /*
   * Clear cached pixels if a Block is ever
   * removed from the Board.
   */
  pixelTextureEntries.forEach(
    (entry, blockKey) => {
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
  context: CanvasRenderingContext2D,
  boardState: BoardState,
) {
  const textureCanvas =
    updatePixelTexture(boardState);

  if (!textureCanvas) {
    return;
  }

  context.save();

  context.imageSmoothingEnabled =
    false;

  /*
   * The complete pixel layer is rendered as
   * one continuous nearest-neighbour texture.
   */
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

function renderClaimSelection(
  context: CanvasRenderingContext2D,
  boardState: BoardState,
) {
  const claimState =
    getClaimState();

  if (!claimState.isActive) {
    return;
  }

  context.save();

  context.fillStyle = "#93c5fd";

  claimState.blocks.forEach(
    (block) => {
      context.fillRect(
        block.column *
          boardState.blockSize,
        block.row *
          boardState.blockSize,
        boardState.blockSize,
        boardState.blockSize,
      );
    },
  );

  context.restore();
}

function renderHover(
  context: CanvasRenderingContext2D,
  boardState: BoardState,
) {
  const editorState =
    getEditorState();

  if (
    editorState.isActive ||
    !hoverState.block
  ) {
    return;
  }

  context.save();

  context.globalAlpha = 0.35;
  context.fillStyle = "#d1d5db";

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
  context: CanvasRenderingContext2D,
  boardState: BoardState,
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
      editorState.currentBlockIndex
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
    pixelSize - strokeWidth;

  if (innerSize <= 0) {
    return;
  }

  const hoverColor =
    editorState.selectedColor.toLowerCase() ===
    "#ffffff"
      ? "#e5e7eb"
      : editorState.selectedColor;

  context.save();

  context.strokeStyle =
    hoverColor;

  context.lineWidth =
    strokeWidth;

  context.strokeRect(
    pixelX + inset,
    pixelY + inset,
    innerSize,
    innerSize,
  );

  context.restore();
}

export function renderBoard(
  context: CanvasRenderingContext2D,
  boardState: BoardState,
  cameraState: CameraState,
  viewportSize: ViewportSize,
) {
  context.clearRect(
    0,
    0,
    viewportSize.width,
    viewportSize.height,
  );

  context.save();

  context.translate(
    viewportSize.width / 2 +
      cameraState.x,
    viewportSize.height / 2 +
      cameraState.y,
  );

  context.scale(
    cameraState.zoom,
    cameraState.zoom,
  );

  context.translate(
    -boardState.width / 2,
    -boardState.height / 2,
  );

  renderBackground(
    context,
    boardState,
  );

  renderPixels(
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