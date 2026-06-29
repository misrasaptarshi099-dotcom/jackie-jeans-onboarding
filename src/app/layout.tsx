import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import LenisScroller from "@/components/LenisScroller";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jackie Fit",
  description: "A premium, conversational voice AI fit advisor that helps you find your perfect jeans size instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="antialiased font-sans">
        <LenisScroller>{children}</LenisScroller>
      </body>
    </html>
  );
}
