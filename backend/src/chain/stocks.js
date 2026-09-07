// Stock Token registry helpers, baskets and curated pools for the reward modes.
import { STOCK_LIST } from './stocks-data.js';

const SECTOR_COLORS = {
  'Big Tech': '#1E88E5', Semis: '#7C4DFF', 'AI & Cloud': '#00ACC1', 'EV & Auto': '#FB8C00',
  'Defense & Space': '#607D8B', 'Crypto Street': '#F2A900', 'Meme & Quantum': '#EC407A',
  Fintech: '#00C805', Energy: '#FDD835', 'Pharma & Health': '#43A047', Consumer: '#F06292',
  'Index & ETF': '#AB47BC', Hardware: '#5C6BC0', Software: '#26A69A', Industrial: '#8D6E63',
};

export const STOCKS = STOCK_LIST.map(([ticker, name, sector, address]) => ({
  ticker, name, sector, address, color: SECTOR_COLORS[sector] || '#00C805',
  logo: `https://assets.parqet.com/logos/symbol/${ticker}?format=png&size=128`,
}));

export const STOCK_BY_TICKER = Object.fromEntries(STOCKS.map((s) => [s.ticker, s]));
export const STOCK_BY_ADDRESS = Object.fromEntries(STOCKS.map((s) => [s.address.toLowerCase(), s]));
export const STOCK_TICKERS = STOCKS.map((s) => s.ticker);

/** Resolve a ticker (any case, optional $) or an address to a registry entry. */
export function getStock(tickerOrAddress) {
  const q = String(tickerOrAddress || '').trim();
  if (!q) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return STOCK_BY_ADDRESS[q.toLowerCase()] || null;
  return STOCK_BY_TICKER[q.replace(/^\$/, '').toUpperCase()] || null;
}

export const isStockToken = (address) => Boolean(STOCK_BY_ADDRESS[String(address || '').toLowerCase()]);

// Tickers whose Uniswap V4 pools filled a 0.01 ETH order at 94% or better of
// the Yahoo price (probe of all 195 on 2026-09-07, `npm run probe ALL 0.01`).
// Roulette and Top Gainer draw from here so a cycle never lands on a dead pool.
// Re-run the probe as Robinhood adds liquidity.
export const LIQUID_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'ORCL', 'NOW',
  'NVDA', 'AMD', 'INTC', 'MU', 'AVGO', 'QCOM', 'TSM', 'SMCI', 'ASML',
  'PLTR', 'SNOW', 'NET', 'DDOG', 'RDDT', 'TSLA', 'RKLB', 'ASTS', 'SPCX',
  'COIN', 'CRCL', 'GME', 'DJT', 'LLY', 'COST', 'TTWO', 'SPY', 'QQQ', 'GLD',
  'EWY', 'DELL', 'HPE', 'SNDK', 'ZM', 'CRWV', 'NBIS', 'WYFI', 'AAOI',
  'KLAC', 'LITE', 'TER',
];
export const LIQUID_STOCKS = LIQUID_TICKERS.map((t) => STOCK_BY_TICKER[t]).filter(Boolean);

// Portfolio mode rotates through a basket, one stock per cycle, so holders
// end up owning a diversified set over time.
export const BASKETS = {
  MAG7: { label: 'Magnificent 7', emoji: '👑', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'] },
  AI: { label: 'AI & Semis', emoji: '🧠', tickers: ['NVDA', 'AMD', 'MU', 'INTC', 'PLTR'] },
  DEGEN: { label: 'Degen Street', emoji: '🎢', tickers: ['GME', 'COIN', 'RDDT', 'TSLA', 'PLTR'] },
  HAVEN: { label: 'Safe Haven', emoji: '🏦', tickers: ['GLD', 'AAPL', 'MSFT'] },
};
export const BASKET_KEYS = Object.keys(BASKETS);

/** Quick-pick stocks offered in the Telegram setup. */
export const FEATURED_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'GLD', 'COIN', 'GME'];

export function pickRandomLiquid() {
  return LIQUID_STOCKS[Math.floor(Math.random() * LIQUID_STOCKS.length)];
}

/** Yahoo Finance symbol for a ticker (all registry tickers map 1:1). */
export const yahooSymbol = (ticker) => ticker;
