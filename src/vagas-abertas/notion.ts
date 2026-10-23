import { DIAS_HORARIO, registroHorario, type DiasGrade } from '@/grupos-empresas/horario';
import { localDaEmpresa } from '@/grupos-empresas/validar';
import { getDnaWorkPool } from '@/lib/dna-work-db';
import { notionRequest, notionToken } from '@/lib/notion';
import { getSupabaseServer } from '@/lib/supabase-server';

const TOGGLE_CLT = '37c828b5-2830-805a-b964-c25ebffcd1f3';
const CODIGO = /\b([A-Z]{2,5}-\d{3,5})\b/i;

const DIAS_NOME: Record<string, number> = {
  domingo: 1,
  segunda: 2,
  terca: 3,
  terça: 3,
  quarta: 4,
  quinta: 5,
  sexta: 6,
  sabado: 7,
  sábado: 7,
};

type NotionBlock = {
  id?: string;
  type?: string;
  has_children?: boolean;
  table_row?: { cells?: Array<Array<{ plain_text?: string }>> };
  [key: string]: unknown;
};

type NotionList = {
  results?: NotionBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type VagaNotion = {
  codigo: string;
  mensagem: string;
  endereco: string;
  entrada: string;
  saida: string;
  inicio: number;
  fim: number;
  intervalo: string;
  texto: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type NotionVagasResultado = {
  lidas: number;
  aplicadas: number;
  iguais: number;
  pendentes: number;
  locais: number;
};

function plain(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => String((part as { plain_text?: string }).plain_text || '')).join('');
}

function textoBloco(block: NotionBlock): string {
  const type = String(block.type || '');
  const inner = (block[type] || {}) as { rich_text?: unknown; title?: unknown };
  return plain(inner.rich_text) || plain(inner.title) || '';
}

function fold(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function filhos(id: string): Promise<NotionBlock[]> {
  const itens: NotionBlock[] = [];
  let cursor: string | null = null;
  do {
    const qs = new URLSearchParams({ page_size: '100' });
    if (cursor) qs.set('start_cursor', cursor);
    const data = await notionRequest<NotionList>(`/blocks/${id}/children?${qs.toString()}`);
    itens.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor || null : null;
  } while (cursor);
  return itens;
}

function celulas(block: NotionBlock): string[] {
  return (block.table_row?.cells || []).map((cell) => plain(cell).replace(/\s+/g, ' ').trim());
}

async function tabelas(id: string): Promise<string[][][]> {
  const kids = await filhos(id);
  const saida: string[][][] = [];
  for (const kid of kids) {
    if (kid.type === 'table' && kid.id) {
      const rows = await filhos(kid.id);
      saida.push(rows.filter((row) => row.type === 'table_row').map(celulas));
    }
    if (kid.has_children && kid.id && (kid.type === 'toggle' || kid.type === 'synced_block')) {
      saida.push(...(await tabelas(kid.id)));
    }
  }
  return saida;
}

function horaDe(valor: string): string {
  const match = valor.match(/^(\d{1,2})[h:](\d{2})$/i);
  if (!match) return '';
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas > 23 || minutos > 59) return '';
  return `${String(horas).padStart(2, '0')}:${match[2]}`;
}

function diaDe(valor: string): number {
  const bruto = fold(valor).replace(/feira/g, '').trim();
  for (const [nome, numero] of Object.entries(DIAS_NOME)) {
    if (bruto.startsWith(fold(nome))) return numero;
  }
  return 0;
}

function faixaDe(texto: string): { inicio: number; fim: number } | null {
  const limpo = fold(texto).replace(/feira/g, ' ');
  const match = limpo.match(
    /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b.*?\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/
  );
  if (!match) return null;
  const inicio = diaDe(match[1]);
  const fim = diaDe(match[2]);
  if (!inicio || !fim) return null;
  return { inicio, fim };
}

function horasDe(texto: string): { entrada: string; saida: string } | null {
  const match = texto.match(/(\d{1,2}[h:]\d{2})\s*(?:às|ás|as|a)\s*(\d{1,2}[h:]\d{2})/i);
  if (!match) return null;
  const entrada = horaDe(match[1].replace('h', ':'));
  const saida = horaDe(match[2].replace('h', ':'));
  if (!entrada || !saida) return null;
  return { entrada, saida };
}

function intervaloDe(texto: string): string {
  const match = fold(texto).match(/intervalo de (\d{1,2})\s*minutos/);
  if (!match) return '';
  const minutos = Number(match[1]);
  if (!Number.isInteger(minutos) || minutos <= 0 || minutos >= 24 * 60) return '';
  const hora = Math.floor(minutos / 60);
  return `${String(hora).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function fraseHorario(mensagem: string): string {
  const linhas = mensagem
    .split(/\n+/)
    .map((linha) => linha.replace(/^[🕐⏱⏰]\s*/, '').trim())
    .filter(Boolean);
  const comRelogio = linhas.find((linha) => horasDe(linha) && faixaDe(linha));
  if (comRelogio) return comRelogio;
  const noBloco = mensagem.replace(/\s+/g, ' ').trim();
  const match = noBloco.match(
    /(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)[^.]{0,120}?\d{1,2}[h:]\d{2}\s*(?:às|ás|as|a)\s*\d{1,2}[h:]\d{2}[^.]*/i
  );
  return (match?.[0] || '').replace(/^[🕐⏱⏰]\s*/, '').trim();
}

function localDe(mensagem: string, endereco: string): { bairro: string; cidade: string; uf: string } {
  const pin = mensagem.match(/📍\s*(?:bairro:\s*)?([^\n💰🕐]+)/i);
  const linha = (pin?.[1] || '').replace(/\s+/g, ' ').trim();
  const partido = linha.match(/^(.+?)\s*-\s*(.+?)\s*\/\s*([A-Z]{2})$/i);
  if (partido) {
    return { bairro: partido[1].trim(), cidade: partido[2].trim(), uf: partido[3].toUpperCase() };
  }
  const soBairro = linha.replace(/^bairro:\s*/i, '').trim();
  const cidadeLinha =
    endereco.match(/cidade:\s*([^/\n]+)\s*\/\s*([A-Z]{2})/i) ||
    endereco.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+?)\s*[-\/]\s*([A-Z]{2})\s*$/i) ||
    endereco.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+?)\s*\/\s*([A-Z]{2})/i);
  return {
    bairro: soBairro.replace(/\s*-\s*$/, '').trim(),
    cidade: cidadeLinha?.[1]?.trim() || '',
    uf: (cidadeLinha?.[2] || '').toUpperCase(),
  };
}

function vagaDe(codigo: string, mensagem: string, endereco: string): VagaNotion | null {
  const frase = fraseHorario(mensagem) || fraseHorario(endereco);
  const faixa = frase ? faixaDe(frase) : null;
  const horas = frase ? horasDe(frase) : horasDe(mensagem);
  if (!faixa || !horas) return null;
  const local = localDe(mensagem, endereco);
  return {
    codigo: codigo.toUpperCase(),
    mensagem,
    endereco,
    entrada: horas.entrada,
    saida: horas.saida,
    inicio: faixa.inicio,
    fim: faixa.fim,
    intervalo: intervaloDe(mensagem),
    texto: frase.replace(/;/g, ','),
    bairro: local.bairro,
    cidade: local.cidade,
    uf: local.uf,
  };
}

function naFaixa(numero: number, inicio: number, fim: number): boolean {
  if (fim >= inicio) return numero >= inicio && numero <= fim;
  return numero >= inicio || numero <= fim;
}

function gradeDe(vaga: VagaNotion): DiasGrade {
  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    const dentro = naFaixa(dia.numero, vaga.inicio, vaga.fim);
    dias[dia.entrada] = dentro ? vaga.entrada : '0';
    dias[dia.saida] = dentro ? vaga.saida : '0';
  }
  return dias;
}

function horarioGravado(vaga: VagaNotion, periodo: string): string {
  const dias = gradeDe(vaga);
  const registro = registroHorario(
    { periodo, inicio: vaga.inicio, fim: vaga.fim, intervalo: vaga.intervalo && vaga.intervalo !== '00:00' ? vaga.intervalo : '' },
    {
      ...dias,
      ...Object.fromEntries(
        DIAS_HORARIO.flatMap((dia) => [
          [dia.entrada, dias[dia.entrada] === '0' ? '' : dias[dia.entrada]],
          [dia.saida, dias[dia.saida] === '0' ? '' : dias[dia.saida]],
        ])
      ),
    } as DiasGrade
  );
  return vaga.texto ? `${registro};texto=${vaga.texto}` : registro;
}

export async function listarVagasNotion(): Promise<Map<string, VagaNotion>> {
  const mapa = new Map<string, VagaNotion>();
  const grades = await tabelas(TOGGLE_CLT);
  for (const tabela of grades) {
    const corpo = tabela.slice(tabela[0]?.[0] === 'Título' || tabela[0]?.[0] === 'Zona' ? 1 : 0);
    for (const linha of corpo) {
      const blob = linha.join('\n');
      const codigo = blob.match(CODIGO)?.[1];
      if (!codigo) continue;
      const mensagem = linha.find((celula) => celula.includes('📍') || celula.includes('🕐')) || linha[linha.length - 1] || '';
      const endereco = linha.find((celula) => /endereço|empresa:|horário/i.test(celula)) || linha[1] || '';
      const vaga = vagaDe(codigo, mensagem, endereco);
      if (vaga) mapa.set(vaga.codigo, vaga);
    }
  }
  return mapa;
}

function horaAtual(valor: unknown): string {
  const match = String(valor ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function horarioIgual(linha: Record<string, unknown>, vaga: VagaNotion): boolean {
  if (fold(String(linha.texto_carga || '')) !== fold(vaga.texto)) return false;
  if (Number(linha.semanas_inicio) !== vaga.inicio || Number(linha.semanas_fim) !== vaga.fim) return false;
  for (const dia of DIAS_HORARIO) {
    const dentro = naFaixa(dia.numero, vaga.inicio, vaga.fim);
    const entrada = horaAtual(linha[dia.entrada]);
    const saida = horaAtual(linha[dia.saida]);
    if (dentro) {
      if (entrada !== vaga.entrada || saida !== vaga.saida) return false;
    } else if (entrada && entrada !== '00:00') {
      return false;
    }
  }
  return true;
}

function localIgual(linha: Record<string, unknown>, vaga: VagaNotion): boolean {
  if (!vaga.bairro) return true;
  return (
    fold(String(linha.bairro || '')) === fold(vaga.bairro) &&
    (!vaga.cidade || fold(String(linha.cidade || '')) === fold(vaga.cidade)) &&
    (!vaga.uf || fold(String(linha.uf || '')) === fold(vaga.uf))
  );
}

export async function aplicarNotionNasVagas(): Promise<NotionVagasResultado> {
  const vazio: NotionVagasResultado = { lidas: 0, aplicadas: 0, iguais: 0, pendentes: 0, locais: 0 };
  if (!notionToken()) {
    console.log('[vagas-abertas] notion=sem-token');
    return vazio;
  }

  let notion: Map<string, VagaNotion>;
  try {
    notion = await listarVagasNotion();
  } catch (error) {
    console.error('[vagas-abertas] notion falhou:', error);
    return vazio;
  }

  const supabase = getSupabaseServer();
  const ids: string[] = [];
  let inicio = 0;
  while (true) {
    const { data, error } = await supabase.from('vaga').select('id, vaga_id, horario').range(inicio, inicio + 499);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const id = String(row.id || '');
      if (id) ids.push(id);
    }
    if (!data || data.length < 500) break;
    inicio += 500;
  }

  const pool = getDnaWorkPool();
  const linhas: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const [rows] = await pool.query(
      `SELECT v.id_vaga, v.id_empresa, v.codigo, v.status, v.periodo, v.semanas_inicio, v.semanas_fim,
        v.horabase, v.hora_saida_base, v.tempo_refeicao, v.texto_carga,
        v.segunda_entrada, v.segunda_saida, v.terca_entrada, v.terca_saida,
        v.quarta_entrada, v.quarta_saida, v.quinta_entrada, v.quinta_saida,
        v.sexta_entrada, v.sexta_saida, v.sab_entrada, v.sab_saida,
        v.domindo_entrada, v.domindo_saida,
        e.bairro, e.cidade, e.uf
       FROM vaga v
       INNER JOIN empresa e ON e.id_empresa = v.id_empresa
       WHERE v.id_vaga IN (?)`,
      [lote]
    );
    linhas.push(...(rows as Record<string, unknown>[]));
  }

  const { data: atuais, error: erroAtuais } = await supabase.from('vaga').select('id, vaga_id, horario').in('id', ids);
  if (erroAtuais) throw new Error(erroAtuais.message);
  const porId = new Map((atuais || []).map((row) => [String(row.id), row]));

  let aplicadas = 0;
  let iguais = 0;
  let pendentes = 0;
  let locais = 0;
  const empresasFeitas = new Set<string>();

  for (const linha of linhas) {
    const codigo = String(linha.codigo || '').trim().toUpperCase();
    const id = String(linha.id_vaga || '');
    const vaga = notion.get(codigo);
    if (!vaga) {
      // Sem a vaga no Notion, o horário segue o Lightsail e o webhook antigo.
      pendentes += 1;
      continue;
    }
    const periodo = ['Manha', 'Tarde', 'Noite'].includes(String(linha.periodo || '').trim())
      ? String(linha.periodo).trim()
      : '';
    const mudaHorario = !horarioIgual(linha, vaga);
    const mudaLocal = !localIgual(linha, vaga);
    if (!mudaHorario && !mudaLocal) {
      iguais += 1;
      continue;
    }

    if (mudaHorario) {
      const dias = gradeDe(vaga);
      const intervalo = vaga.intervalo || horaAtual(linha.tempo_refeicao);
      await pool.query(
        `UPDATE vaga SET
          texto_carga = ?, horabase = ?, hora_saida_base = ?, semanas_inicio = ?, semanas_fim = ?,
          tempo_refeicao = ?,
          segunda_entrada = ?, segunda_saida = ?, terca_entrada = ?, terca_saida = ?,
          quarta_entrada = ?, quarta_saida = ?, quinta_entrada = ?, quinta_saida = ?,
          sexta_entrada = ?, sexta_saida = ?, sab_entrada = ?, sab_saida = ?,
          domindo_entrada = ?, domindo_saida = ?
         WHERE id_vaga = ? AND status = 0`,
        [
          vaga.texto,
          vaga.entrada,
          vaga.saida,
          vaga.inicio,
          vaga.fim,
          intervalo || '00:00',
          dias.segunda_entrada,
          dias.segunda_saida,
          dias.terca_entrada,
          dias.terca_saida,
          dias.quarta_entrada,
          dias.quarta_saida,
          dias.quinta_entrada,
          dias.quinta_saida,
          dias.sexta_entrada,
          dias.sexta_saida,
          dias.sab_entrada,
          dias.sab_saida,
          dias.domindo_entrada,
          dias.domindo_saida,
          id,
        ]
      );
      const horario = horarioGravado(vaga, periodo);
      const atual = porId.get(id);
      const { error } = await supabase.from('vaga').update({ horario }).eq('id', id);
      if (error) throw new Error(error.message);
      if (atual?.vaga_id && String(atual.horario || '') !== horario) {
        const { data: copias, error: erroCopia } = await supabase
          .from('vaga_repetida')
          .select('id, horario')
          .eq('vaga_id', atual.vaga_id);
        if (erroCopia) throw new Error(erroCopia.message);
        const alvo = (copias || []).filter((copia) => String(copia.horario || '') === String(atual.horario || ''));
        if (alvo.length === 1) {
          const { error: erroUpdate } = await supabase.from('vaga_repetida').update({ horario }).eq('id', alvo[0].id);
          if (erroUpdate) throw new Error(erroUpdate.message);
        }
      }
      aplicadas += 1;
    }

    if (mudaLocal && vaga.bairro) {
      const empresaId = String(linha.id_empresa || '');
      if (empresaId && !empresasFeitas.has(empresaId)) {
        await pool.query(`UPDATE empresa SET bairro = ?, cidade = ?, uf = ? WHERE id_empresa = ?`, [
          vaga.bairro,
          vaga.cidade || String(linha.cidade || ''),
          vaga.uf || String(linha.uf || ''),
          empresaId,
        ]);
        const local = localDaEmpresa({
          bairro: vaga.bairro,
          cidade: vaga.cidade || String(linha.cidade || ''),
          uf: vaga.uf || String(linha.uf || ''),
        });
        const { error: erroLocal } = await supabase.from('empresa').update({ local }).eq('id', empresaId);
        if (erroLocal && !/local/i.test(erroLocal.message)) throw new Error(erroLocal.message);
        empresasFeitas.add(empresaId);
        locais += 1;
      }
    }
  }

  const resultado = { lidas: notion.size, aplicadas, iguais, pendentes, locais };
  console.log(
    `[vagas-abertas] notion lidas=${resultado.lidas} aplicadas=${aplicadas} iguais=${iguais} pendentes=${pendentes} locais=${locais}`
  );
  return resultado;
}
