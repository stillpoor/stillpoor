export interface Point {
  x: number;
  y: number;
}

export interface BlockCoordinate {
  row: number;
  column: number;
}

export interface Block {
  coordinate: BlockCoordinate;

  ownerWalletAddress: string;

  pixels: PixelColor[];
  description: string | null;

  claimedAt: string;
  updatedAt: string;

  claimTransactionId: string;

  latestInscriptionVersion: number;
  latestInscriptionId: string | null;
  latestInscribedAt: string | null;

  inscriptionPending: boolean;
}

export interface BoardState {
  width: number;
  height: number;
  blockSize: number;
}

export type PixelColor = string;

export const PIXELS_PER_BLOCK = 16;