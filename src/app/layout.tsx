import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Forma",
  description: "Personal nutrition, fitness and workout tracking",
  appleWebApp: { capable: true, title: "Forma", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bigShoulders.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="border-b border-line bg-card">
          <p className="mx-auto w-full max-w-xl px-4 py-3 text-lg font-bold tracking-tight text-accent">Forma</p>
        </div>
        <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-4">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
