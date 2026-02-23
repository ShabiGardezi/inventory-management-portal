export function sanitizeSingleLine(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '') // control chars
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeMultiLine(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  // Keep + and digits, strip common separators
  return trimmed.replace(/[^\d+]/g, '');
}

