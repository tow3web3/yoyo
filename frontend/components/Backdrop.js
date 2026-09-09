// Ambient backdrop: a faint chart grid with a rising line, plus a few slow
// boomerangs, all at low opacity so the content stays the subject.
import Image from 'next/image';

const BOOMS = [
  { pos: 'left-[4%] top-[16%]', size: 'h-24 w-24', dur: 28, reverse: false, opacity: 0.1 },
  { pos: 'right-[6%] top-[22%]', size: 'h-40 w-40', dur: 38, reverse: true, opacity: 0.08 },
  { pos: 'left-[12%] top-[62%]', size: 'h-20 w-20', dur: 22, reverse: true, opacity: 0.1 },
  { pos: 'right-[14%] top-[70%]', size: 'h-28 w-28', dur: 32, reverse: false, opacity: 0.09 },
];

export default function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1440 900">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="rgba(11,15,12,0.05)" strokeWidth="1" />
          </pattern>
          <linearGradient id="rise" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#CAF90F" stopOpacity="0" />
            <stop offset="0.6" stopColor="#CAF90F" stopOpacity="0.7" />
            <stop offset="1" stopColor="#F6C343" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CAF90F" stopOpacity="0.18" />
            <stop offset="1" stopColor="#CAF90F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1440" height="900" fill="url(#grid)" />
        <path d="M0 720 C 180 700 260 640 380 660 S 560 560 700 540 S 900 460 1040 400 S 1300 260 1440 200 V 900 H 0 Z" fill="url(#fill)" />
        <path d="M0 720 C 180 700 260 640 380 660 S 560 560 700 540 S 900 460 1040 400 S 1300 260 1440 200" fill="none" stroke="url(#rise)" strokeWidth="2.5" />
      </svg>
      {BOOMS.map((it, i) => (
        <div
          key={i}
          className={`absolute animate-spin ${it.pos} ${it.size}`}
          style={{ opacity: it.opacity, animationDuration: `${it.dur}s`, animationDirection: it.reverse ? 'reverse' : 'normal', animationTimingFunction: 'linear' }}
        >
          <Image src="/brand/boom-256.png" alt="" fill className="object-contain" />
        </div>
      ))}
    </div>
  );
}
