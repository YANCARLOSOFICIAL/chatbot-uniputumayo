"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="h-16 bg-green-800 text-white flex items-center px-6 shadow-md">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-green-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">Chatbot IUP</h1>
          <p className="text-xs text-green-200 leading-tight">
            Universidad del Putumayo
          </p>
        </div>
      </Link>

      <nav className="ml-auto flex items-center gap-4">
        <Link
          href="/chat"
          className="text-sm text-green-100 hover:text-white transition-colors"
        >
          Chat
        </Link>
        <Link
          href="/admin"
          className="text-sm text-green-100 hover:text-white transition-colors"
        >
          Admin
        </Link>
      </nav>
    </header>
  );
}
