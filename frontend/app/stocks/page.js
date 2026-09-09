import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import StockUniverse from '../../components/StockUniverse';
import CTA from '../../components/CTA';

export const metadata = {
  title: 'Stocks · Yoyo',
  description: 'The 195 Robinhood Stock Tokens on Robinhood Chain that Yoyo can pay as dividends.',
};

export default function StocksPage() {
  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-6xl space-y-16 px-5 py-10">
        <StockUniverse />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
