// Stock Token registry for the site (mirrors backend/src/chain/stocks.js).
import { STOCK_LIST } from './stocks-data';

const SECTOR_COLORS = {
  'Big Tech': '#1E88E5', Semis: '#7C4DFF', 'AI & Cloud': '#00ACC1', 'EV & Auto': '#FB8C00',
  'Defense & Space': '#607D8B', 'Crypto Street': '#F2A900', 'Meme & Quantum': '#EC407A',
  Fintech: '#93B80A', Energy: '#FDD835', 'Pharma & Health': '#43A047', Consumer: '#F06292',
  'Index & ETF': '#AB47BC', Hardware: '#5C6BC0', Software: '#26A69A', Industrial: '#8D6E63',
};

export const STOCKS = STOCK_LIST.map(([ticker, name, sector, address]) => ({
  ticker, name, sector, address, color: SECTOR_COLORS[sector] || '#00C805',
  logo: `https://assets.parqet.com/logos/symbol/${ticker}?format=png&size=128`,
}));
export const STOCK_BY_TICKER = Object.fromEntries(STOCKS.map((s) => [s.ticker, s]));
export const STOCK_BY_ADDRESS = Object.fromEntries(STOCKS.map((s) => [s.address.toLowerCase(), s]));
export const SECTORS = [...new Set(STOCKS.map((s) => s.sector))];

// Filled a 0.01 ETH order at 94%+ of the Yahoo price on Uniswap V4 (probe 2026-09-07). Mirrors backend/src/chain/stocks.js.
export const LIQUID_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'ORCL', 'NOW',
  'NVDA', 'AMD', 'INTC', 'MU', 'AVGO', 'QCOM', 'TSM', 'SMCI', 'ASML',
  'PLTR', 'SNOW', 'NET', 'DDOG', 'RDDT', 'TSLA', 'RKLB', 'ASTS', 'SPCX',
  'COIN', 'CRCL', 'GME', 'DJT', 'LLY', 'COST', 'TTWO', 'SPY', 'QQQ', 'GLD',
  'EWY', 'DELL', 'HPE', 'SNDK', 'ZM', 'CRWV', 'NBIS', 'WYFI', 'AAOI',
  'KLAC', 'LITE', 'TER',
];
export const TAPE_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'SPY', 'GLD', 'MSFT', 'AMZN', 'META', 'GOOGL', 'COIN', 'PLTR', 'GME', 'AMD', 'QQQ'];

export const BASKETS = {
  MAG7: { label: 'Magnificent 7', emoji: '👑', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'] },
  AI: { label: 'AI & Semis', emoji: '🧠', tickers: ['NVDA', 'AMD', 'MU', 'INTC', 'PLTR'] },
  DEGEN: { label: 'Degen Street', emoji: '🎢', tickers: ['GME', 'COIN', 'RDDT', 'TSLA', 'PLTR'] },
  HAVEN: { label: 'Safe Haven', emoji: '🏦', tickers: ['GLD', 'AAPL', 'MSFT'] },
};

export const ZERO = '0x0000000000000000000000000000000000000000';
export const isNative = (a) => !a || a.toLowerCase() === ZERO;

export function getStock(tickerOrAddress) {
  const q = String(tickerOrAddress || '').trim();
  if (!q) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return STOCK_BY_ADDRESS[q.toLowerCase()] || null;
  return STOCK_BY_TICKER[q.replace(/^\$/, '').toUpperCase()] || null;
}

/** Display info for any reward/source address: stock, ETH, or a generic token. */
export function describeAddress(address, meta = null) {
  if (isNative(address)) return { symbol: 'ETH', name: 'Ether', logo: '/eth.svg', color: '#627EEA', isStock: false, isNative: true };
  const s = getStock(address);
  if (s) return { symbol: s.ticker, name: s.name, logo: s.logo, color: s.color, isStock: true, isNative: false, sector: s.sector };
  const short = address ? `${address.slice(2, 6).toUpperCase()}` : '????';
  return {
    symbol: meta?.symbol || short,
    name: meta?.name || 'Token',
    logo: meta?.image || (address ? `https://dd.dexscreener.com/ds-data/tokens/robinhood/${address}.png?size=lg` : null),
    color: '#00C805', isStock: false, isNative: false,
  };
}

export const EXPLORER = 'https://robinhoodchain.blockscout.com';
export const explorerTx = (h) => `${EXPLORER}/tx/${h}`;
export const explorerAddress = (a) => `${EXPLORER}/address/${a}`;
export const explorerToken = (a) => `${EXPLORER}/token/${a}`;
export const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
