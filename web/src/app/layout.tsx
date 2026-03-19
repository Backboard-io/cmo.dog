import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalHeader } from "@/components/conditional-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI CMO Terminal",
  description: "Enter your website and deploy a team of agents to help you get traffic and users.",
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
        <div className="max-w-[86.4rem] w-full flex flex-col p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)] rounded-xl overflow-hidden bg-white h-[70vh]">
          <ConditionalHeader />
          <main className="flex flex-col flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
