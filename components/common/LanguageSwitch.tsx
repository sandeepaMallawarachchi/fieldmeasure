"use client";

import { getLocale, setLocale, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LANGUAGES: { locale: Locale; label: string; name: string }[] = [
  { locale: "en", label: "EN", name: "English" },
  { locale: "si", label: "සිං", name: "සිංහල" },
];

/** Each language is named in its own script, so it can be found without reading the other. */
export function LanguageSwitch() {
  const current = getLocale();
  return (
    <div
      role="radiogroup"
      aria-label={t.header.language}
      className="relative flex rounded-xl bg-neutral-soft p-0.5"
    >
      <span
        aria-hidden
        data-testid="language-thumb"
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-10 rounded-[10px] bg-surface shadow-sm transition-transform duration-200 ease-out",
          current === "si" && "translate-x-full",
        )}
      />
      {LANGUAGES.map(({ locale, label, name }) => (
        <button
          key={locale}
          type="button"
          role="radio"
          lang={locale}
          aria-checked={current === locale}
          aria-label={name}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-[10px] text-sm font-semibold transition-colors duration-200",
            current === locale ? "text-primary" : "text-muted",
          )}
          onClick={() => setLocale(locale)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
