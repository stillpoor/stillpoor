import {
  getWalletState,
} from "./walletState";

export function getCurrentWalletAddress() {
  return (
    getWalletState()
      .paymentAddress?.address ??
    null
  );
}