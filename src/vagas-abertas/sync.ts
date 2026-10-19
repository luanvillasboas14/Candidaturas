import { randomUUID } from 'crypto';
import { DIAS_HORARIO, registroHorario, type DiasGrade } from '@/grupos-empresas/horario';
import { getDnaWorkPool } from '@/lib/dna-work-db';
import { getSupabaseServer } from '@/lib/supabase-server';

type Linha = Record<string, unknown>;

export type EmpresaAviso = {
  empresaId: string;
  nome: string;
  cnpj: string;
  vagas: number;
};

export type SyncVagasResultado = {
  slot: string;
  lidas: number;
  novas: number;
  jaExistiam: number;
  fora: number;
  empresas: EmpresaAviso[];
};

function texto(valor: unknown): string {
  return valor == null ? '' : String(valor).trim();
}

function hora(valor: unknown): string {
  const match = texto(valor).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas > 23 || minutos > 59) return '';
  return `${String(horas).padStart(2, '0')}:${match[2]}`;
}

function dinheiro(valor: unknown): number | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const numero = Number(bruto.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 100;
}

function inteiro(valor: unknown): number | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const numero = Number(bruto);
  if (!Number.isInteger(numero)) return null;
  return numero;
}

function kmDe(valor: unknown): number | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const numero = Number(bruto.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function naFaixa(numero: number, inicio: number, fim: number): boolean {
  if (fim >= inicio) return numero >= inicio && numero <= fim;
  return numero >= inicio || numero <= fim;
}

function horarioDe(linha: Linha): { horario: string | null; turno: string | null } {
  const inicio = Number(linha.semanas_inicio);
  const fim = Number(linha.semanas_fim);
  const faixaOk = Number.isInteger(inicio) && Number.isInteger(fim) && inicio >= 1 && inicio <= 7 && fim >= 1 && fim <= 7;
  const baseEntrada = hora(linha.horabase);
  const baseSaida = hora(linha.hora_saida_base);
  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    const entradaDia = hora(linha[dia.entrada]);
    const saidaDia = hora(linha[dia.saida]);
    const parDia = entradaDia && saidaDia ? [entradaDia, saidaDia] : null;
    const parBase =
      faixaOk && naFaixa(dia.numero, inicio, fim) && baseEntrada && baseSaida ? [baseEntrada, baseSaida] : null;
    const par = parDia || parBase;
    dias[dia.entrada] = par ? par[0] : '';
    dias[dia.saida] = par ? par[1] : '';
  }
  const periodo = ['Manha', 'Tarde', 'Noite'].includes(texto(linha.periodo)) ? texto(linha.periodo) : '';
  const intervalo = hora(linha.tempo_refeicao);
  const intervaloTexto = intervalo && intervalo !== '00:00' ? intervalo : '';
  const temDia = DIAS_HORARIO.some((dia) => dias[dia.entrada] && dias[dia.saida]);
  let horario: string | null = null;
  if (faixaOk || temDia || intervaloTexto || periodo) {
    const comHorario = DIAS_HORARIO.filter((dia) => dias[dia.entrada] && dias[dia.saida]).map((dia) => dia.numero);
    const inicioRegistro = faixaOk ? inicio : comHorario[0] || 0;
    const fimRegistro = faixaOk ? fim : comHorario[comHorario.length - 1] || 0;
    horario = registroHorario({ periodo, inicio: inicioRegistro, fim: fimRegistro, intervalo: intervaloTexto }, dias);
  }
  const nota = texto(linha.texto_carga).replace(/;/g, ',');
  if (nota) horario = horario ? `${horario};texto=${nota}` : nota;
  return { horario, turno: periodo || null };
}

function beneficiosDe(itens: { nome: string; valor: string; tipo: string }[]): string | null {
  if (!itens.length) return null;
  const linhas = itens
    .map((item) => {
      const tipo = item.tipo === 'D' ? 'Diário' : item.tipo === 'S' ? 'Semanal' : item.tipo === 'M' ? 'Mensal' : item.tipo;
      const valor = item.valor ? `R$ ${item.valor}` : '';
      return [item.nome, valor, tipo].filter(Boolean).join(' — ');
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return linhas.join('\n');
}

function vazio(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo || null;
}

function numeroChave(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}

function chave(vaga: Record<string, unknown>): string {
  return JSON.stringify([
    vaga.empresa_id,
    Number(vaga.tipo_vaga),
    vazio(vaga.cargo),
    numeroChave(vaga.salario),
    vazio(vaga.carga_horaria),
    vazio(vaga.escolaridade),
    vazio(vaga.sexo),
    vaga.idade == null || vaga.idade === '' ? null : Number(vaga.idade),
    vaga.idade_ate == null || vaga.idade_ate === '' ? null : Number(vaga.idade_ate),
    numeroChave(vaga.km),
    vazio(vaga.atividades),
    vazio(vaga.tempo),
    vazio(vaga.horario),
    vazio(vaga.turno),
    vazio(vaga.beneficios),
    vazio(vaga.conducoes),
    vazio(vaga.jornada),
    vazio(vaga.tipo_trabalho),
    vazio(vaga.cep),
    vaga.latitude == null || vaga.latitude === '' ? null : Number(vaga.latitude),
    vaga.longitude == null || vaga.longitude === '' ? null : Number(vaga.longitude),
  ]);
}

async function idsExistentes(ids: string[]): Promise<Set<string>> {
  const supabase = getSupabaseServer();
  const existentes = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('vaga').select('id').in('id', lote);
    if (error) throw new Error(error.message);
    for (const row of data || []) existentes.add(String(row.id));
  }
  return existentes;
}

async function empresasNovas(ids: string[]) {
  const supabase = getSupabaseServer();
  const mapa = new Map<string, { grupo_id: string | null; cep: string | null; latitude: unknown; longitude: unknown }>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('empresa').select('id, grupo_id, cep, latitude, longitude').in('id', lote);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      mapa.set(String(row.id), {
        grupo_id: row.grupo_id ? String(row.grupo_id) : null,
        cep: texto(row.cep) || null,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }
  return mapa;
}

async function vagasParaChave(empresaIds: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseServer();
  const grupos = new Map<string, string>();
  const colunas =
    'vaga_id, empresa_id, tipo_vaga, cargo, salario, carga_horaria, escolaridade, sexo, idade, idade_ate, km, atividades, tempo, horario, turno, beneficios, conducoes, jornada, tipo_trabalho, cep, latitude, longitude';
  for (let i = 0; i < empresaIds.length; i += 40) {
    const lote = empresaIds.slice(i, i + 40);
    let inicio = 0;
    while (true) {
      const { data, error } = await supabase.from('vaga').select(colunas).in('empresa_id', lote).range(inicio, inicio + 499);
      if (error) throw new Error(error.message);
      for (const row of data || []) {
        const vagaId = texto(row.vaga_id);
        if (!vagaId || grupos.has(chave(row))) continue;
        grupos.set(chave(row), vagaId);
      }
      if (!data || data.length < 500) break;
      inicio += 500;
    }
  }
  return grupos;
}

async function repetidasExistentes(vagaIds: string[]): Promise<Set<string>> {
  const supabase = getSupabaseServer();
  const ids = new Set<string>();
  for (let i = 0; i < vagaIds.length; i += 100) {
    const lote = vagaIds.slice(i, i + 100);
    const { data, error } = await supabase.from('vaga_repetida').select('vaga_id').in('vaga_id', lote);
    if (error) throw new Error(error.message);
    for (const row of data || []) ids.add(String(row.vaga_id));
  }
  return ids;
}

export async function listarEmpresasPendentes(): Promise<EmpresaAviso[]> {
  const pool = getDnaWorkPool();
  const [linhas] = await pool.query(
    `select v.id_empresa, e.nome_fantasia, e.razao_social, e.cnpj, count(*) as vagas
     from vaga v
     inner join empresa e on e.id_empresa = v.id_empresa
     where e.sede = 10 and v.status = 0
     group by v.id_empresa, e.nome_fantasia, e.razao_social, e.cnpj`
  );
  const grupos = linhas as Linha[];
  if (!grupos.length) return [];
  const supabase = getSupabaseServer();
  const ids = grupos.map((linha) => texto(linha.id_empresa)).filter(Boolean);
  const existentes = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('empresa').select('id').in('id', lote);
    if (error) throw new Error(error.message);
    for (const empresa of data || []) existentes.add(String(empresa.id));
  }
  return grupos
    .flatMap((linha) => {
      const empresaId = texto(linha.id_empresa);
      if (!empresaId || existentes.has(empresaId)) return [];
      return [
        {
          empresaId,
          nome: texto(linha.nome_fantasia) || texto(linha.razao_social) || 'Empresa sem nome',
          cnpj: texto(linha.cnpj),
          vagas: Number(linha.vagas) || 0,
        },
      ];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function sincronizarVagasAbertas(slot: string): Promise<SyncVagasResultado> {
  const pool = getDnaWorkPool();
  const [linhas] = await pool.query(
    `select v.id_vaga, v.id_empresa, e.nome_fantasia, e.razao_social, e.cnpj, v.tipo_vaga, v.cargo, v.salario,
      v.carga_horaria, v.escolaridade, v.sexo, v.idade, v.idadeate, v.km, v.atribuicaoes, v.jornada, v.remoto,
      v.periodo, v.semanas_inicio, v.semanas_fim, v.horabase, v.hora_saida_base, v.tempo_refeicao, v.texto_carga,
      v.segunda_entrada, v.segunda_saida, v.terca_entrada, v.terca_saida, v.quarta_entrada, v.quarta_saida,
      v.quinta_entrada, v.quinta_saida, v.sexta_entrada, v.sexta_saida, v.sab_entrada, v.sab_saida,
      v.domindo_entrada, v.domindo_saida
     from vaga v
     inner join empresa e on e.id_empresa = v.id_empresa
     where e.sede = 10 and v.status = 0`
  );
  const vagas = linhas as Linha[];
  const ids = vagas.map((vaga) => texto(vaga.id_vaga)).filter(Boolean);
  const beneficiosPorVaga = new Map<string, { nome: string; valor: string; tipo: string }[]>();
  if (ids.length) {
    const [beneficios] = await pool.query(
      `select bv.id_vaga, b.beneficios as nome, bv.valor, bv.tipo
       from beneficio_vaga bv
       inner join beneficio b on b.id = bv.id_beneficio
       where bv.id_vaga in (?)`,
      [ids]
    );
    for (const item of beneficios as Linha[]) {
      const id = texto(item.id_vaga);
      const lista = beneficiosPorVaga.get(id) || [];
      lista.push({ nome: texto(item.nome), valor: texto(item.valor), tipo: texto(item.tipo).toUpperCase() });
      beneficiosPorVaga.set(id, lista);
    }
  }

  const existentes = await idsExistentes(ids);
  const empresasIds = [...new Set(vagas.map((vaga) => texto(vaga.id_empresa)).filter(Boolean))];
  const empresaPorId = await empresasNovas(empresasIds);

  const puladas = new Map<string, EmpresaAviso>();
  const prontas: Record<string, unknown>[] = [];
  for (const linha of vagas) {
    const id = texto(linha.id_vaga);
    if (!id || existentes.has(id)) continue;
    const empresaId = texto(linha.id_empresa);
    const empresa = empresaPorId.get(empresaId);
    const nome = texto(linha.nome_fantasia) || texto(linha.razao_social) || 'Empresa sem nome';
    if (!empresa) {
      const atual = puladas.get(empresaId) || { empresaId, nome, cnpj: texto(linha.cnpj), vagas: 0 };
      atual.vagas += 1;
      puladas.set(empresaId, atual);
      continue;
    }
    const tipo = Number(linha.tipo_vaga);
    if (tipo !== 1 && tipo !== 2 && tipo !== 4) continue;
    const formacao = texto(linha.escolaridade);
    const sexo = texto(linha.sexo).toUpperCase();
    const jornadaNumero = linha.jornada == null || linha.jornada === '' ? 0 : Number(linha.jornada);
    const remotoNumero = linha.remoto == null || linha.remoto === '' ? 0 : Number(linha.remoto);
    const { horario, turno } = horarioDe(linha);
    const carga = texto(linha.carga_horaria);
    prontas.push({
      id,
      empresa_id: empresaId,
      grupo_id: empresa.grupo_id,
      tipo_vaga: tipo,
      cargo: texto(linha.cargo),
      salario: dinheiro(linha.salario),
      carga_horaria: carga || null,
      escolaridade: ['31', '32', '33', '36'].includes(formacao) ? formacao : null,
      sexo: sexo === 'I' || sexo === 'M' || sexo === 'F' ? sexo : null,
      idade: inteiro(linha.idade),
      idade_ate: inteiro(linha.idadeate),
      km: kmDe(linha.km),
      atividades: texto(linha.atribuicaoes) || null,
      tempo: null,
      horario,
      turno,
      beneficios: beneficiosDe(beneficiosPorVaga.get(id) || []),
      conducoes: null,
      jornada: jornadaNumero === 1 ? 'escala' : 'fixa',
      tipo_trabalho: remotoNumero === 1 ? 'remoto' : remotoNumero === 2 ? 'hibrido' : 'presencial',
      cep: empresa.cep,
      latitude: empresa.latitude == null || empresa.latitude === '' ? null : Number(empresa.latitude),
      longitude: empresa.longitude == null || empresa.longitude === '' ? null : Number(empresa.longitude),
    });
  }

  const gruposConhecidos = await vagasParaChave([...new Set(prontas.map((vaga) => String(vaga.empresa_id)))]);
  const novasChaves = new Map<string, string>();
  for (const vaga of prontas) {
    const idChave = chave(vaga);
    const conhecido = gruposConhecidos.get(idChave) || novasChaves.get(idChave);
    if (conhecido) {
      vaga.vaga_id = conhecido;
      continue;
    }
    const vagaId = randomUUID();
    vaga.vaga_id = vagaId;
    novasChaves.set(idChave, vagaId);
  }

  const supabase = getSupabaseServer();
  for (let i = 0; i < prontas.length; i += 40) {
    const lote = prontas.slice(i, i + 40);
    const { error } = await supabase.from('vaga').insert(lote);
    if (error) throw new Error(error.message);
  }

  const idsNovos = [...novasChaves.values()];
  const jaRepetidas = idsNovos.length ? await repetidasExistentes(idsNovos) : new Set<string>();
  const repetidas = [...novasChaves.entries()].flatMap(([idChave, vagaId]) => {
    if (jaRepetidas.has(vagaId)) return [];
    const amostra = prontas.find((vaga) => vaga.vaga_id === vagaId && chave(vaga) === idChave);
    if (!amostra) return [];
    const { id: _id, ...campos } = amostra;
    return [{ ...campos, id: randomUUID(), vaga_id: vagaId }];
  });
  for (let i = 0; i < repetidas.length; i += 40) {
    const { error } = await supabase.from('vaga_repetida').insert(repetidas.slice(i, i + 40));
    if (error) throw new Error(error.message);
  }

  const empresas = [...puladas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const fora = await contarFora();

  const resultado = {
    slot,
    lidas: vagas.length,
    novas: prontas.length,
    jaExistiam: existentes.size,
    fora,
    empresas,
  };
  const aviso = empresas.map((empresa) => `${empresa.nome} | ${empresa.cnpj || 'sem CNPJ'} | ${empresa.vagas}`).join('; ');
  console.log(
    `[vagas-abertas] slot=${slot} novas=${resultado.novas} fora=${fora} aviso=${empresas.length}${aviso ? ` ${aviso}` : ''}`
  );
  return resultado;
}

async function contarFora(): Promise<number> {
  const supabase = getSupabaseServer();
  const ids: string[] = [];
  let inicio = 0;
  while (true) {
    const { data, error } = await supabase.from('vaga').select('id').range(inicio, inicio + 499);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const id = texto(row.id);
      if (id) ids.push(id);
    }
    if (!data || data.length < 500) break;
    inicio += 500;
  }

  let fora = 0;
  const pool = getDnaWorkPool();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const [rows] = await pool.query(`select id_vaga, status from vaga where id_vaga in (?)`, [lote]);
    for (const row of rows as Linha[]) {
      const status = Number(row.status);
      if (texto(row.id_vaga) && Number.isInteger(status) && status !== 0) fora += 1;
    }
  }
  return fora;
}
