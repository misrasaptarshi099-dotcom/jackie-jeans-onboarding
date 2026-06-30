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
  metadataBase: new URL("https://jackie-fit.vercel.app"),
  title: "Jackie Fit - Your Personal AI Denim Size Advisor",
  description: "A premium, conversational voice AI fit advisor that helps you find your perfect jeans size instantly.",
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Jackie Fit",
  url: "https://jackie-fit.vercel.app",
  description: "A premium, conversational voice AI fit advisor that helps you find your perfect jeans size instantly.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "All",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LenisScroller>{children}</LenisScroller>
      </body>
    </html>
  );
}
