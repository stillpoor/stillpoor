"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import BlockThumbnail from "./BlockThumbnail";

import {
  boardConfig,
} from "../lib/board/boardConfig";

import {
  useBoardBlocks,
} from "../lib/board/useBoardBlocks";

import {
  loadPublicWalletProfiles,
} from "../lib/profile/publicProfileApi";

import {
  setSelectedBlock,
} from "../lib/selection/selectionState";

import type {
  Block,
} from "../lib/board/boardTypes";

type ActivityFilter =
  | "all"
  | "blocks"
  | "ordinals";

interface ActivityMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileUpdatedEventDetail {
  paymentAddress: string;
  username: string | null;
}

function getPublicBlockNumber(
  block: Block,
) {
  const blocksPerRow =
    boardConfig.width /
    boardConfig.blockSize;

  return (
    block.coordinate.row *
      blocksPerRow +
    block.coordinate.column +
    1
  );
}

function formatWalletAddress(
  walletAddress: string,
) {
  return `${walletAddress.slice(
    0,
    6,
  )}…${walletAddress.slice(-6)}`;
}

function formatActivityDate(
  claimedAt: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(claimedAt),
  );
}

export default function ActivityMenu({
  isOpen,
  onClose,
}: ActivityMenuProps) {
  const boardBlocks =
    useBoardBlocks();

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<ActivityFilter>(
    "all",
  );

  const [
    ownerUsernames,
    setOwnerUsernames,
  ] = useState<
    Record<string, string | null>
  >({});

  const sortedBlocks =
    useMemo(
      () =>
        [...boardBlocks].sort(
          (
            firstBlock,
            secondBlock,
          ) =>
            new Date(
              secondBlock.claimedAt,
            ).getTime() -
            new Date(
              firstBlock.claimedAt,
            ).getTime(),
        ),
      [
        boardBlocks,
      ],
    );

  const ownerPaymentAddresses =
    useMemo(
      () => [
        ...new Set(
          sortedBlocks.map(
            (block) =>
              block.ownerWalletAddress,
          ),
        ),
      ],
      [
        sortedBlocks,
      ],
    );

  const visibleBlocks =
    activeFilter === "ordinals"
      ? []
      : sortedBlocks;

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;

    void loadPublicWalletProfiles(
      ownerPaymentAddresses,
    )
      .then((profiles) => {
        if (!isActive) {
          return;
        }

        setOwnerUsernames(
          profiles,
        );
      })
      .catch((error) => {
        console.warn(
          "Unable to load Activity usernames:",
          error,
        );

        if (isActive) {
          setOwnerUsernames({});
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    isOpen,
    ownerPaymentAddresses,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleProfileUpdated = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<ProfileUpdatedEventDetail>;

      const paymentAddress =
        customEvent.detail
          ?.paymentAddress;

      if (!paymentAddress) {
        return;
      }

      setOwnerUsernames(
        (
          currentUsernames,
        ) => ({
          ...currentUsernames,

          [paymentAddress]:
            customEvent.detail
              .username,
        }),
      );
    };

    window.addEventListener(
      "profile:updated",
      handleProfileUpdated,
    );

    return () => {
      window.removeEventListener(
        "profile:updated",
        handleProfileUpdated,
      );
    };
  }, [
    isOpen,
  ]);

  const handleBlockClick = (
    block: Block,
  ) => {
    setSelectedBlock(
      block.coordinate,
    );

    window.dispatchEvent(
      new CustomEvent(
        "board:focus-owned-block",
        {
          detail: {
            block:
              block.coordinate,
          },
        },
      ),
    );
  };

  if (!isOpen) {
    return null;
  }

  const filters: {
    value: ActivityFilter;
    label: string;
  }[] = [
    {
      value: "all",
      label: "All",
    },
    {
      value: "blocks",
      label: "Blocks",
    },
    {
      value: "ordinals",
      label: "Ordinals",
    },
  ];

  return (
    <div
      role="dialog"
      aria-label="Activity"
      className="absolute top-full right-0 z-20 mt-2 flex max-h-[calc(100vh-7rem)] w-80 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-md"
    >
      <header className="relative border-b border-black/10 px-4 py-4 pr-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          Activity
        </p>

        <p className="mt-1 text-sm font-semibold text-black">
          Latest Board activity
        </p>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Activity menu"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-black/50 transition hover:bg-black/5 hover:text-black"
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
      </header>

      <section className="border-b border-black/10 p-3">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1">
          {filters.map(
            (filter) => {
              const isSelected =
                activeFilter ===
                filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() =>
                    setActiveFilter(
                      filter.value,
                    )
                  }
                  aria-pressed={
                    isSelected
                  }
                  className={
                    isSelected
                      ? "rounded-md bg-white px-2 py-1.5 text-xs font-semibold text-black shadow-sm"
                      : "rounded-md px-2 py-1.5 text-xs font-medium text-black/50 transition hover:text-black"
                  }
                >
                  {filter.label}
                </button>
              );
            },
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            Recent
          </p>

          <p className="text-xs font-semibold text-black/45">
            {visibleBlocks.length}
          </p>
        </div>

        {activeFilter ===
        "ordinals" ? (
          <p className="rounded-xl bg-black/5 px-3 py-4 text-sm leading-5 text-black/55">
            Ordinal activity will
            appear here after
            inscriptions launch.
          </p>
        ) : visibleBlocks.length ===
          0 ? (
          <p className="rounded-xl bg-black/5 px-3 py-4 text-sm text-black/55">
            No Block activity yet.
          </p>
        ) : (
          <div className="space-y-1">
            {visibleBlocks.map(
              (block) => {
                const blockNumber =
                  getPublicBlockNumber(
                    block,
                  );

                const ownerUsername =
                  ownerUsernames[
                    block
                      .ownerWalletAddress
                  ] ?? null;

                return (
                  <button
                    key={`${block.coordinate.row}:${block.coordinate.column}`}
                    type="button"
                    onClick={() =>
                      handleBlockClick(
                        block,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                  >
                    <BlockThumbnail
                      block={block}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-black">
                        Block #
                        {blockNumber} claimed
                      </span>

                      {ownerUsername && (
                        <span className="mt-0.5 block truncate text-xs font-semibold text-black/65">
                          {ownerUsername}
                        </span>
                      )}

                      <span
                        title={
                          block
                            .ownerWalletAddress
                        }
                        className="mt-0.5 block truncate font-mono text-xs text-black/45"
                      >
                        {formatWalletAddress(
                          block
                            .ownerWalletAddress,
                        )}
                      </span>

                      <span className="mt-0.5 block text-xs text-black/40">
                        {formatActivityDate(
                          block.claimedAt,
                        )}
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}