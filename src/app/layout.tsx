import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "@/assets/styles/globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "La-Roche-Posay-Web-Game",
  description: "Minimal Next.js + TypeScript + Tailwind + Redux Toolkit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body> */}
      <body className="bg-primary text-secondary">
        <main className="w-full min-h-dvh">{children}</main>
      </body>
    </html>
  );
}
