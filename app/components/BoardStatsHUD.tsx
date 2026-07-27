"use client";

import {
  useEffect,
  useState,
} from "react";

interface BoardStats {
  currentWealthSats: number;

  availableBlocks: number;
  claimedBlocks: number;
  activeReservedBlocks: number;

  currentPriceSats: number | null;
  nextPriceSats: number | null;

  blocksUntilPriceIncrease:
    | number
    | null;

  nextAvailableBlockNumber:
    | number
    | null;

  soldOut: boolean;
}

const numberFormatter =
  new Intl.NumberFormat("en-GB");

function formatBtcFromSats(
  sats: number | null,
) {
  if (sats === null) {
    return "—";
  }

  const wholeBtc =
    Math.floor(
      sats / 100_000_000,
    );

  const fractionalBtc =
    String(
      sats % 100_000_000,
    )
      .padStart(8, "0")
      .replace(/0+$/, "");

  return fractionalBtc
    ? `${wholeBtc}.${fractionalBtc}`
    : `${wholeBtc}`;
}

export default function BoardStatsHUD() {
  const [
    stats,
    setStats,
  ] = useState<BoardStats | null>(
    null,
  );

  const [
    hasError,
    setHasError,
  ] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      try {
        const response =
          await fetch(
            "/api/board-stats",
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load Board statistics.",
          );
        }

        const nextStats =
          (await response.json()) as BoardStats;

        if (!isActive) {
          return;
        }

        setStats(nextStats);
        setHasError(false);
      } catch (error) {
        console.error(
          "Unable to load Board statistics:",
          error,
        );

        if (isActive) {
          setHasError(true);
        }
      }
    }

    function refreshStats() {
      void loadStats();
    }

    void loadStats();

    const refreshInterval =
      window.setInterval(
        refreshStats,
        15_000,
      );

    window.addEventListener(
      "focus",
      refreshStats,
    );

    window.addEventListener(
      "board-stats:refresh",
      refreshStats,
    );

    return () => {
      isActive = false;

      window.clearInterval(
        refreshInterval,
      );

      window.removeEventListener(
        "focus",
        refreshStats,
      );

      window.removeEventListener(
        "board-stats:refresh",
        refreshStats,
      );
    };
  }, []);

  return (
    <div className="flex w-[270px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      <section className="rounded-2xl border border-black/10 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          Current Wealth
        </p>

        <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-black">
          ₿{" "}
          {stats
            ? formatBtcFromSats(
                stats.currentWealthSats,
              )
            : "—"}
        </p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md">
        <div className="flex items-end justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            Available Blocks
          </p>

          <p className="text-3xl font-semibold tracking-[-0.05em] text-black">
            {stats
              ? numberFormatter.format(
                  stats.availableBlocks,
                )
              : "—"}
          </p>
        </div>

        {stats?.soldOut ? (
          <p className="mt-4 border-t border-black/10 pt-4 text-sm font-semibold text-black">
            Sold out
          </p>
        ) : stats &&
          stats.availableBlocks === 0 ? (
          <p className="mt-4 border-t border-black/10 pt-4 text-sm font-medium text-black/60">
            No Blocks available right now
          </p>
        ) : (
          <dl className="mt-4 space-y-2 border-t border-black/10 pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-black/50">
                Current price
              </dt>

              <dd className="font-semibold text-black">
                ₿{" "}
                {stats
                  ? formatBtcFromSats(
                      stats.currentPriceSats,
                    )
                  : "—"}
              </dd>
            </div>

            {stats?.nextPriceSats !==
            null ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-black/50">
                    Next price
                  </dt>

                  <dd className="font-semibold text-black">
                    ₿{" "}
                    {stats
                      ? formatBtcFromSats(
                          stats.nextPriceSats,
                        )
                      : "—"}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-black/50">
                    Price increases in
                  </dt>

                  <dd className="font-semibold text-black">
                    {stats?.blocksUntilPriceIncrease ??
                      "—"}{" "}
                    Blocks
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/50">
                  Pricing
                </dt>

                <dd className="font-semibold text-black">
                  Maximum tier
                </dd>
              </div>
            )}
          </dl>
        )}

        {hasError && (
          <p className="mt-3 text-xs font-medium text-red-600">
            Unable to refresh
          </p>
        )}
      </section>
    </div>
  );
}