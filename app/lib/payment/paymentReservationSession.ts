import type {
  BlockCoordinate,
} from "../board/boardTypes";

export type ClaimPaymentSessionStage =
  | "reserved"
  | "payment-started"
  | "transaction-known";

export interface StoredClaimPaymentSession {
  orderId: string;
  expiresAt: string;

  paymentAddress: string;
  receiverAddress: string;

  blocks:
    BlockCoordinate[];

  totalPriceSats: number;

  stage:
    ClaimPaymentSessionStage;

  paymentTxid:
    string | null;
}

const storageKey =
  "stillpoor:claim-payment-session";

const transactionIdPattern =
  /^[0-9a-fA-F]{64}$/;

function canUseSessionStorage() {
  return (
    typeof window !==
    "undefined"
  );
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

function isValidStage(
  value: unknown,
): value is ClaimPaymentSessionStage {
  return (
    value === "reserved" ||
    value ===
      "payment-started" ||
    value ===
      "transaction-known"
  );
}

function isValidBlockCoordinate(
  value: unknown,
): value is BlockCoordinate {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const coordinate =
    value as
      Partial<BlockCoordinate>;

  return (
    typeof coordinate.row ===
      "number" &&
    Number.isInteger(
      coordinate.row,
    ) &&
    coordinate.row >= 0 &&

    typeof coordinate.column ===
      "number" &&
    Number.isInteger(
      coordinate.column,
    ) &&
    coordinate.column >= 0
  );
}

function isValidPositiveSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value > 0
  );
}

function isValidExpiryDate(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    Number.isFinite(
      new Date(
        value,
      ).getTime(),
    )
  );
}

function readStoredSession() {
  if (
    !canUseSessionStorage()
  ) {
    return null;
  }

  let rawValue:
    string | null;

  try {
    rawValue =
      window.sessionStorage.getItem(
        storageKey,
      );
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  let parsedValue:
    unknown;

  try {
    parsedValue =
      JSON.parse(
        rawValue,
      );
  } catch {
    clearStoredClaimPaymentSession();

    return null;
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object"
  ) {
    clearStoredClaimPaymentSession();

    return null;
  }

  const session =
    parsedValue as
      Partial<StoredClaimPaymentSession>;

  const hasValidBlocks =
    Array.isArray(
      session.blocks,
    ) &&
    session.blocks.length > 0 &&
    session.blocks.every(
      isValidBlockCoordinate,
    );

  const hasValidTransactionId =
    session.paymentTxid ===
      null ||
    (
      typeof session.paymentTxid ===
        "string" &&
      transactionIdPattern.test(
        session.paymentTxid,
      )
    );

  const hasConsistentPaymentStage =
    session.stage ===
      "transaction-known"
      ? (
          typeof session.paymentTxid ===
            "string" &&
          transactionIdPattern.test(
            session.paymentTxid,
          )
        )
      : session.paymentTxid ===
          null;

  if (
    !isNonEmptyString(
      session.orderId,
    ) ||
    !isValidExpiryDate(
      session.expiresAt,
    ) ||
    !isNonEmptyString(
      session.paymentAddress,
    ) ||
    !isNonEmptyString(
      session.receiverAddress,
    ) ||
    !hasValidBlocks ||
    !isValidPositiveSafeInteger(
      session.totalPriceSats,
    ) ||
    !isValidStage(
      session.stage,
    ) ||
    !hasValidTransactionId ||
    !hasConsistentPaymentStage
  ) {
    clearStoredClaimPaymentSession();

    return null;
  }

  const validSession =
    session as
      StoredClaimPaymentSession;

  return {
    orderId:
      validSession.orderId.trim(),

    expiresAt:
      validSession.expiresAt,

    paymentAddress:
      validSession.paymentAddress.trim(),

    receiverAddress:
      validSession.receiverAddress.trim(),

    blocks:
      validSession.blocks.map(
        (block) => ({
          ...block,
        }),
      ),

    totalPriceSats:
      validSession.totalPriceSats,

    stage:
      validSession.stage,

    paymentTxid:
      validSession.paymentTxid
        ? validSession.paymentTxid
            .trim()
            .toLowerCase()
        : null,
  } satisfies StoredClaimPaymentSession;
}

function writeStoredSession(
  session:
    StoredClaimPaymentSession,
) {
  if (
    !canUseSessionStorage()
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(
        session,
      ),
    );
  } catch {
    /*
     * The payment flow must keep working
     * even when browser storage is blocked.
     * Server-side expiration remains the
     * fallback protection.
     */
  }
}

export function getStoredClaimPaymentSession() {
  return readStoredSession();
}

export function storeReservedClaimPaymentSession({
  orderId,
  expiresAt,
  paymentAddress,
  receiverAddress,
  blocks,
  totalPriceSats,
}: {
  orderId: string;
  expiresAt: string;

  paymentAddress: string;
  receiverAddress: string;

  blocks:
    readonly BlockCoordinate[];

  totalPriceSats: number;
}) {
  writeStoredSession({
    orderId:
      orderId.trim(),

    expiresAt,

    paymentAddress:
      paymentAddress.trim(),

    receiverAddress:
      receiverAddress.trim(),

    blocks:
      blocks.map(
        (block) => ({
          ...block,
        }),
      ),

    totalPriceSats,

    stage:
      "reserved",

    paymentTxid:
      null,
  });
}

export function markClaimPaymentStarted(
  orderId: string,
) {
  const session =
    readStoredSession();

  if (
    !session ||
    session.orderId !==
      orderId
  ) {
    return;
  }

  writeStoredSession({
    ...session,

    stage:
      "payment-started",

    paymentTxid:
      null,
  });
}

export function storeClaimPaymentTransaction({
  orderId,
  paymentTxid,
}: {
  orderId: string;
  paymentTxid: string;
}) {
  const session =
    readStoredSession();

  if (
    !session ||
    session.orderId !==
      orderId ||
    !transactionIdPattern.test(
      paymentTxid,
    )
  ) {
    return;
  }

  writeStoredSession({
    ...session,

    stage:
      "transaction-known",

    paymentTxid:
      paymentTxid
        .trim()
        .toLowerCase(),
  });
}

export function getAbandonedUnpaidClaimPaymentSession() {
  const session =
    readStoredSession();

  if (
    !session ||
    session.stage !==
      "reserved"
  ) {
    return null;
  }

  return session;
}

export function clearStoredClaimPaymentSession(
  orderId?: string,
) {
  if (
    !canUseSessionStorage()
  ) {
    return;
  }

  if (orderId) {
    const session =
      readStoredSession();

    if (
      session &&
      session.orderId !==
        orderId
    ) {
      return;
    }
  }

  try {
    window.sessionStorage.removeItem(
      storageKey,
    );
  } catch {
    /*
     * Nothing else is required here.
     */
  }
}
