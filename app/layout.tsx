import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StillPoor",
  description: "Own a piece of the board",
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