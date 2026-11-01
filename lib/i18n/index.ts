import { en, type Messages } from "./en";
import { si } from "./si";

/**
 * All text comes from the predefined dictionaries here; nothing is translated at
 * runtime. To add a language, create a file typed as `Messages` and add it below.
 *
 * `t` is a live binding: code reading it always gets the current language, including
 * map and report code outside React. AppShell re-renders the screens on a change.
 */
const dictionaries = { en, si } satisfies Record<string, Messages>;

export type Locale = keyof typeof dictionaries;

const LOCALE_STORAGE_KEY = "fieldmeasure.locale";

let locale: Locale = "en";
const listeners = new Set<() => void>();

export let t: Messages = en;

export function getLocale(): Locale {
  return locale;
}

function applyLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  t = dictionaries[next];
  if (typeof document !== "undefined") document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

export function setLocale(next: Locale): void {
  applyLocale(next);
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Blocked storage only means the choice isn't remembered next time.
  }
}

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isLocale(value: string | null): value is Locale {
  return value !== null && value in dictionaries;
}

/** Uses the saved choice, otherwise the browser's language. Runs after hydration. */
export function initLocale(): void {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Blocked storage: fall through to the browser's language.
  }
  if (isLocale(saved)) applyLocale(saved);
  else if (navigator.language?.toLowerCase().startsWith("si")) applyLocale("si");
}
