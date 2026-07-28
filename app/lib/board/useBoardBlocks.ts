"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getBlocksSnapshot,
  subscribeToBlocks,
} from "./boardStore";

import type {
  Block,
} from "./boardTypes";

const serverBlocks:
  readonly Block[] = [];

function getServerBlocks() {
  return serverBlocks;
}

export function useBoardBlocks() {
  return useSyncExternalStore(
    subscribeToBlocks,
    getBlocksSnapshot,
    getServerBlocks,
  );
}