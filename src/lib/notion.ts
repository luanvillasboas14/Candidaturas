import { readEnv } from './env';

const NOTION_VERSION = '2022-06-28';

export function notionToken(): string {
  return readEnv('NOTION_TOKEN').trim();
}

export async function notionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = notionToken();
  if (!token) throw new Error('NOTION_TOKEN não está configurada.');
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || `Notion retornou ${response.status}.`);
  }
  return data;
}
