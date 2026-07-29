import type {
  Block,
  BlockCoordinate,
} from "../board/boardTypes";

interface SimulatedInscription {
  id: string;
  version: number;
  status: string;
  inscriptionId: string;
  destinationOrdinalsAddress: string;
  commitTransactionId: string;
  revealTransactionId: string;
}

interface MintResponse {
  ok: true;
  block: Block;
  inscription: SimulatedInscription;
}

interface ErrorResponse {
  ok?: false;
  error?: string;
}

export async function mintBlockOrdinalSimulated(
  block: BlockCoordinate,
): Promise<MintResponse> {
  const response = await fetch(
    "/api/ordinals/mint-simulated",
    {
      method: "POST",
      credentials: "same-origin",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        block,
      }),
    },
  );

  let data:
    | MintResponse
    | ErrorResponse;

  try {
    data =
      (await response.json()) as
        | MintResponse
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
        : "Unable to mint the Ordinal.",
    );
  }

  return data;
}