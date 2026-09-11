import { readEnv } from './env';

function getCrmConfig() {
  return {
    url: readEnv('CRM_DNA_API_URL'),
    token: readEnv('CRM_DNA_API_TOKEN'),
  };
}

interface CrmContact {
  id: string;
  name?: string;
  phone?: string;
  [key: string]: unknown;
}

interface CrmContactsResponse {
  items?: CrmContact[];
  total?: number;
}

export interface ContactInfo {
  id: string;
  name: string | null;
}

/**
 * Busca um contato no CRM DNA pelo telefone.
 * Retorna o contact_id e o nome se encontrar, ou null se não existir.
 */
export async function findContactByPhone(phone: string): Promise<ContactInfo | null> {
  const { url: crmUrl, token } = getCrmConfig();

  if (!crmUrl || !token) {
    console.warn('CRM_DNA_API_URL ou CRM_DNA_API_TOKEN não configurados.');
    return null;
  }

  try {
    const url = new URL(`${crmUrl}/api/contacts`);
    url.searchParams.set('phone', phone);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Erro ao buscar contato no CRM DNA:', response.status, await response.text());
      return null;
    }

    const data: CrmContactsResponse = await response.json();

    if (data.items && data.items.length > 0) {
      const contact = data.items[0];
      return {
        id: contact.id,
        name: contact.name || null,
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao chamar API do CRM DNA:', error);
    return null;
  }
}
