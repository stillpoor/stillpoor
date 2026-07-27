import type {
  Block,
  BlockCoordinate,
} from "./boardTypes";

const blocks =
  new Map<string, Block>();

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

export function getBlocks() {
  return blocks.values();
}

export function setBlock(
  block: Block,
) {
  blocks.set(
    getBlockKey(block.coordinate),
    block,
  );
}

export function replaceBlocks(
  nextBlocks: Iterable<Block>,
) {
  blocks.clear();

  for (const block of nextBlocks) {
    setBlock(block);
  }
}

export function hasBlock(
  coordinate: BlockCoordinate,
) {
  return blocks.has(
    getBlockKey(coordinate),
  );
}