import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';

// Design handoff (docs/design_handoff_mms): Instrument Sans for all UI text,
// JetBrains Mono for identifiers/references/timestamps/eyebrow labels.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Letshego Faidika Bank — MMS Platform',
  description:
    'Merchant Management System for Letshego Faidika Bank — TANQR / TIPS payments, Tanzania',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${instrumentSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-page text-text-primary"
        suppressHydrationWarning
      >
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
