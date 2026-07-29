import {
  NextResponse,
} from "next/server";

import {
  getServerWalletSession,
} from "../../../lib/auth/serverSession";

import {
  PIXELS_PER_BLOCK,
} from "../../../lib/board/boardTypes";

import {
  paymentConfig,
} from "../../../lib/payment/paymentConfig";

import {
  supabaseAdmin,
} from "../../../lib/supabase/serverClient";

interface ConfirmPaidRequestBody {
  orderId?: unknown;
  paymentTxid?: unknown;
}

interface ClaimOrderRow {
  id: string;

  payment_address: string;
  ordinals_address: string;

  amount_sats:
    number | string;

  receiver_address: string;

  status: string;
  expires_at: string;

  payment_network: string;
}

interface MempoolInput {
  prevout?: {
    scriptpubkey_address?:
      unknown;
  } | null;
}

interface MempoolOutput {
  scriptpubkey_address?:
    unknown;

  value?: unknown;
}

interface MempoolTransaction {
  txid?: unknown;

  vin?: unknown;
  vout?: unknown;
}

interface ClaimedBlockRow {
  block_number: number;
  block_row: number;
  block_column: number;

  owner_payment_address:
    string;

  pixels: string[];
  description:
    string | null;

  claimed_at: string;
  updated_at: string;

  claim_transaction_id:
    string;
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.trim().length > 0
  );
}

function isValidUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidTransactionId(
  value: string,
) {
  return /^[0-9a-fA-F]{64}$/.test(
    value,
  );
}

function readPositiveSafeInteger(
  value: unknown,
) {
  const numberValue =
    typeof value ===
      "string"
      ? Number(value)
      : value;

  if (
    typeof numberValue !==
      "number" ||
    !Number.isSafeInteger(
      numberValue,
    ) ||
    numberValue <= 0
  ) {
    return null;
  }

  return numberValue;
}

function wait(
  milliseconds: number,
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function loadSignetTransaction(
  transactionId: string,
) {
  const url =
    `https://mempool.space/signet/api/tx/${transactionId}`;

  for (
    let attempt = 0;
    attempt < 8;
    attempt += 1
  ) {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
        },
      );

    if (
      response.status === 404
    ) {
      if (attempt < 7) {
        await wait(1000);
        continue;
      }

      return null;
    }

    if (
      response.status === 429
    ) {
      throw new Error(
        "The Signet explorer is temporarily rate limited.",
      );
    }

    if (!response.ok) {
      throw new Error(
        "The Signet explorer could not verify the transaction.",
      );
    }

    return (
      await response.json()
    ) as MempoolTransaction;
  }

  return null;
}

function mapClaimedBlocks(
  rows:
    ClaimedBlockRow[],
) {
  return rows.map(
    (row) => ({
      coordinate: {
        row:
          row.block_row,

        column:
          row.block_column,
      },

      ownerWalletAddress:
        row.owner_payment_address,

      pixels: [
        ...row.pixels,
      ],

      description:
        row.description,

      claimedAt:
        row.claimed_at,

      updatedAt:
        row.updated_at,

      claimTransactionId:
        row.claim_transaction_id,

      latestInscriptionVersion:
        0,

      latestInscriptionId:
        null,

      latestInscribedAt:
        null,

      inscriptionPending:
        false,
    }),
  );
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: Request,
) {
  const session =
    await getServerWalletSession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "A verified wallet session is required.",
      },
      {
        status: 401,
      },
    );
  }

  let body:
    ConfirmPaidRequestBody;

  try {
    body =
      (await request.json()) as
        ConfirmPaidRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The request body is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isNonEmptyString(
      body.orderId,
    ) ||
    !isValidUuid(
      body.orderId.trim(),
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The order ID is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isNonEmptyString(
      body.paymentTxid,
    ) ||
    !isValidTransactionId(
      body.paymentTxid.trim(),
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Bitcoin transaction ID is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const orderId =
    body.orderId.trim();

  const paymentTxid =
    body.paymentTxid
      .trim()
      .toLowerCase();

  const {
    data: orderData,
    error: orderError,
  } = await supabaseAdmin
    .from("claim_orders")
    .select(`
      id,
      payment_address,
      ordinals_address,
      amount_sats,
      receiver_address,
      status,
      expires_at,
      payment_network
    `)
    .eq(
      "id",
      orderId,
    )
    .maybeSingle();

  if (
    orderError ||
    !orderData
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order does not exist.",
      },
      {
        status: 404,
      },
    );
  }

  const order =
    orderData as ClaimOrderRow;

  if (
    order.payment_address !==
    session.paymentAddress
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The wallet does not own this order.",
      },
      {
        status: 403,
      },
    );
  }

  if (
    order.status !==
    "pending"
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order is no longer pending.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    order.payment_network !==
    "signet"
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order is not a Signet order.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    new Date(
      order.expires_at,
    ).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order has expired.",
      },
      {
        status: 410,
      },
    );
  }

  const expectedAmountSats =
    readPositiveSafeInteger(
      order.amount_sats,
    );

  if (
    expectedAmountSats ===
    null
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order amount is invalid.",
      },
      {
        status: 500,
      },
    );
  }

  if (
    order.receiver_address !==
    paymentConfig.receiverAddress
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order receiver is invalid.",
      },
      {
        status: 500,
      },
    );
  }

  let transaction:
    MempoolTransaction | null;

  try {
    transaction =
      await loadSignetTransaction(
        paymentTxid,
      );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "The Signet payment could not be verified.",
      },
      {
        status: 503,
      },
    );
  }

  if (!transaction) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The transaction is not visible on Signet yet. Try verifying it again.",
      },
      {
        status: 425,
      },
    );
  }

  if (
    transaction.txid !==
      paymentTxid ||
    !Array.isArray(
      transaction.vin,
    ) ||
    !Array.isArray(
      transaction.vout,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Signet transaction returned invalid data.",
      },
      {
        status: 502,
      },
    );
  }

  const authorisedAddresses =
    new Set([
      session.paymentAddress,
      session.ordinalsAddress,
    ]);

  const hasAuthorisedInput =
    transaction.vin.some(
      (inputValue) => {
        if (
          !inputValue ||
          typeof inputValue !==
            "object"
        ) {
          return false;
        }

        const input =
          inputValue as
            MempoolInput;

        const address =
          input.prevout
            ?.scriptpubkey_address;

        return (
          typeof address ===
            "string" &&
          authorisedAddresses.has(
            address,
          )
        );
      },
    );

  if (!hasAuthorisedInput) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The transaction was not sent by the authenticated wallet.",
      },
      {
        status: 400,
      },
    );
  }

  const amountReceived =
    transaction.vout.reduce(
      (
        total,
        outputValue,
      ) => {
        if (
          !outputValue ||
          typeof outputValue !==
            "object"
        ) {
          return total;
        }

        const output =
          outputValue as
            MempoolOutput;

        if (
          output
            .scriptpubkey_address !==
          paymentConfig
            .receiverAddress
        ) {
          return total;
        }

        const value =
          readPositiveSafeInteger(
            output.value,
          );

        return total +
          (value ?? 0);
      },
      0,
    );

  if (
    amountReceived <
    expectedAmountSats
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Bitcoin transaction did not pay the required amount.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "confirm_claim_order_paid",
    {
      p_order_id:
        orderId,

      p_payment_address:
        session.paymentAddress,

      p_payment_txid:
        paymentTxid,
    },
  );

  if (error) {
    const errorMessage =
      error.message ||
      "Unable to confirm the Claim order.";

    const lowerError =
      errorMessage.toLowerCase();

    let status = 400;

    if (
      lowerError.includes(
        "does not own",
      )
    ) {
      status = 403;
    } else if (
      lowerError.includes(
        "expired",
      )
    ) {
      status = 410;
    } else if (
      lowerError.includes(
        "no longer pending",
      ) ||
      lowerError.includes(
        "already been used",
      )
    ) {
      status = 409;
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          errorMessage,
      },
      {
        status,
      },
    );
  }

  const rows =
    (data ?? []) as
      ClaimedBlockRow[];

  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const hasInvalidBlock =
    rows.some(
      (row) =>
        row
          .owner_payment_address !==
          session.paymentAddress ||
        !row.claimed_at ||
        !row.updated_at ||
        row
          .claim_transaction_id !==
          paymentTxid ||
        !Array.isArray(
          row.pixels,
        ) ||
        row.pixels.length !==
          expectedPixelCount,
    );

  if (
    rows.length === 0 ||
    hasInvalidBlock
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The confirmed Blocks returned invalid data.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      claimedBlocks:
        mapClaimedBlocks(
          rows,
        ),
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}