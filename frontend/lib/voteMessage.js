// The exact message a voter signs (EIP-191 personal_sign). Shared by client and server.
export function voteMessage({ cycleId, optionId, wallet }) {
  return `yo-yo Community Vote\nChain: Robinhood Chain (4663)\nCycle: ${cycleId}\nOption: ${optionId}\nWallet: ${wallet}`;
}
