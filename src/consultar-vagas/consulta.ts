import type { ResultSetHeader } from 'mysql2/promise';
import { getDnaWorkPool, type DnaRow } from '@/lib/dna-work-db';
import { getSupabaseServer } from '@/lib/supabase-server';
import {
  STATUS_CONSULTA,
  type ConsultaRegistrada,
  type EmpresaFiltro,
  type FiltroConsulta,
  type StatusConsulta,
  type VagaAberta,
} from './tipos';

const STATUS_MYSQL: Record<StatusConsulta, number> = {
  contratada: 1,
  demitida: 2,
  cancelada: 6,
};

function mensagemSupabase(message: string): string {
  if (/consulta_vaga/i.test(message) && /schema cache|PGRST205|does not exist/i.test(message)) {
    return 'A tabela consulta_vaga ainda não existe no Supabase. Rode o SQL no SQL Editor.';
  }
  return 'Não foi possível consultar as vagas.';
}

function diaSaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function idsFechadas(ids: string[]): Promise<Set<string>> {
  const fechadas = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const [rows] = await getDnaWorkPool().query<DnaRow[]>(`SELECT id_vaga, status FROM vaga WHERE id_vaga IN (?)`, [lote]);
    for (const row of rows) {
      const status = Number(row.status);
      if (Number.isInteger(status) && status !== 0) fechadas.add(String(row.id_vaga));
    }
  }
  return fechadas;
}

function texto(valor: unknown): string {
  return String(valor || '').trim();
}

function tipoNumero(valor: unknown): number {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : 0;
}

function statusConsulta(valor: string): StatusConsulta | null {
  return STATUS_CONSULTA.includes(valor as StatusConsulta) ? (valor as StatusConsulta) : null;
}

function cargoFiltro(cargo: string): string {
  return cargo.trim().replace(/[%_\\]/g, '');
}

function nomeEmpresa(linha: { nome_fantasia?: unknown; razao_social?: unknown } | null): string {
  return texto(linha?.nome_fantasia) || texto(linha?.razao_social) || 'Empresa';
}

function colunaAusente(message: string, coluna: string): boolean {
  return new RegExp(coluna, 'i').test(message) && /schema cache|PGRST204/i.test(message);
}

async function atualizarStatusMysql(id: string, status: number): Promise<void> {
  try {
    await getDnaWorkPool().query<ResultSetHeader>(
      `UPDATE vaga SET status = ?, data_status = ? WHERE id_vaga = ?`,
      [status, diaSaoPaulo(), id]
    );
  } catch {
    throw new Error('Não foi possível atualizar a vaga no sistema antigo.');
  }
}

async function exigirVagaMysql(id: string): Promise<void> {
  const [linhas] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT id_vaga FROM vaga WHERE id_vaga = ? LIMIT 1`,
    [id]
  );
  if (!linhas.length) throw new Error('Essa vaga não está no sistema antigo.');
}

export async function listarConsultas(filtro: FiltroConsulta): Promise<{
  abertas: VagaAberta[];
  consultas: ConsultaRegistrada[];
  empresas: EmpresaFiltro[];
}> {
  const supabase = getSupabaseServer();
  const cargo = cargoFiltro(filtro.cargo);
  const empresaId = filtro.empresaId.trim();
  const status = statusConsulta(filtro.status.trim());

  let abertasQuery = supabase.from('vaga').select('id, empresa_id, cargo, tipo_vaga').order('cargo', { ascending: true });
  if (empresaId) abertasQuery = abertasQuery.eq('empresa_id', empresaId);
  if (cargo) abertasQuery = abertasQuery.ilike('cargo', `%${cargo}%`);

  let consultasQuery = supabase
    .from('consulta_vaga')
    .select('id, vaga_id, empresa_id, empresa_nome, cargo, tipo_vaga, status')
    .order('criado_em', { ascending: false });
  if (empresaId) consultasQuery = consultasQuery.eq('empresa_id', empresaId);
  if (cargo) consultasQuery = consultasQuery.ilike('cargo', `%${cargo}%`);
  if (status) consultasQuery = consultasQuery.eq('status', status);

  const [abertasResp, consultasResp, empresasResp, nomesResp] = await Promise.all([
    abertasQuery,
    consultasQuery,
    supabase.from('empresa').select('id, nome_fantasia, razao_social').order('nome_fantasia', { ascending: true }),
    supabase.from('consulta_vaga').select('empresa_id, empresa_nome'),
  ]);

  if (abertasResp.error) throw new Error(mensagemSupabase(abertasResp.error.message));
  if (consultasResp.error) throw new Error(mensagemSupabase(consultasResp.error.message));
  if (empresasResp.error) throw new Error(mensagemSupabase(empresasResp.error.message));
  if (nomesResp.error) throw new Error(mensagemSupabase(nomesResp.error.message));

  const nomes = new Map<string, string>();
  for (const empresa of empresasResp.data || []) {
    const id = texto(empresa.id);
    if (id) nomes.set(id, nomeEmpresa(empresa));
  }
  for (const consulta of nomesResp.data || []) {
    const id = texto(consulta.empresa_id);
    if (id && !nomes.has(id)) nomes.set(id, texto(consulta.empresa_nome) || 'Empresa');
  }

  const fechadas = await idsFechadas((abertasResp.data || []).map((linha) => texto(linha.id)).filter(Boolean));
  const abertas = (abertasResp.data || []).flatMap((linha) => {
    const id = texto(linha.id);
    if (fechadas.has(id)) return [];
    const empresa = texto(linha.empresa_id);
    const cargoLinha = texto(linha.cargo);
    if (!id || !empresa || !cargoLinha) return [];
    return [
      {
        id,
        empresaId: empresa,
        empresaNome: nomes.get(empresa) || 'Empresa',
        cargo: cargoLinha,
        tipoVaga: tipoNumero(linha.tipo_vaga),
      },
    ];
  });

  const consultas = (consultasResp.data || []).flatMap((linha) => {
    const id = texto(linha.id);
    const vagaId = texto(linha.vaga_id);
    const empresa = texto(linha.empresa_id);
    const desfecho = statusConsulta(texto(linha.status));
    const cargoLinha = texto(linha.cargo);
    if (!id || !vagaId || !empresa || !desfecho || !cargoLinha) return [];
    return [
      {
        id,
        vagaId,
        empresaId: empresa,
        empresaNome: texto(linha.empresa_nome) || nomes.get(empresa) || 'Empresa',
        cargo: cargoLinha,
        tipoVaga: tipoNumero(linha.tipo_vaga),
        status: desfecho,
      },
    ];
  });

  const empresas = Array.from(nomes, ([id, nome]) => ({ id, nome })).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );

  return { abertas, consultas, empresas };
}

async function gravarConsulta(
  linha: Record<string, unknown>,
  copia: Record<string, unknown> | null
): Promise<boolean> {
  const supabase = getSupabaseServer();
  const comCopia = copia ? { ...linha, vaga: copia } : linha;
  const { error } = await supabase.from('consulta_vaga').insert(comCopia);
  if (!error) return true;
  if (error.code === '23505') return false;
  if (copia && colunaAusente(error.message, 'vaga')) {
    const semCopia = await supabase.from('consulta_vaga').insert(linha);
    if (!semCopia.error) return true;
    if (semCopia.error.code === '23505') return false;
    throw new Error(mensagemSupabase(semCopia.error.message));
  }
  throw new Error(mensagemSupabase(error.message));
}

async function linhaParaReabrir(id: string, empresaId: string, cargo: string, tipo: number): Promise<Record<string, unknown>> {
  const [linhas] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT cargo, salario, carga_horaria, escolaridade, sexo, idade, idadeate, km, atribuicaoes, periodo, jornada, remoto
    FROM vaga WHERE id_vaga = ? LIMIT 1
    `,
    [id]
  );
  const vaga = linhas[0];
  if (!vaga) throw new Error('Essa vaga não está no sistema antigo.');
  const { data: empresa, error } = await getSupabaseServer()
    .from('empresa')
    .select('grupo_id, cep, latitude, longitude')
    .eq('id', empresaId)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  const tipoClt = tipo === 2;
  const jornada =
    texto(vaga.jornada) === '0' ? 'fixa' : texto(vaga.jornada) === '1' ? 'escala' : null;
  const remoto =
    texto(vaga.remoto) === '0' ? 'presencial' : texto(vaga.remoto) === '1' ? 'remoto' : texto(vaga.remoto) === '2' ? 'hibrido' : null;
  return {
    id,
    vaga_id: id,
    grupo_id: empresa?.grupo_id || null,
    empresa_id: empresaId,
    tipo_vaga: tipo,
    cargo: texto(vaga.cargo) || cargo,
    salario: vaga.salario == null ? null : Number(vaga.salario),
    carga_horaria: texto(vaga.carga_horaria) || null,
    escolaridade: texto(vaga.escolaridade) || null,
    sexo: texto(vaga.sexo) || null,
    idade: vaga.idade == null || texto(vaga.idade) === '' ? null : Number(vaga.idade),
    idade_ate: vaga.idadeate == null || texto(vaga.idadeate) === '' ? null : Number(vaga.idadeate),
    km: vaga.km == null || texto(vaga.km) === '' ? null : Number(vaga.km),
    atividades: texto(vaga.atribuicaoes) || null,
    turno: texto(vaga.periodo) || null,
    jornada: tipoClt ? jornada : null,
    tipo_trabalho: tipoClt ? remoto : null,
    cep: texto(empresa?.cep) || null,
    latitude: empresa?.latitude == null ? null : Number(empresa.latitude),
    longitude: empresa?.longitude == null ? null : Number(empresa.longitude),
  };
}

export async function marcarConsulta(id: string, status: StatusConsulta): Promise<void> {
  const limpo = id.trim();
  if (!limpo) throw new Error('Escolha a vaga.');
  if (!statusConsulta(status)) throw new Error('Escolha o status.');
  if (status === 'demitida') {
    await demitirConsulta(limpo);
    return;
  }

  const supabase = getSupabaseServer();
  const { data: vaga, error: erroVaga } = await supabase.from('vaga').select('*').eq('id', limpo).maybeSingle();
  if (erroVaga) throw new Error(mensagemSupabase(erroVaga.message));
  if (!vaga) throw new Error('Essa vaga não está mais na lista.');

  const empresaId = texto(vaga.empresa_id);
  const cargo = texto(vaga.cargo);
  const tipo = tipoNumero(vaga.tipo_vaga);
  if (!empresaId || !cargo || !tipo) throw new Error('Essa vaga está incompleta.');

  const { data: empresa, error: erroEmpresa } = await supabase
    .from('empresa')
    .select('nome_fantasia, razao_social')
    .eq('id', empresaId)
    .maybeSingle();
  if (erroEmpresa) throw new Error(mensagemSupabase(erroEmpresa.message));

  await exigirVagaMysql(limpo);
  await atualizarStatusMysql(limpo, STATUS_MYSQL[status]);

  const { data: existente, error: erroBusca } = await supabase
    .from('consulta_vaga')
    .select('id')
    .eq('vaga_id', limpo)
    .maybeSingle();
  if (erroBusca) throw new Error(mensagemSupabase(erroBusca.message));

  let criada = false;
  if (!existente) {
    criada = await gravarConsulta(
      {
        vaga_id: limpo,
        empresa_id: empresaId,
        empresa_nome: nomeEmpresa(empresa),
        cargo,
        tipo_vaga: tipo,
        status,
      },
      vaga
    );
  }

  const { error: erroDelete } = await supabase.from('vaga').delete().eq('id', limpo);
  if (erroDelete) {
    if (criada) await supabase.from('consulta_vaga').delete().eq('vaga_id', limpo);
    throw new Error('Não foi possível tirar a vaga da lista.');
  }
}

async function demitirConsulta(id: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('consulta_vaga')
    .select('status')
    .eq('vaga_id', id)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  if (texto(data?.status) !== 'contratada') throw new Error('Só uma vaga contratada pode ser demitida.');

  await exigirVagaMysql(id);
  await atualizarStatusMysql(id, STATUS_MYSQL.demitida);
  const { error: erroUpdate } = await supabase.from('consulta_vaga').update({ status: 'demitida' }).eq('vaga_id', id);
  if (erroUpdate) {
    await atualizarStatusMysql(id, STATUS_MYSQL.contratada);
    throw new Error(mensagemSupabase(erroUpdate.message));
  }
}

export async function reabrirConsulta(id: string): Promise<void> {
  const limpo = id.trim();
  if (!limpo) throw new Error('Escolha a vaga.');
  const supabase = getSupabaseServer();
  const busca = await supabase
    .from('consulta_vaga')
    .select('status, vaga, empresa_id, cargo, tipo_vaga')
    .eq('vaga_id', limpo)
    .maybeSingle();
  let consulta: { status?: unknown; vaga?: unknown; empresa_id?: unknown; cargo?: unknown; tipo_vaga?: unknown } | null = busca.data;
  if (busca.error && colunaAusente(busca.error.message, 'vaga')) {
    const semCopia = await supabase
      .from('consulta_vaga')
      .select('status, empresa_id, cargo, tipo_vaga')
      .eq('vaga_id', limpo)
      .maybeSingle();
    if (semCopia.error) throw new Error(mensagemSupabase(semCopia.error.message));
    consulta = semCopia.data;
  } else if (busca.error) {
    throw new Error(mensagemSupabase(busca.error.message));
  }
  if (texto(consulta?.status) !== 'cancelada') throw new Error('Só uma vaga cancelada pode ser aberta de novo.');

  await exigirVagaMysql(limpo);
  await atualizarStatusMysql(limpo, 0);

  const { data: aberta, error: erroAberta } = await supabase.from('vaga').select('id').eq('id', limpo).maybeSingle();
  if (erroAberta) {
    await atualizarStatusMysql(limpo, STATUS_MYSQL.cancelada);
    throw new Error(mensagemSupabase(erroAberta.message));
  }
  let inserida = false;
  if (!aberta) {
    const copia = consulta && typeof consulta.vaga === 'object' && consulta.vaga ? consulta.vaga : null;
    const linha =
      copia ||
      (await linhaParaReabrir(
        limpo,
        texto(consulta?.empresa_id),
        texto(consulta?.cargo),
        tipoNumero(consulta?.tipo_vaga)
      ));
    const { error: erroInsert } = await supabase.from('vaga').insert(linha);
    if (erroInsert) {
      await atualizarStatusMysql(limpo, STATUS_MYSQL.cancelada);
      throw new Error('Não foi possível abrir a vaga de novo.');
    }
    inserida = true;
  }

  const { error: erroDelete } = await supabase.from('consulta_vaga').delete().eq('vaga_id', limpo);
  if (erroDelete) {
    if (inserida) await supabase.from('vaga').delete().eq('id', limpo);
    await atualizarStatusMysql(limpo, STATUS_MYSQL.cancelada);
    throw new Error('Não foi possível abrir a vaga de novo.');
  }
}
