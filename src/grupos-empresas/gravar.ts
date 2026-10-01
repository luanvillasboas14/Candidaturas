import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { getDnaWorkPool, withDnaWorkTransaction, type DnaRow } from '@/lib/dna-work-db';
import { getSupabaseServer } from '@/lib/supabase-server';
import {
  digitosCnpj,
  exigirTexto,
  normalizarContato,
  normalizarEndereco,
  type ContatoNormalizado,
  type Empresa,
  type EnderecoEmpresa,
  type Grupo,
} from './validar';

type GrupoInput = {
  nome: string;
  email: string;
  telefone: string;
};

type EmpresaInput = {
  grupoId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
};

function textoOuVazio(value: string | null): string {
  return value || '';
}

function camposSupabaseEndereco(endereco: EnderecoEmpresa) {
  return {
    cep: endereco.cep,
    logradouro: endereco.logradouro,
    numero: endereco.numero,
    complemento: endereco.complemento,
  };
}

async function cnpjNoLegado(cnpj: string, ignorarId?: string): Promise<boolean> {
  const pool = getDnaWorkPool();
  const [rows] = await pool.query<DnaRow[]>(
    `
    SELECT id_empresa
    FROM empresa
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(cnpj, ''), '.', ''), '/', ''), '-', ''), ' ', '') = ?
      AND (? IS NULL OR id_empresa <> ?)
    LIMIT 1
    `,
    [cnpj, ignorarId || null, ignorarId || '']
  );
  return rows.length > 0;
}

async function cnpjNoSupabase(cnpj: string, ignorarId?: string): Promise<boolean> {
  let query = getSupabaseServer().from('empresa').select('id').eq('cnpj', cnpj).limit(1);
  if (ignorarId) query = query.neq('id', ignorarId);
  const { data, error } = await query;
  if (error) throw new Error(mensagemSupabase(error.message));
  return Boolean(data?.length);
}

async function exigirCnpjLivre(cnpj: string, ignorarId?: string): Promise<void> {
  if (await cnpjNoLegado(cnpj, ignorarId)) {
    throw new Error('Esse CNPJ já existe no sistema antigo. O cadastro foi interrompido.');
  }
  if (await cnpjNoSupabase(cnpj, ignorarId)) {
    throw new Error('Esse CNPJ já está cadastrado.');
  }
}

function mensagemSupabase(message: string): string {
  if (/column/i.test(message) && /schema cache|PGRST204/i.test(message)) {
    return 'Faltam as colunas de endereço na tabela empresa. Rode o SQL no SQL Editor.';
  }
  if (/schema cache|PGRST205|does not exist/i.test(message)) {
    return 'As tabelas grupo e empresa ainda não existem no Supabase. Rode o SQL no SQL Editor.';
  }
  if (message.includes('duplicate') || message.includes('23505')) {
    return 'Esse CNPJ já está cadastrado.';
  }
  return 'Não foi possível gravar no Supabase.';
}

function erroLegado(error: unknown): Error {
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
    return new Error(
      'Essa empresa tem vagas, contratos ou outros registros no sistema antigo. A exclusão foi interrompida e nada foi apagado.'
    );
  }
  if (error instanceof Error && error.message.startsWith('A empresa não foi encontrada no sistema antigo')) {
    return error;
  }
  return new Error('Não foi possível apagar a empresa no sistema antigo. A exclusão foi interrompida e nada foi apagado.');
}

async function apagarUmaEmpresaLegada(conn: PoolConnection, id: string): Promise<number> {
  await conn.query(`DELETE FROM assinaturas_empresa WHERE id_empresa = ?`, [id]);
  const [resultado] = await conn.query<ResultSetHeader>(`DELETE FROM empresa WHERE id_empresa = ?`, [id]);
  return resultado.affectedRows;
}

async function apagarEmpresaLegada(id: string, cnpj: string): Promise<void> {
  await withDnaWorkTransaction(async (conn) => {
    let apagadas = await apagarUmaEmpresaLegada(conn, id);
    if (apagadas === 0 && cnpj) {
      const [rows] = await conn.query<DnaRow[]>(
        `
        SELECT id_empresa
        FROM empresa
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(cnpj, ''), '.', ''), '/', ''), '-', ''), ' ', '') = ?
        `,
        [cnpj]
      );
      for (const row of rows) {
        apagadas += await apagarUmaEmpresaLegada(conn, String(row.id_empresa));
      }
    }
    if (apagadas === 0) {
      throw new Error('A empresa não foi encontrada no sistema antigo. A exclusão foi interrompida e nada foi apagado.');
    }
  });
}

export async function listarGrupos(): Promise<Grupo[]> {
  const { data, error } = await getSupabaseServer()
    .from('grupo')
    .select('id, nome, email, telefone, criado_em')
    .order('nome', { ascending: true });
  if (error) throw new Error(mensagemSupabase(error.message));
  return (data || []) as Grupo[];
}

export async function criarGrupo(input: GrupoInput): Promise<Grupo> {
  const nome = exigirTexto(input.nome, 'Informe o nome do grupo.');
  const contato = normalizarContato(input.email, input.telefone);
  const { data, error } = await getSupabaseServer()
    .from('grupo')
    .insert({ nome, email: contato.email, telefone: contato.telefone })
    .select('id, nome, email, telefone, criado_em')
    .single();
  if (error) throw new Error(mensagemSupabase(error.message));
  return data as Grupo;
}

export async function atualizarGrupo(id: string, input: GrupoInput): Promise<Grupo> {
  const nome = exigirTexto(input.nome, 'Informe o nome do grupo.');
  const contato = normalizarContato(input.email, input.telefone);
  const { data, error } = await getSupabaseServer()
    .from('grupo')
    .update({ nome, email: contato.email, telefone: contato.telefone })
    .eq('id', id)
    .select('id, nome, email, telefone, criado_em')
    .single();
  if (error) throw new Error(mensagemSupabase(error.message));
  return data as Grupo;
}

export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await getSupabaseServer()
    .from('empresa')
    .select(
      'id, grupo_id, cnpj, razao_social, nome_fantasia, email, telefone, cep, logradouro, numero, complemento, criado_em, grupo(nome)'
    )
    .order('razao_social', { ascending: true });
  if (error) throw new Error(mensagemSupabase(error.message));
  return (data || []).map((row) => {
    const grupo = row.grupo as { nome?: string } | { nome?: string }[] | null;
    const grupoNome = Array.isArray(grupo) ? grupo[0]?.nome : grupo?.nome;
    return {
      id: row.id as string,
      grupo_id: (row.grupo_id as string | null) || null,
      grupo_nome: grupoNome || '',
      cnpj: row.cnpj as string,
      razao_social: row.razao_social as string,
      nome_fantasia: row.nome_fantasia as string,
      email: (row.email as string | null) || null,
      telefone: (row.telefone as string | null) || null,
      cep: (row.cep as string | null) || '',
      logradouro: (row.logradouro as string | null) || '',
      numero: (row.numero as string | null) || null,
      complemento: (row.complemento as string | null) || null,
      criado_em: row.criado_em as string,
    };
  });
}

function dadosEmpresa(input: EmpresaInput): {
  grupoId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  contato: ContatoNormalizado;
  endereco: EnderecoEmpresa;
} {
  const cnpj = digitosCnpj(input.cnpj);
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.');
  return {
    grupoId: exigirTexto(input.grupoId, 'Escolha um grupo.'),
    cnpj,
    razaoSocial: exigirTexto(input.razaoSocial, 'Informe a razão social.'),
    nomeFantasia: exigirTexto(input.nomeFantasia, 'Informe o nome fantasia.'),
    contato: normalizarContato(input.email, input.telefone),
    endereco: normalizarEndereco(input),
  };
}

async function exigirGrupo(grupoId: string): Promise<void> {
  const grupos = await listarGrupos();
  if (!grupos.some((grupo) => grupo.id === grupoId)) {
    throw new Error('Escolha um grupo já cadastrado.');
  }
}

export async function criarEmpresa(input: EmpresaInput): Promise<Empresa> {
  const dados = dadosEmpresa(input);
  await exigirGrupo(dados.grupoId);
  await exigirCnpjLivre(dados.cnpj);

  const id = randomUUID();
  const pool = getDnaWorkPool();
  await pool.query<ResultSetHeader>(
    `
    INSERT INTO empresa (
      id_empresa, cnpj, razao_social, nome_fantasia, email, telefone,
      cep, logradouro, numero, complemento,
      tipo_empresa, matriz, status, sede, mesmoendereco, nome_confidencial, usa_agente
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, 10, 1, 1, 1)
    `,
    [
      id,
      dados.cnpj,
      dados.razaoSocial,
      dados.nomeFantasia,
      textoOuVazio(dados.contato.email),
      textoOuVazio(dados.contato.telefone),
      dados.endereco.cep,
      dados.endereco.logradouro,
      textoOuVazio(dados.endereco.numero),
      textoOuVazio(dados.endereco.complemento),
      id,
    ]
  );
  try {
    await pool.query(
      `INSERT INTO assinaturas_empresa (id_empresa, tipo, responsavel) VALUES (?, 'TCE', 1)`,
      [id]
    );
    await pool.query(
      `INSERT INTO assinaturas_empresa (id_empresa, tipo, responsavel) VALUES (?, 'Convenio', 1)`,
      [id]
    );
  } catch (error) {
    await apagarEmpresaLegada(id, dados.cnpj);
    throw error;
  }

  const { error } = await getSupabaseServer().from('empresa').insert({
    id,
    grupo_id: dados.grupoId,
    cnpj: dados.cnpj,
    razao_social: dados.razaoSocial,
    nome_fantasia: dados.nomeFantasia,
    email: dados.contato.email,
    telefone: dados.contato.telefone,
    ...camposSupabaseEndereco(dados.endereco),
  });
  if (error) {
    await apagarEmpresaLegada(id, dados.cnpj);
    throw new Error(mensagemSupabase(error.message));
  }

  const empresas = await listarEmpresas();
  const criada = empresas.find((item) => item.id === id);
  if (!criada) throw new Error('A empresa foi gravada, mas não apareceu na lista.');
  return criada;
}

export async function atualizarEmpresa(id: string, input: EmpresaInput): Promise<Empresa> {
  const dados = dadosEmpresa(input);
  await exigirGrupo(dados.grupoId);
  await exigirCnpjLivre(dados.cnpj, id);

  const pool = getDnaWorkPool();
  const [atuais] = await pool.query<DnaRow[]>(
    `SELECT cnpj, razao_social, nome_fantasia, email, telefone, cep, logradouro, numero, complemento FROM empresa WHERE id_empresa = ? LIMIT 1`,
    [id]
  );
  const atual = atuais[0];
  if (!atual) throw new Error('Empresa não encontrada no sistema antigo.');

  await pool.query(
    `
    UPDATE empresa
    SET cnpj = ?, razao_social = ?, nome_fantasia = ?, email = ?, telefone = ?,
        cep = ?, logradouro = ?, numero = ?, complemento = ?
    WHERE id_empresa = ?
    `,
    [
      dados.cnpj,
      dados.razaoSocial,
      dados.nomeFantasia,
      textoOuVazio(dados.contato.email),
      textoOuVazio(dados.contato.telefone),
      dados.endereco.cep,
      dados.endereco.logradouro,
      textoOuVazio(dados.endereco.numero),
      textoOuVazio(dados.endereco.complemento),
      id,
    ]
  );

  const { error } = await getSupabaseServer()
    .from('empresa')
    .update({
      grupo_id: dados.grupoId,
      cnpj: dados.cnpj,
      razao_social: dados.razaoSocial,
      nome_fantasia: dados.nomeFantasia,
      email: dados.contato.email,
      telefone: dados.contato.telefone,
      ...camposSupabaseEndereco(dados.endereco),
    })
    .eq('id', id);
  if (error) {
    await pool.query(
      `
      UPDATE empresa
      SET cnpj = ?, razao_social = ?, nome_fantasia = ?, email = ?, telefone = ?,
          cep = ?, logradouro = ?, numero = ?, complemento = ?
      WHERE id_empresa = ?
      `,
      [
        atual.cnpj,
        atual.razao_social,
        atual.nome_fantasia,
        atual.email,
        atual.telefone,
        atual.cep,
        atual.logradouro,
        atual.numero,
        atual.complemento,
        id,
      ]
    );
    throw new Error(mensagemSupabase(error.message));
  }

  const empresas = await listarEmpresas();
  const atualizada = empresas.find((item) => item.id === id);
  if (!atualizada) throw new Error('Empresa não encontrada.');
  return atualizada;
}

export async function apagarGrupo(id: string): Promise<void> {
  const { count, error: erroContagem } = await getSupabaseServer()
    .from('empresa')
    .select('id', { count: 'exact', head: true })
    .eq('grupo_id', id);
  if (erroContagem) throw new Error(mensagemSupabase(erroContagem.message));
  if (count && count > 0) {
    throw new Error('Esse grupo tem empresas cadastradas. Apague as empresas antes.');
  }

  const { error } = await getSupabaseServer().from('grupo').delete().eq('id', id);
  if (error) {
    if (error.message.includes('23503') || /foreign key/i.test(error.message)) {
      throw new Error('Esse grupo tem empresas cadastradas. Apague as empresas antes.');
    }
    throw new Error(mensagemSupabase(error.message));
  }
}

export async function apagarEmpresa(id: string): Promise<void> {
  const empresas = await listarEmpresas();
  const atual = empresas.find((item) => item.id === id);
  if (!atual) throw new Error('Empresa não encontrada.');

  try {
    await apagarEmpresaLegada(id, atual.cnpj);
  } catch (error) {
    throw erroLegado(error);
  }

  const { error } = await getSupabaseServer().from('empresa').delete().eq('id', id);
  if (error) throw new Error(mensagemSupabase(error.message));
}
