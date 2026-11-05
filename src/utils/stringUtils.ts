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

/**
 * Compara dois códigos de livros para ordenação numérica crescente (natural sort).
 * Garante que sequências como "0001-01", "0001-02", "0002-01", "0002-02"
 * fiquem perfeitamente na ordem numérica crescente correta.
 */
export function compareBookCodes(codeA?: string | null, codeB?: string | null): number {
  const strA = String(codeA || '').trim();
  const strB = String(codeB || '').trim();

  // Códigos vazios vão para o fim da lista
  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  // Quebra os códigos em grupos contínuos de dígitos e caracteres não-dígitos
  // Exemplo: "0001-02" -> ["0001", "-", "02"]
  const regex = /(\d+|\D+)/g;
  const partsA = strA.match(regex) || [strA];
  const partsB = strB.match(regex) || [strB];

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    // Se ambos forem exatamente iguais (ex: mesmo hífen '-'), avança para a próxima parte
    if (partA === partB) continue;

    const isNumA = /^\d+$/.test(partA);
    const isNumB = /^\d+$/.test(partB);

    if (isNumA && isNumB) {
      const numA = parseInt(partA, 10);
      const numB = parseInt(partB, 10);

      if (numA !== numB) {
        return numA - numB;
      }
      // Se tiverem o mesmo valor numérico (ex: "01" vs "1"), desempata pela quantidade de zeros/tamanho
      if (partA.length !== partB.length) {
        return partA.length - partB.length;
      }
    } else {
      const cmp = partA.localeCompare(partB, 'pt-BR', { sensitivity: 'base', numeric: true });
      if (cmp !== 0) return cmp;
    }
  }

  return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base', numeric: true });
}

