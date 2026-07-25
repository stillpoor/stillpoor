import { boardConfig } from "./boardConfig";
import type { BoardState } from "./boardTypes";

export const boardState: BoardState = {
  width: boardConfig.width,
  height: boardConfig.height,
  blockSize: boardConfig.blockSize,
};