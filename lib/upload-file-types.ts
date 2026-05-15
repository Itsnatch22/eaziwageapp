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

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  return (
    isImageFile(file) ||
    DOCUMENT_MIME_TYPES.has(file.type) ||
    DOCUMENT_EXTENSIONS.has(extension)
  );
}

