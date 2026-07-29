export type BitcoinPaymentNetwork =
  | "signet"
  | "mainnet";

interface BitcoinNetworkConfig {
  networkLabel: string;

  receiverAddress: string;

  mempoolApiBaseUrl: string;

  transactionExplorerBaseUrl:
    string;

  signetAmountSatsPerBlock:
    number | null;
}

/*
 * Keep Signet active during development.
 *
 * Before production:
 * 1. Add the real Mainnet receiver address below.
 * 2. Complete the dedicated security review.
 * 3. Change this single value to "mainnet".
 */
export const activeBitcoinPaymentNetwork:
  BitcoinPaymentNetwork =
  "signet";

const bitcoinNetworkConfigs:
  Record<
    BitcoinPaymentNetwork,
    BitcoinNetworkConfig
  > = {
    signet: {
      networkLabel:
        "Signet",

      receiverAddress:
        "tb1qw5dter2uwy6e5nsfdny4r2qytnf47r0rryfg3u",

      mempoolApiBaseUrl:
        "https://mempool.space/signet/api",

      transactionExplorerBaseUrl:
        "https://mempool.space/signet/tx",

      signetAmountSatsPerBlock:
        1_000,
    },

    mainnet: {
      networkLabel:
        "Mainnet",

      /*
       * Intentionally empty until the real
       * StillPoor Mainnet receiving address
       * has been created and verified.
       */
      receiverAddress:
        "",

      mempoolApiBaseUrl:
        "https://mempool.space/api",

      transactionExplorerBaseUrl:
        "https://mempool.space/tx",

      signetAmountSatsPerBlock:
        null,
    },
  };

const selectedNetworkConfig =
  bitcoinNetworkConfigs[
    activeBitcoinPaymentNetwork
  ];

if (
  selectedNetworkConfig
    .receiverAddress
    .trim() === ""
) {
  throw new Error(
    `The ${selectedNetworkConfig.networkLabel} Bitcoin receiver address is missing.`,
  );
}

export const paymentConfig = {
  network:
    activeBitcoinPaymentNetwork,

  ...selectedNetworkConfig,
} as const;
