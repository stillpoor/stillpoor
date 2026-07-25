import type { BlockCoordinate } from "../board/boardTypes";

type SelectionListener = () => void;

let selectedBlock: BlockCoordinate | null = null;

const listeners = new Set<SelectionListener>();

export function getSelectedBlock() {
  return selectedBlock;
}

export function setSelectedBlock(
  block: BlockCoordinate | null,
) {
  selectedBlock = block;

  listeners.forEach((listener) => {
    listener();
  });
}

export function subscribeToSelection(
  listener: SelectionListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}