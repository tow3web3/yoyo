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
        <div className="wb-boom wb-boom--1"><img className="wb-spin" src="/brand/boomerang-256.png" alt="" /></div>
        <div className="wb-boom wb-boom--2"><img className="wb-spin" src="/brand/boomerang-256.png" alt="" /></div>
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="wb-reveal eyebrow mb-3" style={{ transitionDelay: '150ms' }}>The missing layer</div>
        <h2 className="wb-reveal font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl" style={{ transitionDelay: '350ms' }}>
          Memecoins have cash flow now. They need a <span className="text-gradient">dividend policy</span>.
        </h2>
        <p className="wb-reveal mt-5 text-[15px] leading-relaxed text-mut" style={{ transitionDelay: '900ms' }}>
          On Robinhood Chain, launchpads pay creators their fees in real stocks: NVDA, SPY, GLD. A memecoin with fees
          in NVDA is a company with revenue. And every company with revenue has to answer one question: what happens to it?
        </p>
        <p className="wb-reveal mt-4 text-[15px] leading-relaxed text-mut" style={{ transitionDelay: '1250ms' }}>
          <span className="font-semibold text-ink">Boomerang is that answer.</span> A payout ratio to holders, paid in kind. A share you keep.
          Buybacks. Retained earnings in a stock treasury with a published book value. A record date that rewards the people who
          actually hold. A dividend calendar. A yield anyone can compare. One bot, plugged into your dev wallet: the fees come back.
        </p>
      </div>
    </div>
  );
}
