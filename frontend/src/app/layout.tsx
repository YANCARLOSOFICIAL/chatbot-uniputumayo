import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexus — Asistente IA · UniPutumayo",
  description:
    "Nexus, el asistente virtual inteligente de la Institución Universitaria del Putumayo. Consulta programas académicos, requisitos de admisión y más.",
  keywords: ["chatbot", "IUP", "UniPutumayo", "asistente virtual", "educación"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased transition-theme`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
