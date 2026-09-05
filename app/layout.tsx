import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meadow Mail — A little post. A big adventure.',
  description:
    'A cozy island delivery adventure. Carry letters to animal neighbours, make your own paths, and sail a little further from home.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
