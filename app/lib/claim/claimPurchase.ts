import {
  getBlockKey,
  hasBlock,
  setBlock,
} from "../board/boardStore";
import {
  PIXELS_PER_BLOCK,
} from "../board/boardTypes";
import {
  startEditor,
} from "../editor/editorState";
import {
  cancelClaim,
  getClaimState,
} from "./claimState";

import type {
  Block,
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";
import type {
  BlockDraft,
} from "../editor/editorTypes";

const simulatedOwnerWalletAddress =
  "bc1qstillpoorcurrentuser0000000000000000001";

const defaultPixelColor: PixelColor = "#ffffff";

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const blocksPerRow = 64;

  return (
    block.row * blocksPerRow +
    block.column +
    1
  );
}

export function simulateClaimPurchase() {
  const claimState = getClaimState();

  if (
    !claimState.isActive ||
    claimState.blocks.length === 0
  ) {
    return;
  }

  const unavailableBlock =
    claimState.blocks.find((block) =>
      hasBlock(block),
    );

  if (unavailableBlock) {
    console.error(
      "Claim failed: Block is no longer available.",
      unavailableBlock,
    );

    return;
  }

  const purchasedBlocks = [
    ...claimState.blocks,
  ].sort(
    (firstBlock, secondBlock) =>
      getPublicBlockNumber(firstBlock) -
      getPublicBlockNumber(secondBlock),
  );

  const drafts =
    new Map<string, BlockDraft>();

  const timestamp = new Date().toISOString();

  purchasedBlocks.forEach((coordinate) => {
    const pixels = Array(
      PIXELS_PER_BLOCK *
        PIXELS_PER_BLOCK,
    ).fill(defaultPixelColor) as PixelColor[];

    const block: Block = {
      coordinate,
      ownerWalletAddress:
        simulatedOwnerWalletAddress,
      pixels,
      description: null,
      claimedAt: timestamp,
      updatedAt: timestamp,
      claimTransactionId:
        `simulated-${getBlockKey(coordinate)}`,
    };

    setBlock(block);

    drafts.set(
      getBlockKey(coordinate),
      {
        pixels: [...pixels],
        description: "",
      },
    );
  });

  cancelClaim();

  startEditor(
    purchasedBlocks,
    drafts,
  );
}