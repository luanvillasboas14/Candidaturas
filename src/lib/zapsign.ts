import { readEnv } from './env';

const DEFAULT_URL = 'https://api.zapsign.com.br';

export function zapsignApiUrl(): string {
  return (readEnv('ZAPSIGN_API_URL') || DEFAULT_URL).replace(/\/$/, '');
}

export function zapsignApiToken(): string {
  const token = readEnv('ZAPSIGN_API_TOKEN').trim();
  if (!token) throw new Error('ZAPSIGN_API_TOKEN precisa estar configurada.');
  return token;
}

export function zapsignUserToken(): string {
  return readEnv('ZAPSIGN_USER_TOKEN').trim();
}

export function zapsignAgenteId(): string {
  return readEnv('ZAPSIGN_AGENTE_ID').trim() || '127';
}

export type ZapSignerIn = {
  name: string;
  email?: string;
  auth_mode: 'tokenEmail' | 'assinaturaTela';
  send_automatic_email: boolean;
  external_id: string;
  blank_email?: boolean;
};

export type ZapSignerOut = {
  token?: string;
  status?: string;
  name?: string;
  email?: string;
  external_id?: string;
  signed_at?: string | null;
};

export function extrairPdfBase64(raw: string): string {
  const texto = raw.trim().replace(/\s+/g, '');
  const marca = 'base64,';
  const i = texto.toLowerCase().indexOf(marca);
  const b64 = i >= 0 ? texto.slice(i + marca.length) : texto.replace(/^data:application\/pdf;base64,/i, '');
  if (b64.length < 80) throw new Error('PDF do documento não foi gerado.');
  const cabeca = Buffer.from(b64.slice(0, 32), 'base64').subarray(0, 4).toString();
  if (cabeca !== '%PDF') throw new Error('O arquivo gerado não é um PDF válido.');
  return b64;
}

export type ZapDoc = {
  token?: string;
  status?: string;
  original_file?: string;
  signed_file?: string;
  signers?: ZapSignerOut[];
};

async function zapsignFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${zapsignApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${zapsignApiToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!res.ok) {
    const detail = json && typeof json === 'object' ? json.error || json.detail || JSON.stringify(json) : '';
    throw new Error(detail || `ZapSign ${res.status}`);
  }
  return json;
}

export async function zapsignCriarDoc(input: {
  name: string;
  base64Pdf: string;
  externalId: string;
  folderPath: string;
  signers: ZapSignerIn[];
}): Promise<ZapDoc> {
  return zapsignFetch<ZapDoc>('/api/v1/docs/', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      base64_pdf: extrairPdfBase64(input.base64Pdf),
      external_id: input.externalId,
      folder_path: input.folderPath,
      lang: 'pt-br',
      signers: input.signers,
    }),
  });
}

export async function zapsignDetalharDoc(token: string): Promise<ZapDoc> {
  return zapsignFetch<ZapDoc>(`/api/v1/docs/${encodeURIComponent(token)}/`);
}

export async function zapsignReenviarEmail(signerToken: string): Promise<void> {
  await zapsignFetch(`/api/v1/signers/${encodeURIComponent(signerToken)}/`, {
    method: 'POST',
    body: JSON.stringify({ send_automatic_email: true }),
  });
}

export async function zapsignAssinarLote(userToken: string, signerTokens: string[]): Promise<void> {
  await zapsignFetch('/api/v1/sign/', {
    method: 'POST',
    body: JSON.stringify({ user_token: userToken, signer_tokens: signerTokens }),
  });
}
