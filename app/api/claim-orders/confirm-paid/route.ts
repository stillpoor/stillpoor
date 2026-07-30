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

  block_numbers: number[];

  amount_sats:
    number | string;

  receiver_address: string;

  status: string;
  expires_at: string;

  payment_network: string;

  payment_txid:
    string | null;
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

  status?: string;

  latest_inscription_version?:
    number;

  latest_inscription_id?:
    string | null;

  latest_inscribed_at?:
    string | null;

  inscription_pending?:
    boolean;
}

type PaidOrderRecoveryResult =
  | {
      kind: "success";
      rows: ClaimedBlockRow[];
    }
  | {
      kind: "not-paid";
    }
  | {
      kind: "error";
      response:
        NextResponse;
    };

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

function isValidBlockNumbers(
  value: unknown,
): value is number[] {
  return (
    Array.isArray(
      value,
    ) &&
    value.length > 0 &&
    value.every(
      (blockNumber) =>
        typeof blockNumber ===
          "number" &&
        Number.isInteger(
          blockNumber,
        ) &&
        blockNumber > 0,
    )
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

async function loadBitcoinTransaction(
  transactionId: string,
) {
  const url =
    `${paymentConfig.mempoolApiBaseUrl}/tx/${transactionId}`;

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
        `The ${paymentConfig.networkLabel} explorer is temporarily rate limited.`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `The ${paymentConfig.networkLabel} explorer could not verify the transaction.`,
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
        Number.isInteger(
          row.latest_inscription_version,
        )
          ? row.latest_inscription_version ??
            0
          : 0,

      latestInscriptionId:
        row.latest_inscription_id ??
        null,

      latestInscribedAt:
        row.latest_inscribed_at ??
        null,

      inscriptionPending:
        typeof row.inscription_pending ===
          "boolean"
          ? row.inscription_pending
          : false,
    }),
  );
}

function areValidClaimedBlocks({
  rows,
  expectedBlockNumbers,
  paymentAddress,
  paymentTxid,
}: {
  rows:
    ClaimedBlockRow[];

  expectedBlockNumbers:
    readonly number[];

  paymentAddress: string;
  paymentTxid: string;
}) {
  const expectedPixelCount =
    PIXELS_PER_BLOCK *
    PIXELS_PER_BLOCK;

  const uniqueExpectedBlockNumbers =
    new Set(
      expectedBlockNumbers,
    );

  if (
    uniqueExpectedBlockNumbers.size !==
      expectedBlockNumbers.length ||
    rows.length !==
      expectedBlockNumbers.length
  ) {
    return false;
  }

  return rows.every(
    (row) =>
      uniqueExpectedBlockNumbers.has(
        row.block_number,
      ) &&
      row
        .owner_payment_address ===
        paymentAddress &&
      (
        row.status ===
          undefined ||
        row.status ===
          "claimed"
      ) &&
      Boolean(
        row.claimed_at,
      ) &&
      Boolean(
        row.updated_at,
      ) &&
      row
        .claim_transaction_id
        .toLowerCase() ===
        paymentTxid &&
      Array.isArray(
        row.pixels,
      ) &&
      row.pixels.length ===
        expectedPixelCount,
  );
}

function createSuccessResponse(
  rows:
    ClaimedBlockRow[],
) {
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

async function recoverPaidClaimOrder({
  orderId,
  paymentAddress,
  paymentTxid,
}: {
  orderId: string;
  paymentAddress: string;
  paymentTxid: string;
}): Promise<
  PaidOrderRecoveryResult
> {
  const {
    data: paidOrderData,
    error: paidOrderError,
  } = await supabaseAdmin
    .from("claim_orders")
    .select(`
      id,
      payment_address,
      block_numbers,
      status,
      payment_txid
    `)
    .eq(
      "id",
      orderId,
    )
    .maybeSingle();

  if (
    paidOrderError ||
    !paidOrderData
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The confirmed Claim order could not be recovered.",
          },
          {
            status: 500,
          },
        ),
    };
  }

  const paidOrder =
    paidOrderData as {
      id: string;

      payment_address:
        string;

      block_numbers:
        number[];

      status: string;

      payment_txid:
        string | null;
    };

  if (
    paidOrder.payment_address !==
    paymentAddress
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The wallet does not own this order.",
          },
          {
            status: 403,
          },
        ),
    };
  }

  if (
    paidOrder.status !==
    "paid"
  ) {
    return {
      kind: "not-paid",
    };
  }

  if (
    !paidOrder.payment_txid ||
    paidOrder.payment_txid
      .toLowerCase() !==
      paymentTxid
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The Claim order was confirmed with a different Bitcoin transaction.",
          },
          {
            status: 409,
          },
        ),
    };
  }

  if (
    !isValidBlockNumbers(
      paidOrder.block_numbers,
    )
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The confirmed Claim order contains invalid Block data.",
          },
          {
            status: 500,
          },
        ),
    };
  }

  const {
    data: claimedBlockData,
    error: claimedBlockError,
  } = await supabaseAdmin
    .from("blocks")
    .select(`
      block_number,
      block_row,
      block_column,
      owner_payment_address,
      pixels,
      description,
      claimed_at,
      updated_at,
      claim_transaction_id,
      status,
      latest_inscription_version,
      latest_inscription_id,
      latest_inscribed_at,
      inscription_pending
    `)
    .in(
      "block_number",
      paidOrder.block_numbers,
    )
    .order(
      "block_number",
      {
        ascending: true,
      },
    );

  if (
    claimedBlockError
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The confirmed Blocks could not be recovered.",
          },
          {
            status: 500,
          },
        ),
    };
  }

  const rows =
    (claimedBlockData ??
      []) as ClaimedBlockRow[];

  if (
    !areValidClaimedBlocks({
      rows,

      expectedBlockNumbers:
        paidOrder.block_numbers,

      paymentAddress,

      paymentTxid,
    })
  ) {
    return {
      kind: "error",

      response:
        NextResponse.json(
          {
            ok: false,

            error:
              "The recovered Blocks contain invalid data.",
          },
          {
            status: 500,
          },
        ),
    };
  }

  return {
    kind: "success",
    rows,
  };
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
      block_numbers,
      amount_sats,
      receiver_address,
      status,
      expires_at,
      payment_network,
      payment_txid
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
    order.payment_network !==
    paymentConfig.network
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          `The Claim order is not a ${paymentConfig.networkLabel} order.`,
      },
      {
        status: 400,
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

  /*
   * Idempotent recovery:
   *
   * The transaction may already have been
   * verified immediately before a refresh.
   * Reusing the same order and txid must return
   * the already claimed Blocks instead of
   * reporting a second-confirmation error.
   */
  if (
    order.status ===
    "paid"
  ) {
    const recovery =
      await recoverPaidClaimOrder({
        orderId,

        paymentAddress:
          session.paymentAddress,

        paymentTxid,
      });

    if (
      recovery.kind ===
      "success"
    ) {
      return createSuccessResponse(
        recovery.rows,
      );
    }

    if (
      recovery.kind ===
      "error"
    ) {
      return recovery.response;
    }

    return NextResponse.json(
      {
        ok: false,

        error:
          "The paid Claim order could not be recovered.",
      },
      {
        status: 500,
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

  if (
    !isValidBlockNumbers(
      order.block_numbers,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "The Claim order contains invalid Block data.",
      },
      {
        status: 500,
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

  let transaction:
    MempoolTransaction | null;

  try {
    transaction =
      await loadBitcoinTransaction(
        paymentTxid,
      );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : `The ${paymentConfig.networkLabel} payment could not be verified.`,
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
          `The transaction is not visible on ${paymentConfig.networkLabel} yet. Try verifying it again.`,
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
          `The ${paymentConfig.networkLabel} transaction returned invalid data.`,
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

    /*
     * Handles a rare race where another request
     * confirmed the order after this request had
     * already read it as pending.
     */
    if (
      lowerError.includes(
        "no longer pending",
      )
    ) {
      const recovery =
        await recoverPaidClaimOrder({
          orderId,

          paymentAddress:
            session.paymentAddress,

          paymentTxid,
        });

      if (
        recovery.kind ===
        "success"
      ) {
        return createSuccessResponse(
          recovery.rows,
        );
      }

      if (
        recovery.kind ===
        "error"
      ) {
        return recovery.response;
      }
    }

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

  if (
    !areValidClaimedBlocks({
      rows,

      expectedBlockNumbers:
        order.block_numbers,

      paymentAddress:
        session.paymentAddress,

      paymentTxid,
    })
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

  return createSuccessResponse(
    rows,
  );
}
