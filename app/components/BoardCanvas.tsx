"use client";

import { useEffect, useRef } from "react";

import { renderBoard } from "../lib/board/boardRender";
import { boardState } from "../lib/board/boardState";

import { CameraController } from "../lib/camera/cameraController";
import { cameraConfig } from "../lib/camera/cameraConfig";
import { cameraState } from "../lib/camera/cameraState";

import {
  getEditorState,
  subscribeToEditor,
} from "../lib/editor/editorState";

export default function BoardCanvas() {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

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

    const initializeCamera = () => {
      const horizontalMargin = 48;
      const verticalMargin = 48;

      const availableWidth =
        viewportWidth -
        horizontalMargin * 2;

      const availableHeight =
        viewportHeight -
        verticalMargin * 2;

      const fitZoom = Math.min(
        availableWidth /
          boardState.width,
        availableHeight /
          boardState.height,
      );

      cameraState.x = 0;
      cameraState.y = 0;

      cameraState.zoom = Math.max(
        cameraConfig.minZoom,
        Math.min(
          fitZoom,
          cameraConfig.maxZoom,
        ),
      );
    };

    const cameraController =
      new CameraController(
        canvas,
        render,
      );

    const getResponsiveEditorZoom = () => {
      /*
       * Ces valeurs seront affinées
       * pendant la passe UI.
       */
      const topControlsSpace = 220;
      const bottomControlsSpace = 280;
      const horizontalPadding = 48;
      const verticalPadding = 32;

      const availableWidth = Math.max(
        viewportWidth -
          horizontalPadding * 2,
        boardState.blockSize,
      );

      const availableHeight = Math.max(
        viewportHeight -
          topControlsSpace -
          bottomControlsSpace -
          verticalPadding * 2,
        boardState.blockSize,
      );

      const fitZoom = Math.min(
        availableWidth /
          boardState.blockSize,
        availableHeight /
          boardState.blockSize,
      );

      const minimumEditorZoom = Math.max(
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
        canvas.style.removeProperty("cursor");
        cameraController.setNavigationEnabled(
          true,
        );

        previousEditorIsActive = false;
        previousEditorBlockKey = null;

        render();
        return;
      }

      const currentBlock =
        editorState.blocks[
          editorState.currentBlockIndex
        ];

      if (!currentBlock) {
        cameraController.setNavigationEnabled(
          false,
        );

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
      canvas.style.cursor = "crosshair";
      cameraController.setNavigationEnabled(
        false,
      );

      previousEditorIsActive = true;
      previousEditorBlockKey =
        currentBlockKey;

      if (shouldFocus) {
        cameraController.focusBlock(
          currentBlock,
          getResponsiveEditorZoom(),
        );

        return;
      }

      /*
       * Une couleur, une description ou un pixel
       * a changé, mais la caméra reste en place.
       */
      render();
    };

    const handleEditorStateChange = () => {
      synchronizeEditorCamera(false);
    };

    const resizeCanvas = () => {
      const bounds =
        canvas.getBoundingClientRect();

      viewportWidth = bounds.width;
      viewportHeight = bounds.height;

      pixelRatio =
        window.devicePixelRatio || 1;

      canvas.width = Math.round(
        viewportWidth * pixelRatio,
      );

      canvas.height = Math.round(
        viewportHeight * pixelRatio,
      );

      if (!hasInitializedCamera) {
        initializeCamera();
        hasInitializedCamera = true;
      }

      /*
       * En cas de redimensionnement,
       * le Block édité doit être recentré
       * avec un zoom adapté au nouvel espace.
       */
      synchronizeEditorCamera(true);
    };

    const resizeObserver =
      new ResizeObserver(resizeCanvas);

    const unsubscribeFromEditor =
      subscribeToEditor(
        handleEditorStateChange,
      );

    resizeObserver.observe(canvas);
    resizeCanvas();

    return () => {
      unsubscribeFromEditor();
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