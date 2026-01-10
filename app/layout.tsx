import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Move Alliance Buyback Tracker",
  description: "Track $MOVE token buybacks onchain in real-time",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
