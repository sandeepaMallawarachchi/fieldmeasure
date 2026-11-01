import { en, type Messages } from "./en";

/**
 * To add a language (Sinhala is next), create a file that satisfies `Messages`,
 * add it here, and set `locale` from the user's choice. Component text is only
 * ever read from `t`, so nothing else has to change. Sinhala text also needs a
 * font with Sinhala glyphs, as Geist does not include them.
 */
const dictionaries = { en } satisfies Record<string, Messages>;

export type Locale = keyof typeof dictionaries;

const locale: Locale = "en";

export const t: Messages = dictionaries[locale];
