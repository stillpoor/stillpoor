import {
  getAppMode,
  setAppMode,
} from "../app/appState";

import type {
  BlockCoordinate,
} from "../board/boardTypes";

import type {
  ClaimState,
} from "./claimTypes";

type ClaimListener = () => void;

let claimState: ClaimState = {
  isActive: false,
  blocks: [],
};

const listeners =
  new Set<ClaimListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

function areSameBlock(
  firstBlock: BlockCoordinate,
  secondBlock: BlockCoordinate,
) {
  return (
    firstBlock.row ===
      secondBlock.row &&
    firstBlock.column ===
      secondBlock.column
  );
}

export function getClaimState() {
  return claimState;
}

export function startClaimMode() {
  if (getAppMode() === "editor") {
    return;
  }

  setAppMode("claim");

  claimState = {
    isActive: true,
    blocks: [],
  };

  notifyListeners();
}

export function enterClaimMode(
  block: BlockCoordinate,
) {
  setAppMode("claim");

  claimState = {
    isActive: true,
    blocks: [block],
  };

  notifyListeners();
}

export function toggleClaimBlock(
  block: BlockCoordinate,
) {
  if (getAppMode() !== "claim") {
    return;
  }

  const isAlreadySelected =
    claimState.blocks.some(
      (selectedBlock) =>
        areSameBlock(
          selectedBlock,
          block,
        ),
    );

  if (!isAlreadySelected) {
    claimState = {
      ...claimState,
      blocks: [
        ...claimState.blocks,
        block,
      ],
    };

    notifyListeners();
    return;
  }

  const remainingBlocks =
    claimState.blocks.filter(
      (selectedBlock) =>
        !areSameBlock(
          selectedBlock,
          block,
        ),
    );

  if (remainingBlocks.length === 0) {
    cancelClaim();
    return;
  }

  claimState = {
    ...claimState,
    blocks: remainingBlocks,
  };

  notifyListeners();
}

export function isBlockClaimed(
  block: BlockCoordinate,
) {
  return claimState.blocks.some(
    (selectedBlock) =>
      areSameBlock(
        selectedBlock,
        block,
      ),
  );
}

export function cancelClaim() {
  setAppMode("browsing");

  claimState = {
    isActive: false,
    blocks: [],
  };

  notifyListeners();
}

export function subscribeToClaim(
  listener: ClaimListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}