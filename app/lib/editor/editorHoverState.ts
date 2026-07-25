import type { PixelCoordinate } from "./editorCoordinates";

type Listener = () => void;

let hoveredPixel: PixelCoordinate | null =
  null;

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) =>
    listener(),
  );
}

export function getHoveredPixel() {
  return hoveredPixel;
}

export function setHoveredPixel(
  pixel: PixelCoordinate | null,
) {
  if (
    hoveredPixel?.row === pixel?.row &&
    hoveredPixel?.column === pixel?.column
  ) {
    return;
  }

  hoveredPixel = pixel;

  notify();
}

export function subscribeToHoveredPixel(
  listener: Listener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}