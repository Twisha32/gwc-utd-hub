// only follow same-site paths, never a full URL someone put in the query string
export const safeNext = (next: string | null) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : null;
