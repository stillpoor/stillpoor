import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export type EditorSaveMode =
  | "standard"
  | "ordinal-version";

export interface BlockDraft {
  pixels: PixelColor[];
  description: string;
}

export interface EditorState {
  isActive: boolean;

  blocks: BlockCoordinate[];
  currentBlockIndex: number;

  selectedColor: PixelColor;

  drafts: Map<
    string,
    BlockDraft
  >;

  saveMode: EditorSaveMode;

  expectedLatestInscriptionVersion:
    number | null;
}