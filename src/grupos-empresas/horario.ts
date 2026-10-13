export const DIAS_HORARIO = [
  { numero: 1, nome: 'Domingo', entrada: 'domindo_entrada', saida: 'domindo_saida' },
  { numero: 2, nome: 'Segunda', entrada: 'segunda_entrada', saida: 'segunda_saida' },
  { numero: 3, nome: 'Terça', entrada: 'terca_entrada', saida: 'terca_saida' },
  { numero: 4, nome: 'Quarta', entrada: 'quarta_entrada', saida: 'quarta_saida' },
  { numero: 5, nome: 'Quinta', entrada: 'quinta_entrada', saida: 'quinta_saida' },
  { numero: 6, nome: 'Sexta', entrada: 'sexta_entrada', saida: 'sexta_saida' },
  { numero: 7, nome: 'Sábado', entrada: 'sab_entrada', saida: 'sab_saida' },
] as const;

export const CARGAS_ESTAGIO = ['30', '20'] as const;
export const CARGAS_CLT = ['44', '40'] as const;
export const PERIODOS = [
  { id: 'Manha', nome: 'Manhã' },
  { id: 'Tarde', nome: 'Tarde' },
  { id: 'Noite', nome: 'Noite' },
] as const;

type ColunaDia = (typeof DIAS_HORARIO)[number]['entrada'] | (typeof DIAS_HORARIO)[number]['saida'];

export type DiasGrade = Record<ColunaDia, string>;

export type GradeHorario = {
  cargaHoraria: string;
  periodo: string;
  inicio: number;
  fim: number;
  entrada: string;
  saida: string;
  intervalo: string;
  intervaloMinutos: number;
  pausa: '0' | '1';
  texto: string;
  registro: string;
  dias: DiasGrade;
};

export function mascaraHora(valor: string): string {
  if (valor.includes(':')) {
    const [hora, minuto = ''] = valor.split(':');
    return `${hora.replace(/\D/g, '').slice(0, 2)}:${minuto.replace(/\D/g, '').slice(0, 2)}`;
  }
  const digitos = valor.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

function horaCanonica(valor: string): string {
  const match = valor.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hora = Number(match[1]);
  const minuto = Number(match[2]);
  if (hora > 23 || minuto > 59) return '';
  return `${String(hora).padStart(2, '0')}:${match[2]}`;
}

export function horaPronta(valor: string): boolean {
  return horaCanonica(valor) !== '';
}

function minutosDoRelogio(valor: string): number {
  const [hora, minuto] = valor.split(':').map(Number);
  return hora * 60 + minuto;
}

function relogio(minutos: number): string {
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

function parteTempo(quantidade: number, singular: string, plural: string): string {
  if (quantidade === 1) return `1 ${singular}`;
  if (quantidade > 1) return `${quantidade} ${plural}`;
  return '';
}

function diaPorNumero(numero: number) {
  return DIAS_HORARIO.find((dia) => dia.numero === numero);
}

function quantidadeDias(inicio: number, fim: number): number {
  if (fim >= inicio) return fim - inicio + 1;
  return 7 - inicio + 1 + fim;
}

function diaNaFaixa(numero: number, inicio: number, fim: number): boolean {
  if (fim >= inicio) return numero >= inicio && numero <= fim;
  return numero >= inicio || numero <= fim;
}

export function registroHorario(grade: Pick<GradeHorario, 'periodo' | 'inicio' | 'fim' | 'intervalo'>, dias: DiasGrade): string {
  const pares = DIAS_HORARIO.map((dia) => {
    const entrada = dias[dia.entrada];
    const saida = dias[dia.saida];
    return `${dia.numero}=${entrada && saida ? `${entrada}-${saida}` : ''}`;
  }).join(';');
  return `${grade.periodo};${grade.inicio}-${grade.fim};${grade.intervalo || '00:00'};${pares}`;
}

export function calcularHorario(input: {
  cargaHoraria: string;
  tipoVaga?: string;
  periodo: string;
  diaDe: string;
  diaAte: string;
  entrada: string;
  intervaloHoras: string;
  intervaloMinutos: string;
}): GradeHorario {
  const cargaHoraria = input.cargaHoraria.trim();
  const clt = input.tipoVaga === '2';
  const permitidas: readonly string[] = clt ? CARGAS_CLT : CARGAS_ESTAGIO;
  if (!permitidas.includes(cargaHoraria)) {
    throw new Error('Escolha a carga horária.');
  }
  const periodo = input.periodo.trim();
  if (!PERIODOS.some((item) => item.id === periodo)) throw new Error('Escolha o período.');

  const inicio = Number(input.diaDe);
  const fim = Number(input.diaAte);
  if (!diaPorNumero(inicio) || !diaPorNumero(fim)) throw new Error('Escolha os dias do horário.');
  const entrada = horaCanonica(input.entrada);
  if (!entrada) throw new Error('Informe a entrada no formato 00:00.');

  const horasIntervalo = input.intervaloHoras.trim() || '0';
  const minutosIntervalo = input.intervaloMinutos.trim() || '0';
  if (!/^\d+$/.test(horasIntervalo) || !/^\d+$/.test(minutosIntervalo)) {
    throw new Error('Informe o intervalo em horas e minutos.');
  }
  const horaIntervalo = Number(horasIntervalo);
  const minutoIntervalo = Number(minutosIntervalo);
  if (horaIntervalo > 23) throw new Error('O intervalo precisa caber em um dia.');
  if (minutoIntervalo > 59) throw new Error('Os minutos do intervalo vão de 0 a 59.');
  const intervaloMinutos = horaIntervalo * 60 + minutoIntervalo;

  const diasNaFaixa = quantidadeDias(inicio, fim);
  const carga = Number(cargaHoraria);
  const teto = clt ? carga : 30;
  const trabalhoMinutos = Math.round(Math.min(teto / diasNaFaixa, carga / 5) * 60);
  const permanencia = trabalhoMinutos + intervaloMinutos;
  const entradaMinutos = minutosDoRelogio(entrada);
  if (entradaMinutos + permanencia >= 24 * 60) {
    throw new Error('A saída passa da meia-noite. Ajuste a entrada ou o intervalo.');
  }
  const saida = relogio(entradaMinutos + permanencia);

  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    const dentro = diaNaFaixa(dia.numero, inicio, fim);
    dias[dia.entrada] = dentro ? entrada : '';
    dias[dia.saida] = dentro ? saida : '';
  }

  const primeiro = diaPorNumero(inicio)!;
  const ultimo = diaPorNumero(fim)!;
  const periodoDias =
    inicio === fim ? primeiro.nome : `${primeiro.nome} a ${ultimo.nome.toLocaleLowerCase('pt-BR')}`;
  const horasParte = parteTempo(horaIntervalo, 'hora', 'horas');
  const minutosParte = parteTempo(minutoIntervalo, 'minuto', 'minutos');
  const intervaloTexto = [horasParte, minutosParte].filter(Boolean).join(' e ');
  const pausa = intervaloTexto ? `, com intervalo de ${intervaloTexto}` : '';
  const texto = `${periodoDias} das ${entrada} às ${saida}${pausa}. Carga horária: ${cargaHoraria}h por semana.`;
  const intervalo = intervaloMinutos > 0 ? relogio(intervaloMinutos) : '';
  const grade = {
    cargaHoraria,
    periodo,
    inicio,
    fim,
    entrada,
    saida,
    intervalo,
    intervaloMinutos,
    pausa: intervaloMinutos > 0 ? '1' : '0',
    texto,
    registro: '',
    dias,
  } satisfies GradeHorario;
  grade.registro = registroHorario(grade, dias);
  return grade;
}

export function lerRegistro(registro: string): {
  periodo: string;
  diaDe: string;
  diaAte: string;
  entrada: string;
  intervaloHoras: string;
  intervaloMinutos: string;
  dias: DiasGrade;
} | null {
  const partes = registro.split(';');
  if (partes.length < 4) return null;
  const [periodo, faixa, intervalo = ''] = partes;
  const [diaDe = '', diaAte = ''] = faixa.split('-');
  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    dias[dia.entrada] = '';
    dias[dia.saida] = '';
  }
  let entrada = '';
  for (const parte of partes.slice(3)) {
    const [numero, horario = ''] = parte.split('=');
    const dia = diaPorNumero(Number(numero));
    if (!dia) continue;
    const [chegada = '', saida = ''] = horario.split('-');
    dias[dia.entrada] = horaCanonica(chegada);
    dias[dia.saida] = horaCanonica(saida);
    if (!entrada && dias[dia.entrada]) entrada = dias[dia.entrada];
  }
  const [horas = '0', minutos = '0'] = intervalo.split(':');
  return {
    periodo,
    diaDe,
    diaAte,
    entrada,
    intervaloHoras: String(Number(horas) || 0),
    intervaloMinutos: String(Number(minutos) || 0),
    dias,
  };
}

export function diasInformados(valor: unknown, padrao: DiasGrade): DiasGrade {
  if (valor == null) return padrao;
  if (typeof valor !== 'object') throw new Error('O horário dos dias está inválido.');
  const bruto = valor as Record<string, unknown>;
  const dias = {} as DiasGrade;
  for (const dia of DIAS_HORARIO) {
    for (const coluna of [dia.entrada, dia.saida] as const) {
      if (!(coluna in bruto)) throw new Error('O horário dos dias está incompleto.');
      const item = bruto[coluna];
      if (item == null || item === '') {
        dias[coluna] = '';
        continue;
      }
      if (typeof item !== 'string' || !horaCanonica(item)) {
        throw new Error(`Horário inválido em ${dia.nome}. Use 00:00.`);
      }
      dias[coluna] = horaCanonica(item);
    }
  }
  return dias;
}

export function validarDias(cargaHoraria: string, intervaloMinutos: number, dias: DiasGrade): void {
  const carga = Number(cargaHoraria);
  const limiteDia = (carga / 5) * 60 + intervaloMinutos;
  let soma = 0;
  let preenchidos = 0;
  for (const dia of DIAS_HORARIO) {
    const entrada = dias[dia.entrada];
    const saida = dias[dia.saida];
    if (!entrada && !saida) continue;
    if (!horaCanonica(entrada) || !horaCanonica(saida)) throw new Error(`Informe entrada e saída de ${dia.nome}.`);
    const permanencia = minutosDoRelogio(saida) - minutosDoRelogio(entrada);
    if (permanencia <= 0) throw new Error(`A saída de ${dia.nome} precisa ser depois da entrada.`);
    if (permanencia - intervaloMinutos < 0) {
      throw new Error(`A permanência de ${dia.nome} não cobre o intervalo.`);
    }
    if (permanencia > limiteDia) {
      throw new Error(`A permanência de ${dia.nome} passa do limite da carga horária.`);
    }
    soma += permanencia - intervaloMinutos;
    preenchidos += 1;
  }
  if (preenchidos === 0) throw new Error('Informe o horário de pelo menos um dia.');
  if (soma > carga * 60) throw new Error(`A soma das horas da semana passa da carga de ${cargaHoraria}h.`);
}

export function tempoRelogio(horas: string, minutos: string): string {
  if (!/^\d+$/.test(horas.trim()) || !/^\d+$/.test(minutos.trim())) {
    throw new Error('Informe o tempo em horas e minutos.');
  }
  const hora = Number(horas);
  const minuto = Number(minutos);
  if (minuto > 59) throw new Error('Os minutos do tempo vão de 0 a 59.');
  if (hora === 0 && minuto === 0) throw new Error('Informe o tempo em horas e minutos.');
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}
