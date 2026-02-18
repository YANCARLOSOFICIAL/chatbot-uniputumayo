import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-br from-[var(--primary-100)] via-white to-[var(--accent-gold-light)]">
        <div className="text-center max-w-2xl z-10">
          {/* Inline mini guacamaya SVG (idle) */}
          <div className="mx-auto mb-6 w-28 h-28">
            <svg viewBox="0 0 120 120" className="w-full h-full animate-[avatar-bob_3s_ease-in-out_infinite]">
              <defs>
                <linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1B5E20" />
                  <stop offset="100%" stopColor="#2E7D32" />
                </linearGradient>
                <linearGradient id="hcGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#E8C07A" />
                  <stop offset="100%" stopColor="#D4A574" />
                </linearGradient>
                <linearGradient id="hbeakG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF8F00" />
                  <stop offset="100%" stopColor="#E65100" />
                </linearGradient>
                <linearGradient id="hwGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1B5E20" />
                  <stop offset="60%" stopColor="#00897B" />
                  <stop offset="100%" stopColor="#26A69A" />
                </linearGradient>
                <linearGradient id="htGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#E53935" />
                  <stop offset="40%" stopColor="#FF7043" />
                  <stop offset="100%" stopColor="#2E7D32" />
                </linearGradient>
                <linearGradient id="hcrGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#1B5E20" />
                  <stop offset="100%" stopColor="#43A047" />
                </linearGradient>
              </defs>
              <ellipse cx="42" cy="108" rx="8" ry="14" fill="url(#htGrad)" transform="rotate(-15 42 108)" />
              <ellipse cx="55" cy="110" rx="6" ry="16" fill="url(#htGrad)" />
              <ellipse cx="67" cy="108" rx="8" ry="14" fill="url(#htGrad)" transform="rotate(15 67 108)" />
              <ellipse cx="58" cy="72" rx="26" ry="30" fill="url(#hbGrad)" />
              <ellipse cx="58" cy="78" rx="16" ry="20" fill="url(#hcGrad)" />
              <path d="M32 58 C20 52, 12 62, 16 78 C18 86, 26 88, 34 82 Z" fill="url(#hwGrad)" opacity="0.9" />
              <path d="M84 58 C96 52, 104 62, 100 78 C98 86, 90 88, 82 82 Z" fill="url(#hwGrad)" opacity="0.9" />
              <circle cx="58" cy="38" r="22" fill="url(#hbGrad)" />
              <path d="M48 18 C50 10, 58 6, 60 12 C62 6, 70 10, 68 18 C66 14, 58 12, 56 14 Z" fill="url(#hcrGrad)" />
              <ellipse cx="48" cy="36" rx="9" ry="8" fill="white" />
              <ellipse cx="68" cy="36" rx="9" ry="8" fill="white" />
              <circle cx="48" cy="36" r="5" fill="#1a1a1a" />
              <circle cx="68" cy="36" r="5" fill="#1a1a1a" />
              <circle cx="46" cy="34" r="1.8" fill="white" />
              <circle cx="66" cy="34" r="1.8" fill="white" />
              <circle cx="50" cy="37" r="0.8" fill="white" opacity="0.6" />
              <circle cx="70" cy="37" r="0.8" fill="white" opacity="0.6" />
              <path d="M53 42 C55 40, 61 40, 63 42 L60 50 C59 51, 57 51, 56 50 Z" fill="url(#hbeakG)" />
              <path d="M55 49 C56 49, 60 49, 61 49 L59 53 C58.5 53.5, 57.5 53.5, 57 53 Z" fill="#BF360C" />
              <circle cx="40" cy="40" r="4" fill="#E57373" opacity="0.3" />
              <circle cx="76" cy="40" r="4" fill="#E57373" opacity="0.3" />
              <path d="M48 98 L44 106 M48 98 L48 106 M48 98 L52 106" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M68 98 L64 106 M68 98 L68 106 M68 98 L72 106" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            Chatbot <span className="text-[var(--primary-600)]">IUP</span>
          </h1>
          <p className="text-lg text-gray-600 mb-1 font-medium">
            Institución Universitaria del Putumayo
          </p>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            Asistente virtual inteligente para consultar información sobre
            programas académicos, pensum, requisitos de admisión y más.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-500)] text-white rounded-xl font-medium hover:translate-y-[-1px] hover:shadow-lg transition-all shadow-md"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Iniciar Chat
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full">
            <path d="M0 40 C360 80, 720 0, 1080 40 C1260 60, 1380 50, 1440 40 L1440 80 L0 80 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[var(--primary-100)] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Texto y Voz</h3>
            <p className="text-sm text-gray-500">
              Interactúa escribiendo o usando comandos de voz en español colombiano.
            </p>
          </div>
          <div className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[var(--primary-100)] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">IA Inteligente</h3>
            <p className="text-sm text-gray-500">
              Respuestas precisas basadas en documentos oficiales de la universidad.
            </p>
          </div>
          <div className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[var(--primary-100)] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Programas Académicos</h3>
            <p className="text-sm text-gray-500">
              Consulta pensum, horarios, requisitos y perfiles profesionales.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
