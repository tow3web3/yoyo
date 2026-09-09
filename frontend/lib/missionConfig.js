// $YOYO on Robinhood Chain + the minimum holding required for missions.
export const BOOMERANG_TOKEN = process.env.NEXT_PUBLIC_BOOMERANG_CA || process.env.BOOMERANG_TOKEN_ADDRESS || '';
export const MIN_HOLD = 100_000;

export function claimMessage(wallet) {
  return `yo-yo Missions, claim rewards\nChain: Robinhood Chain (4663)\nWallet: ${wallet}`;
}

export const RANKS = [
  { name: 'Rookie', min: 0, emoji: '🥚' },
  { name: 'Holder', min: 100, emoji: '🪀' },
  { name: 'Diamond', min: 300, emoji: '💎' },
  { name: 'Whale', min: 700, emoji: '🐋' },
  { name: 'Legend', min: 1500, emoji: '👑' },
];

export function rankForXp(xp = 0) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].min) i = k;
  const cur = RANKS[i];
  const next = RANKS[i + 1] || null;
  const span = next ? next.min - cur.min : 1;
  const pct = next ? Math.min(100, Math.round(((xp - cur.min) / span) * 100)) : 100;
  return { ...cur, level: i + 1, next, pct, toNext: next ? next.min - xp : 0 };
}
