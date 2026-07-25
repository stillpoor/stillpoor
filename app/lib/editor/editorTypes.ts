import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export interface BlockDraft {
  pixels: PixelColor[];
  description: string;
}

export interface EditorState {
  isActive: boolean;
  blocks: BlockCoordinate[];
  currentBlockIndex: number;
  selectedColor: PixelColor;
  drafts: Map<string, BlockDraft>;
}