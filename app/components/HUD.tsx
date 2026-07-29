"use client";

import Image from "next/image";

import {
  useState,
} from "react";

import AboutModal from "./AboutModal";
import ActivityMenu from "./ActivityMenu";
import BlockEditor from "./BlockEditor";
import BlockInspector from "./BlockInspector";
import BoardControls from "./BoardControls";
import BoardStatsHUD from "./BoardStatsHUD";
import OrdinalMintModal from "./OrdinalMintModal";
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

  const [
    isActivityOpen,
    setIsActivityOpen,
  ] = useState(false);

  const handleOpenAbout =
    () => {
      /*
       * About is an independent overlay.
       * Menus underneath keep their state.
       */
      setIsAboutOpen(true);
    };

  const handleToggleActivity =
    () => {
      const shouldOpen =
        !isActivityOpen;

      setIsActivityOpen(
        shouldOpen,
      );

      if (shouldOpen) {
        /*
         * WalletButton listens to this event
         * and closes the Profile menu.
         */
        window.dispatchEvent(
          new CustomEvent(
            "hud:panel-opened",
            {
              detail: {
                panel:
                  "activity",
              },
            },
          ),
        );
      }
    };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-none absolute top-8 left-8">
        <div className="flex flex-col items-start gap-5">
          <Image
            src="/stillpoor-logo.svg"
            alt="StillPoor"
            width={396}
            height={123}
            priority
            className="pointer-events-none h-[32px] w-auto"
          />

          <div className="pointer-events-auto">
            <BoardStatsHUD />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute top-8 right-8 flex items-start gap-2">
        <button
          type="button"
          onClick={
            handleOpenAbout
          }
          className="pointer-events-auto rounded-lg border border-black/10 bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          About
        </button>

        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={
              handleToggleActivity
            }
            aria-expanded={
              isActivityOpen
            }
            aria-haspopup="dialog"
            className="pointer-events-auto rounded-lg border border-black/10 bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur-md transition hover:bg-white"
          >
            Activity
          </button>

          <div className="pointer-events-auto">
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
        </div>

        <div
          className="pointer-events-auto"
          onClickCapture={() =>
            setIsActivityOpen(
              false,
            )
          }
        >
          <WalletButton />
        </div>
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

      <OrdinalMintModal />

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