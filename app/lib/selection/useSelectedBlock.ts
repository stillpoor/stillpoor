"use client";

import { useSyncExternalStore } from "react";

import {
  getSelectedBlock,
  subscribeToSelection,
} from "./selectionState";

function getServerSelectedBlock() {
  return null;
}

export function useSelectedBlock() {
  return useSyncExternalStore(
    subscribeToSelection,
    getSelectedBlock,
    getServerSelectedBlock,
  );
}