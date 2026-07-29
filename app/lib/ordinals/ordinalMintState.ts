import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export type OrdinalMintMode =
  | "first"
  | "new-version";

export interface OrdinalMintState {
  isOpen: boolean;

  mode: OrdinalMintMode;

  block: BlockCoordinate | null;

  pixels: PixelColor[];
  description: string;

  targetVersion: number;

  expectedLatestVersion:
    number | null;
}

type OrdinalMintListener =
  () => void;

const closedOrdinalMintState: OrdinalMintState =
  {
    isOpen: false,

    mode: "first",

    block: null,

    pixels: [],
    description: "",

    targetVersion: 1,

    expectedLatestVersion:
      null,
  };

let ordinalMintState =
  closedOrdinalMintState;

const listeners =
  new Set<OrdinalMintListener>();

function notifyListeners() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}

export function getOrdinalMintState() {
  return ordinalMintState;
}

export function openFirstOrdinalMintModal({
  block,
  pixels,
  description,
}: {
  block: BlockCoordinate;

  pixels: readonly PixelColor[];

  description: string;
}) {
  ordinalMintState = {
    isOpen: true,

    mode: "first",

    block: {
      ...block,
    },

    pixels: [
      ...pixels,
    ],

    description,

    targetVersion: 1,

    expectedLatestVersion:
      null,
  };

  notifyListeners();
}

export function openNewOrdinalVersionMintModal({
  block,
  pixels,
  description,
  expectedLatestVersion,
}: {
  block: BlockCoordinate;

  pixels: readonly PixelColor[];

  description: string;

  expectedLatestVersion: number;
}) {
  ordinalMintState = {
    isOpen: true,

    mode: "new-version",

    block: {
      ...block,
    },

    pixels: [
      ...pixels,
    ],

    description,

    targetVersion:
      expectedLatestVersion + 1,

    expectedLatestVersion,
  };

  notifyListeners();
}

export function closeOrdinalMintModal() {
  if (!ordinalMintState.isOpen) {
    return;
  }

  ordinalMintState =
    closedOrdinalMintState;

  notifyListeners();
}

export function subscribeToOrdinalMint(
  listener: OrdinalMintListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}