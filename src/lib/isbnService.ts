/**
 * Serviço para consulta de dados de livros por ISBN via APIs abertas (Google Books e Open Library)
 */

export interface BookApiDetails {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  pageCount?: number;
  category?: string;
  publishedDate?: string;
  thumbnail?: string;
}

/**
 * Limpa uma string de ISBN removendo traços, espaços e caracteres não numéricos
 */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9X]/gi, '').trim();
}

/**
 * Verifica se a string tem formato plausível de código de barras de livro (EAN-13 / ISBN-10 / ISBN-13)
 */
export function isLikelyIsbn(raw: string): boolean {
  const cleaned = cleanIsbn(raw);
  return (
    cleaned.length === 10 ||
    (cleaned.length === 13 && (cleaned.startsWith('978') || cleaned.startsWith('979')))
  );
}

/**
 * Consulta detalhes do livro a partir do ISBN no Google Books API (com fallback na Open Library)
 */
export async function fetchBookDetailsByIsbn(rawIsbn: string): Promise<BookApiDetails | null> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;

  try {
    // 1. Tentar Google Books API
    const googleRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    if (googleRes.ok) {
      const data = await googleRes.json();
      if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
        const info = data.items[0].volumeInfo;
        return {
          title: info.title || '',
          author: info.authors ? info.authors.join(', ') : '',
          publisher: info.publisher || '',
          description: info.description || '',
          pageCount: info.pageCount || undefined,
          category: info.categories ? info.categories[0] : undefined,
          publishedDate: info.publishedDate || '',
          thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
        };
      }
    }
  } catch (err) {
    console.warn('[IsbnService] Google Books API falhou, tentando Open Library...', err);
  }

  try {
    // 2. Fallback: Open Library API
    const openRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    if (openRes.ok) {
      const data = await openRes.json();
      const bookKey = `ISBN:${isbn}`;
      if (data[bookKey]) {
        const info = data[bookKey];
        return {
          title: info.title || '',
          author: info.authors ? info.authors.map((a: any) => a.name).join(', ') : '',
          publisher: info.publishers ? info.publishers.map((p: any) => p.name).join(', ') : '',
          publishedDate: info.publish_date || '',
          pageCount: info.number_of_pages || undefined,
          thumbnail: info.cover?.medium || info.cover?.small || '',
        };
      }
    }
  } catch (err) {
    console.warn('[IsbnService] Open Library API falhou:', err);
  }

  return null;
}
