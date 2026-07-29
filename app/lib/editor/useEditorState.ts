"use client";

import { useSyncExternalStore } from "react";

import { editorConfig } from "./editorConfig";
import {
  getEditorState,
  subscribeToEditor,
} from "./editorState";

import type { EditorState } from "./editorTypes";

const serverEditorState: EditorState = {
  isActive: false,

  blocks: [],
  currentBlockIndex: 0,

  selectedColor: "#030712",

  drafts: new Map(),

  saveMode: "standard",

  expectedLatestInscriptionVersion:
    null,
};

function getServerEditorState() {
  return serverEditorState;
}

export function useEditorState() {
  return useSyncExternalStore(
    subscribeToEditor,
    getEditorState,
    getServerEditorState,
  );
}