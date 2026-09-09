'use client';

import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import VoteDashboard from '../../components/vote/VoteDashboard';
import LiveVotes from '../../components/vote/LiveVotes';

export default function VotePage() {
  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <div className="eyebrow mb-2">Community Vote</div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Holders pick the dividend 🪀🗳️</h1>
          <p className="mt-2 text-sm leading-relaxed text-mut">
            Connect your wallet to vote on the next stock for every Yoyo token you hold. Votes are weighted by your
            balance at the cycle snapshot, and gasless: you just sign a message.
          </p>
        </div>
        <LiveVotes />
        <VoteDashboard />
      </main>
      <Footer />
    </>
  );
}
