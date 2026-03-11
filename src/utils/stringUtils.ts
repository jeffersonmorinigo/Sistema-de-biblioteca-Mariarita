/**
 * Normalizes a string by converting it to lowercase and removing accents/diacritics.
 * Example: "João" -> "joao"
 */
export function normalizeString(str: any): string {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
