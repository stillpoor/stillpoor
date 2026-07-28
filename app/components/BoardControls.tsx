"use client";

interface BoardControlsProps {
  disabled: boolean;
}

function dispatchBoardEvent(
  eventName: string,
) {
  window.dispatchEvent(
    new Event(eventName),
  );
}

export default function BoardControls({
  disabled,
}: BoardControlsProps) {
  return (
    <div
      role="group"
      aria-label="Board controls"
      className="pointer-events-auto absolute bottom-8 left-8 flex overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-lg backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() =>
          dispatchBoardEvent(
            "board:zoom-out",
          )
        }
        disabled={disabled}
        aria-label="Zoom out"
        title="Zoom out"
        className="flex h-11 w-11 items-center justify-center border-r border-black/10 text-black transition hover:bg-black/5 disabled:cursor-default disabled:opacity-30"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            d="M6 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={() =>
          dispatchBoardEvent(
            "board:recenter",
          )
        }
        disabled={disabled}
        aria-label="Recenter board"
        title="Recenter board"
        className="flex h-11 w-11 items-center justify-center border-r border-black/10 text-black transition hover:bg-black/5 disabled:cursor-default disabled:opacity-30"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle
            cx="12"
            cy="12"
            r="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={() =>
          dispatchBoardEvent(
            "board:zoom-in",
          )
        }
        disabled={disabled}
        aria-label="Zoom in"
        title="Zoom in"
        className="flex h-11 w-11 items-center justify-center text-black transition hover:bg-black/5 disabled:cursor-default disabled:opacity-30"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            d="M12 6v12M6 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}