const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/csv',
  'application/csv',
  'text/plain',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'csv',
  'doc',
  'docx',
  'odp',
  'ods',
  'odt',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'txt',
  'xls',
  'xlsx',
]);

export const IMAGE_ACCEPT = 'image/*';

export const DOCUMENT_ACCEPT = [
  'image/*',
  'application/pdf',
  '.csv',
  '.doc',
  '.docx',
  '.odt',
  '.ods',
  '.odp',
  '.ppt',
  '.pptx',
  '.rtf',
  '.txt',
  '.xls',
  '.xlsx',
].join(',');

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/rtf': 'rtf',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/plain': 'txt',
};

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

export function getSafeFileExtension(file: File): string {
  const extension = getFileExtension(file.name);

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return extension;
  }

  const mapped = MIME_EXTENSION_MAP[file.type];
  if (mapped) {
    return mapped;
  }

  return 'bin';
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml';
}

export function isDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  return (
    isImageFile(file) ||
    DOCUMENT_MIME_TYPES.has(file.type) ||
    DOCUMENT_EXTENSIONS.has(extension)
  );
}

