import { PIXELS_PER_BLOCK } from "../board/boardTypes";

import type { Point } from "../board/boardTypes";

export interface PixelCoordinate {
  row: number;
  column: number;
}

export function boardPointToPixel(
  boardPoint: Point,
  blockSize: number,
): PixelCoordinate {
  const localX =
    ((boardPoint.x % blockSize) + blockSize) %
    blockSize;

  const localY =
    ((boardPoint.y % blockSize) + blockSize) %
    blockSize;

  const pixelSize =
    blockSize / PIXELS_PER_BLOCK;

  return {
    row: Math.floor(localY / pixelSize),
    column: Math.floor(localX / pixelSize),
  };
}