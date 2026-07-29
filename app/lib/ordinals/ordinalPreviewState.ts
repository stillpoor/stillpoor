import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export interface OrdinalPreviewState {
  block:
    BlockCoordinate | null;

  version:
    number | null;

  pixels:
    readonly PixelColor[] | null;
}

type OrdinalPreviewListener =
  () => void;

const emptyPreviewState:
  OrdinalPreviewState = {
    block: null,
    version: null,
    pixels: null,
  };

let previewState =
  emptyPreviewState;

const listeners =
  new Set<
    OrdinalPreviewListener
  >();

function notifyListeners() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}

export function getOrdinalPreviewState() {
  return previewState;
}

export function setOrdinalPreview({
  block,
  version,
  pixels,
}: {
  block: BlockCoordinate;
  version: number;
  pixels:
    readonly PixelColor[];
}) {
  previewState = {
    block: {
      ...block,
    },

    version,

    pixels: [
      ...pixels,
    ],
  };

  notifyListeners();
}

export function clearOrdinalPreview() {
  if (
    !previewState.block
  ) {
    return;
  }

  previewState =
    emptyPreviewState;

  notifyListeners();
}

export function subscribeToOrdinalPreview(
  listener:
    OrdinalPreviewListener,
) {
  listeners.add(
    listener,
  );

  return () => {
    listeners.delete(
      listener,
    );
  };
}