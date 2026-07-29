"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getOrdinalMintState,
  subscribeToOrdinalMint,
} from "./ordinalMintState";

export function useOrdinalMintState() {
  return useSyncExternalStore(
    subscribeToOrdinalMint,
    getOrdinalMintState,
    getOrdinalMintState,
  );
}