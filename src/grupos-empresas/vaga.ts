import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDnaWorkPool, withDnaWorkTransaction, type DnaRow } from '@/lib/dna-work-db';
import {
  DIAS_HORARIO,
  calcularHorario,
  diasInformados,
  registroHorario,
  tempoRelogio,
  validarDias,
  lerRegistro,
  type DiasGrade,
  type GradeHorario,
} from '@/grupos-empresas/horario';
import { getSupabaseServer } from '@/lib/supabase-server';

export const TIPOS_VAGA = [1, 2, 4] as const;
export type TipoVaga = (typeof TIPOS_VAGA)[number];

const FORMACOES = ['31', '32', '33', '36'] as const;
const SEXOS = ['I', 'M', 'F'] as const;

export type VagaFormulario = {
  empresaId: string;
  tipoVaga: string;
  quantidade: string;
  cargo: string;
  bolsa: string;
  cargaHoraria: string;
  periodo: string;
  diaDe: string;
  diaAte: string;
  entrada: string;
  intervaloHoras: string;
  intervaloMinutos: string;
  dias: DiasGrade | null;
  escolaridade: string;
  sexo: string;
  idade: string;
  idadeAte: string;
  km: string;
  atividades: string;
  tempoHoras: string;
  tempoMinutos: string;
  beneficios: string;
  conducoes: string;
  folgasFixas: string;
  jornada: string;
  tipoTrabalho: string;
};

export type VagaLista = {
  id: string;
  empresaId: string;
  empresaNome: string;
  tipoVaga: TipoVaga;
  cargo: string;
  codigo: string;
};

type VagaInput = {
  empresaId: string;
  tipoVaga: string;
  quantidade: string;
  cargo: string;
  bolsa: string;
  cargaHoraria: string;
  periodo: string;
  diaDe: string;
  diaAte: string;
  entrada: string;
  intervaloHoras: string;
  intervaloMinutos: string;
  dias: unknown;
  escolaridade: string;
  sexo: string;
  idade: string;
  idadeAte: string;
  km: string;
  atividades: string;
  tempoHoras: string;
  tempoMinutos: string;
  beneficios: string;
  conducoes: string;
  folgasFixas: string;
  jornada: string;
  tipoTrabalho: string;
};

type VagaPronta = {
  empresaId: string;
  grupoId: string;
  tipoVaga: TipoVaga;
  quantidade: number;
  cargo: string;
  salario: string;
  cargaHoraria: string | null;
  escolaridade: string | null;
  sexo: string | null;
  idade: number;
  idadeAte: number;
  km: string | null;
  atividades: string;
  tempo: string | null;
  horario: GradeHorario | null;
  beneficios: string | null;
  conducoes: string | null;
  folgasFixas: string | null;
  jornada: string | null;
  jornadaCodigo: string | null;
  tipoTrabalho: string | null;
  remoto: string | null;
  sede: number | null;
};

function texto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function exigir(value: string, mensagem: string): string {
  const limpo = value.trim();
  if (!limpo) throw new Error(mensagem);
  return limpo;
}

function inteiro(value: string, mensagem: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(mensagem);
  return Number(value.trim());
}

function dinheiro(value: string): number {
  const normalizado = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) {
    throw new Error('Informe o salário com um valor válido.');
  }
  return Number(normalizado);
}

function tempoOpcional(horas: string, minutos: string): string | null {
  const hora = horas.trim();
  const minuto = minutos.trim();
  if (!hora && !minuto) return null;
  if ((hora === '' || hora === '0') && (minuto === '' || minuto === '0')) return null;
  return tempoRelogio(hora || '0', minuto || '0');
}

function folgasFixas(value: string): string | null {
  const limpo = value.trim().toLowerCase();
  if (!limpo) return null;
  if (limpo !== 'sim' && limpo !== 'nao') throw new Error('Escolha se as folgas são fixas.');
  return limpo;
}

function salarioOpcional(value: string): string {
  if (!value.trim()) return '0.00';
  return dinheiro(value).toFixed(2);
}

function jornadaClt(value: string): { texto: 'fixa' | 'escala'; codigo: '0' | '1' } {
  const limpo = value.trim().toLowerCase();
  if (limpo === 'fixa') return { texto: 'fixa', codigo: '0' };
  if (limpo === 'escala') return { texto: 'escala', codigo: '1' };
  throw new Error('Escolha a jornada.');
}

function tipoTrabalhoClt(value: string): { texto: 'presencial' | 'remoto' | 'hibrido'; codigo: '0' | '1' | '2' } {
  const limpo = value.trim().toLowerCase();
  if (limpo === 'presencial') return { texto: 'presencial', codigo: '0' };
  if (limpo === 'remoto') return { texto: 'remoto', codigo: '1' };
  if (limpo === 'hibrido') return { texto: 'hibrido', codigo: '2' };
  throw new Error('Escolha o tipo de trabalho.');
}

function opcional(value: string): string | null {
  const limpo = value.trim();
  return limpo || null;
}

function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).replaceAll('-', '/');
}

function codigoNovo(): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let prefixo = '';
  for (let i = 0; i < 3; i += 1) prefixo += letras[Math.floor(Math.random() * letras.length)];
  const numero = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefixo}-${numero}`;
}

type LocalEmpresa = {
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
};

function numeroOuNulo(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
}

function localDaEmpresa(empresa: { cep?: unknown; latitude?: unknown; longitude?: unknown }): LocalEmpresa {
  const cep = texto(empresa.cep);
  return {
    cep: cep || null,
    latitude: numeroOuNulo(empresa.latitude),
    longitude: numeroOuNulo(empresa.longitude),
  };
}

function mensagemSupabase(message: string): string {
  if (/schema cache|PGRST205|does not exist/i.test(message)) {
    return 'A tabela vaga ainda não existe no Supabase. Rode o SQL no SQL Editor.';
  }
  if (/cep|latitude|longitude/i.test(message) && /schema cache|PGRST204/i.test(message)) {
    return 'Faltam CEP, latitude e longitude na tabela vaga. Rode o SQL no SQL Editor.';
  }
  if (/column/i.test(message) && /schema cache|PGRST204/i.test(message)) {
    return 'A tabela vaga está desatualizada. Rode o SQL do horário no SQL Editor.';
  }
  if (/vaga_tempo_estagio/i.test(message)) {
    return 'Para gravar o estágio sem tempo, rode no SQL Editor: alter table public.vaga drop constraint if exists vaga_tempo_estagio;';
  }
  return 'Não foi possível gravar a vaga no Supabase.';
}

function tabelaRepetidaAusente(message: string): boolean {
  return /vaga_repetida/i.test(message) && /schema cache|PGRST205|does not exist/i.test(message);
}

function preparar(input: VagaInput, grupoId: string, sede: number | null): VagaPronta {
  const tipo = Number(input.tipoVaga);
  if (!TIPOS_VAGA.includes(tipo as TipoVaga)) throw new Error('Escolha o tipo da vaga.');
  const tipoVaga = tipo as TipoVaga;
  const quantidade = inteiro(input.quantidade, 'Informe a quantidade.');
  if (quantidade < 1 || quantidade > 50) throw new Error('A quantidade deve ser de 1 a 50.');
  const idade = inteiro(input.idade, 'Informe a idade inicial.');
  const idadeAte = inteiro(input.idadeAte, 'Informe a idade final.');
  if (idade > 999 || idadeAte > 999) throw new Error('A idade deve ter no máximo 3 dígitos.');
  if (idade > idadeAte) throw new Error('A idade inicial não pode ser maior que a idade final.');
  const atividades = exigir(input.atividades, 'Informe as atividades.');
  const cargo = exigir(input.cargo, 'Informe o cargo.');

  if (tipoVaga !== 1 && tipoVaga !== 2) {
    return {
      empresaId: input.empresaId,
      grupoId,
      tipoVaga,
      quantidade,
      cargo,
      salario: '0.00',
      cargaHoraria: null,
      escolaridade: null,
      sexo: null,
      idade,
      idadeAte,
      km: null,
      atividades,
      tempo: null,
      horario: null,
      beneficios: opcional(input.beneficios),
      conducoes: opcional(input.conducoes),
      folgasFixas: folgasFixas(input.folgasFixas),
      jornada: folgasFixas(input.folgasFixas),
      jornadaCodigo: null,
      tipoTrabalho: null,
      remoto: null,
      sede,
    };
  }

  const jornada = jornadaClt(input.jornada);
  const trabalho = tipoTrabalhoClt(input.tipoTrabalho);

  const calculado = calcularHorario(input);
  const dias = diasInformados(input.dias, calculado.dias);
  validarDias(calculado.cargaHoraria, calculado.intervaloMinutos, dias);
  const horario: GradeHorario = { ...calculado, dias, registro: registroHorario(calculado, dias) };
  const formacao = input.escolaridade.trim();
  if (formacao !== '0' && !FORMACOES.includes(formacao as (typeof FORMACOES)[number])) {
    throw new Error('Escolha a formação.');
  }
  const escolaridade = formacao === '0' ? '' : formacao;
  const sexo = input.sexo.trim().toUpperCase();
  if (!SEXOS.includes(sexo as (typeof SEXOS)[number])) throw new Error('Escolha o sexo.');
  let km: string | null = null;
  if (input.km.trim()) {
    const kmNumero = Number(input.km.trim().replace(',', '.'));
    if (!Number.isFinite(kmNumero) || kmNumero < 0) throw new Error('Informe a distância máxima com um número válido.');
    km = String(kmNumero);
    if (km.length > 10) throw new Error('A distância máxima está longa demais.');
  }

  return {
    empresaId: input.empresaId,
    grupoId,
    tipoVaga,
    quantidade,
    cargo,
    salario: tipoVaga === 2 ? salarioOpcional(input.bolsa) : dinheiro(input.bolsa).toFixed(2),
    cargaHoraria: horario.cargaHoraria,
    escolaridade,
    sexo,
    idade,
    idadeAte,
    km,
    atividades,
    tempo: tempoOpcional(input.tempoHoras, input.tempoMinutos),
    horario,
    beneficios: opcional(input.beneficios),
    conducoes: opcional(input.conducoes),
    folgasFixas: null,
    jornada: jornada.texto,
    jornadaCodigo: tipoVaga === 2 ? jornada.codigo : null,
    tipoTrabalho: trabalho.texto,
    remoto: tipoVaga === 2 ? trabalho.codigo : null,
    sede,
  };
}

async function codigoLivre(conn: PoolConnection): Promise<string> {
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const codigo = codigoNovo();
    const [rows] = await conn.query<DnaRow[]>(`SELECT codigo FROM codigo_vaga WHERE codigo = ? LIMIT 1`, [codigo]);
    if (!rows.length) return codigo;
  }
  throw new Error('Não foi possível gerar um código de vaga. Tente de novo.');
}

async function comparadorLivre(conn: PoolConnection): Promise<string> {
  let valor = Math.floor(Date.now() / 1000);
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const atual = String(valor);
    const [rows] = await conn.query<DnaRow[]>(
      `SELECT comparador FROM vaga_valores WHERE comparador = ? LIMIT 1`,
      [atual]
    );
    if (!rows.length) return atual;
    valor += 1;
  }
  throw new Error('Não foi possível abrir a vaga agora. Tente de novo.');
}

async function proRata(conn: PoolConnection, empresaId: string, tipoVaga: TipoVaga): Promise<string> {
  const [rows] = await conn.query<DnaRow[]>(
    `SELECT proporcional FROM faturamento_empresa WHERE id_empresa = ? AND modalidade_vaga = ? LIMIT 1`,
    [empresaId, tipoVaga]
  );
  const valor = rows[0]?.proporcional;
  if (valor == null || valor === '') return '0';
  return String(valor);
}

async function apagarAbertura(ids: string[], comparador: string, codigo: string): Promise<void> {
  await withDnaWorkTransaction(async (conn) => {
    await conn.query(`DELETE FROM vaga_valores WHERE comparador = ?`, [comparador]);
    await conn.query(`DELETE FROM vaga_endereco WHERE comparador = ?`, [comparador]);
    if (ids.length) {
      await conn.query(`DELETE FROM etapa_vaga WHERE id_vaga IN (?)`, [ids]);
      await conn.query(
        `DELETE FROM log_diversos WHERE id_vaga IN (?) AND acao = 'Abertura de vaga ADM'`,
        [ids]
      );
      await conn.query(`DELETE FROM vaga WHERE id_vaga IN (?)`, [ids]);
    }
    await conn.query(`DELETE FROM codigo_vaga WHERE codigo = ?`, [codigo]);
  });
}

async function gravarMysql(dados: VagaPronta): Promise<{ ids: string[]; codigo: string; comparador: string }> {
  return withDnaWorkTransaction(async (conn) => {
    const codigo = await codigoLivre(conn);
    const comparador = await comparadorLivre(conn);
    const abertura = hoje();
    await conn.query(`INSERT INTO codigo_vaga (codigo) VALUES (?)`, [codigo]);

    const ids: string[] = [];
    for (let i = 0; i < dados.quantidade; i += 1) {
      const [uuidRows] = await conn.query<RowDataPacket[]>(`SELECT UUID() AS id`);
      const id = String(uuidRows[0]?.id || '');
      if (!id) throw new Error('Não foi possível gerar o identificador da vaga.');
      ids.push(id);
      await conn.query<ResultSetHeader>(
        `
        INSERT INTO vaga (
          id_vaga, id_empresa, tipo_vaga, codigo, cargo, salario, carga_horaria, escolaridade, sexo,
          idade, idadeate, km, atribuicaoes, atribu_contrato, sede, status, faturar, dataabertura, data_adicao, comparador,
          texto_carga, horabase, hora_saida_base, periodo, semanas_inicio, semanas_fim, pausa_almoco, tempo_refeicao,
          segunda_entrada, segunda_saida, terca_entrada, terca_saida, quarta_entrada, quarta_saida,
          quinta_entrada, quinta_saida, sexta_entrada, sexta_saida, sab_entrada, sab_saida,
          domindo_entrada, domindo_saida, jornada, remoto
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'S', ?, NOW(), ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          id,
          dados.empresaId,
          dados.tipoVaga,
          codigo,
          dados.cargo,
          dados.salario,
          dados.cargaHoraria,
          dados.escolaridade,
          dados.sexo,
          String(dados.idade),
          String(dados.idadeAte),
          dados.km,
          dados.atividades,
          dados.atividades,
          dados.sede,
          abertura,
          comparador,
          dados.horario?.texto || null,
          dados.horario?.entrada || null,
          dados.horario?.saida || null,
          dados.horario?.periodo || null,
          dados.horario?.inicio ?? null,
          dados.horario?.fim ?? null,
          dados.horario?.pausa || null,
          dados.horario ? dados.horario.intervalo : null,
          dados.horario ? dados.horario.dias.segunda_entrada : null,
          dados.horario ? dados.horario.dias.segunda_saida : null,
          dados.horario ? dados.horario.dias.terca_entrada : null,
          dados.horario ? dados.horario.dias.terca_saida : null,
          dados.horario ? dados.horario.dias.quarta_entrada : null,
          dados.horario ? dados.horario.dias.quarta_saida : null,
          dados.horario ? dados.horario.dias.quinta_entrada : null,
          dados.horario ? dados.horario.dias.quinta_saida : null,
          dados.horario ? dados.horario.dias.sexta_entrada : null,
          dados.horario ? dados.horario.dias.sexta_saida : null,
          dados.horario ? dados.horario.dias.sab_entrada : null,
          dados.horario ? dados.horario.dias.sab_saida : null,
          dados.horario ? dados.horario.dias.domindo_entrada : null,
          dados.horario ? dados.horario.dias.domindo_saida : null,
          dados.jornadaCodigo,
          dados.remoto,
        ]
      );
      await conn.query(
        `
        INSERT INTO etapa_vaga (
          id_vaga, avalia_comportamental, avalia_cultural, avalia_escolar, avalia_tecnico, avalia_basico,
          entrevista_agente, entrevista_agente_tipo, entrevista_empresa, entrevista_empresa_tipo, contratacao
        ) VALUES (?, '1', '1', '1', '1', '1', '0', 'P', '1', 'V', 'T')
        `,
        [id]
      );
      await conn.query(
        `
        INSERT INTO log_diversos (usuario, id_empresa, id_candidato, id_vaga, data, acao)
        VALUES ('', ?, '', ?, NOW(), 'Abertura de vaga ADM')
        `,
        [dados.empresaId, id]
      );
    }

    const rata = await proRata(conn, dados.empresaId, dados.tipoVaga);
    await conn.query(
      `
      INSERT INTO vaga_valores (
        comparador, cobra_selecao, tipo_selecao, valor_selecao, cobra_recorrente, tipo_recorrente, valor_recorrente,
        pro_rata, cobra_comissao, tipo_comissao, valor_comissao, treinamento, tipo_treinamento, valor_treinamento,
        comissao_recrutamento, tipo_comissao_recrutamento, valor_comissao_recrutamento
      ) VALUES (?, 0, '', '0', 0, '', '0', ?, 0, 'P', '0', 0, 'F', '0', 0, 'P', '0')
      `,
      [comparador, rata]
    );
    const [cepRows] = await conn.query<DnaRow[]>(`SELECT cep FROM empresa WHERE id_empresa = ? LIMIT 1`, [
      dados.empresaId,
    ]);
    const cep = String(cepRows[0]?.cep || '').trim();
    await conn.query(
      `
      INSERT INTO vaga_endereco (comparador, logradouro, numero, complemento, bairro, cidade, uf, cep, empresa)
      VALUES (?, '', '', '', '', '', '', ?, NULL)
      `,
      [comparador, cep]
    );

    return { ids, codigo, comparador };
  });
}

export async function listarVagas(): Promise<VagaLista[]> {
  const { data, error } = await getSupabaseServer()
    .from('vaga')
    .select('id, empresa_id, tipo_vaga, cargo, empresa(nome_fantasia, razao_social)')
    .order('criado_em', { ascending: false });
  if (error) throw new Error(mensagemSupabase(error.message));

  const linhas = data || [];
  const ids = linhas.map((linha) => String(linha.id));
  const codigos = new Map<string, string>();
  const fechadas = new Set<string>();
  if (ids.length) {
    const [rows] = await getDnaWorkPool().query<DnaRow[]>(
      `SELECT id_vaga, codigo, status FROM vaga WHERE id_vaga IN (?)`,
      [ids]
    );
    for (const row of rows) {
      const id = String(row.id_vaga);
      codigos.set(id, String(row.codigo || ''));
      const status = Number(row.status);
      if (Number.isInteger(status) && status !== 0) fechadas.add(id);
    }
  }

  return linhas.flatMap((linha) => {
    const id = String(linha.id);
    if (fechadas.has(id)) return [];
    const tipo = Number(linha.tipo_vaga);
    if (!TIPOS_VAGA.includes(tipo as TipoVaga)) return [];
    const bruto = linha.empresa;
    const empresa = (Array.isArray(bruto) ? bruto[0] : bruto) as
      | { nome_fantasia?: string; razao_social?: string }
      | null
      | undefined;
    return [
      {
        id: String(linha.id),
        empresaId: String(linha.empresa_id),
        empresaNome: texto(empresa?.nome_fantasia) || texto(empresa?.razao_social) || 'Empresa',
        tipoVaga: tipo as TipoVaga,
        cargo: String(linha.cargo || ''),
        codigo: codigos.get(String(linha.id)) || '',
      },
    ];
  });
}

function igual<T extends { is: (coluna: string, valor: null) => T; eq: (coluna: string, valor: string | number) => T }>(
  query: T,
  coluna: string,
  valor: string | number | null
): T {
  return valor == null ? query.is(coluna, null) : query.eq(coluna, valor);
}

async function buscarVagaId(
  dados: VagaPronta,
  salario: number | null,
  local: LocalEmpresa,
  ignorarId?: string
): Promise<string | null> {
  const naLista = await buscarIdNaTabela('vaga', dados, salario, local, ignorarId);
  if (naLista) return naLista;
  return buscarIdNaTabela('vaga_repetida', dados, salario, local);
}

async function buscarIdNaTabela(
  tabela: 'vaga' | 'vaga_repetida',
  dados: VagaPronta,
  salario: number | null,
  local: LocalEmpresa,
  ignorarId?: string
): Promise<string | null> {
  let query = getSupabaseServer().from(tabela).select('vaga_id').limit(1);
  if (ignorarId) query = query.neq('id', ignorarId);
  const campos: Array<[string, string | number | null]> = [
    ['empresa_id', dados.empresaId],
    ['tipo_vaga', dados.tipoVaga],
    ['cargo', dados.cargo],
    ['salario', salario],
    ['carga_horaria', dados.cargaHoraria],
    ['escolaridade', dados.escolaridade || null],
    ['sexo', dados.sexo],
    ['idade', dados.idade],
    ['idade_ate', dados.idadeAte],
    ['km', dados.km == null ? null : Number(dados.km)],
    ['atividades', dados.atividades],
    ['tempo', dados.tempo],
    ['horario', dados.horario?.registro || null],
    ['turno', dados.horario?.periodo || null],
    ['beneficios', dados.beneficios],
    ['conducoes', dados.conducoes],
    ['jornada', dados.jornada],
    ['tipo_trabalho', dados.tipoTrabalho],
    ['cep', local.cep],
    ['latitude', local.latitude],
    ['longitude', local.longitude],
  ];
  for (const [coluna, valor] of campos) query = igual(query, coluna, valor);
  const { data, error } = await query;
  if (error) {
    if (tabela === 'vaga_repetida' && tabelaRepetidaAusente(error.message)) return null;
    throw new Error(mensagemSupabase(error.message));
  }
  const existente = data?.[0]?.vaga_id;
  return existente ? String(existente) : null;
}

async function vagaIdCompartilhado(
  dados: VagaPronta,
  salario: number | null,
  local: LocalEmpresa
): Promise<string> {
  return (await buscarVagaId(dados, salario, local)) || randomUUID();
}

function formularioRepetida(
  linha: Record<string, unknown>,
  empresaId: string
): VagaFormulario {
  const tipo = String(linha.tipo_vaga || '');
  const registro = lerRegistro(String(linha.horario || ''));
  const tempo = String(linha.tempo || '');
  const [tempoHoras, tempoMinutos] = tempo.includes(':')
    ? tempo.split(':').map((parte) => String(Number(parte) || 0))
    : ['', ''];
  const jornada = String(linha.jornada || '');
  return {
    empresaId,
    tipoVaga: tipo,
    quantidade: '1',
    cargo: String(linha.cargo || ''),
    bolsa: linha.salario == null ? '' : String(linha.salario),
    cargaHoraria: String(linha.carga_horaria || ''),
    periodo: String(linha.turno || registro?.periodo || ''),
    diaDe: registro?.diaDe || '',
    diaAte: registro?.diaAte || '',
    entrada: registro?.entrada || '',
    intervaloHoras: registro?.intervaloHoras || '0',
    intervaloMinutos: registro?.intervaloMinutos || '0',
    dias: registro?.dias || null,
    escolaridade: String(linha.escolaridade || (tipo === '1' || tipo === '2' ? '0' : '')),
    sexo: String(linha.sexo || ''),
    idade: linha.idade == null ? '' : String(linha.idade),
    idadeAte: linha.idade_ate == null ? '' : String(linha.idade_ate),
    km: linha.km == null ? '' : String(linha.km),
    atividades: String(linha.atividades || ''),
    tempoHoras,
    tempoMinutos,
    beneficios: String(linha.beneficios || ''),
    conducoes: String(linha.conducoes || ''),
    folgasFixas: jornada === 'sim' || jornada === 'nao' ? jornada : '',
    jornada: jornada === 'fixa' || jornada === 'escala' ? jornada : '',
    tipoTrabalho:
      linha.tipo_trabalho === 'presencial' || linha.tipo_trabalho === 'remoto' || linha.tipo_trabalho === 'hibrido'
        ? linha.tipo_trabalho
        : '',
  };
}

async function guardarRepetida(
  dados: VagaPronta,
  salario: number | null,
  local: LocalEmpresa,
  vagaId: string
): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: existente, error: erroBusca } = await supabase
    .from('vaga_repetida')
    .select('id')
    .eq('vaga_id', vagaId)
    .maybeSingle();
  if (erroBusca) {
    if (tabelaRepetidaAusente(erroBusca.message)) return;
    throw new Error(mensagemSupabase(erroBusca.message));
  }
  const { error } = await supabase.from('vaga_repetida').upsert(
    {
      id: existente?.id || randomUUID(),
      vaga_id: vagaId,
      grupo_id: dados.grupoId,
      empresa_id: dados.empresaId,
      tipo_vaga: dados.tipoVaga,
      cargo: dados.cargo,
      salario,
      carga_horaria: dados.cargaHoraria,
      escolaridade: dados.escolaridade || null,
      sexo: dados.sexo,
      idade: dados.idade,
      idade_ate: dados.idadeAte,
      km: dados.km == null ? null : Number(dados.km),
      atividades: dados.atividades,
      tempo: dados.tempo,
      horario: dados.horario?.registro || null,
      turno: dados.horario?.periodo || null,
      beneficios: dados.beneficios,
      conducoes: dados.conducoes,
      jornada: dados.jornada,
      tipo_trabalho: dados.tipoTrabalho,
      cep: local.cep,
      latitude: local.latitude,
      longitude: local.longitude,
    },
    { onConflict: 'vaga_id' }
  );
  if (error) {
    if (tabelaRepetidaAusente(error.message)) return;
    throw new Error(mensagemSupabase(error.message));
  }
}

export type VagaModelo = {
  vagaId: string;
  formulario: VagaFormulario;
};

export async function listarRepetidas(empresaId: string): Promise<VagaModelo[]> {
  const limpo = empresaId.trim();
  if (!limpo) return [];
  const { data, error } = await getSupabaseServer()
    .from('vaga_repetida')
    .select(
      'vaga_id, tipo_vaga, cargo, salario, carga_horaria, escolaridade, sexo, idade, idade_ate, km, atividades, tempo, horario, turno, beneficios, conducoes, jornada, tipo_trabalho'
    )
    .eq('empresa_id', limpo)
    .order('cargo', { ascending: true });
  if (error) {
    if (tabelaRepetidaAusente(error.message)) return [];
    throw new Error(mensagemSupabase(error.message));
  }
  return (data || []).flatMap((linha) => {
    const vagaId = String(linha.vaga_id || '');
    if (!vagaId) return [];
    return [{ vagaId, formulario: formularioRepetida(linha, limpo) }];
  });
}

async function vagaIdNaEdicao(
  idAtual: string,
  dados: VagaPronta,
  salario: number | null,
  local: LocalEmpresa
): Promise<string> {
  const outraIgual = await buscarVagaId(dados, salario, local, idAtual);
  if (outraIgual) return outraIgual;

  const { data: atual, error } = await getSupabaseServer()
    .from('vaga')
    .select('vaga_id')
    .eq('id', idAtual)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  const compartilhado = atual?.vaga_id ? String(atual.vaga_id) : '';
  if (!compartilhado) return randomUUID();

  const { data: irmas, error: erroIrmas } = await getSupabaseServer()
    .from('vaga')
    .select('id')
    .eq('vaga_id', compartilhado)
    .neq('id', idAtual)
    .limit(1);
  if (erroIrmas) throw new Error(mensagemSupabase(erroIrmas.message));
  if (irmas && irmas.length > 0) return randomUUID();
  return compartilhado;
}

export async function criarVaga(input: VagaInput): Promise<VagaLista[]> {
  const empresaId = exigir(input.empresaId, 'Escolha uma empresa.');
  const { data: empresa, error } = await getSupabaseServer()
    .from('empresa')
    .select('id, grupo_id, nome_fantasia, razao_social, cep, latitude, longitude')
    .eq('id', empresaId)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  if (!empresa) throw new Error('Escolha uma empresa já cadastrada.');
  const grupoId = texto(empresa.grupo_id);
  if (!grupoId) throw new Error('Essa empresa não tem grupo.');

  const abertura = await withDnaWorkTransaction(async (conn) => {
    const [rows] = await conn.query<DnaRow[]>(`SELECT sede FROM empresa WHERE id_empresa = ? LIMIT 1`, [empresaId]);
    if (!rows[0]) throw new Error('Essa empresa não está no sistema antigo.');
    const sede = rows[0].sede == null || rows[0].sede === '' ? null : Number(rows[0].sede);
    const dados = preparar(input, grupoId, Number.isFinite(sede) ? sede : null);
    return { dados };
  });

  const local = localDaEmpresa(empresa);
  const gravado = await gravarMysql(abertura.dados);
  const salario = Number(abertura.dados.salario);
  const salarioNumero = Number.isFinite(salario) ? salario : null;
  let vagaId = '';
  try {
    vagaId = await vagaIdCompartilhado(abertura.dados, salarioNumero, local);
  } catch (error) {
    await apagarAbertura(gravado.ids, gravado.comparador, gravado.codigo);
    throw error;
  }
  const { error: erroVaga } = await getSupabaseServer()
    .from('vaga')
    .insert(
      gravado.ids.map((id) => ({
        id,
        vaga_id: vagaId,
        grupo_id: abertura.dados.grupoId,
        empresa_id: abertura.dados.empresaId,
        tipo_vaga: abertura.dados.tipoVaga,
        cargo: abertura.dados.cargo,
        salario: salarioNumero,
        carga_horaria: abertura.dados.cargaHoraria,
        escolaridade: abertura.dados.escolaridade || null,
        sexo: abertura.dados.sexo,
        idade: abertura.dados.idade,
        idade_ate: abertura.dados.idadeAte,
        km: abertura.dados.km == null ? null : Number(abertura.dados.km),
        atividades: abertura.dados.atividades,
        tempo: abertura.dados.tempo,
        horario: abertura.dados.horario?.registro || null,
        turno: abertura.dados.horario?.periodo || null,
        beneficios: abertura.dados.beneficios,
        conducoes: abertura.dados.conducoes,
        jornada: abertura.dados.jornada,
        tipo_trabalho: abertura.dados.tipoTrabalho,
        cep: local.cep,
        latitude: local.latitude,
        longitude: local.longitude,
      }))
    );
  if (erroVaga) {
    try {
      await getSupabaseServer().from('vaga').delete().in('id', gravado.ids);
      await apagarAbertura(gravado.ids, gravado.comparador, gravado.codigo);
    } catch {
      throw new Error(
        `${mensagemSupabase(erroVaga.message)} A abertura ficou no sistema antigo e não pôde ser desfeita.`
      );
    }
    throw new Error(mensagemSupabase(erroVaga.message));
  }

  try {
    await guardarRepetida(abertura.dados, salarioNumero, local, vagaId);
  } catch (error) {
    await getSupabaseServer().from('vaga').delete().in('id', gravado.ids);
    await apagarAbertura(gravado.ids, gravado.comparador, gravado.codigo);
    throw error;
  }

  const empresaNome = texto(empresa.nome_fantasia) || texto(empresa.razao_social) || 'Empresa';
  return gravado.ids.map((id) => ({
    id,
    empresaId: abertura.dados.empresaId,
    empresaNome,
    tipoVaga: abertura.dados.tipoVaga,
    cargo: abertura.dados.cargo,
    codigo: gravado.codigo,
  }));
}

const COLUNAS_VALORES = [
  'comparador',
  'cobra_selecao',
  'tipo_selecao',
  'valor_selecao',
  'cobra_recorrente',
  'tipo_recorrente',
  'valor_recorrente',
  'pro_rata',
  'cobra_comissao',
  'tipo_comissao',
  'valor_comissao',
  'treinamento',
  'tipo_treinamento',
  'valor_treinamento',
  'comissao_recrutamento',
  'tipo_comissao_recrutamento',
  'valor_comissao_recrutamento',
] as const;

async function retirarValores(conn: PoolConnection, comparador: string): Promise<DnaRow[]> {
  const [linhas] = await conn.query<DnaRow[]>(
    `SELECT ${COLUNAS_VALORES.join(', ')} FROM vaga_valores WHERE comparador = ?`,
    [comparador]
  );
  if (linhas.length) await conn.query(`DELETE FROM vaga_valores WHERE comparador = ?`, [comparador]);
  return linhas;
}

async function devolverValores(conn: PoolConnection, linhas: DnaRow[]): Promise<void> {
  for (const linha of linhas) {
    await conn.query(
      `INSERT INTO vaga_valores (${COLUNAS_VALORES.join(', ')}) VALUES (${COLUNAS_VALORES.map(() => '?').join(', ')})`,
      COLUNAS_VALORES.map((coluna) => linha[coluna])
    );
  }
}

function mensagemMysql(error: unknown): string {
  const errno = typeof error === 'object' && error && 'errno' in error ? Number(error.errno) : 0;
  if (errno === 1451) return 'Essa vaga já está em uso e não pode ser apagada.';
  return 'Não foi possível apagar a vaga.';
}

export async function apagarVaga(id: string): Promise<void> {
  const limpo = id.trim();
  if (!limpo) throw new Error('Escolha a vaga.');
  const { data, error } = await getSupabaseServer().from('vaga').select('id').eq('id', limpo).maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));

  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT codigo, comparador FROM vaga WHERE id_vaga = ? LIMIT 1`,
    [limpo]
  );
  if (!data && !rows[0]) throw new Error('Essa vaga não está nesta lista.');
  if (rows[0]) {
    const codigo = String(rows[0].codigo || '');
    const comparador = String(rows[0].comparador || '');
    try {
      await withDnaWorkTransaction(async (conn) => {
        const [irmas] = await conn.query<DnaRow[]>(
          `SELECT COUNT(*) AS n FROM vaga WHERE comparador = ? AND id_vaga <> ?`,
          [comparador, limpo]
        );
        const temIrma = Number(irmas[0]?.n || 0) > 0;
        const valores = comparador && temIrma ? await retirarValores(conn, comparador) : [];
        if (comparador && !temIrma) {
          await conn.query(`DELETE FROM vaga_valores WHERE comparador = ?`, [comparador]);
          await conn.query(`DELETE FROM vaga_endereco WHERE comparador = ?`, [comparador]);
        }
        await conn.query(`DELETE FROM etapa_vaga WHERE id_vaga = ?`, [limpo]);
        await conn.query(`DELETE FROM log_diversos WHERE id_vaga = ? AND acao = 'Abertura de vaga ADM'`, [limpo]);
        await conn.query(`DELETE FROM vaga WHERE id_vaga = ?`, [limpo]);
        if (valores.length) await devolverValores(conn, valores);
        if (codigo) {
          const [resto] = await conn.query<DnaRow[]>(`SELECT id_vaga FROM vaga WHERE codigo = ? LIMIT 1`, [codigo]);
          if (!resto.length) await conn.query(`DELETE FROM codigo_vaga WHERE codigo = ?`, [codigo]);
        }
      });
    } catch (erro) {
      throw new Error(mensagemMysql(erro));
    }
  }

  if (data) {
    const { error: erroDelete } = await getSupabaseServer().from('vaga').delete().eq('id', limpo);
    if (erroDelete) throw new Error(mensagemSupabase(erroDelete.message));
  }
}

function partirRelogio(valor: unknown): [string, string] {
  const match = String(valor || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return ['', ''];
  return [String(Number(match[1])), String(Number(match[2]))];
}

function parametrosVaga(dados: VagaPronta): unknown[] {
  return [
    dados.empresaId,
    dados.tipoVaga,
    dados.cargo,
    dados.salario,
    dados.cargaHoraria,
    dados.escolaridade,
    dados.sexo,
    String(dados.idade),
    String(dados.idadeAte),
    dados.km,
    dados.atividades,
    dados.atividades,
    dados.sede,
    dados.horario?.texto || null,
    dados.horario?.entrada || null,
    dados.horario?.saida || null,
    dados.horario?.periodo || null,
    dados.horario?.inicio ?? null,
    dados.horario?.fim ?? null,
    dados.horario?.pausa || null,
    dados.horario ? dados.horario.intervalo : null,
    dados.horario ? dados.horario.dias.segunda_entrada : null,
    dados.horario ? dados.horario.dias.segunda_saida : null,
    dados.horario ? dados.horario.dias.terca_entrada : null,
    dados.horario ? dados.horario.dias.terca_saida : null,
    dados.horario ? dados.horario.dias.quarta_entrada : null,
    dados.horario ? dados.horario.dias.quarta_saida : null,
    dados.horario ? dados.horario.dias.quinta_entrada : null,
    dados.horario ? dados.horario.dias.quinta_saida : null,
    dados.horario ? dados.horario.dias.sexta_entrada : null,
    dados.horario ? dados.horario.dias.sexta_saida : null,
    dados.horario ? dados.horario.dias.sab_entrada : null,
    dados.horario ? dados.horario.dias.sab_saida : null,
    dados.horario ? dados.horario.dias.domindo_entrada : null,
    dados.horario ? dados.horario.dias.domindo_saida : null,
    dados.jornadaCodigo,
    dados.remoto,
  ];
}

export async function lerVaga(id: string): Promise<VagaFormulario> {
  const limpo = id.trim();
  if (!limpo) throw new Error('Escolha a vaga.');
  const { data, error } = await getSupabaseServer()
    .from('vaga')
    .select(
      'empresa_id, tipo_vaga, cargo, salario, carga_horaria, escolaridade, sexo, idade, idade_ate, km, atividades, tempo, turno, beneficios, conducoes, jornada, tipo_trabalho'
    )
    .eq('id', limpo)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  if (!data) throw new Error('Essa vaga não está nesta lista.');

  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT periodo, semanas_inicio, semanas_fim, horabase, tempo_refeicao, carga_horaria,
      segunda_entrada, segunda_saida, terca_entrada, terca_saida, quarta_entrada, quarta_saida,
      quinta_entrada, quinta_saida, sexta_entrada, sexta_saida, sab_entrada, sab_saida,
      domindo_entrada, domindo_saida
    FROM vaga WHERE id_vaga = ? LIMIT 1
    `,
    [limpo]
  );
  const row = rows[0];
  if (!row) throw new Error('Essa vaga não está no sistema antigo.');

  const tipo = String(data.tipo_vaga || '');
  const [intervaloHoras, intervaloMinutos] = partirRelogio(row.tempo_refeicao);
  const [tempoHoras, tempoMinutos] = partirRelogio(data.tempo);
  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    dias[dia.entrada] = String(row[dia.entrada] || '');
    dias[dia.saida] = String(row[dia.saida] || '');
  }

  return {
    empresaId: String(data.empresa_id || ''),
    tipoVaga: tipo,
    quantidade: '1',
    cargo: String(data.cargo || ''),
    bolsa: data.salario == null ? '' : String(data.salario),
    cargaHoraria: String(data.carga_horaria || row.carga_horaria || ''),
    periodo: String(data.turno || row.periodo || ''),
    diaDe: row.semanas_inicio == null ? '' : String(row.semanas_inicio),
    diaAte: row.semanas_fim == null ? '' : String(row.semanas_fim),
    entrada: String(row.horabase || ''),
    intervaloHoras: intervaloHoras || '0',
    intervaloMinutos: intervaloMinutos || '0',
    dias: tipo === '1' || tipo === '2' ? dias : null,
    escolaridade: String(data.escolaridade || (tipo === '1' || tipo === '2' ? '0' : '')),
    sexo: String(data.sexo || ''),
    idade: data.idade == null ? '' : String(data.idade),
    idadeAte: data.idade_ate == null ? '' : String(data.idade_ate),
    km: data.km == null ? '' : String(data.km),
    atividades: String(data.atividades || ''),
    tempoHoras,
    tempoMinutos,
    beneficios: String(data.beneficios || ''),
    conducoes: String(data.conducoes || ''),
    folgasFixas: data.jornada === 'sim' || data.jornada === 'nao' ? data.jornada : '',
    jornada: data.jornada === 'fixa' || data.jornada === 'escala' ? data.jornada : '',
    tipoTrabalho:
      data.tipo_trabalho === 'presencial' || data.tipo_trabalho === 'remoto' || data.tipo_trabalho === 'hibrido'
        ? data.tipo_trabalho
        : '',
  };
}

export async function atualizarVaga(id: string, input: VagaInput): Promise<void> {
  const limpo = id.trim();
  if (!limpo) throw new Error('Escolha a vaga.');
  const { data: atual, error: erroAtual } = await getSupabaseServer().from('vaga').select('id').eq('id', limpo).maybeSingle();
  if (erroAtual) throw new Error(mensagemSupabase(erroAtual.message));
  if (!atual) throw new Error('Essa vaga não está nesta lista.');

  const empresaId = exigir(input.empresaId, 'Escolha uma empresa.');
  const { data: empresa, error } = await getSupabaseServer()
    .from('empresa')
    .select('id, grupo_id, cep, latitude, longitude')
    .eq('id', empresaId)
    .maybeSingle();
  if (error) throw new Error(mensagemSupabase(error.message));
  if (!empresa) throw new Error('Escolha uma empresa já cadastrada.');
  const grupoId = texto(empresa.grupo_id);
  if (!grupoId) throw new Error('Essa empresa não tem grupo.');

  const abertura = await withDnaWorkTransaction(async (conn) => {
    const [rows] = await conn.query<DnaRow[]>(`SELECT id_vaga, sede FROM vaga WHERE id_vaga = ? LIMIT 1`, [limpo]);
    if (!rows[0]) throw new Error('Essa vaga não está no sistema antigo.');
    const [empresaRows] = await conn.query<DnaRow[]>(`SELECT sede FROM empresa WHERE id_empresa = ? LIMIT 1`, [empresaId]);
    if (!empresaRows[0]) throw new Error('Essa empresa não está no sistema antigo.');
    const sedeBruta = empresaRows[0].sede;
    const sede = sedeBruta == null || sedeBruta === '' ? null : Number(sedeBruta);
    const dados = preparar({ ...input, quantidade: '1' }, grupoId, Number.isFinite(sede) ? sede : null);
    const salarioBruto = Number(dados.salario);
    const salarioNumero = Number.isFinite(salarioBruto) ? salarioBruto : null;
    const local = localDaEmpresa(empresa);
    const vagaId = await vagaIdNaEdicao(limpo, dados, salarioNumero, local);
    const { data: antes, error: erroAntes } = await getSupabaseServer()
      .from('vaga')
      .select('vaga_id')
      .eq('id', limpo)
      .maybeSingle();
    if (erroAntes) throw new Error(mensagemSupabase(erroAntes.message));
    const codigoNovo = String(antes?.vaga_id || '') === vagaId ? null : await codigoLivre(conn);
    if (codigoNovo) await conn.query(`INSERT INTO codigo_vaga (codigo) VALUES (?)`, [codigoNovo]);
    await conn.query(
      `
      UPDATE vaga SET
        ${codigoNovo ? 'codigo = ?,' : ''}
        id_empresa = ?, tipo_vaga = ?, cargo = ?, salario = ?, carga_horaria = ?, escolaridade = ?, sexo = ?,
        idade = ?, idadeate = ?, km = ?, atribuicaoes = ?, atribu_contrato = ?, sede = ?,
        texto_carga = ?, horabase = ?, hora_saida_base = ?, periodo = ?, semanas_inicio = ?, semanas_fim = ?,
        pausa_almoco = ?, tempo_refeicao = ?,
        segunda_entrada = ?, segunda_saida = ?, terca_entrada = ?, terca_saida = ?, quarta_entrada = ?, quarta_saida = ?,
        quinta_entrada = ?, quinta_saida = ?, sexta_entrada = ?, sexta_saida = ?, sab_entrada = ?, sab_saida = ?,
        domindo_entrada = ?, domindo_saida = ?,
        jornada = ?, remoto = ?
      WHERE id_vaga = ?
      `,
      [...(codigoNovo ? [codigoNovo] : []), ...parametrosVaga(dados), limpo]
    );
    return { dados, vagaId, salarioNumero, local };
  });

  const { error: erroUpdate } = await getSupabaseServer()
    .from('vaga')
    .update({
      vaga_id: abertura.vagaId,
      grupo_id: abertura.dados.grupoId,
      empresa_id: abertura.dados.empresaId,
      tipo_vaga: abertura.dados.tipoVaga,
      cargo: abertura.dados.cargo,
      salario: abertura.salarioNumero,
      carga_horaria: abertura.dados.cargaHoraria,
      escolaridade: abertura.dados.escolaridade || null,
      sexo: abertura.dados.sexo,
      idade: abertura.dados.idade,
      idade_ate: abertura.dados.idadeAte,
      km: abertura.dados.km == null ? null : Number(abertura.dados.km),
      atividades: abertura.dados.atividades,
      tempo: abertura.dados.tempo,
      horario: abertura.dados.horario?.registro || null,
      turno: abertura.dados.horario?.periodo || null,
      beneficios: abertura.dados.beneficios,
      conducoes: abertura.dados.conducoes,
      jornada: abertura.dados.jornada,
      tipo_trabalho: abertura.dados.tipoTrabalho,
      cep: abertura.local.cep,
      latitude: abertura.local.latitude,
      longitude: abertura.local.longitude,
    })
    .eq('id', limpo);
  if (erroUpdate) throw new Error(mensagemSupabase(erroUpdate.message));
  await guardarRepetida(abertura.dados, abertura.salarioNumero, abertura.local, abertura.vagaId);
}
