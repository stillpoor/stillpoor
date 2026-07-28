"use client";

import Image from "next/image";

import {
  useState,
} from "react";

import AboutModal from "./AboutModal";
import BlockEditor from "./BlockEditor";
import BlockInspector from "./BlockInspector";
import BoardControls from "./BoardControls";
import BoardStatsHUD from "./BoardStatsHUD";
import PaymentModal from "./PaymentModal";
import WalletButton from "./WalletButton";

import {
  useEditorState,
} from "../lib/editor/useEditorState";

import {
  useSelectedBlock,
} from "../lib/selection/useSelectedBlock";

export default function HUD() {
  const editorState =
    useEditorState();

  const selectedBlock =
    useSelectedBlock();

  const [
    isAboutOpen,
    setIsAboutOpen,
  ] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute top-8 left-8">
        <div className="flex flex-col items-start gap-5">
          <Image
            src="/stillpoor-logo.svg"
            alt="StillPoor"
            width={396}
            height={123}
            priority
            className="h-[32px] w-auto"
          />

          <BoardStatsHUD />
        </div>
      </div>

      <div className="pointer-events-auto absolute top-8 right-8 flex items-start gap-2">
        <button
          type="button"
          onClick={() =>
            setIsAboutOpen(true)
          }
          className="rounded-lg border border-black/10 bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          About
        </button>

        <WalletButton />
      </div>

      {editorState.isActive ? (
        <BlockEditor />
      ) : (
        selectedBlock && (
          <BlockInspector
            block={selectedBlock}
          />
        )
      )}

      <BoardControls
        disabled={editorState.isActive}
      />

      <PaymentModal />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() =>
          setIsAboutOpen(false)
        }
      />
    </div>
  );
}