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
  loadOrdinalActivity,
} from "../lib/ordinals/ordinalActivityApi";

import {
  loadPublicWalletProfiles,
} from "../lib/profile/publicProfileApi";

import {
  setSelectedBlock,
} from "../lib/selection/selectionState";

import type {
  Block,
  BlockCoordinate,
  PixelColor,
} from "../lib/board/boardTypes";

import type {
  OrdinalActivity,
} from "../lib/ordinals/ordinalActivityApi";

type ActivityFilter =
  | "all"
  | "blocks"
  | "ordinals";

type ActivityType =
  | "block"
  | "ordinal";

interface ActivityMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileUpdatedEventDetail {
  paymentAddress: string;
  username: string | null;
}

interface ActivityItem {
  id: string;
  type: ActivityType;

  timestamp: string;

  blockNumber: number;
  coordinate: BlockCoordinate;

  ownerWalletAddress: string;

  pixels: PixelColor[];

  latestInscriptionVersion: number;

  ordinalVersion: number | null;
  inscriptionId: string | null;
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
  activityDate: string,
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
    new Date(activityDate),
  );
}

function formatInscriptionId(
  inscriptionId: string,
) {
  return `${inscriptionId.slice(
    0,
    10,
  )}…${inscriptionId.slice(-8)}`;
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
    ordinalActivities,
    setOrdinalActivities,
  ] = useState<
    OrdinalActivity[]
  >([]);

  const [
    isOrdinalActivityLoading,
    setIsOrdinalActivityLoading,
  ] = useState(false);

  const [
    ordinalActivityError,
    setOrdinalActivityError,
  ] = useState<string | null>(
    null,
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

  const ordinalStateKey =
    useMemo(
      () =>
        boardBlocks
          .map(
            (block) =>
              `${block.coordinate.row}:${block.coordinate.column}:${block.latestInscriptionVersion}:${block.inscriptionPending}`,
          )
          .sort()
          .join("|"),
      [
        boardBlocks,
      ],
    );

  const blockActivityItems =
    useMemo<ActivityItem[]>(
      () =>
        sortedBlocks.map(
          (block) => ({
            id:
              `block:${block.coordinate.row}:${block.coordinate.column}`,

            type: "block",

            timestamp:
              block.claimedAt,

            blockNumber:
              getPublicBlockNumber(
                block,
              ),

            coordinate: {
              ...block.coordinate,
            },

            ownerWalletAddress:
              block.ownerWalletAddress,

            pixels: [
              ...block.pixels,
            ],

            latestInscriptionVersion:
              block.latestInscriptionVersion,

            ordinalVersion: null,
            inscriptionId: null,
          }),
        ),
      [
        sortedBlocks,
      ],
    );

  const ordinalActivityItems =
    useMemo<ActivityItem[]>(
      () =>
        ordinalActivities.map(
          (activity) => ({
            id:
              `ordinal:${activity.id}`,

            type: "ordinal",

            timestamp:
              activity.confirmedAt,

            blockNumber:
              activity.blockNumber,

            coordinate: {
              ...activity.coordinate,
            },

            ownerWalletAddress:
              activity.ownerWalletAddress,

            pixels: [
              ...activity.pixels,
            ],

            latestInscriptionVersion:
              activity.version,

            ordinalVersion:
              activity.version,

            inscriptionId:
              activity.inscriptionId,
          }),
        ),
      [
        ordinalActivities,
      ],
    );

  const visibleActivities =
    useMemo(() => {
      if (
        activeFilter ===
        "blocks"
      ) {
        return blockActivityItems;
      }

      if (
        activeFilter ===
        "ordinals"
      ) {
        return ordinalActivityItems;
      }

      return [
        ...blockActivityItems,
        ...ordinalActivityItems,
      ].sort(
        (
          firstActivity,
          secondActivity,
        ) =>
          new Date(
            secondActivity.timestamp,
          ).getTime() -
          new Date(
            firstActivity.timestamp,
          ).getTime(),
      );
    }, [
      activeFilter,
      blockActivityItems,
      ordinalActivityItems,
    ]);

  const ownerPaymentAddresses =
    useMemo(
      () => [
        ...new Set(
          [
            ...blockActivityItems,
            ...ordinalActivityItems,
          ].map(
            (activity) =>
              activity.ownerWalletAddress,
          ),
        ),
      ],
      [
        blockActivityItems,
        ordinalActivityItems,
      ],
    );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
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

    setIsOrdinalActivityLoading(
      true,
    );

    setOrdinalActivityError(
      null,
    );

    void loadOrdinalActivity()
      .then((activities) => {
        if (!isActive) {
          return;
        }

        setOrdinalActivities(
          activities,
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setOrdinalActivityError(
          error instanceof Error
            ? error.message
            : "Unable to load Ordinal activity.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsOrdinalActivityLoading(
            false,
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    isOpen,
    ordinalStateKey,
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

  const handleActivityClick = (
    activity: ActivityItem,
  ) => {
    setSelectedBlock(
      activity.coordinate,
    );

    window.dispatchEvent(
      new CustomEvent(
        "board:focus-owned-block",
        {
          detail: {
            block:
              activity.coordinate,
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

  const showOrdinalLoading =
    activeFilter === "ordinals" &&
    isOrdinalActivityLoading &&
    ordinalActivityItems.length ===
      0;

  const showOrdinalError =
    activeFilter === "ordinals" &&
    Boolean(
      ordinalActivityError,
    );

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
            {visibleActivities.length}
          </p>
        </div>

        {showOrdinalLoading ? (
          <p className="rounded-xl bg-black/5 px-3 py-4 text-sm text-black/55">
            Loading Ordinal activity...
          </p>
        ) : showOrdinalError ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-4 text-sm text-red-600"
          >
            {ordinalActivityError}
          </p>
        ) : visibleActivities.length ===
          0 ? (
          <p className="rounded-xl bg-black/5 px-3 py-4 text-sm text-black/55">
            {activeFilter ===
            "ordinals"
              ? "No Ordinal activity yet."
              : "No Block activity yet."}
          </p>
        ) : (
          <div className="space-y-1">
            {visibleActivities.map(
              (activity) => {
                const ownerUsername =
                  ownerUsernames[
                    activity
                      .ownerWalletAddress
                  ] ?? null;

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() =>
                      handleActivityClick(
                        activity,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                  >
                    <BlockThumbnail
  block={{
    pixels:
      activity.pixels,

    latestInscriptionVersion:
      activity.type === "ordinal"
        ? activity.latestInscriptionVersion
        : 0,
  }}
/>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-black">
                        Block #
                        {
                          activity.blockNumber
                        }{" "}
                        {activity.type ===
                        "ordinal"
                          ? "inscribed"
                          : "claimed"}
                      </span>

                      {activity.type ===
                        "ordinal" &&
                        activity.ordinalVersion && (
                          <span className="mt-0.5 block text-xs font-semibold text-amber-700">
                            Ordinal v
                            {
                              activity.ordinalVersion
                            }
                          </span>
                        )}

                      {ownerUsername && (
                        <span className="mt-0.5 block truncate text-xs font-semibold text-black/65">
                          {ownerUsername}
                        </span>
                      )}

                      <span
                        title={
                          activity
                            .ownerWalletAddress
                        }
                        className="mt-0.5 block truncate font-mono text-xs text-black/45"
                      >
                        {formatWalletAddress(
                          activity
                            .ownerWalletAddress,
                        )}
                      </span>

                      {activity.inscriptionId && (
                        <span
                          title={
                            activity.inscriptionId
                          }
                          className="mt-0.5 block truncate font-mono text-xs text-black/40"
                        >
                          Inscription{" "}
                          {formatInscriptionId(
                            activity.inscriptionId,
                          )}
                        </span>
                      )}

                      <span className="mt-0.5 block text-xs text-black/40">
                        {formatActivityDate(
                          activity.timestamp,
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