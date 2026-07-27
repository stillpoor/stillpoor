import { getAppMode } from "../app/appState";

import { boardConfig } from "../board/boardConfig";
import {
  boardPointToBlock,
  screenToBoard,
} from "../board/boardCoordinates";
import { getBlock } from "../board/boardStore";

import {
  enterClaimMode,
  getClaimState,
  toggleClaimBlock,
} from "../claim/claimState";

import { boardPointToPixel } from "../editor/editorCoordinates";
import {
  getHoveredPixel,
  setHoveredPixel,
} from "../editor/editorHoverState";
import {
  getEditorState,
  paintPixel,
} from "../editor/editorState";

import { hoverState } from "../hover/hoverState";

import {
  getSelectedBlock,
  setSelectedBlock,
} from "../selection/selectionState";

import { cameraConfig } from "./cameraConfig";
import { cameraState } from "./cameraState";

import type { BlockCoordinate } from "../board/boardTypes";
import type { PixelCoordinate } from "../editor/editorCoordinates";

type CameraChangeHandler = () => void;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function areSameBlock(
  firstBlock: BlockCoordinate,
  secondBlock: BlockCoordinate,
) {
  return (
    firstBlock.row === secondBlock.row &&
    firstBlock.column === secondBlock.column
  );
}

function getPixelKey(
  pixel: PixelCoordinate,
) {
  return `${pixel.row}:${pixel.column}`;
}

export class CameraController {
  private isDragging = false;
  private hasDragged = false;

  private isPainting = false;
  private lastPaintedPixelKey: string | null =
    null;

  private startPointerX = 0;
  private startPointerY = 0;

  private startCameraX = 0;
  private startCameraY = 0;

  private focusAnimationFrameId:
    number | null = null;

  private isNavigationEnabled = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onCameraChange: CameraChangeHandler,
  ) {
    this.canvas.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.canvas.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.addEventListener(
      "pointerup",
      this.handlePointerUp,
    );

    this.canvas.addEventListener(
      "pointercancel",
      this.handlePointerCancel,
    );

    this.canvas.addEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.canvas.addEventListener(
      "wheel",
      this.handleWheel,
      { passive: false },
    );
  }

  public setNavigationEnabled(
    isEnabled: boolean,
  ) {
    this.isNavigationEnabled = isEnabled;

    if (!isEnabled) {
      this.isDragging = false;
      this.hasDragged = false;
    }
  }

  public focusBlock(
    block: BlockCoordinate,
    targetZoom: number,
    preserveHigherZoom = false,
  ) {
    this.cancelFocusAnimation();

    const startX = cameraState.x;
    const startY = cameraState.y;
    const startZoom = cameraState.zoom;

    const requestedZoom = clamp(
      targetZoom,
      cameraConfig.minZoom,
      cameraConfig.maxZoom,
    );

    const resolvedTargetZoom =
      preserveHigherZoom
        ? Math.max(
            startZoom,
            requestedZoom,
          )
        : requestedZoom;

    const blockCenterX =
      block.column *
        boardConfig.blockSize +
      boardConfig.blockSize / 2;

    const blockCenterY =
      block.row *
        boardConfig.blockSize +
      boardConfig.blockSize / 2;

    const targetX =
      -(
        blockCenterX -
        boardConfig.width / 2
      ) * resolvedTargetZoom;

    const targetY =
      -(
        blockCenterY -
        boardConfig.height / 2
      ) * resolvedTargetZoom;

    const startedAt = performance.now();

    const animate = (
      currentTime: number,
    ) => {
      const elapsed =
        currentTime - startedAt;

      const progress = Math.min(
        elapsed /
          cameraConfig.focusDuration,
        1,
      );

      const easedProgress =
        easeOutCubic(progress);

      cameraState.x =
        startX +
        (targetX - startX) *
          easedProgress;

      cameraState.y =
        startY +
        (targetY - startY) *
          easedProgress;

      cameraState.zoom =
        startZoom +
        (
          resolvedTargetZoom -
          startZoom
        ) *
          easedProgress;

      this.clampCameraPosition();
      this.onCameraChange();

      if (progress < 1) {
        this.focusAnimationFrameId =
          requestAnimationFrame(
            animate,
          );

        return;
      }

      this.focusAnimationFrameId = null;
    };

    this.focusAnimationFrameId =
      requestAnimationFrame(animate);
  }

  public destroy() {
    this.cancelFocusAnimation();

    this.canvas.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.removeEventListener(
      "pointerup",
      this.handlePointerUp,
    );

    this.canvas.removeEventListener(
      "pointercancel",
      this.handlePointerCancel,
    );

    this.canvas.removeEventListener(
      "pointerleave",
      this.handlePointerLeave,
    );

    this.canvas.removeEventListener(
      "wheel",
      this.handleWheel,
    );
  }

  private cancelFocusAnimation() {
    if (
      this.focusAnimationFrameId === null
    ) {
      return;
    }

    cancelAnimationFrame(
      this.focusAnimationFrameId,
    );

    this.focusAnimationFrameId = null;
  }

  private stopPainting() {
    this.isPainting = false;
    this.lastPaintedPixelKey = null;
  }

  private clampCameraPosition() {
    const bounds =
      this.canvas.getBoundingClientRect();

    const boardHalfWidth =
      (
        boardConfig.width *
        cameraState.zoom
      ) / 2;

    const boardHalfHeight =
      (
        boardConfig.height *
        cameraState.zoom
      ) / 2;

    const minimumVisible =
      cameraConfig.minimumVisibleBoardSize;

    const minimumX =
      minimumVisible -
      bounds.width / 2 -
      boardHalfWidth;

    const maximumX =
      bounds.width / 2 -
      minimumVisible +
      boardHalfWidth;

    const minimumY =
      minimumVisible -
      bounds.height / 2 -
      boardHalfHeight;

    const maximumY =
      bounds.height / 2 -
      minimumVisible +
      boardHalfHeight;

    cameraState.x = clamp(
      cameraState.x,
      minimumX,
      maximumX,
    );

    cameraState.y = clamp(
      cameraState.y,
      minimumY,
      maximumY,
    );
  }

  private dismissSelectedOccupiedBlockIfFarFromCenter() {
    if (
      getAppMode() !== "browsing" ||
      getClaimState().isActive
    ) {
      return;
    }

    const selectedBlock =
      getSelectedBlock();

    if (
      !selectedBlock ||
      !getBlock(selectedBlock)
    ) {
      return;
    }

    const bounds =
      this.canvas.getBoundingClientRect();

    const blockCenterX =
      selectedBlock.column *
        boardConfig.blockSize +
      boardConfig.blockSize / 2;

    const blockCenterY =
      selectedBlock.row *
        boardConfig.blockSize +
      boardConfig.blockSize / 2;

    /*
     * Position du centre du Block par rapport
     * au centre du viewport, en pixels écran.
     */
    const offsetFromViewportCenterX =
      cameraState.x +
      (
        blockCenterX -
        boardConfig.width / 2
      ) *
        cameraState.zoom;

    const offsetFromViewportCenterY =
      cameraState.y +
      (
        blockCenterY -
        boardConfig.height / 2
      ) *
        cameraState.zoom;

    const shortestViewportSide =
      Math.min(
        bounds.width,
        bounds.height,
      );

    const dismissThreshold = clamp(
      shortestViewportSide *
        cameraConfig
          .selectedBlockDismissThresholdRatio,
      cameraConfig
        .selectedBlockDismissThresholdMin,
      cameraConfig
        .selectedBlockDismissThresholdMax,
    );

    const distanceFromViewportCenter =
      Math.hypot(
        offsetFromViewportCenterX,
        offsetFromViewportCenterY,
      );

    if (
      distanceFromViewportCenter <=
      dismissThreshold
    ) {
      return;
    }

    setSelectedBlock(null);
  }

  private updateHoveredBlock(
    event: PointerEvent,
  ) {
    const bounds =
      this.canvas.getBoundingClientRect();

    const boardPoint = screenToBoard(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      {
        width: bounds.width,
        height: bounds.height,
      },
      cameraState,
    );

    hoverState.block =
      boardPointToBlock(boardPoint);
  }

  private updateHoveredEditorPixel(
    event: PointerEvent,
  ) {
    if (getAppMode() !== "editor") {
      setHoveredPixel(null);
      return;
    }

    const editorState =
      getEditorState();

    const currentBlock =
      editorState.blocks[
        editorState.currentBlockIndex
      ];

    if (!currentBlock) {
      setHoveredPixel(null);
      return;
    }

    const bounds =
      this.canvas.getBoundingClientRect();

    const boardPoint = screenToBoard(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      {
        width: bounds.width,
        height: bounds.height,
      },
      cameraState,
    );

    const hoveredBlock =
      boardPointToBlock(boardPoint);

    if (
      !hoveredBlock ||
      !areSameBlock(
        hoveredBlock,
        currentBlock,
      )
    ) {
      setHoveredPixel(null);
      return;
    }

    setHoveredPixel(
      boardPointToPixel(
        boardPoint,
        boardConfig.blockSize,
      ),
    );
  }

  private paintHoveredPixelIfNeeded() {
    if (
      !this.isPainting ||
      getAppMode() !== "editor"
    ) {
      return;
    }

    const hoveredPixel =
      getHoveredPixel();

    if (!hoveredPixel) {
      return;
    }

    const pixelKey =
      getPixelKey(hoveredPixel);

    if (
      pixelKey ===
      this.lastPaintedPixelKey
    ) {
      return;
    }

    const editorState =
      getEditorState();

    const currentBlock =
      editorState.blocks[
        editorState.currentBlockIndex
      ];

    if (!currentBlock) {
      return;
    }

    paintPixel(
      currentBlock,
      hoveredPixel,
    );

    this.lastPaintedPixelKey =
      pixelKey;
  }

  private handleOccupiedBlockClick(
    block: BlockCoordinate,
  ) {
    if (getClaimState().isActive) {
      return;
    }

    const selectedBlock =
      getSelectedBlock();

    if (
      selectedBlock &&
      areSameBlock(
        selectedBlock,
        block,
      )
    ) {
      setSelectedBlock(null);
      this.onCameraChange();
      return;
    }

    setSelectedBlock(block);
    this.onCameraChange();

    this.focusBlock(
      block,
      cameraConfig.occupiedFocusZoom,
      true,
    );
  }

  private handleAvailableBlockClick(
    block: BlockCoordinate,
  ) {
    const claimState =
      getClaimState();

    if (!claimState.isActive) {
      enterClaimMode(block);
      setSelectedBlock(block);
      this.onCameraChange();

      this.focusBlock(
        block,
        cameraConfig.claimFocusZoom,
        true,
      );

      return;
    }

    toggleClaimBlock(block);

    const updatedClaimState =
      getClaimState();

    if (!updatedClaimState.isActive) {
      setSelectedBlock(null);
    } else {
      const isStillClaimed =
        updatedClaimState.blocks.some(
          (claimedBlock) =>
            areSameBlock(
              claimedBlock,
              block,
            ),
        );

      if (isStillClaimed) {
        setSelectedBlock(block);
      } else {
        setSelectedBlock(
          updatedClaimState.blocks[
            updatedClaimState.blocks
              .length - 1
          ],
        );
      }
    }

    this.onCameraChange();
  }

  private handleBlockClick(
    block: BlockCoordinate,
  ) {
    const occupiedBlock =
      getBlock(block);

    if (occupiedBlock) {
      this.handleOccupiedBlockClick(
        block,
      );

      return;
    }

    this.handleAvailableBlockClick(
      block,
    );
  }

  private handlePointerDown = (
    event: PointerEvent,
  ) => {
    if (event.button !== 0) {
      return;
    }

    if (getAppMode() === "editor") {
      event.preventDefault();

      this.updateHoveredEditorPixel(
        event,
      );

      const hoveredPixel =
        getHoveredPixel();

      if (!hoveredPixel) {
        return;
      }

      this.isPainting = true;
      this.lastPaintedPixelKey = null;

      this.canvas.setPointerCapture(
        event.pointerId,
      );

      this.paintHoveredPixelIfNeeded();
      this.onCameraChange();

      return;
    }

    if (!this.isNavigationEnabled) {
      return;
    }

    event.preventDefault();

    this.cancelFocusAnimation();

    this.isDragging = true;
    this.hasDragged = false;

    this.startPointerX =
      event.clientX;

    this.startPointerY =
      event.clientY;

    this.startCameraX =
      cameraState.x;

    this.startCameraY =
      cameraState.y;

    this.canvas.setPointerCapture(
      event.pointerId,
    );
  };

  private handlePointerMove = (
    event: PointerEvent,
  ) => {
    if (getAppMode() === "editor") {
      this.updateHoveredEditorPixel(
        event,
      );

      this.paintHoveredPixelIfNeeded();
      this.onCameraChange();

      return;
    }

    this.updateHoveredBlock(event);

    if (!this.isDragging) {
      this.onCameraChange();
      return;
    }

    const deltaX =
      event.clientX -
      this.startPointerX;

    const deltaY =
      event.clientY -
      this.startPointerY;

    const distance =
      Math.hypot(
        deltaX,
        deltaY,
      );

    if (
      distance <
      cameraConfig.dragThreshold
    ) {
      this.onCameraChange();
      return;
    }

    this.hasDragged = true;

    cameraState.x =
      this.startCameraX + deltaX;

    cameraState.y =
      this.startCameraY + deltaY;

    this.clampCameraPosition();

    this.dismissSelectedOccupiedBlockIfFarFromCenter();

    this.updateHoveredBlock(event);
    this.onCameraChange();
  };

  private handlePointerUp = (
    event: PointerEvent,
  ) => {
    if (getAppMode() === "editor") {
      this.stopPainting();

      if (
        this.canvas.hasPointerCapture(
          event.pointerId,
        )
      ) {
        this.canvas.releasePointerCapture(
          event.pointerId,
        );
      }

      return;
    }

    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;

    if (
      !this.hasDragged &&
      hoverState.block
    ) {
      this.handleBlockClick(
        hoverState.block,
      );
    }

    if (
      this.canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      this.canvas.releasePointerCapture(
        event.pointerId,
      );
    }
  };

  private handlePointerCancel = (
    event: PointerEvent,
  ) => {
    this.stopPainting();

    this.isDragging = false;
    this.hasDragged = false;

    if (
      this.canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      this.canvas.releasePointerCapture(
        event.pointerId,
      );
    }
  };

  private handlePointerLeave = () => {
    if (getAppMode() === "editor") {
      setHoveredPixel(null);
      this.onCameraChange();
      return;
    }

    if (this.isDragging) {
      return;
    }

    hoverState.block = null;
    this.onCameraChange();
  };

  private handleWheel = (
    event: WheelEvent,
  ) => {
    event.preventDefault();

    if (!this.isNavigationEnabled) {
      return;
    }

    this.cancelFocusAnimation();

    const bounds =
      this.canvas.getBoundingClientRect();

    const pointerX =
      event.clientX - bounds.left;

    const pointerY =
      event.clientY - bounds.top;

    const viewportCenterX =
      bounds.width / 2;

    const viewportCenterY =
      bounds.height / 2;

    const previousZoom =
      cameraState.zoom;

    const zoomMultiplier = Math.exp(
      -event.deltaY *
        cameraConfig.zoomSensitivity,
    );

    const nextZoom = clamp(
      previousZoom * zoomMultiplier,
      cameraConfig.minZoom,
      cameraConfig.maxZoom,
    );

    if (
      nextZoom === previousZoom
    ) {
      return;
    }

    const worldX =
      (
        pointerX -
        viewportCenterX -
        cameraState.x
      ) / previousZoom;

    const worldY =
      (
        pointerY -
        viewportCenterY -
        cameraState.y
      ) / previousZoom;

    cameraState.zoom = nextZoom;

    cameraState.x =
      pointerX -
      viewportCenterX -
      worldX * nextZoom;

    cameraState.y =
      pointerY -
      viewportCenterY -
      worldY * nextZoom;

    this.clampCameraPosition();
    this.onCameraChange();
  };
}