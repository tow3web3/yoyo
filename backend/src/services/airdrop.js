// Distribution: ERC-20 or native ETH to many holders. If a Disperse contract is
// configured (contracts/BoomerangDisperse.sol), one transaction pays up to
// DISPERSE_BATCH holders; otherwise transfers go out one per recipient with
// sequential nonces, in parallel waves, which is cheap on this L2.
import { parseAbi, maxUint256 } from 'viem';
import { publicClient, walletFor, erc20Abi, DEAD, isAddress, explorerTx } from '../chain/config.js';

const DISPERSE_ADDRESS = isAddress(process.env.DISPERSE_ADDRESS) ? process.env.DISPERSE_ADDRESS : null;
const DISPERSE_BATCH = 150;
const WAVE = 20; // parallel single transfers per wave

const DISPERSE_ABI = parseAbi([
  'function disperseEther(address[] recipients, uint256[] values) payable',
  'function disperseToken(address token, address[] recipients, uint256[] values)',
]);

async function waitAll(hashes) {
  const client = publicClient();
  return Promise.all(hashes.map((hash) => client.waitForTransactionReceipt({ hash, timeout: 180_000 }).then((r) => r.status === 'success').catch(() => false)));
}

/**
 * Pure-integer pro-rata split by weight (loyalty-adjusted balance, or the plain
 * balance when weights are absent); leftover dust goes to the largest holder.
 */
export function calculateDistributions(holders, totalToDistribute, minAmount = 0n) {
  const total = BigInt(totalToDistribute);
  const weightOf = (h) => BigInt(h.weight ?? h.balance);
  const totalWeight = holders.reduce((sum, h) => sum + weightOf(h), 0n);
  if (totalWeight === 0n) throw new Error('Total holdings cannot be zero');

  const distributions = holders
    .map((holder) => ({
      address: holder.address,
      holderBalance: BigInt(holder.balance),
      multiplierBps: holder.multiplierBps ?? 10000,
      amount: (total * weightOf(holder)) / totalWeight,
    }))
    .filter((d) => d.amount >= BigInt(minAmount) && d.amount > 0n);

  const allocated = distributions.reduce((sum, d) => sum + d.amount, 0n);
  const remainder = total - allocated;
  if (remainder > 0n && distributions.length > 0) {
    let largest = distributions[0];
    for (const d of distributions) if (d.holderBalance > largest.holderBalance) largest = d;
    largest.amount += remainder;
  }
  console.log(`   ${distributions.length} distributions from ${holders.length} holders, ${total.toString()} raw total`);
  return distributions;
}

async function viaDisperse({ privateKey, token, distributions }) {
  const { account, wallet } = walletFor(privateKey);
  const client = publicClient();
  const results = { successful: [], failed: [], totalSent: 0n, txHashes: [] };

  if (token) {
    const total = distributions.reduce((s, d) => s + d.amount, 0n);
    const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account.address, DISPERSE_ADDRESS] });
    if (allowance < total) {
      const ah = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [DISPERSE_ADDRESS, maxUint256] });
      await client.waitForTransactionReceipt({ hash: ah });
    }
  }

  for (let i = 0; i < distributions.length; i += DISPERSE_BATCH) {
    const batch = distributions.slice(i, i + DISPERSE_BATCH);
    const recipients = batch.map((d) => d.address);
    const values = batch.map((d) => d.amount);
    const value = values.reduce((s, v) => s + v, 0n);
    try {
      const hash = token
        ? await wallet.writeContract({ address: DISPERSE_ADDRESS, abi: DISPERSE_ABI, functionName: 'disperseToken', args: [token, recipients, values] })
        : await wallet.writeContract({ address: DISPERSE_ADDRESS, abi: DISPERSE_ABI, functionName: 'disperseEther', args: [recipients, values], value });
      const [ok] = await waitAll([hash]);
      results.txHashes.push(hash);
      for (const d of batch) {
        if (ok) { results.successful.push({ ...d, hash }); results.totalSent += d.amount; }
        else results.failed.push({ ...d, error: `batch reverted ${hash}` });
      }
      console.log(`   Disperse batch ${Math.floor(i / DISPERSE_BATCH) + 1}: ${ok ? 'ok' : 'REVERTED'} ${explorerTx(hash)}`);
    } catch (e) {
      for (const d of batch) results.failed.push({ ...d, error: e.shortMessage || e.message });
    }
  }
  return results;
}

async function viaSingles({ privateKey, token, distributions }) {
  const { account, wallet } = walletFor(privateKey);
  const client = publicClient();
  const results = { successful: [], failed: [], totalSent: 0n, txHashes: [] };
  let nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });

  for (let i = 0; i < distributions.length; i += WAVE) {
    const wave = distributions.slice(i, i + WAVE);
    const sent = [];
    for (const d of wave) {
      try {
        const hash = token
          ? await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'transfer', args: [d.address, d.amount], nonce: nonce++ })
          : await wallet.sendTransaction({ to: d.address, value: d.amount, nonce: nonce++ });
        sent.push({ d, hash });
      } catch (e) {
        results.failed.push({ ...d, error: e.shortMessage || e.message });
        // A failed send never consumed the nonce; re-read to stay aligned.
        nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });
      }
    }
    const oks = await waitAll(sent.map((s) => s.hash));
    sent.forEach(({ d, hash }, j) => {
      results.txHashes.push(hash);
      if (oks[j]) { results.successful.push({ ...d, hash }); results.totalSent += d.amount; }
      else results.failed.push({ ...d, error: `reverted ${hash}` });
    });
    console.log(`   Wave ${Math.floor(i / WAVE) + 1}/${Math.ceil(distributions.length / WAVE)}: ${oks.filter(Boolean).length}/${sent.length} confirmed`);
  }
  return results;
}

export async function distributeTokens(privateKey, token, distributions) {
  console.log(`   Paying ${distributions.length} holders in ${token}${DISPERSE_ADDRESS ? ' via Disperse' : ''}`);
  const valid = distributions.filter((d) => d.amount > 0n);
  return DISPERSE_ADDRESS ? viaDisperse({ privateKey, token, distributions: valid }) : viaSingles({ privateKey, token, distributions: valid });
}

export async function distributeEth(privateKey, distributions) {
  console.log(`   Paying ${distributions.length} holders in ETH${DISPERSE_ADDRESS ? ' via Disperse' : ''}`);
  const valid = distributions.filter((d) => d.amount > 0n);
  return DISPERSE_ADDRESS ? viaDisperse({ privateKey, token: null, distributions: valid }) : viaSingles({ privateKey, token: null, distributions: valid });
}

/** Buy back and burn: send the whole bought amount to the dead address. */
export async function burnTokens(privateKey, token, amount) {
  const { wallet } = walletFor(privateKey);
  const hash = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'transfer', args: [DEAD, amount] });
  const [ok] = await waitAll([hash]);
  if (!ok) throw new Error(`Burn reverted: ${explorerTx(hash)}`);
  console.log(`   Burned ${amount.toString()} raw (${explorerTx(hash)})`);
  return hash;
}
