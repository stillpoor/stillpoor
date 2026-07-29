"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  PIXELS_PER_BLOCK,
} from "../lib/board/boardTypes";

import type {
  Block,
} from "../lib/board/boardTypes";

interface BlockThumbnailProps {
  block: Pick<
    Block,
    | "pixels"
    | "latestInscriptionVersion"
  >;
}

export default function BlockThumbnail({
  block,
}: BlockThumbnailProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const isInscribed =
    block.latestInscriptionVersion >
    0;

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(
      0,
      0,
      PIXELS_PER_BLOCK,
      PIXELS_PER_BLOCK,
    );

    context.imageSmoothingEnabled =
      false;

    block.pixels.forEach(
      (
        pixelColor,
        pixelIndex,
      ) => {
        const row =
          Math.floor(
            pixelIndex /
              PIXELS_PER_BLOCK,
          );

        const column =
          pixelIndex %
          PIXELS_PER_BLOCK;

        context.fillStyle =
          pixelColor;

        context.fillRect(
          column,
          row,
          1,
          1,
        );
      },
    );
  }, [
    block.pixels,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={PIXELS_PER_BLOCK}
      height={PIXELS_PER_BLOCK}
      aria-hidden="true"
      className={
        isInscribed
          ? "h-12 w-12 shrink-0 rounded-md bg-white ring-2 ring-amber-400 ring-offset-1 ring-offset-white [image-rendering:pixelated]"
          : "h-12 w-12 shrink-0 rounded-md bg-white [image-rendering:pixelated]"
      }
    />
  );
}