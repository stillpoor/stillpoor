import type { BlockCoordinate } from "../board/boardTypes";

export interface ClaimState {
  isActive: boolean;
  blocks: BlockCoordinate[];
}