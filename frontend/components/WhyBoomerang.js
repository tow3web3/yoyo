'use client';

import { useEffect, useRef, useState } from 'react';

// Boomerangs fly a return loop and their sweep uncovers the text.
export default function WhyBoomerang() {
  const ref = useRef(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setPlayed(true); io.disconnect(); }
    }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`wb-stage panel relative overflow-hidden px-7 py-14 sm:px-12 sm:py-16 ${played ? 'in' : ''}`}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="wb-boom wb-boom--1"><img className="wb-spin" src="/newlogopng.png" alt="" /></div>
        <div className="wb-boom wb-boom--2"><img className="wb-spin" src="/newlogopng.png" alt="" /></div>
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="wb-reveal eyebrow mb-3" style={{ transitionDelay: '150ms' }}>The missing layer</div>
        <h2 className="wb-reveal font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl" style={{ transitionDelay: '350ms' }}>
          Memecoins finally pay <span className="text-gradient">dividends</span>.
        </h2>
        <p className="wb-reveal mt-5 text-[15px] leading-relaxed text-mut" style={{ transitionDelay: '900ms' }}>
          Robinhood Chain is the first chain where 195 real stocks and ETFs trade as plain tokens. Every launchpad on it
          pays creators their fees in ETH. Until now, those fees just sat in a wallet.
        </p>
        <p className="wb-reveal mt-4 text-[15px] leading-relaxed text-mut" style={{ transitionDelay: '1250ms' }}>
          <span className="font-semibold text-ink">Boomerang closes the loop:</span> one bot, plugged into your dev wallet.
          You pick the stock, the schedule, and the destination. Holders wake up to NVDA in their wallet because they held
          your coin. Like a boomerang, the fees always come back.
        </p>
      </div>
    </div>
  );
}
