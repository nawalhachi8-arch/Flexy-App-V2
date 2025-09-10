
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "أربح فليكسي",
  description: "FlexyEarn - Watch ads and earn points",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        {children}
        <Script src='//libtl.com/sdk.js' data-zone='9854021' data-sdk='show_9854021' strategy="lazyOnload" />
      </body>
    </html>
  );
}
