import { useEffect, useState } from "react";

import {
  getHoveredPixel,
  subscribeToHoveredPixel,
} from "./editorHoverState";

export function useHoveredPixel() {
  const [hoveredPixel, setHoveredPixel] =
    useState(getHoveredPixel());

  useEffect(() => {
    return subscribeToHoveredPixel(() => {
      setHoveredPixel(
        getHoveredPixel(),
      );
    });
  }, []);

  return hoveredPixel;
}