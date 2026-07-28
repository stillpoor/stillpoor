import type {
  Block,
  BlockCoordinate,
} from "./boardTypes";

type BoardListener = () => void;

const blocks =
  new Map<string, Block>();

const listeners =
  new Set<BoardListener>();

let blocksSnapshot:
  readonly Block[] = [];

function notifyListeners() {
  blocksSnapshot =
    Array.from(blocks.values());

  listeners.forEach((listener) => {
    listener();
  });
}

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

export function getBlocksSnapshot() {
  return blocksSnapshot;
}

export function setBlock(
  block: Block,
) {
  blocks.set(
    getBlockKey(block.coordinate),
    block,
  );

  notifyListeners();
}

export function replaceBlocks(
  nextBlocks: Iterable<Block>,
) {
  blocks.clear();

  for (const block of nextBlocks) {
    blocks.set(
      getBlockKey(
        block.coordinate,
      ),
      block,
    );
  }

  notifyListeners();
}

export function hasBlock(
  coordinate: BlockCoordinate,
) {
  return blocks.has(
    getBlockKey(coordinate),
  );
}

export function subscribeToBlocks(
  listener: BoardListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}