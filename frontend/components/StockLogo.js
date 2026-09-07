'use client';

import { useState } from 'react';
import { describeAddress } from '../lib/stocks';

/**
 * Logo disc for any asset: stock logo (parqet), ETH mark, DexScreener image for
 * other tokens, and a coloured monogram when nothing loads.
 */
export default function StockLogo({ address, meta, size = 'h-9 w-9', text = 'text-[10px]', className = '' }) {
  const d = describeAddress(address, meta);
  const [broken, setBroken] = useState(!d.logo);
  if (!broken) {
    return (
      <span className={`stock-logo ${size} ${className}`}>
        <img src={d.logo} alt={d.symbol} onError={() => setBroken(true)} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`stock-logo ${size} ${text} font-mono font-bold text-white ${className}`} style={{ background: d.color, borderColor: d.color }}>
      {d.symbol.replace('$', '').slice(0, 4)}
    </span>
  );
}
