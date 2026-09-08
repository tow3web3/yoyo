import TickerTape from '../components/TickerTape'
import Navigation from '../components/Navigation'
import Hero from '../components/Hero'
import WhyBoomerang from '../components/WhyBoomerang'
import Peeks from '../components/Peeks'
import StatsBar from '../components/StatsBar'
import TokenSearch from '../components/TokenSearch'
import LiveFeed from '../components/LiveFeed'
import Screener from '../components/Screener'
import HowItWorks from '../components/HowItWorks'
import StockUniverse from '../components/StockUniverse'
import Modes from '../components/Modes'
import Developers from '../components/Developers'
import Security from '../components/Security'
import FAQ from '../components/FAQ'
import CTA from '../components/CTA'
import Footer from '../components/Footer'
import Reveal from '../components/Reveal'

export default function Home() {
  return (
    <main className="min-h-screen">
      <TickerTape />
      <Navigation />
      <Hero />

      <div className="mx-auto max-w-6xl space-y-20 px-5 py-24">
        <WhyBoomerang />
        <Reveal><Peeks /></Reveal>
        <Reveal><StatsBar /></Reveal>
        <Reveal><TokenSearch /></Reveal>
        <Reveal><HowItWorks /></Reveal>
        <Reveal><StockUniverse compact /></Reveal>
        <div id="live" className="scroll-mt-20 grid items-start gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <div className="eyebrow mb-2">Live</div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Watch the dividends land</h2>
            <p className="mt-3 text-sm leading-relaxed text-mut">Tokens linking up and holders receiving stock, in real time.</p>
          </div>
          <Reveal><LiveFeed /></Reveal>
        </div>
        <Reveal><Screener /></Reveal>
        <Reveal><Modes /></Reveal>
        <Reveal><Developers /></Reveal>
        <Reveal><Security /></Reveal>
        <Reveal><FAQ /></Reveal>
        <Reveal><CTA /></Reveal>
      </div>

      <Footer />
    </main>
  )
}
