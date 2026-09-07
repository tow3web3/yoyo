import './globals.css'
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google'
import Backdrop from '../components/Backdrop'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-manrope' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-jetbrains' })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boomerang.fun'
const DESCRIPTION =
  'Boomerang turns your token fees on Robinhood Chain into real stock dividends: NVDA, TSLA, SPY, GLD and 190 more Robinhood Stock Tokens, paid to every holder on schedule.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Boomerang: your fees come back as stocks',
  description: DESCRIPTION,
  keywords: 'robinhood chain, stock tokens, dividends, telegram bot, airdrop, memecoin, NVDA, TSLA',
  icons: { icon: '/newlogopng.png', apple: '/newlogopng.png' },
  openGraph: {
    title: 'Boomerang: your fees come back as stocks',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Boomerang',
    images: [{ url: '/bannier.png', width: 1200, height: 630, alt: 'Boomerang' }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Boomerang: your fees come back as stocks', description: DESCRIPTION, images: ['/bannier.png'] },
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
