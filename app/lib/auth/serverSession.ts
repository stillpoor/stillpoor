import "server-only";

import {
  cookies,
} from "next/headers";

import {
  walletAuthConfig,
} from "./authConfig";

import {
  hashSessionToken,
} from "./sessionToken";

import {
  supabaseAdmin,
} from "../supabase/serverClient";

interface WalletSessionRow {
  payment_address: string;
  ordinals_address: string;

  expires_at: string;
  revoked_at: string | null;
}

export interface ServerWalletSession {
  paymentAddress: string;
  ordinalsAddress: string;
  expiresAt: string;
}

async function getSessionToken() {
  const cookieStore =
    await cookies();

  return {
    cookieStore,

    sessionToken:
      cookieStore.get(
        walletAuthConfig.sessionCookieName,
      )?.value ?? null,
  };
}

export async function getServerWalletSession():
  Promise<ServerWalletSession | null> {
  const {
    sessionToken,
  } = await getSessionToken();

  if (!sessionToken) {
    return null;
  }

  const tokenHash =
    hashSessionToken(sessionToken);

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("wallet_sessions")
    .select(`
      payment_address,
      ordinals_address,
      expires_at,
      revoked_at
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const session =
    data as WalletSessionRow;

  if (session.revoked_at) {
    return null;
  }

  if (
    new Date(
      session.expires_at,
    ).getTime() <= Date.now()
  ) {
    return null;
  }

  return {
    paymentAddress:
      session.payment_address,

    ordinalsAddress:
      session.ordinals_address,

    expiresAt:
      session.expires_at,
  };
}

export async function revokeServerWalletSession() {
  const {
    cookieStore,
    sessionToken,
  } = await getSessionToken();

  if (!sessionToken) {
    cookieStore.delete(
      walletAuthConfig.sessionCookieName,
    );

    return false;
  }

  const tokenHash =
    hashSessionToken(sessionToken);

  const {
    error,
  } = await supabaseAdmin
    .from("wallet_sessions")
    .update({
      revoked_at:
        new Date().toISOString(),
    })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);

  if (error) {
    throw new Error(
      "Unable to revoke the wallet session.",
    );
  }

  cookieStore.delete(
    walletAuthConfig.sessionCookieName,
  );

  return true;
}

export async function clearSessionCookie() {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    walletAuthConfig.sessionCookieName,
  );
}