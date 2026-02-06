"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="fixed inset-0 flex flex-col justify-center items-center gap-8">
      <h1 className="text-2xl font-bold">Game Type Selection</h1>
      <Link
        href="/game"
        className="px-8 py-4 bg-white text-black font-bold rounded-full text-xl hover:bg-gray-100 transition-colors"
      >
        La Roche-Posay Photo Booth
      </Link>
    </div>
  );
}
