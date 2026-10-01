import { normalizePhone } from '@/lib/phone';

export type Grupo = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  criado_em: string;
};

export type EnderecoEmpresa = {
  cep: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
};

export type Empresa = {
  id: string;
  grupo_id: string | null;
  grupo_nome: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string | null;
  telefone: string | null;
  cep: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  criado_em: string;
};

export function digitosCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

export function cnpjMascarado(digits: string): string {
  const d = digitosCnpj(digits);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export type ContatoNormalizado = {
  email: string | null;
  telefone: string | null;
};

export function normalizarContato(emailRaw: string, telefoneRaw: string): ContatoNormalizado {
  const email = emailRaw.replace(/\s/g, '');
  const telefoneInformado = telefoneRaw.trim();
  if (!email && !telefoneInformado) {
    throw new Error('Informe o e-mail ou o telefone.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido.');
  }
  let telefone: string | null = null;
  if (telefoneInformado) {
    telefone = normalizePhone(telefoneInformado);
    if (!telefone) throw new Error('Informe um telefone válido.');
  }
  return { email: email || null, telefone };
}

export function digitosCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function cepMascarado(value: string): string {
  const digits = digitosCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function limitar(value: string, max: number, mensagem: string): string {
  const texto = value.trim();
  if (texto.length > max) throw new Error(mensagem);
  return texto;
}

export function normalizarEndereco(input: {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
}): EnderecoEmpresa {
  const cep = digitosCep(input.cep);
  if (cep.length !== 8) throw new Error('Informe um CEP com 8 dígitos.');
  const numero = limitar(input.numero, 10, 'O número pode ter no máximo 10 caracteres.');
  const complemento = limitar(input.complemento, 100, 'O complemento pode ter no máximo 100 caracteres.');
  return {
    cep,
    logradouro: limitar(exigirTexto(input.logradouro, 'Informe o endereço.'), 255, 'O endereço está longo demais.'),
    numero: numero || null,
    complemento: complemento || null,
  };
}

export function exigirTexto(value: string, mensagem: string): string {
  const texto = value.trim();
  if (!texto) throw new Error(mensagem);
  return texto;
}
