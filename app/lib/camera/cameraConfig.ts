export const cameraConfig = {
  minZoom: 0.5,
  maxZoom: 20,
  zoomSensitivity: 0.0015,

  controlZoomFactor: 1.4,

  minimumVisibleBoardSize: 96,
  dragThreshold: 4,

  occupiedFocusZoom: 8,
  claimFocusZoom: 3,
  focusDuration: 300,

  selectedBlockDismissThresholdRatio: 0.35,
  selectedBlockDismissThresholdMin: 160,
  selectedBlockDismissThresholdMax: 320,
} as const;