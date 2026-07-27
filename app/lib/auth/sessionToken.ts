import "server-only";

import {
  createHash,
  randomBytes,
} from "node:crypto";

export function createSessionToken() {
  return randomBytes(32).toString(
    "base64url",
  );
}

export function hashSessionToken(
  sessionToken: string,
) {
  return createHash("sha256")
    .update(sessionToken)
    .digest("hex");
}