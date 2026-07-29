import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export interface OrdinalActivity {
  id: string;

  blockNumber: number;
  coordinate: BlockCoordinate;

  version: number;

  ownerWalletAddress: string;

  pixels: PixelColor[];
  description: string | null;

  inscriptionId: string;
  confirmedAt: string;
}

interface ActivityResponse {
  ok: true;
  inscriptions: OrdinalActivity[];
}

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export async function loadOrdinalActivity(): Promise<
  OrdinalActivity[]
> {
  const response = await fetch(
    "/api/ordinals/activity",
    {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  );

  let data:
    | ActivityResponse
    | ErrorResponse;

  try {
    data =
      (await response.json()) as
        | ActivityResponse
        | ErrorResponse;
  } catch {
    throw new Error(
      "The server returned an invalid response.",
    );
  }

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      "error" in data &&
        typeof data.error ===
          "string"
        ? data.error
        : "Unable to load Ordinal activity.",
    );
  }

  if (
    !Array.isArray(
      data.inscriptions,
    )
  ) {
    throw new Error(
      "The server returned invalid Ordinal activity.",
    );
  }

  return data.inscriptions;
}