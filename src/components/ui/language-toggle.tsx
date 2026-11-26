"use client";

import { useLocale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label="Cambiar idioma (ES/EN)"
      data-testid="language-toggle"
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
