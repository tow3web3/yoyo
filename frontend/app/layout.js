import './globals.css'
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google'
import Backdrop from '../components/Backdrop'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-manrope' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-jetbrains' })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boomerang.fun'
const DESCRIPTION =
  'Launchpads on Robinhood Chain pay creators in real stocks. 0xdiv gives your memecoin a dividend policy: payout ratio to holders, paid in kind, a share you keep, buybacks, a stock treasury with a published book value, and a yield anyone can compare.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: '0xdiv: the dividend policy for memecoins',
  description: DESCRIPTION,
  keywords: 'robinhood chain, stock tokens, dividend policy, payout ratio, memecoin dividends, telegram bot, NVDA, SPY, GLD',
  icons: { icon: '/brand/boom-64.png', apple: '/brand/boom-256.png' },
  openGraph: {
    title: '0xdiv: the dividend policy for memecoins',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: '0xdiv',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: '0xdiv: the dividend policy for memecoins', description: DESCRIPTION },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body className={inter.className}>
        <Backdrop />
        {children}
      </body>
    </html>
  )
}
