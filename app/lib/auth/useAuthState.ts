"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getAuthState,
  subscribeToAuth,
} from "./authState";

import type {
  AuthState,
} from "./authState";

const serverAuthState: AuthState = {
  isAuthenticating: false,
  isRestoringSession: false,
  isAuthenticated: false,

  paymentAddress: null,
  ordinalsAddress: null,
  expiresAt: null,

  errorMessage: null,
};

function getServerAuthState() {
  return serverAuthState;
}

export function useAuthState() {
  return useSyncExternalStore(
    subscribeToAuth,
    getAuthState,
    getServerAuthState,
  );
}