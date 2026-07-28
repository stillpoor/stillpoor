"use client";

import {
  useEffect,
} from "react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({
  isOpen,
  onClose,
}: AboutModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isOpen,
    onClose,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/25 p-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="relative max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close About"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg text-black/50 transition hover:bg-black/5 hover:text-black"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          About
        </p>

        <h2
          id="about-title"
          className="mt-2 pr-10 text-2xl font-semibold tracking-[-0.03em] text-black"
        >
          StillPoor
        </h2>

        <p className="mt-4 text-sm leading-6 text-black/65">
          StillPoor is a community-owned
          Bitcoin pixel board. Claim a
          Block, create your artwork and
          leave your mark on the board.
        </p>

        <div className="mt-6 rounded-xl bg-black/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            Block pricing
          </p>

          <p className="mt-2 text-sm leading-6 text-black/70">
            Blocks start at 0.001 BTC.
            The price increases by
            0.0001 BTC every 100 Blocks
            sold, up to 0.005 BTC.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <a
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-black transition hover:bg-black/5"
          >
            <span>Follow StillPoor on X</span>

            <span aria-hidden="true">
              ↗
            </span>
          </a>

          <a
            href="mailto:support@stillpoor.place"
            className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-black transition hover:bg-black/5"
          >
            <span>
              support@stillpoor.place
            </span>

            <span aria-hidden="true">
              ↗
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}