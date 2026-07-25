import type { BlockCoordinate } from "../board/boardTypes";

export interface SelectionState {
  block: BlockCoordinate | null;
}