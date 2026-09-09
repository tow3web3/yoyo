import { apiJson, apiOptions } from '../../../lib/apiResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return apiOptions();
}

export function GET() {
  return apiJson({
    name: '0xdiv Public API',
    version: 'v1',
    chain: { name: 'Robinhood Chain', id: 4663, explorer: 'https://robinhoodchain.blockscout.com' },
    description: 'Read-only data about tokens paying stock dividends with 0xdiv.',
    endpoints: {
      stats: { method: 'GET', path: '/api/v1/stats', description: 'Global stats.' },
      tokens: { method: 'GET', path: '/api/v1/tokens', description: 'Every token with an active bot.' },
      token: { method: 'GET', path: '/api/v1/token/{address}', description: 'Is a token linked? Config and stats.' },
      stocks: { method: 'GET', path: '/api/v1/stocks', description: 'The 195 Robinhood Stock Tokens.' },
      activity: { method: 'GET', path: '/api/v1/activity?limit=20', description: 'Recent linked tokens and dividends.' },
    },
    docs: 'https://github.com/tow3web3/boomerang',
  });
}
