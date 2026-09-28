import type { CorCurriculo, ModeloCurriculo } from './types';

export const MODELOS: Array<{ id: ModeloCurriculo; nome: string; descricao: string }> = [
  { id: 'ats', nome: 'ATS', descricao: 'Coluna única, o mais seguro para Gupy e portais.' },
  { id: 'classico', nome: 'Clássico', descricao: 'Centralizado, formal, bom para loja e operação.' },
  { id: 'moderno', nome: 'Moderno', descricao: 'Faixa colorida e seções limpas.' },
  { id: 'executivo', nome: 'Executivo', descricao: 'Faixa no topo com o nome em destaque.' },
  { id: 'lateral', nome: 'Lateral', descricao: 'Barra à esquerda com contato e competências.' },
  { id: 'direita', nome: 'Barra direita', descricao: 'Contato e competências à direita.' },
  { id: 'timeline', nome: 'Linha do tempo', descricao: 'Histórico profissional com marcações.' },
  { id: 'minimal', nome: 'Minimalista', descricao: 'Espaçado, tipografia leve, visual limpo.' },
  { id: 'compacto', nome: 'Compacto', descricao: 'Cabe mais conteúdo em uma página.' },
];

export const CORES: Array<{ id: CorCurriculo; nome: string; hex: string }> = [
  { id: 'laranja', nome: 'DNA', hex: '#ff7a08' },
  { id: 'azul', nome: 'Azul', hex: '#1d4ed8' },
  { id: 'verde', nome: 'Verde', hex: '#0f766e' },
  { id: 'vinho', nome: 'Vinho', hex: '#9f1239' },
  { id: 'grafite', nome: 'Grafite', hex: '#334155' },
  { id: 'roxo', nome: 'Roxo', hex: '#6a5cff' },
  { id: 'vermelho', nome: 'Vermelho', hex: '#b91c1c' },
  { id: 'rosa', nome: 'Rosa', hex: '#be185d' },
  { id: 'ciano', nome: 'Ciano', hex: '#0e7490' },
  { id: 'mostarda', nome: 'Mostarda', hex: '#b45309' },
  { id: 'marinho', nome: 'Marinho', hex: '#1e3a5f' },
  { id: 'terracota', nome: 'Terracota', hex: '#c2410c' },
  { id: 'oliva', nome: 'Oliva', hex: '#3f6212' },
  { id: 'preto', nome: 'Preto', hex: '#111827' },
];

export function hexDaCor(cor: CorCurriculo): string {
  return CORES.find((item) => item.id === cor)?.hex || '#ff7a08';
}
