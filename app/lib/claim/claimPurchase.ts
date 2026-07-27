import { boardConfig } from "../board/boardConfig";
import {
  getBlockKey,
  setBlock,
} from "../board/boardStore";

import {
  startEditor,
} from "../editor/editorState";

import {
  cancelClaim,
} from "./claimState";

import type {
  Block,
  BlockCoordinate,
} from "../board/boardTypes";
import type {
  BlockDraft,
} from "../editor/editorTypes";

function getPublicBlockNumber(
  block: BlockCoordinate,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.row * blocksPerRow +
    block.column +
    1
  );
}

export function completeSimulatedClaimPurchase(
  claimedBlocks: readonly Block[],
) {
  if (claimedBlocks.length === 0) {
    return false;
  }

  const purchasedBlocks =
    claimedBlocks
      .map((block) => ({
        ...block,

        coordinate: {
          ...block.coordinate,
        },

        pixels: [
          ...block.pixels,
        ],
      }))
      .sort(
        (firstBlock, secondBlock) =>
          getPublicBlockNumber(
            firstBlock.coordinate,
          ) -
          getPublicBlockNumber(
            secondBlock.coordinate,
          ),
      );

  const drafts =
    new Map<string, BlockDraft>();

  purchasedBlocks.forEach((block) => {
    setBlock(block);

    drafts.set(
      getBlockKey(block.coordinate),
      {
        pixels: [
          ...block.pixels,
        ],

        description:
          block.description ?? "",
      },
    );
  });

  cancelClaim();

  startEditor(
    purchasedBlocks.map(
      (block) => ({
        ...block.coordinate,
      }),
    ),
    drafts,
  );

  return true;
}