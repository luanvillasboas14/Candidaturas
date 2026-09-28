export const SETORES = [
  { id: 'atendimento', nome: 'Atendimento' },
  { id: 'administrativo', nome: 'Administrativo' },
  { id: 'operacao', nome: 'Operação' },
  { id: 'geral', nome: 'Comportamental' },
] as const;

export const FRASES: Array<{ setor: (typeof SETORES)[number]['id']; texto: string }> = [
  { setor: 'atendimento', texto: 'Prática com atendimento e suporte aos clientes' },
  { setor: 'atendimento', texto: 'Facilidade para orientar o cliente e resolver dúvidas' },
  { setor: 'atendimento', texto: 'Experiência com caixa, troco e fechamento de turno' },
  { setor: 'atendimento', texto: 'Cuidado com a organização do espaço de atendimento' },
  { setor: 'administrativo', texto: 'Eficiência na organização de documentos e arquivos' },
  { setor: 'administrativo', texto: 'Familiaridade com rotinas administrativas' },
  { setor: 'administrativo', texto: 'Prática com planilhas, lançamentos e conferência de informações' },
  { setor: 'administrativo', texto: 'Organização de agenda, recados e acompanhamento de prazos' },
  { setor: 'operacao', texto: 'Reposição de mercadorias e organização do estoque' },
  { setor: 'operacao', texto: 'Agilidade para cumprir rotina e entregar no prazo' },
  { setor: 'operacao', texto: 'Cuidado com limpeza, segurança e padrão do local de trabalho' },
  { setor: 'operacao', texto: 'Experiência com recebimento e conferência de mercadorias' },
  { setor: 'geral', texto: 'Perfil colaborativo no dia a dia do trabalho' },
  { setor: 'geral', texto: 'Boa comunicação com a equipe e com a liderança' },
  { setor: 'geral', texto: 'Disposição para aprender rotinas novas e seguir o padrão do trabalho' },
  { setor: 'geral', texto: 'Pontualidade, responsabilidade e cuidado com o que foi combinado' },
];
