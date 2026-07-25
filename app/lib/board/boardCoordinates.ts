import { boardConfig } from "./boardConfig";

import type { CameraState } from "../camera/cameraTypes";
import type {
  BlockCoordinate,
  Point,
} from "./boardTypes";

interface ViewportSize {
  width: number;
  height: number;
}

export function screenToBoard(
  screenX: number,
  screenY: number,
  viewport: ViewportSize,
  camera: CameraState,
): Point {
  return {
    x:
      (screenX - viewport.width / 2 - camera.x) /
        camera.zoom +
      boardConfig.width / 2,

    y:
      (screenY - viewport.height / 2 - camera.y) /
        camera.zoom +
      boardConfig.height / 2,
  };
}

export function boardToScreen(
  boardX: number,
  boardY: number,
  viewport: ViewportSize,
  camera: CameraState,
): Point {
  return {
    x:
      viewport.width / 2 +
      camera.x +
      (boardX - boardConfig.width / 2) *
        camera.zoom,

    y:
      viewport.height / 2 +
      camera.y +
      (boardY - boardConfig.height / 2) *
        camera.zoom,
  };
}

export function boardPointToBlock(
  point: Point,
): BlockCoordinate | null {
  const isOutsideBoard =
    point.x < 0 ||
    point.y < 0 ||
    point.x >= boardConfig.width ||
    point.y >= boardConfig.height;

  if (isOutsideBoard) {
    return null;
  }

  return {
    column: Math.floor(
      point.x / boardConfig.blockSize,
    ),
    row: Math.floor(
      point.y / boardConfig.blockSize,
    ),
  };
}