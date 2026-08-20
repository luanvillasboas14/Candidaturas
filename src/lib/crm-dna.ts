const CRM_API_URL = process.env.CRM_DNA_API_URL || '';
const CRM_API_TOKEN = process.env.CRM_DNA_API_TOKEN || '';

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
  if (!CRM_API_URL || !CRM_API_TOKEN) {
    console.warn('CRM_DNA_API_URL ou CRM_DNA_API_TOKEN não configurados.');
    return null;
  }

  try {
    const url = new URL(`${CRM_API_URL}/api/contacts`);
    url.searchParams.set('phone', phone);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CRM_API_TOKEN}`,
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
