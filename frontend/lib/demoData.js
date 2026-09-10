// Sample policy shown on the dashboard before a wallet is connected: a real-looking
// coin, a five-leg routing, holdings and two past cycles. Nothing here is saved.
import { getStock, ZERO } from './stocks';

const NVDA = getStock('NVDA').address.toLowerCase();
const GLD = getStock('GLD').address.toLowerCase();
const SPY = getStock('SPY').address.toLowerCase();
const PONS = '0x39dbed3a2bd333467115de45665cc57f813c4571';
const DEMO_TOKEN = '0x00000000000000000000000000000000000d3m0';
const DEV = '0x4c86f00d3ac9e6b12b7f4c0a9d6e1b2c3d4e5f6a';
const now = Date.now();

export const DEMO_DATA = {
  demo: true,
  user: { id: 0, wallet: null, telegramLinked: false, telegramUsername: null },
  config: {
    id: 0, is_active: true, source_token_address: DEMO_TOKEN, dev_wallet_public: DEV, target_token_address: ZERO,
    reward_mode: 'fixed', basket: 'MAG7', schedule_kind: 'closing_bell', interval_minutes: 1440, market_hours_only: false, fee_source: 'wallet',
    split_holders_bps: 6000, split_creator_bps: 2500, split_burn_bps: 500, split_treasury_bps: 1000, creator_address: DEV, treasury_address: DEV, treasury_asset: null, payout_mode: 'in_kind',
    loyalty_enabled: true, loyalty_min_hold_hours: 24, loyalty_ramp_days: 30, loyalty_max_bps: 20000, loyalty_sell_reset: true,
    legs_enabled: true, gas_reserve_wei: '2000000000000000', scheduleLabel: 'at the closing bell',
  },
  legs: [
    { id: 1, kind: 'holders', share_bps: 6000, address: null, asset: null, label: 'Holders', sort_order: 0, pos_x: 480, pos_y: 30 },
    { id: 2, kind: 'wallet', share_bps: 1500, address: DEV, asset: GLD, label: 'Team', sort_order: 1, pos_x: 480, pos_y: 198 },
    { id: 3, kind: 'wallet', share_bps: 1000, address: '0x000000000000000000000000000000000000dead', asset: PONS, label: 'Partner $PONS', sort_order: 2, pos_x: 480, pos_y: 366 },
    { id: 4, kind: 'burn', share_bps: 500, address: null, asset: null, label: 'Buyback & burn', sort_order: 3, pos_x: 480, pos_y: 534 },
    { id: 5, kind: 'treasury', share_bps: 1000, address: DEV, asset: null, label: 'Treasury', sort_order: 4, pos_x: 480, pos_y: 702 },
  ],
  assets: {
    totalUsd: 148.2, gasReserveEth: 0.002,
    assets: [
      { address: ZERO, symbol: 'ETH', name: 'Ether', amount: 0.0312, spendable: 0.0292, usd: 92.4, isNative: true },
      { address: NVDA, symbol: 'NVDA', name: 'NVIDIA', amount: 0.0421, usd: 7.1, isNative: false },
      { address: GLD, symbol: 'GLD', name: 'Gold', amount: 0.0106, usd: 4.3, isNative: false },
      { address: SPY, symbol: 'SPY', name: 'S&P 500', amount: 0.058, usd: 44.4, isNative: false },
    ],
  },
  logs: [
    { id: 9001, cycle_key: 'demo-1', status: 'success', error_message: null, execution_time: new Date(now - 86400e3).toISOString(), holder_count: 412, claimed_eth_wei: '0', total_airdropped: '42100000000000000', reward_token_used: NVDA, asset_token: NVDA, asset_amount: '70000000000000000', creator_amount: '10500000000000000', burn_amount: '3500000000000000', treasury_amount: '7000000000000000', treasury_token: NVDA, tx_hash: null,
      legs: [{ kind: 'wallet', label: 'Team', output: { symbol: 'GLD', amount: '2600000000000000', decimals: 18 } }, { kind: 'wallet', label: 'Partner $PONS', output: { symbol: 'PONS', amount: '8300000000000000000', decimals: 18 } }, { kind: 'burn', label: 'Buyback & burn', output: { symbol: 'DEMO', amount: '1240000000000000000000', decimals: 18 } }, { kind: 'treasury', label: 'Treasury', output: { symbol: 'NVDA', amount: '7000000000000000', decimals: 18 } }] },
    { id: 9000, cycle_key: 'demo-0', status: 'success', error_message: null, execution_time: new Date(now - 2 * 86400e3).toISOString(), holder_count: 398, claimed_eth_wei: '0', total_airdropped: '10600000000000000', reward_token_used: GLD, asset_token: GLD, asset_amount: '17600000000000000', creator_amount: '2600000000000000', burn_amount: '900000000000000', treasury_amount: '1760000000000000', treasury_token: GLD, tx_hash: null, legs: [] },
  ],
  meta: {
    [DEMO_TOKEN]: { symbol: 'DEMO', name: 'Your coin', image: '/brand/yoyo-256.png', decimals: 18, marketCap: 1250000 },
    [PONS]: { symbol: 'PONS', name: 'Pons', image: 'https://cdn.dexscreener.com/cms/images/dkmXs8KYMyMXjuU1?width=128&height=128&fit=crop&quality=95&format=png', decimals: 18, marketCap: 534000000 },
  },
  yield: { apy: 12.4 },
  timestamp: new Date(now).toISOString(),
};

/** Blank canvas for a wallet that has no policy yet: one holders leg, nothing else. */
export const blankData = (user) => ({
  setup: true,
  user,
  config: {
    id: 0, is_active: false, source_token_address: DEMO_TOKEN, dev_wallet_public: '0x0000000000000000000000000000000000000000', target_token_address: ZERO,
    reward_mode: 'fixed', basket: 'MAG7', schedule_kind: 'closing_bell', interval_minutes: 1440, market_hours_only: false, fee_source: 'wallet',
    split_holders_bps: 10000, split_creator_bps: 0, split_burn_bps: 0, split_treasury_bps: 0, creator_address: null, treasury_address: null, treasury_asset: null, payout_mode: 'in_kind',
    loyalty_enabled: true, loyalty_min_hold_hours: 24, loyalty_ramp_days: 30, loyalty_max_bps: 20000, loyalty_sell_reset: true,
    legs_enabled: true, gas_reserve_wei: '2000000000000000', scheduleLabel: 'at the closing bell',
  },
  legs: [{ id: 1, kind: 'holders', share_bps: 10000, address: null, asset: null, label: 'Holders', sort_order: 0, pos_x: 480, pos_y: 60 }],
  assets: { totalUsd: 0, gasReserveEth: 0.002, assets: [] },
  logs: [],
  meta: { [DEMO_TOKEN]: { symbol: '…', name: 'Your coin', image: '/brand/yoyo-256.png', decimals: 18, marketCap: null } },
  yield: null,
  timestamp: new Date().toISOString(),
});
