import type { AppMode } from "./appTypes";

type AppModeListener = () => void;

let appMode: AppMode = "browsing";

const listeners = new Set<AppModeListener>();

export function getAppMode() {
  return appMode;
}

export function setAppMode(
  nextMode: AppMode,
) {
  if (appMode === nextMode) {
    return;
  }

  appMode = nextMode;

  listeners.forEach((listener) => {
    listener();
  });
}

export function subscribeToAppMode(
  listener: AppModeListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}