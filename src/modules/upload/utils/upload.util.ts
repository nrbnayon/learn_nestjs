export function buildUploadPath(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return `/uploads/${normalized}`;
}
