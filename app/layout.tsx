import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "./components/WalletContextProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stealth Link - Privacy-First Donations on Solana",
  description: "Receive crypto donations without revealing your wallet. Privacy-preserving donations powered by Light Protocol ZK compression on Solana.",
  keywords: ["Solana", "Privacy", "Donations", "ZK Compression", "Light Protocol", "Blinks", "Web3"],
  openGraph: {
    title: "Stealth Link - Privacy-First Donations",
    description: "Accept SOL donations anonymously. No trace. No doxxing.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stealth Link - Privacy-First Donations",
    description: "Accept SOL donations anonymously. No trace. No doxxing.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
