// GraphQL queries verified against streaming.bitquery.io/eap.

const SOL_MINTS = [
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
];

export const WALLET_PUMP_BUYS = `
query WalletPumpBuys($wallet: String!, $limit: Int!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Dex: { ProtocolName: { is: "pump" } }
          Side: { Type: { is: buy } }
          Account: { Address: { is: $wallet } }
          Currency: { MintAddress: { notIn: ${JSON.stringify(SOL_MINTS)} } }
        }
      }
      orderBy: { descending: Block_Time }
      limit: { count: $limit }
    ) {
      Block { Slot Time }
      Transaction { Signature Signer }
      Trade {
        Currency { MintAddress Symbol }
        Amount
      }
    }
  }
}
`;

export const MINT_LAUNCH_SLOTS = `
query MintLaunchSlots($mints: [String!]!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Dex: { ProtocolName: { is: "pump" } }
          Currency: { MintAddress: { in: $mints } }
        }
      }
      limitBy: { by: Trade_Currency_MintAddress, count: 1 }
      orderBy: { ascending: Block_Slot }
    ) {
      Block { Slot Time }
      Trade { Currency { MintAddress } }
    }
  }
}
`;

export const SLOT_BUNDLE_SCAN = `
query SlotBundleScan($slots: [String!]!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Dex: { ProtocolName: { is: "pump" } }
          Side: { Type: { is: buy } }
          Currency: { MintAddress: { notIn: ${JSON.stringify(SOL_MINTS)} } }
        }
        Block: { Slot: { in: $slots } }
      }
      limit: { count: 5000 }
    ) {
      Block { Slot }
      Transaction { Signer }
      Trade { Currency { MintAddress } }
    }
  }
}
`;
