/**
 * Extrait un message d'erreur lisible depuis une erreur HTTP ou une exception.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { error?: { message?: string; errors?: string[] }; message?: string };
  if (e.error?.message) return e.error.message;
  if (Array.isArray(e.error?.errors) && e.error.errors.length > 0) {
    return e.error.errors.join('. ');
  }
  if (e.message) return e.message;
  return fallback;
}
