export function buildUploadPath(fileName: string): string {
  const normalized = fileName.trim().replace(/\s+/g, '-');
  return `/uploads/${normalized}`;
}
