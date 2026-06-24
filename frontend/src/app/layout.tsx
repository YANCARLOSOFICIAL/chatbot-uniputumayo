import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ToastContainer } from "@/components/ui/Toast";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Guaca — Asistente IA · UniPutumayo",
  description:
    "Guaca, el asistente virtual inteligente de la Institución Universitaria del Putumayo. Consulta programas académicos, requisitos de admisión y más.",
  keywords: ["chatbot", "UniPutumayo", "asistente virtual", "educación", "Putumayo"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${beVietnam.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased transition-theme`}>
        <ThemeProvider>
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
