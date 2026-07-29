import type {
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

export interface OrdinalBlockVersion {
  id: string;

  blockNumber: number;
  version: number;

  ownerPaymentAddress: string;

  destinationOrdinalsAddress:
    string;

  pixels: PixelColor[];
  description: string | null;

  inscriptionId: string;
  confirmedAt: string;
}

interface HistoryResponse {
  ok: true;

  versions:
    OrdinalBlockVersion[];
}

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export async function loadOrdinalBlockHistory(
  block: BlockCoordinate,
): Promise<
  OrdinalBlockVersion[]
> {
  const searchParameters =
    new URLSearchParams({
      row:
        String(block.row),

      column:
        String(block.column),
    });

  const response = await fetch(
    `/api/ordinals/block-history?${searchParameters.toString()}`,
    {
      method: "GET",

      credentials:
        "same-origin",

      cache: "no-store",
    },
  );

  let data:
    | HistoryResponse
    | ErrorResponse;

  try {
    data =
      (await response.json()) as
        | HistoryResponse
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
        : "Unable to load Ordinal history.",
    );
  }

  if (
    !Array.isArray(
      data.versions,
    )
  ) {
    throw new Error(
      "The server returned invalid Ordinal history.",
    );
  }

  return data.versions;
}