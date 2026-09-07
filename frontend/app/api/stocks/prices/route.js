import { getQuotes } from '../../../../lib/prices';
import { STOCK_BY_TICKER } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const raw = new URL(request.url).searchParams.get('tickers') || 'NVDA,TSLA,AAPL,SPY,GLD';
    const tickers = raw.split(',').map((t) => t.trim().toUpperCase()).filter((t) => STOCK_BY_TICKER[t]).slice(0, 30);
    const quotes = await getQuotes([...tickers, 'ETH-USD']);
    return Response.json({ quotes, timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
