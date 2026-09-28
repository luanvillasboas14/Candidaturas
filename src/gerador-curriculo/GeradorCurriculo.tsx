'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizePhone } from '@/lib/phone';
import { CurriculoPreview } from './CurriculoPreview';
import { curriculoExemplo } from './exemplo';
import { FRASES, SETORES } from './frases';
import { CORES, hexDaCor, MODELOS } from './modelos';
import { baixarCurriculoPdf } from './pdf';
import type { CorCurriculo, Curriculo, ModeloCurriculo, NivelFormacao, StatusFormacao } from './types';
import { NIVEIS_FORMACAO, NIVEIS_IDIOMA, UFS, formacaoSemCurso, statusDaFormacao } from './types';

const ETAPAS = [
  'Modelo',
  'Cabeçalho do currículo',
  'Formação acadêmica',
  'Histórico profissional',
  'Competências',
  'Objetivo',
  'Finalizar',
];

function novoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function curriculoVazio(): Curriculo {
  return {
    nome: '',
    foto: '',
    telefone: '',
    email: '',
    cidade: '',
    uf: 'SP',
    bairro: '',
    nascimento: '',
    formacoes: [
      { id: novoId(), nivel: 'Ensino médio', curso: '', instituicao: '', inicio: '', fim: '', status: 'Completo' },
    ],
    experiencias: [
      {
        id: novoId(),
        empresa: '',
        cargo: '',
        cidade: '',
        inicio: '',
        fim: '',
        atual: false,
        atividades: '',
      },
    ],
    competencias: [],
    idiomas: [],
    certificacoes: [],
    afiliacoes: '',
    conquistas: '',
    informacoes: '',
    sites: '',
    objetivo: '',
  };
}

function formatarMesAno(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function mesAnoVisivel(value: string): string {
  if (/^\d{4}-\d{2}/.test(value)) return `${value.slice(5, 7)}/${value.slice(0, 4)}`;
  return value;
}

function mesAnoSalvo(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return display;
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) return display;
  return `${m[2]}-${m[1]}`;
}

function mesAnoCompleto(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return false;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12;
}

function erroMesAno(valor: string, campo: string): string {
  if (mesAnoCompleto(valor)) return '';
  const texto = mesAnoVisivel(valor);
  const m = texto.match(/^(\d{2})\/(\d{4})$/);
  if (m && (Number(m[1]) < 1 || Number(m[1]) > 12)) {
    return `${campo} está com mês inválido. Use de 01 a 12.`;
  }
  if (texto.trim()) return `${campo} precisa estar no formato mm/aaaa.`;
  return `Preencha ${campo}.`;
}

function erroAno(valor: string, campo: string): string {
  if (/^\d{4}$/.test(valor)) return '';
  if (valor.trim()) return `${campo} precisa ter 4 dígitos.`;
  return `Preencha ${campo}.`;
}

function posicaoAposDigitos(texto: string, digitos: number) {
  let pos = 0;
  let vistos = 0;
  while (pos < texto.length && vistos < digitos) {
    if (/\d/.test(texto[pos])) vistos += 1;
    pos += 1;
  }
  return pos;
}

function CampoMascara({
  id,
  value,
  disabled,
  placeholder,
  inputMode,
  formatar,
  onValue,
}: {
  id?: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  inputMode: 'numeric' | 'tel';
  formatar: (bruto: string) => string;
  onValue: (valor: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const digitosRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || digitosRef.current == null) return;
    const pos = posicaoAposDigitos(el.value, digitosRef.current);
    el.setSelectionRange(pos, pos);
    digitosRef.current = null;
  });

  return (
    <input
      ref={ref}
      id={id}
      inputMode={inputMode}
      placeholder={placeholder}
      disabled={disabled}
      value={disabled ? '' : value}
      onChange={(e) => {
        const bruto = e.target.value;
        const cursor = e.target.selectionStart ?? bruto.length;
        digitosRef.current = bruto.slice(0, cursor).replace(/\D/g, '').length;
        onValue(formatar(bruto));
      }}
    />
  );
}

function CampoAno({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const visivel = value.match(/\d{4}/)?.[0] || value.replace(/\D/g, '').slice(0, 4);
  return (
    <CampoMascara
      inputMode="numeric"
      placeholder="aaaa"
      disabled={disabled}
      value={visivel}
      formatar={(bruto) => bruto.replace(/\D/g, '').slice(0, 4)}
      onValue={onChange}
    />
  );
}

function CampoMesAno({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <CampoMascara
      inputMode="numeric"
      placeholder="mm/aaaa"
      disabled={disabled}
      value={mesAnoVisivel(value)}
      formatar={(bruto) => mesAnoVisivel(mesAnoSalvo(formatarMesAno(bruto)))}
      onValue={(mostrado) => onChange(mesAnoSalvo(mostrado))}
    />
  );
}

function formatarTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function GeradorCurriculo() {
  const [passo, setPasso] = useState(0);
  const [data, setData] = useState<Curriculo>(curriculoVazio);
  const [competencia, setCompetencia] = useState('');
  const [setorComp, setSetorComp] = useState('todos');
  const [modelo, setModelo] = useState<ModeloCurriculo>('moderno');
  const [cor, setCor] = useState<CorCurriculo>('laranja');
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [previewAltura, setPreviewAltura] = useState(1123);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const capturandoRef = useRef(false);

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const atualizar = () => {
      if (capturandoRef.current) return;
      const largura = el.clientWidth - 32;
      setPreviewScale(largura > 0 ? Math.min(1, largura / 794) : 1);
    };
    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const telefoneNorm = useMemo(() => normalizePhone(data.telefone), [data.telefone]);
  const previewData = passo === 0 ? curriculoExemplo(hexDaCor(cor)) : data;
  const frasesVisiveis = useMemo(
    () => FRASES.filter((item) => setorComp === 'todos' || item.setor === setorComp),
    [setorComp]
  );

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const medir = () => setPreviewAltura(Math.max(1123, el.scrollHeight));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, [passo, modelo, cor, data]);

  function erroDoPasso(indice: number): string {
    if (indice === 1) {
      if (!data.nome.trim()) return 'Preencha o nome completo.';
      if (!telefoneNorm) return 'Preencha um telefone válido.';
      if (!data.email.trim() || !data.email.includes('@')) return 'Preencha um e-mail válido.';
      if (!data.cidade.trim()) return 'Preencha a cidade.';
      if (!data.uf.trim()) return 'Escolha a UF.';
      if (!data.bairro.trim()) return 'Preencha o bairro.';
      if (!data.nascimento) return 'Preencha a data de nascimento.';
    }
    if (indice === 2) {
      if (!data.formacoes.length) return 'Inclua ao menos uma formação.';
      for (const [index, item] of data.formacoes.entries()) {
        const onde = data.formacoes.length > 1 ? ` da formação ${index + 1}` : '';
        if (!formacaoSemCurso(item.nivel) && !item.curso.trim()) return `Preencha o curso${onde}.`;
        if (!item.instituicao.trim()) return `Preencha a instituição${onde}.`;
        const inicio = erroAno(item.inicio, `O ano de início${onde}`);
        if (inicio) return inicio;
        if (item.status !== 'Cursando') {
          const fim = erroAno(item.fim, `O ano de fim${onde}`);
          if (fim) return fim;
        }
      }
    }
    if (indice === 3) {
      if (!data.experiencias.length) return 'Inclua ao menos uma experiência.';
      for (const [index, item] of data.experiencias.entries()) {
        const onde = data.experiencias.length > 1 ? ` da experiência ${index + 1}` : '';
        if (!item.empresa.trim()) return `Preencha a empresa${onde}.`;
        if (!item.cargo.trim()) return `Preencha o cargo${onde}.`;
        if (!item.cidade.trim()) return `Preencha a cidade${onde}.`;
        const inicio = erroMesAno(item.inicio, `O início${onde}`);
        if (inicio) return inicio;
        if (!item.atividades.trim()) return `Preencha as atividades${onde}.`;
        if (!item.atual) {
          const fim = erroMesAno(item.fim, `O fim${onde}`);
          if (fim) return fim;
        }
      }
    }
    if (indice === 4) {
      if (!data.competencias.length) return 'Inclua ao menos uma competência.';
      for (const item of data.idiomas) {
        if (item.idioma.trim()) continue;
        if (data.idiomas.length) return 'Preencha o idioma ou remova a linha.';
      }
      for (const [index, item] of data.certificacoes.entries()) {
        const algum = item.nome.trim() || item.emissor.trim() || item.ano.trim();
        if (!algum) continue;
        const onde = data.certificacoes.length > 1 ? ` da certificação ${index + 1}` : '';
        if (!item.nome.trim()) return `Preencha o nome${onde}.`;
        if (!item.emissor.trim()) return `Preencha o emissor${onde}.`;
        if (!item.ano.trim()) return `Preencha o ano${onde}.`;
      }
    }
    if (indice === 5) {
      if (!data.objetivo.trim()) return 'Preencha o objetivo profissional.';
    }
    return '';
  }

  function irPara(destino: number) {
    if (destino === passo) return;
    if (destino > passo) {
      for (let indice = passo; indice < destino; indice += 1) {
        const mensagem = erroDoPasso(indice);
        if (mensagem) {
          setErro(mensagem);
          setPasso(indice);
          return;
        }
      }
    }
    setErro('');
    setPasso(destino);
  }

  function patch(parcial: Partial<Curriculo>) {
    setData((atual) => ({ ...atual, ...parcial }));
  }

  function atualizarLista<K extends 'formacoes' | 'experiencias' | 'idiomas' | 'certificacoes'>(
    chave: K,
    id: string,
    parcial: Partial<Curriculo[K][number]>
  ) {
    setData((atual) => ({
      ...atual,
      [chave]: atual[chave].map((item) => (item.id === id ? { ...item, ...parcial } : item)),
    }));
  }

  function removerLista(chave: 'formacoes' | 'experiencias' | 'idiomas' | 'certificacoes', id: string) {
    setData((atual) => ({
      ...atual,
      [chave]: atual[chave].filter((item) => item.id !== id),
    }));
  }

  async function lerFoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 800_000) {
      setErro('A foto deve ter no máximo 800 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ foto: String(reader.result || '') });
    reader.readAsDataURL(file);
  }

  function adicionarCompetencia(texto?: string) {
    const valor = (typeof texto === 'string' ? texto : competencia).trim();
    if (!valor || data.competencias.includes(valor)) {
      setCompetencia('');
      return;
    }
    patch({ competencias: [...data.competencias, valor] });
    setCompetencia('');
  }

  function alternarCompetencia(texto: string) {
    if (data.competencias.includes(texto)) {
      patch({ competencias: data.competencias.filter((item) => item !== texto) });
      return;
    }
    patch({ competencias: [...data.competencias, texto] });
  }

  async function baixar() {
    if (!previewRef.current) return;
    const pendente = [1, 2, 3, 4, 5].map(erroDoPasso).find(Boolean);
    if (pendente) {
      setErro(pendente);
      return;
    }
    setBaixando(true);
    setErro('');
    capturandoRef.current = true;
    setPreviewScale(1);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      await baixarCurriculoPdf(previewRef.current, data.nome);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao gerar o PDF.');
    } finally {
      capturandoRef.current = false;
      const wrap = previewWrapRef.current;
      if (wrap) {
        const largura = wrap.clientWidth - 32;
        setPreviewScale(largura > 0 ? Math.min(1, largura / 794) : 1);
      }
      setBaixando(false);
    }
  }

  const seletorModelo = (
    <div className="cv-final">
      <div className="field">
        <label>Modelo</label>
        <div className="cv-opcoes">
          {MODELOS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={modelo === item.id ? 'ativo' : ''}
              onClick={() => setModelo(item.id)}
            >
              <strong>{item.nome}</strong>
              <span>{item.descricao}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Cor</label>
        <div className="cv-cores">
          {CORES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cor === item.id ? 'ativo' : ''}
              style={{ background: item.hex }}
              title={item.nome}
              onClick={() => setCor(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="cv-gerador">
      <ol className="cv-passos">
        {ETAPAS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={`cv-passo${passo === index ? ' ativo' : ''}${passo > index ? ' feito' : ''}`}
              onClick={() => irPara(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="cv-form">
        {passo === 0 && seletorModelo}

        {passo === 1 && (
          <div className="cv-grid">
            <div className="field">
              <label htmlFor="cv-nome">Nome completo</label>
              <input id="cv-nome" value={data.nome} onChange={(e) => patch({ nome: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cv-tel">Telefone</label>
              <CampoMascara
                id="cv-tel"
                inputMode="tel"
                value={data.telefone}
                formatar={formatarTelefone}
                onValue={(telefone) => patch({ telefone })}
              />
              {telefoneNorm ? <p className="hint">{telefoneNorm}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="cv-email">E-mail</label>
              <input
                id="cv-email"
                type="email"
                value={data.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cv-cidade">Cidade</label>
              <input id="cv-cidade" value={data.cidade} onChange={(e) => patch({ cidade: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cv-uf">UF</label>
              <select id="cv-uf" value={data.uf} onChange={(e) => patch({ uf: e.target.value })}>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cv-bairro">Bairro</label>
              <input id="cv-bairro" value={data.bairro} onChange={(e) => patch({ bairro: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cv-nasc">Data de nascimento</label>
              <input
                id="cv-nasc"
                type="date"
                value={data.nascimento}
                onChange={(e) => patch({ nascimento: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cv-foto">Foto (opcional)</label>
              <input id="cv-foto" type="file" accept="image/*" onChange={(e) => void lerFoto(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="cv-lista">
            {data.formacoes.map((item, index) => (
              <div key={item.id} className="cv-bloco">
                <header>
                  <strong>Formação {index + 1}</strong>
                  {data.formacoes.length > 1 && (
                    <button type="button" onClick={() => removerLista('formacoes', item.id)}>
                      Remover
                    </button>
                  )}
                </header>
                <div className="cv-grid">
                  <div className="field">
                    <label>Nível</label>
                    <select
                      value={item.nivel}
                      onChange={(e) => {
                        const nivel = e.target.value as NivelFormacao;
                        const opcoes = statusDaFormacao(nivel);
                        const status: StatusFormacao = opcoes.includes(item.status) ? item.status : 'Completo';
                        atualizarLista('formacoes', item.id, {
                          nivel,
                          status,
                          curso: formacaoSemCurso(nivel) ? '' : item.curso,
                          fim: status === 'Cursando' ? '' : item.fim,
                        });
                      }}
                    >
                      {NIVEIS_FORMACAO.map((nivel) => (
                        <option key={nivel}>{nivel}</option>
                      ))}
                    </select>
                  </div>
                  {!formacaoSemCurso(item.nivel) && (
                    <div className="field">
                      <label>Curso</label>
                      <input
                        value={item.curso}
                        onChange={(e) => atualizarLista('formacoes', item.id, { curso: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="field">
                    <label>Instituição</label>
                    <input
                      value={item.instituicao}
                      onChange={(e) => atualizarLista('formacoes', item.id, { instituicao: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Situação</label>
                    <select
                      value={statusDaFormacao(item.nivel).includes(item.status) ? item.status : 'Completo'}
                      onChange={(e) => {
                        const status = e.target.value as StatusFormacao;
                        atualizarLista('formacoes', item.id, {
                          status,
                          fim: status === 'Cursando' ? '' : item.fim,
                        });
                      }}
                    >
                      {statusDaFormacao(item.nivel).map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Ano de início</label>
                    <CampoAno
                      value={item.inicio}
                      onChange={(inicio) => atualizarLista('formacoes', item.id, { inicio })}
                    />
                  </div>
                  <div className="field">
                    <label>Ano de fim</label>
                    <CampoAno
                      value={item.fim}
                      disabled={item.status === 'Cursando'}
                      onChange={(fim) => atualizarLista('formacoes', item.id, { fim })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="ativacao-page-btn"
              onClick={() =>
                patch({
                  formacoes: [
                    ...data.formacoes,
                    {
                      id: novoId(),
                      nivel: 'Superior',
                      curso: '',
                      instituicao: '',
                      inicio: '',
                      fim: '',
                      status: 'Cursando',
                    },
                  ],
                })
              }
            >
              Adicionar formação
            </button>
          </div>
        )}

        {passo === 3 && (
          <div className="cv-lista">
            {data.experiencias.map((item, index) => (
              <div key={item.id} className="cv-bloco">
                <header>
                  <strong>Experiência {index + 1}</strong>
                  {data.experiencias.length > 1 && (
                    <button type="button" onClick={() => removerLista('experiencias', item.id)}>
                      Remover
                    </button>
                  )}
                </header>
                <div className="cv-grid">
                  <div className="field">
                    <label>Empresa</label>
                    <input
                      value={item.empresa}
                      onChange={(e) => atualizarLista('experiencias', item.id, { empresa: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Cargo</label>
                    <input
                      value={item.cargo}
                      onChange={(e) => atualizarLista('experiencias', item.id, { cargo: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Cidade</label>
                    <input
                      value={item.cidade}
                      onChange={(e) => atualizarLista('experiencias', item.id, { cidade: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Início</label>
                    <CampoMesAno
                      value={item.inicio}
                      onChange={(inicio) => atualizarLista('experiencias', item.id, { inicio })}
                    />
                  </div>
                  <div className="field">
                    <label>Fim</label>
                    <CampoMesAno
                      value={item.fim}
                      disabled={item.atual}
                      onChange={(fim) => atualizarLista('experiencias', item.id, { fim })}
                    />
                  </div>
                  <label className="cv-check">
                    <input
                      type="checkbox"
                      checked={item.atual}
                      onChange={(e) => atualizarLista('experiencias', item.id, { atual: e.target.checked, fim: '' })}
                    />
                    Trabalho atual
                  </label>
                  <div className="field cv-span">
                    <label>Atividades</label>
                    <textarea
                      rows={4}
                      placeholder="Uma atividade por linha"
                      value={item.atividades}
                      onChange={(e) => atualizarLista('experiencias', item.id, { atividades: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="ativacao-page-btn"
              onClick={() =>
                patch({
                  experiencias: [
                    ...data.experiencias,
                    {
                      id: novoId(),
                      empresa: '',
                      cargo: '',
                      cidade: '',
                      inicio: '',
                      fim: '',
                      atual: false,
                      atividades: '',
                    },
                  ],
                })
              }
            >
              Adicionar experiência
            </button>
          </div>
        )}

        {passo === 4 && (
          <div className="cv-lista">
            <div className="cv-sugestoes">
              {data.competencias.length > 0 && (
                <div className="cv-chips-edit">
                  {data.competencias.map((item) => (
                    <button key={item} type="button" onClick={() => alternarCompetencia(item)}>
                      {item} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="cv-add">
                <input
                  id="cv-comp"
                  placeholder="Escreva uma competência"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarCompetencia();
                    }
                  }}
                />
                <button type="button" className="submit-button" onClick={() => adicionarCompetencia()}>
                  Incluir
                </button>
              </div>
              <div className="cv-setores">
                <button type="button" className={setorComp === 'todos' ? 'ativo' : ''} onClick={() => setSetorComp('todos')}>
                  Todas
                </button>
                {SETORES.map((setor) => (
                  <button
                    key={setor.id}
                    type="button"
                    className={setorComp === setor.id ? 'ativo' : ''}
                    onClick={() => setSetorComp(setor.id)}
                  >
                    {setor.nome}
                  </button>
                ))}
              </div>
              <div className="cv-frases-lista">
                {frasesVisiveis
                  .filter((item) => !data.competencias.includes(item.texto))
                  .map((item) => (
                    <button key={item.texto} type="button" onClick={() => alternarCompetencia(item.texto)}>
                      <span>+</span>
                      {item.texto}
                    </button>
                  ))}
                {frasesVisiveis.every((item) => data.competencias.includes(item.texto)) && (
                  <p className="hint">Nenhuma frase nova nesse filtro.</p>
                )}
              </div>
            </div>

            <details className="cv-opcional">
              <summary>
                <strong>Idiomas</strong>
                <span>Opcional. Inclua só se quiser mostrar um idioma.</span>
              </summary>
              {data.idiomas.map((item, index) => (
                <div key={item.id} className="cv-bloco">
                  <header>
                    <strong>Idioma {index + 1}</strong>
                    <button type="button" onClick={() => removerLista('idiomas', item.id)}>
                      Remover
                    </button>
                  </header>
                  <div className="cv-grid">
                    <div className="field">
                      <label>Idioma</label>
                      <input
                        value={item.idioma}
                        onChange={(e) => atualizarLista('idiomas', item.id, { idioma: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Nível</label>
                      <select
                        value={item.nivel}
                        onChange={(e) => atualizarLista('idiomas', item.id, { nivel: e.target.value as typeof item.nivel })}
                      >
                        {NIVEIS_IDIOMA.map((nivel) => (
                          <option key={nivel}>{nivel}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="ativacao-page-btn"
                onClick={() => patch({ idiomas: [...data.idiomas, { id: novoId(), idioma: '', nivel: 'Básico' }] })}
              >
                Adicionar idioma
              </button>
            </details>

            <details className="cv-opcional">
              <summary>
                <strong>Certificados</strong>
                <span>Opcional. Cursos e certificados que queira mostrar.</span>
              </summary>
              {data.certificacoes.map((item, index) => (
                <div key={item.id} className="cv-bloco">
                  <header>
                    <strong>Certificação {index + 1}</strong>
                    <button type="button" onClick={() => removerLista('certificacoes', item.id)}>
                      Remover
                    </button>
                  </header>
                  <div className="cv-grid">
                    <div className="field">
                      <label>Nome</label>
                      <input
                        value={item.nome}
                        onChange={(e) => atualizarLista('certificacoes', item.id, { nome: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Emissor</label>
                      <input
                        value={item.emissor}
                        onChange={(e) => atualizarLista('certificacoes', item.id, { emissor: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Ano</label>
                      <input
                        value={item.ano}
                        onChange={(e) => atualizarLista('certificacoes', item.id, { ano: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="ativacao-page-btn"
                onClick={() =>
                  patch({ certificacoes: [...data.certificacoes, { id: novoId(), nome: '', emissor: '', ano: '' }] })
                }
              >
                Adicionar certificação
              </button>
            </details>

            <details className="cv-opcional">
              <summary>
                <strong>Afiliações</strong>
                <span>Opcional. Associações ou grupos ligados à sua experiência.</span>
              </summary>
              <textarea
                rows={3}
                placeholder="Uma afiliação por linha"
                value={data.afiliacoes}
                onChange={(e) => patch({ afiliacoes: e.target.value })}
              />
            </details>

            <details className="cv-opcional">
              <summary>
                <strong>Conquistas e distinções</strong>
                <span>Opcional. Prêmios, metas ou reconhecimentos.</span>
              </summary>
              <textarea
                rows={3}
                placeholder="Uma conquista por linha"
                value={data.conquistas}
                onChange={(e) => patch({ conquistas: e.target.value })}
              />
            </details>

            <details className="cv-opcional">
              <summary>
                <strong>Informações adicionais</strong>
                <span>Opcional. Outros detalhes que queira compartilhar.</span>
              </summary>
              <textarea
                rows={3}
                value={data.informacoes}
                onChange={(e) => patch({ informacoes: e.target.value })}
              />
            </details>

            <details className="cv-opcional">
              <summary>
                <strong>Sites e links</strong>
                <span>Opcional. Site, rede ou portfólio.</span>
              </summary>
              <input
                placeholder="https://"
                value={data.sites}
                onChange={(e) => patch({ sites: e.target.value })}
              />
            </details>
          </div>
        )}

        {passo === 5 && (
          <div className="field">
            <label htmlFor="cv-obj">Objetivo profissional</label>
            <textarea
              id="cv-obj"
              rows={6}
              placeholder="Busco uma vaga de Auxiliar de Padaria, com disponibilidade para trabalhar na Vila Madalena."
              value={data.objetivo}
              onChange={(e) => patch({ objetivo: e.target.value })}
            />
            <p className="hint">Duas a quatro linhas. Cargo, disponibilidade e bairro já bastam.</p>
          </div>
        )}

        {passo === 6 && (
          <>
            {seletorModelo}
            <button type="button" className="submit-button" disabled={baixando} onClick={() => void baixar()}>
              {baixando ? 'Gerando PDF…' : 'Baixar PDF'}
            </button>
          </>
        )}

        {erro && <div className="message error">{erro}</div>}

        <div className="cv-nav">
          <button type="button" className="ativacao-page-btn" disabled={passo === 0} onClick={() => irPara(passo - 1)}>
            Voltar
          </button>
          {passo < ETAPAS.length - 1 && (
            <button type="button" className="submit-button" onClick={() => irPara(passo + 1)}>
              Continuar
            </button>
          )}
        </div>
      </div>

      <aside className="cv-preview-pane">
        {passo === 0 && (
          <p className="cv-preview-aviso">Prévia com dados fictícios para mostrar o modelo completo.</p>
        )}
        <div className="cv-preview-wrap" ref={previewWrapRef}>
          <div
            className="cv-preview-scale"
            style={{
              width: 794 * previewScale,
              height: previewAltura * previewScale,
            }}
          >
            <div
              ref={previewRef}
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              <CurriculoPreview data={previewData} modelo={modelo} cor={cor} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
