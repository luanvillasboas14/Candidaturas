import type { Curriculo } from './types';

function fotoIniciais(iniciais: string, hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="18" fill="${hex}"/>
    <text x="100" y="118" text-anchor="middle" fill="#ffffff" font-size="72" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${iniciais}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function curriculoExemplo(hex = '#ff7a08'): Curriculo {
  return {
    nome: 'Ana Paula Ferreira',
    foto: fotoIniciais('AP', hex),
    telefone: '(11) 98876-4321',
    email: 'ana.ferreira@email.com',
    cidade: 'São Paulo',
    uf: 'SP',
    bairro: 'Vila Madalena',
    nascimento: '1996-03-14',
    formacoes: [
      {
        id: 'ex-f1',
        nivel: 'Técnico',
        curso: 'Técnico em Panificação',
        instituicao: 'SENAI São Paulo',
        inicio: '2018',
        fim: '2020',
        status: 'Completo',
      },
      {
        id: 'ex-f2',
        nivel: 'Ensino médio',
        curso: '',
        instituicao: 'E.E. Fernão Dias',
        inicio: '2012',
        fim: '2015',
        status: 'Completo',
      },
    ],
    experiencias: [
      {
        id: 'ex-e1',
        empresa: 'Padaria Central',
        cargo: 'Auxiliar de Padaria',
        cidade: 'São Paulo',
        inicio: '2022-03',
        fim: '',
        atual: true,
        atividades: 'Produção de pães, bolos e salgados\nOrganização da vitrine e controle de validade\nApoio no atendimento do balcão nos horários de pico',
      },
      {
        id: 'ex-e2',
        empresa: 'Mercado Bom Preço',
        cargo: 'Operadora de caixa',
        cidade: 'São Paulo',
        inicio: '2019-06',
        fim: '2022-02',
        atual: false,
        atividades: 'Operação de caixa e fechamento de turno\nReposição de mercadorias\nAtendimento ao cliente e troca de produtos',
      },
    ],
    competencias: [
      'Prática com atendimento e suporte aos clientes',
      'Perfil colaborativo no dia a dia do trabalho',
      'Agilidade para cumprir rotina e entregar no prazo',
      'Pontualidade, responsabilidade e cuidado com o que foi combinado',
    ],
    idiomas: [
      { id: 'ex-i1', idioma: 'Português', nivel: 'Nativo' },
      { id: 'ex-i2', idioma: 'Espanhol', nivel: 'Básico' },
    ],
    certificacoes: [
      { id: 'ex-c1', nome: 'Boas Práticas de Fabricação', emissor: 'SENAI', ano: '2023' },
      { id: 'ex-c2', nome: 'Atendimento ao Cliente', emissor: 'Senac', ano: '2021' },
    ],
    afiliacoes: '',
    conquistas: '',
    informacoes: '',
    sites: '',
    objetivo:
      'Busco uma vaga de Auxiliar de Padaria na Vila Madalena, com disponibilidade para turnos e experiência em produção, organização da vitrine e atendimento.',
  };
}
