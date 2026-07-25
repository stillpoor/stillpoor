import type {
  Block,
  BlockCoordinate,
} from "./boardTypes";

const blocks = new Map<string, Block>();

export function getBlockKey(
  coordinate: BlockCoordinate,
) {
  return `${coordinate.row}:${coordinate.column}`;
}

export function getBlock(
  coordinate: BlockCoordinate,
) {
  return blocks.get(
    getBlockKey(coordinate),
  );
}

export function setBlock(
  block: Block,
) {
  blocks.set(
    getBlockKey(block.coordinate),
    block,
  );
}

export function hasBlock(
  coordinate: BlockCoordinate,
) {
  return blocks.has(
    getBlockKey(coordinate),
  );
}

setBlock({
  coordinate: {
    row: 5,
    column: 8,
  },
  ownerWalletAddress:
    "bc1qstillpoor8x4w0r4k9example0000000001",
    pixels: [
    ...Array(128).fill("#ef4444"),
    ...Array(128).fill("#3b82f6"),
    ],
  description:
    "The first fake occupied Block used to test StillPoor.",
  claimedAt: "2026-07-20T10:30:00.000Z",
  updatedAt: "2026-07-20T10:30:00.000Z",
  claimTransactionId:
    "test-transaction-0001",
});

setBlock({
  coordinate: {
    row: 12,
    column: 20,
  },
  ownerWalletAddress:
    "bc1qstillpoor7m2v8n6p3example0000000002",
  pixels: Array(256).fill("#374151"),
  description:
    "A tiny place on the internet that belongs to someone.",
  claimedAt: "2026-07-21T14:15:00.000Z",
  updatedAt: "2026-07-22T09:45:00.000Z",
  claimTransactionId:
    "test-transaction-0002",
});

setBlock({
  coordinate: {
    row: 32,
    column: 42,
  },
  ownerWalletAddress:
    "bc1qstillpoor4k9x1c5z8example0000000003",
  pixels: Array(256).fill("#6b7280"),
  description: null,
  claimedAt: "2026-07-23T18:00:00.000Z",
  updatedAt: "2026-07-24T08:20:00.000Z",
  claimTransactionId:
    "test-transaction-0003",
});

