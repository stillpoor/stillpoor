export type ClaimPaymentSessionStage =
  | "reserved"
  | "payment-started"
  | "transaction-known";

export interface StoredClaimPaymentSession {
  orderId: string;
  paymentAddress: string;

  stage:
    ClaimPaymentSessionStage;

  paymentTxid:
    string | null;
}

const storageKey =
  "stillpoor:claim-payment-session";

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

  if (
    !isNonEmptyString(
      session.orderId,
    ) ||
    !isNonEmptyString(
      session.paymentAddress,
    ) ||
    !isValidStage(
      session.stage,
    ) ||
    (
      session.paymentTxid !==
        null &&
      typeof session.paymentTxid !==
        "string"
    )
  ) {
    clearStoredClaimPaymentSession();

    return null;
  }

  return {
    orderId:
      session.orderId.trim(),

    paymentAddress:
      session.paymentAddress.trim(),

    stage:
      session.stage,

    paymentTxid:
      session.paymentTxid
        ? session.paymentTxid
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
     * In that case, the server expiration
     * remains the fallback protection.
     */
  }
}

export function getStoredClaimPaymentSession() {
  return readStoredSession();
}

export function storeReservedClaimPaymentSession({
  orderId,
  paymentAddress,
}: {
  orderId: string;
  paymentAddress: string;
}) {
  writeStoredSession({
    orderId:
      orderId.trim(),

    paymentAddress:
      paymentAddress.trim(),

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
      orderId
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
