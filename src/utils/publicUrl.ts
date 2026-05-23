export function resolvePublicUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBase = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  const normalizedPath = path.startsWith('/')
    ? path.slice(1)
    : path;

  return `${normalizedBase}${normalizedPath}`;
}