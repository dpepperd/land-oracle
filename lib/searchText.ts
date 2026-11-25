// Parcel ID / address text search (the "contains" search). Two protections, shared by the Florida search, the Florida export and the pilot-state search:
//   1. a minimum length: a one or two character search matches hundreds of thousands of rows (measured: "1" in Duval took about 10 s and loaded the database);
//   2. LIKE wildcards typed by the user (% _ \) are taken literally, so "%" cannot be used to match everything.
export const MIN_SEARCH_TEXT = 3;

export const TEXT_TOO_SHORT = {
  error: 'text_too_short',
  message: `Type at least ${MIN_SEARCH_TEXT} characters to search by parcel ID or address.`,
};

/** Escapes LIKE wildcards so the text is matched literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Trimmed search text, or null when it is empty (no text search). Throws nothing: check `tooShort` first. */
export const cleanSearchText = (raw: string | undefined | null): string | null => {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t : null;
};

export const tooShort = (cleaned: string | null) => cleaned !== null && cleaned.length < MIN_SEARCH_TEXT;

/** The pattern to bind to an ILIKE: contains-match of the literal text. */
export const likePattern = (cleaned: string) => `%${escapeLike(cleaned)}%`;
