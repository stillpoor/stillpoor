"use client";

import Image from "next/image";

import {
  useEffect,
  useState,
} from "react";

import AboutModal from "./AboutModal";
import ActivityMenu from "./ActivityMenu";
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

interface HudPanelOpenedEventDetail {
  panel:
    | "about"
    | "activity"
    | "profile";
}

function dispatchPanelOpened(
  panel: HudPanelOpenedEventDetail["panel"],
) {
  window.dispatchEvent(
    new CustomEvent(
      "hud:panel-opened",
      {
        detail: {
          panel,
        },
      },
    ),
  );
}

export default function HUD() {
  const editorState =
    useEditorState();

  const selectedBlock =
    useSelectedBlock();

  const [
    isAboutOpen,
    setIsAboutOpen,
  ] = useState(false);

  const [
    isActivityOpen,
    setIsActivityOpen,
  ] = useState(false);

  useEffect(() => {
    const handlePanelOpened = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<HudPanelOpenedEventDetail>;

      if (
        customEvent.detail
          ?.panel !== "profile"
      ) {
        return;
      }

      setIsAboutOpen(false);
      setIsActivityOpen(false);
    };

    window.addEventListener(
      "hud:panel-opened",
      handlePanelOpened,
    );

    return () => {
      window.removeEventListener(
        "hud:panel-opened",
        handlePanelOpened,
      );
    };
  }, []);

  const handleAboutClick =
    () => {
      setIsActivityOpen(false);
      setIsAboutOpen(true);

      dispatchPanelOpened(
        "about",
      );
    };

  const handleActivityClick =
    () => {
      const nextIsOpen =
        !isActivityOpen;

      setIsActivityOpen(
        nextIsOpen,
      );

      if (!nextIsOpen) {
        return;
      }

      setIsAboutOpen(false);

      dispatchPanelOpened(
        "activity",
      );
    };

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
          onClick={
            handleAboutClick
          }
          className="rounded-lg border border-black/10 bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          About
        </button>

        <button
          type="button"
          onClick={
            handleActivityClick
          }
          aria-expanded={
            isActivityOpen
          }
          aria-haspopup="dialog"
          className="rounded-lg border border-black/10 bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          Activity
        </button>

        <WalletButton />

        <ActivityMenu
          isOpen={
            isActivityOpen
          }
          onClose={() =>
            setIsActivityOpen(
              false,
            )
          }
        />
      </div>

      {editorState.isActive ? (
        <BlockEditor />
      ) : (
        selectedBlock && (
          <BlockInspector
            block={
              selectedBlock
            }
          />
        )
      )}

      <BoardControls
        disabled={
          editorState.isActive
        }
      />

      <PaymentModal />

      <AboutModal
        isOpen={
          isAboutOpen
        }
        onClose={() =>
          setIsAboutOpen(
            false,
          )
        }
      />
    </div>
  );
}