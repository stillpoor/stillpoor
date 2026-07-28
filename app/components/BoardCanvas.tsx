"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  loadClaimedBlocks,
} from "../lib/board/boardDatabase";

import {
  renderBoard,
} from "../lib/board/boardRender";

import {
  boardState,
} from "../lib/board/boardState";

import {
  replaceBlocks,
} from "../lib/board/boardStore";

import {
  CameraController,
} from "../lib/camera/cameraController";

import {
  cameraConfig,
} from "../lib/camera/cameraConfig";

import {
  cameraState,
} from "../lib/camera/cameraState";

import {
  subscribeToClaim,
} from "../lib/claim/claimState";

import {
  getEditorState,
  subscribeToEditor,
} from "../lib/editor/editorState";

import type {
  BlockCoordinate,
} from "../lib/board/boardTypes";

interface FocusClaimBlockEventDetail {
  block: BlockCoordinate;
}

interface FocusOwnedBlockEventDetail {
  block: BlockCoordinate;
}

export default function BoardCanvas() {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    let viewportWidth = 0;
    let viewportHeight = 0;
    let pixelRatio = 1;

    let hasInitializedCamera = false;
    let hasBeenDisposed = false;

    let previousEditorIsActive = false;

    let previousEditorBlockKey:
      string | null = null;

    const render = () => {
      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
      );

      renderBoard(
        context,
        boardState,
        cameraState,
        {
          width: viewportWidth,
          height: viewportHeight,
        },
      );
    };

    const getFitZoom = () => {
      const horizontalMargin = 48;
      const verticalMargin = 48;

      const availableWidth =
        Math.max(
          viewportWidth -
            horizontalMargin * 2,
          1,
        );

      const availableHeight =
        Math.max(
          viewportHeight -
            verticalMargin * 2,
          1,
        );

      const fitZoom =
        Math.min(
          availableWidth /
            boardState.width,

          availableHeight /
            boardState.height,
        );

      return Math.max(
        cameraConfig.minZoom,

        Math.min(
          fitZoom,
          cameraConfig.maxZoom,
        ),
      );
    };

    const initializeCamera = () => {
      cameraState.x = 0;
      cameraState.y = 0;
      cameraState.zoom =
        getFitZoom();
    };

    const cameraController =
      new CameraController(
        canvas,
        render,
      );

    const handleZoomIn = () => {
      cameraController.zoomBy(
        cameraConfig.controlZoomFactor,
      );
    };

    const handleZoomOut = () => {
      cameraController.zoomBy(
        1 /
          cameraConfig.controlZoomFactor,
      );
    };

    const handleRecenter = () => {
      cameraController.recenter(
        getFitZoom(),
      );
    };

    const handleFocusClaimBlock = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<FocusClaimBlockEventDetail>;

      const block =
        customEvent.detail?.block;

      if (!block) {
        return;
      }

      cameraController.focusBlock(
        block,
        cameraConfig.claimFocusZoom,
        true,
      );
    };

    const handleFocusOwnedBlock = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<FocusOwnedBlockEventDetail>;

      const block =
        customEvent.detail?.block;

      if (!block) {
        return;
      }

      cameraController.focusBlock(
        block,
        cameraConfig.occupiedFocusZoom,
        true,
      );
    };

    const getResponsiveEditorZoom =
      () => {
        const topControlsSpace = 220;
        const bottomControlsSpace = 280;

        const horizontalPadding = 48;
        const verticalPadding = 32;

        const availableWidth =
          Math.max(
            viewportWidth -
              horizontalPadding * 2,

            boardState.blockSize,
          );

        const availableHeight =
          Math.max(
            viewportHeight -
              topControlsSpace -
              bottomControlsSpace -
              verticalPadding * 2,

            boardState.blockSize,
          );

        const fitZoom =
          Math.min(
            availableWidth /
              boardState.blockSize,

            availableHeight /
              boardState.blockSize,
          );

        const minimumEditorZoom =
          Math.max(
            6,
            cameraConfig.minZoom,
          );

        return Math.max(
          minimumEditorZoom,

          Math.min(
            fitZoom,
            cameraConfig.maxZoom,
          ),
        );
      };

    const synchronizeEditorCamera = (
      forceFocus = false,
    ) => {
      const editorState =
        getEditorState();

      const isEditorActive =
        editorState.isActive &&
        editorState.blocks.length > 0;

      if (!isEditorActive) {
        canvas.style.removeProperty(
          "cursor",
        );

        cameraController
          .setNavigationEnabled(true);

        previousEditorIsActive =
          false;

        previousEditorBlockKey =
          null;

        render();

        return;
      }

      const currentBlock =
        editorState.blocks[
          editorState.currentBlockIndex
        ];

      if (!currentBlock) {
        cameraController
          .setNavigationEnabled(false);

        render();

        return;
      }

      const currentBlockKey =
        `${currentBlock.row}:${currentBlock.column}`;

      const shouldFocus =
        forceFocus ||
        !previousEditorIsActive ||
        previousEditorBlockKey !==
          currentBlockKey;

      canvas.style.cursor =
        "crosshair";

      cameraController
        .setNavigationEnabled(false);

      previousEditorIsActive =
        true;

      previousEditorBlockKey =
        currentBlockKey;

      if (shouldFocus) {
        cameraController.focusBlock(
          currentBlock,
          getResponsiveEditorZoom(),
        );

        return;
      }

      render();
    };

    const handleEditorStateChange =
      () => {
        synchronizeEditorCamera(
          false,
        );
      };

    const resizeCanvas = () => {
      const bounds =
        canvas.getBoundingClientRect();

      viewportWidth =
        bounds.width;

      viewportHeight =
        bounds.height;

      pixelRatio =
        window.devicePixelRatio || 1;

      canvas.width =
        Math.round(
          viewportWidth *
            pixelRatio,
        );

      canvas.height =
        Math.round(
          viewportHeight *
            pixelRatio,
        );

      if (!hasInitializedCamera) {
        initializeCamera();

        hasInitializedCamera =
          true;
      }

      synchronizeEditorCamera(
        true,
      );
    };

    const loadBoard = async () => {
      try {
        const claimedBlocks =
          await loadClaimedBlocks();

        if (hasBeenDisposed) {
          return;
        }

        replaceBlocks(
          claimedBlocks,
        );

        render();
      } catch (error) {
        if (hasBeenDisposed) {
          return;
        }

        console.warn(
          "Unable to load claimed Blocks from Supabase:",
          error,
        );
      }
    };

    const resizeObserver =
      new ResizeObserver(
        resizeCanvas,
      );

    const unsubscribeFromEditor =
      subscribeToEditor(
        handleEditorStateChange,
      );

    const unsubscribeFromClaim =
      subscribeToClaim(render);

    window.addEventListener(
      "board:zoom-in",
      handleZoomIn,
    );

    window.addEventListener(
      "board:zoom-out",
      handleZoomOut,
    );

    window.addEventListener(
      "board:recenter",
      handleRecenter,
    );

    window.addEventListener(
      "board:focus-claim-block",
      handleFocusClaimBlock,
    );

    window.addEventListener(
      "board:focus-owned-block",
      handleFocusOwnedBlock,
    );

    resizeObserver.observe(
      canvas,
    );

    resizeCanvas();

    void loadBoard();

    return () => {
      hasBeenDisposed = true;

      unsubscribeFromEditor();
      unsubscribeFromClaim();

      window.removeEventListener(
        "board:zoom-in",
        handleZoomIn,
      );

      window.removeEventListener(
        "board:zoom-out",
        handleZoomOut,
      );

      window.removeEventListener(
        "board:recenter",
        handleRecenter,
      );

      window.removeEventListener(
        "board:focus-claim-block",
        handleFocusClaimBlock,
      );

      window.removeEventListener(
        "board:focus-owned-block",
        handleFocusOwnedBlock,
      );

      resizeObserver.disconnect();

      cameraController.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="StillPoor board canvas"
      className="absolute inset-0 block h-full w-full touch-none cursor-grab active:cursor-grabbing"
    />
  );
}