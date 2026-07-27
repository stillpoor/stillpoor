import type {
  Block,
  BlockCoordinate,
  PixelColor,
} from "../board/boardTypes";

interface EditorSaveBlock {
  coordinate: BlockCoordinate;
  pixels: PixelColor[];
  description: string;
}

interface SaveResponse {
  ok: true;
  savedBlocks: Block[];
}

interface ErrorResponse {
  ok?: false;
  error?: string;
}

interface SaveEditorBlocksOptions {
  /*
   * Conservé temporairement pour éviter de modifier
   * tous les appels existants.
   *
   * Cette adresse n’est plus envoyée au serveur.
   */
  paymentAddress: string;

  blocks: EditorSaveBlock[];
}

export async function saveEditorBlocks(
  options: SaveEditorBlocksOptions,
) {
  const response = await fetch(
    "/api/blocks/save",
    {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        blocks: options.blocks,
      }),
    },
  );

  let data:
    | SaveResponse
    | ErrorResponse;

  try {
    data =
      (await response.json()) as
        | SaveResponse
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
        typeof data.error === "string"
        ? data.error
        : "Unable to save the Blocks.",
    );
  }

  return data.savedBlocks;
}