export function sanitizeText(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export function sanitizeAiInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return sanitizeText(input).slice(0, 2000);
}

export function sanitizeUserContent(input: unknown): string {
  if (typeof input !== 'string') return '';
  return sanitizeText(input).slice(0, 4000);
}
