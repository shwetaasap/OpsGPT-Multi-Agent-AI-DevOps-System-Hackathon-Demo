const STORAGE_KEY = 'opsgpt:openrouter_api_key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* storage disabled */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled */
  }
}

/** Show only the last 4 characters of a configured key for display. */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return key;
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}
