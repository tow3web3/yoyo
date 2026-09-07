import { Arrow } from './Icons';

export default function CTA() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'boomerangtekbot';
  return (
    <div className="panel-ink relative flex flex-col items-center justify-between gap-6 overflow-hidden px-8 py-10 text-center sm:flex-row sm:text-left">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-hood-500/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-hood-400">Ring the bell</div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Give your holders a dividend.</h2>
        <p className="mt-2 text-sm text-white/70">Set it up in under 2 minutes. No code: pick the stock, the schedule, and go.</p>
      </div>
      <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="btn-primary relative shrink-0">
        Launch Boomerang
        <Arrow className="h-4 w-4" />
      </a>
    </div>
  );
}
