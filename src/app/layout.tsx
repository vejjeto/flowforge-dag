import { AppProviders } from "@/components/providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowForge — Visual DAG Automation Editor",
  description:
    "Editor visual de automatizaciones basado en grafos acíclicos dirigidos (DAG) con ordenamiento topológico Kahn y sandbox de ejecución en vivo.",
};

const ZERO_FOUC_THEME_SCRIPT = `
(function(){
  try {
    var saved = localStorage.getItem("theme") || localStorage.getItem("forge-theme");
    var isDark = saved ? saved === "dark" : true;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: zero-FOUC theme init script */}
        <script dangerouslySetInnerHTML={{ __html: ZERO_FOUC_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-[#09090b] dark:text-zinc-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
