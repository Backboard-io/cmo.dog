import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalHeader } from "@/components/conditional-header";
import { PawPrints } from "@/components/paw-prints";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CMO.dog — Your AI Chief Marketing Officer",
  description: "Drop in a URL. Onni fetches your competitor intel, brand voice, site audit, and SEO fixes — in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex items-center justify-center bg-bb-cloud p-6">
        <PawPrints />
        <div className="relative z-[1] max-w-[86.4rem] w-full flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.25)] rounded-xl overflow-hidden bg-white h-[91vh]">
          <ConditionalHeader />
          <main className="flex flex-col flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
