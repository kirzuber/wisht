type Details = {
  code?: string;
  status?: number;
  step?: string;
  reason?: string;
};

export function diagnosticCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_]{1,48}$/.test(value) ? value : undefined;
}

export function browserDiagnostic(level: 'info' | 'error', event: string, details?: Details): void {
  const message = `[Wisht] ${event}`;
  if (details) console[level](message, details);
  else console[level](message);
  // Send only explicit diagnostic fields to the local dev terminal.
  if (import.meta.hot) import.meta.hot.send('wisht:diagnostic', { level, event, details });
}
