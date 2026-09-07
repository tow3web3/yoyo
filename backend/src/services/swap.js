// ETH -> reward token on Robinhood Chain.
//
// Stock Token liquidity lives in Uniswap V4 (PoolManager singleton, pools keyed
// vs native ETH or USDG). GLD and most memecoins trade on V3; the V2 pools are
// mostly dust. So every swap is routed: V4 (direct + via USDG) -> V3 (WETH ->
// token, WETH -> USDG -> token, simulated through SwapRouter02) -> V2. When a
// Yahoo fair price exists for the reward, a route is only taken if it delivers
// at least MIN_FAIR_RATIO of fair value.
import { encodePacked, parseAbi, maxUint256 } from 'viem';
import {
  publicClient, walletFor, confirm, erc20Abi, wethAbi,
  ZERO, WETH, USDG, UNIV2_ROUTER, UNIV3_SWAP_ROUTER02, UNIV4_QUOTER, UNIV4_ROUTER,
  explorerTx,
} from '../chain/config.js';

export const MIN_FAIR_RATIO = parseFloat(process.env.MIN_SWAP_FAIR_RATIO || '0.9');

const FEE_TIERS = [[100, 1], [500, 10], [3000, 60], [10000, 200]];
const MIN_SQRT_PRICE_PLUS_1 = 4295128740n;
const MAX_SQRT_PRICE_MINUS_1 = 1461446703485210103287273052203988822378723970341n;

const V4_QUOTER_ABI = parseAbi([
  'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
  'function quoteExactInputSingle((PoolKey poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
]);
const V4_ROUTER_ABI = parseAbi([
  'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
  'function exactInputSingle((PoolKey key, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, uint160 sqrtPriceLimitX96, address recipient, uint256 deadline, bytes hookData) params) payable returns (uint256 amountInUsed, uint256 amountOut)',
]);
const V3_ROUTER_ABI = parseAbi([
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) payable returns (uint256 amountOut)',
]);
const V2_ROUTER_ABI = parseAbi([
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
]);

const lc = (a) => a.toLowerCase();
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 180);

// ---------------------------------------------------------------- V4 quoting
function v4Key(a, b, fee, tickSpacing) {
  const [c0, c1] = lc(a) < lc(b) ? [a, b] : [b, a];
  return { key: { currency0: c0, currency1: c1, fee, tickSpacing, hooks: ZERO }, zeroForOne: lc(c0) === lc(a) };
}

async function v4QuoteSingle(tokenIn, tokenOut, fee, tickSpacing, amountIn) {
  if (amountIn <= 0n) return null;
  const { key, zeroForOne } = v4Key(tokenIn, tokenOut, fee, tickSpacing);
  try {
    const { result } = await publicClient().simulateContract({
      address: UNIV4_QUOTER, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle',
      args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: '0x' }],
    });
    const out = result[0];
    return out > 0n ? { key, zeroForOne, tokenIn, out } : null;
  } catch {
    return null;
  }
}

async function v4BestSingle(tokenIn, tokenOut, amountIn) {
  let best = null;
  for (const [fee, tick] of FEE_TIERS) {
    const q = await v4QuoteSingle(tokenIn, tokenOut, fee, tick, amountIn);
    if (q && (!best || q.out > best.out)) best = q;
  }
  return best;
}

async function quoteV4(token, amountWei) {
  const direct = await v4BestSingle(ZERO, token, amountWei);
  let viaUsdg = null;
  const first = await v4BestSingle(ZERO, USDG, amountWei);
  if (first) {
    const second = await v4BestSingle(USDG, token, first.out);
    if (second) viaUsdg = { venue: 'v4', label: 'V4 ETH > USDG > token', legs: [first, second], out: second.out };
  }
  const directRoute = direct ? { venue: 'v4', label: 'V4 ETH > token', legs: [direct], out: direct.out } : null;
  if (directRoute && viaUsdg) return directRoute.out >= viaUsdg.out ? directRoute : viaUsdg;
  return directRoute ?? viaUsdg;
}

// ---------------------------------------------------------------- V3 quoting
function encodePath(hops) {
  const types = hops.map((_, i) => (i % 2 === 0 ? 'address' : 'uint24'));
  return encodePacked(types, hops);
}

function v3Candidates(token) {
  const routes = [];
  for (const [fee] of FEE_TIERS) routes.push({ label: `V3 WETH ${fee / 10000}% token`, hops: [WETH, fee, token] });
  for (const f1 of [100, 500]) for (const [f2] of FEE_TIERS) {
    routes.push({ label: `V3 WETH ${f1 / 10000}% USDG ${f2 / 10000}% token`, hops: [WETH, f1, USDG, f2, token] });
  }
  return routes;
}

async function quoteV3(token, amountWei, recipient) {
  const client = publicClient();
  let best = null;
  await Promise.all(v3Candidates(token).map(async (route) => {
    try {
      const { result } = await client.simulateContract({
        address: UNIV3_SWAP_ROUTER02, abi: V3_ROUTER_ABI, functionName: 'exactInput',
        args: [{ path: encodePath(route.hops), recipient, amountIn: amountWei, amountOutMinimum: 0n }],
        value: amountWei, account: recipient,
      });
      if (result > 0n && (!best || result > best.out)) best = { venue: 'v3', label: route.label, hops: route.hops, out: result };
    } catch {
      // no liquidity on this route
    }
  }));
  return best;
}

// ---------------------------------------------------------------- V2 quoting
async function quoteV2(token, amountWei) {
  const client = publicClient();
  let best = null;
  for (const path of [[WETH, token], [WETH, USDG, token]]) {
    try {
      const amounts = await client.readContract({ address: UNIV2_ROUTER, abi: V2_ROUTER_ABI, functionName: 'getAmountsOut', args: [amountWei, path] });
      const out = amounts[amounts.length - 1];
      if (out > 0n && (!best || out > best.out)) best = { venue: 'v2', label: `V2 ${path.length === 2 ? 'WETH > token' : 'WETH > USDG > token'}`, path, out };
    } catch {
      // no pair
    }
  }
  return best;
}

/**
 * Best route across venues for ETH -> token. `fairOut` (raw units) enables the
 * oracle guard: routes below MIN_FAIR_RATIO of it are rejected.
 * Returns { route, ratio } or null.
 */
export async function quoteEthForToken({ token, amountWei, recipient, fairOut = null }) {
  const guard = (route) => {
    if (!route) return null;
    if (!fairOut || fairOut <= 0n) return { route, ratio: null };
    const ratio = Number((route.out * 10_000n) / fairOut) / 10_000;
    return ratio >= MIN_FAIR_RATIO ? { route, ratio } : null;
  };
  const rejected = [];
  for (const q of [() => quoteV4(token, amountWei), () => quoteV3(token, amountWei, recipient), () => quoteV2(token, amountWei)]) {
    const route = await q();
    const ok = guard(route);
    if (ok) return ok;
    if (route) rejected.push(`${route.label} (${fairOut ? `${(Number((route.out * 10_000n) / fairOut) / 100).toFixed(1)}% of fair` : 'no quote'})`);
  }
  if (rejected.length) console.log(`   Routes rejected by the fair-price guard: ${rejected.join(', ')}`);
  return null;
}

async function ensureAllowance(wallet, account, token, spender, amount) {
  const client = publicClient();
  const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account.address, spender] });
  if (allowance >= amount) return;
  const hash = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [spender, maxUint256] });
  await confirm(hash, 'approve');
}

async function balanceOf(token, owner) {
  return publicClient().readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
}

/** Execute a quoted route. Returns { hash, outputAmount } with the real balance delta. */
async function executeRoute({ privateKey, token, amountWei, route, slippageBps }) {
  const { account, wallet } = walletFor(privateKey);
  const before = await balanceOf(token, account.address);
  const minOutFor = (expected) => (expected * BigInt(10_000 - slippageBps)) / 10_000n;
  let hash;

  if (route.venue === 'v4') {
    let amountIn = amountWei;
    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      const isNative = leg.tokenIn === ZERO;
      if (!isNative) await ensureAllowance(wallet, account, leg.tokenIn, UNIV4_ROUTER, amountIn);
      const outToken = leg.zeroForOne ? leg.key.currency1 : leg.key.currency0;
      const fresh = await v4QuoteSingle(leg.tokenIn, outToken, leg.key.fee, leg.key.tickSpacing, amountIn);
      const expected = fresh?.out ?? leg.out;
      const isLast = i === route.legs.length - 1;
      const outBefore = isLast ? 0n : await balanceOf(outToken, account.address);
      hash = await wallet.writeContract({
        address: UNIV4_ROUTER, abi: V4_ROUTER_ABI, functionName: 'exactInputSingle',
        args: [{
          key: leg.key, zeroForOne: leg.zeroForOne, amountIn, minAmountOut: minOutFor(expected),
          sqrtPriceLimitX96: leg.zeroForOne ? MIN_SQRT_PRICE_PLUS_1 : MAX_SQRT_PRICE_MINUS_1,
          recipient: account.address, deadline: deadline(), hookData: '0x',
        }],
        value: isNative ? amountIn : 0n,
      });
      await confirm(hash, `V4 swap leg ${i + 1}`);
      if (!isLast) {
        const outAfter = await balanceOf(outToken, account.address);
        amountIn = outAfter - outBefore;
        if (amountIn <= 0n) throw new Error(`V4 leg ${i + 1} produced no output`);
      }
    }
  } else if (route.venue === 'v3') {
    hash = await wallet.writeContract({
      address: UNIV3_SWAP_ROUTER02, abi: V3_ROUTER_ABI, functionName: 'exactInput',
      args: [{ path: encodePath(route.hops), recipient: account.address, amountIn: amountWei, amountOutMinimum: minOutFor(route.out) }],
      value: amountWei,
    });
    await confirm(hash, 'V3 swap');
  } else {
    hash = await wallet.writeContract({
      address: UNIV2_ROUTER, abi: V2_ROUTER_ABI, functionName: 'swapExactETHForTokens',
      args: [minOutFor(route.out), route.path, account.address, deadline()],
      value: amountWei,
    });
    await confirm(hash, 'V2 swap');
  }

  const after = await balanceOf(token, account.address);
  const outputAmount = after - before;
  if (outputAmount <= 0n) throw new Error('Swap confirmed but no tokens received');
  return { hash, outputAmount };
}

/**
 * Swap ETH for a token from the dev wallet with the fair-price guard.
 * `oracle` = { stockUsd, ethUsd } enables the guard (stock rewards).
 * Throws when no route clears the guard; the executor then pays ETH instead.
 */
export async function swapEthForToken({ privateKey, token, decimals, amountWei, slippageBps = 150, oracle = null }) {
  const { account } = walletFor(privateKey);
  let fairOut = null;
  if (oracle?.stockUsd > 0 && oracle?.ethUsd > 0) {
    const fairTokens = (Number(amountWei) / 1e18) * (oracle.ethUsd / oracle.stockUsd);
    fairOut = BigInt(Math.floor(fairTokens * 10 ** decimals));
  }
  const quoted = await quoteEthForToken({ token, amountWei, recipient: account.address, fairOut });
  if (!quoted) throw new Error(fairOut ? `No route delivers ${(MIN_FAIR_RATIO * 100).toFixed(0)}% of fair value` : 'No liquidity route for this token');
  const { route, ratio } = quoted;
  console.log(`   Route: ${route.label}${ratio !== null ? ` at ${(ratio * 100).toFixed(1)}% of fair` : ''}, expecting ${route.out.toString()} raw`);
  const result = await executeRoute({ privateKey, token, amountWei, route, slippageBps });
  console.log(`   Swap confirmed: ${explorerTx(result.hash)} (received ${result.outputAmount.toString()} raw)`);
  return { ...result, route: route.label, ratio };
}

/**
 * Best-effort liquidation of an ERC-20 balance into ETH (used for the token side
 * of Uniswap V3 LP fees). V3 token -> WETH then unwrap, else V2 token -> ETH.
 * Returns { hash, ethOut } or null when there is no usable route.
 */
export async function swapTokenForEth({ privateKey, token, amountRaw, slippageBps = 300 }) {
  if (amountRaw <= 0n) return null;
  const client = publicClient();
  const { account, wallet } = walletFor(privateKey);

  // V3: quote token -> WETH across tiers by simulation.
  let best = null;
  for (const [fee] of FEE_TIERS) {
    try {
      await ensureAllowance(wallet, account, token, UNIV3_SWAP_ROUTER02, amountRaw);
      const { result } = await client.simulateContract({
        address: UNIV3_SWAP_ROUTER02, abi: V3_ROUTER_ABI, functionName: 'exactInput',
        args: [{ path: encodePath([token, fee, WETH]), recipient: account.address, amountIn: amountRaw, amountOutMinimum: 0n }],
        account: account.address,
      });
      if (result > 0n && (!best || result > best.out)) best = { venue: 'v3', fee, out: result };
    } catch {
      // no pool at this tier
    }
  }
  if (best) {
    const wethBefore = await client.readContract({ address: WETH, abi: wethAbi, functionName: 'balanceOf', args: [account.address] });
    const hash = await wallet.writeContract({
      address: UNIV3_SWAP_ROUTER02, abi: V3_ROUTER_ABI, functionName: 'exactInput',
      args: [{ path: encodePath([token, best.fee, WETH]), recipient: account.address, amountIn: amountRaw, amountOutMinimum: (best.out * BigInt(10_000 - slippageBps)) / 10_000n }],
    });
    await confirm(hash, 'V3 token > WETH');
    const wethAfter = await client.readContract({ address: WETH, abi: wethAbi, functionName: 'balanceOf', args: [account.address] });
    const got = wethAfter - wethBefore;
    if (got > 0n) {
      const wh = await wallet.writeContract({ address: WETH, abi: wethAbi, functionName: 'withdraw', args: [got] });
      await confirm(wh, 'WETH unwrap');
    }
    return { hash, ethOut: got };
  }

  // V2 fallback
  try {
    const amounts = await client.readContract({ address: UNIV2_ROUTER, abi: V2_ROUTER_ABI, functionName: 'getAmountsOut', args: [amountRaw, [token, WETH]] });
    const out = amounts[amounts.length - 1];
    if (out <= 0n) return null;
    await ensureAllowance(wallet, account, token, UNIV2_ROUTER, amountRaw);
    const hash = await wallet.writeContract({
      address: UNIV2_ROUTER, abi: V2_ROUTER_ABI, functionName: 'swapExactTokensForETH',
      args: [amountRaw, (out * BigInt(10_000 - slippageBps)) / 10_000n, [token, WETH], account.address, deadline()],
    });
    await confirm(hash, 'V2 token > ETH');
    return { hash, ethOut: out };
  } catch {
    return null;
  }
}
