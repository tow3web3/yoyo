// Fee sources. On Robinhood Chain there is no single "creator vault": fees
// arrive as ETH in the dev wallet (most launchpads pay creators directly) or
// accrue inside Uniswap V3 LP positions the creator holds. Either way the goal
// of this step is the same: end with the fees as plain ETH in the dev wallet.
import { parseAbi } from 'viem';
import {
  publicClient, walletFor, confirm, erc20Abi, wethAbi, WETH, UNIV3_NPM, lower, explorerTx,
} from '../chain/config.js';
import { swapTokenForEth } from './swap.js';

export const FEE_SOURCES = {
  wallet: { label: 'Wallet balance', emoji: '💼', hint: 'Fees land in the dev wallet as stock tokens or ETH (any launchpad that pays creators directly).' },
  univ3: { label: 'Uniswap V3 LP fees', emoji: '🦄', hint: 'Fees accrue in V3 liquidity positions held by the dev wallet. 0xdiv collects them every cycle.' },
};

const MAX_UINT128 = (1n << 128n) - 1n;

const NPM_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)',
]);

/** V3 position ids owned by `owner` whose pair includes `token`. */
export async function discoverPositions(owner, token) {
  const client = publicClient();
  const count = Number(await client.readContract({ address: UNIV3_NPM, abi: NPM_ABI, functionName: 'balanceOf', args: [owner] }));
  const ids = [];
  for (let i = 0; i < Math.min(count, 50); i++) {
    const id = await client.readContract({ address: UNIV3_NPM, abi: NPM_ABI, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)] });
    const pos = await client.readContract({ address: UNIV3_NPM, abi: NPM_ABI, functionName: 'positions', args: [id] });
    const [, , token0, token1] = pos;
    if (lower(token0) === lower(token) || lower(token1) === lower(token)) ids.push(id.toString());
  }
  return ids;
}

/** Unwrap any WETH sitting in the wallet so everything is native ETH. */
async function unwrapWeth(privateKey) {
  const { account, wallet } = walletFor(privateKey);
  const bal = await publicClient().readContract({ address: WETH, abi: wethAbi, functionName: 'balanceOf', args: [account.address] });
  if (bal <= 0n) return null;
  const hash = await wallet.writeContract({ address: WETH, abi: wethAbi, functionName: 'withdraw', args: [bal] });
  await confirm(hash, 'WETH unwrap');
  console.log(`   Unwrapped ${bal.toString()} wei of WETH (${explorerTx(hash)})`);
  return hash;
}

/**
 * Collect fees into the dev wallet as ETH.
 * @returns {Promise<{claimTx: string|null, notes: string[]}>}
 */
export async function claimFees(config, privateKey) {
  const notes = [];
  let claimTx = null;
  const { account, wallet } = walletFor(privateKey);
  const client = publicClient();

  if (config.fee_source === 'univ3') {
    let ids = Array.isArray(config.univ3_position_ids) ? config.univ3_position_ids : [];
    if (!ids.length) ids = await discoverPositions(account.address, config.source_token_address);
    if (!ids.length) {
      notes.push('No Uniswap V3 position for this token in the dev wallet');
    }
    for (const id of ids) {
      try {
        const hash = await wallet.writeContract({
          address: UNIV3_NPM, abi: NPM_ABI, functionName: 'collect',
          args: [{ tokenId: BigInt(id), recipient: account.address, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
        });
        await confirm(hash, `collect position ${id}`);
        claimTx = claimTx || hash;
        console.log(`   Collected fees from V3 position #${id} (${explorerTx(hash)})`);
      } catch (e) {
        notes.push(`Position #${id}: ${e.shortMessage || e.message}`);
      }
    }
    // Token-side fees: turn them into ETH so the whole cycle is denominated in ETH.
    const tokenBal = await client.readContract({ address: config.source_token_address, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
    if (tokenBal > 0n) {
      try {
        const sold = await swapTokenForEth({ privateKey, token: config.source_token_address, amountRaw: tokenBal });
        if (sold) console.log(`   Liquidated token-side fees for ${sold.ethOut.toString()} wei (${explorerTx(sold.hash)})`);
        else notes.push('Token-side fees kept (no ETH route)');
      } catch (e) {
        notes.push(`Token-side fees kept: ${e.shortMessage || e.message}`);
      }
    }
  }

  // Both sources: WETH in the wallet counts as fees too.
  try {
    const wh = await unwrapWeth(privateKey);
    claimTx = claimTx || wh;
  } catch (e) {
    notes.push(`WETH unwrap failed: ${e.shortMessage || e.message}`);
  }

  return { claimTx, notes };
}

/** ETH available for this cycle: wallet balance minus the gas reserve. */
export async function availableEth(address, gasReserveWei) {
  const balance = await publicClient().getBalance({ address });
  const reserve = BigInt(gasReserveWei || 0);
  return { balance, spendable: balance > reserve ? balance - reserve : 0n };
}
