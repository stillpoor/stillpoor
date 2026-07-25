"use client";

import { useSyncExternalStore } from "react";

import {
  getClaimState,
  subscribeToClaim,
} from "./claimState";

import type { ClaimState } from "./claimTypes";

const serverClaimState: ClaimState = {
  isActive: false,
  blocks: [],
};

function getServerClaimState() {
  return serverClaimState;
}

export function useClaimState() {
  return useSyncExternalStore(
    subscribeToClaim,
    getClaimState,
    getServerClaimState,
  );
}