import type { ReactNode } from 'react';
import { hexDaCor } from './modelos';
import type { CorCurriculo, Curriculo, Experiencia, Formacao, ModeloCurriculo } from './types';

function mesAno(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}/.test(value)) {
    const [ano, mes] = value.split('-');
    return `${mes}/${ano}`;
  }
  return value;
}

function periodo(inicio: string, fim: string, atual?: boolean): string {
  const de = mesAno(inicio);
  const ate = atual ? 'Atual' : mesAno(fim);
  if (de && ate) return `${de} — ${ate}`;
  return de || ate;
}

function linhas(texto: string): string[] {
  return texto
    .split(/\n|;/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function misturar(hex: string, com: string, percentual: number) {
  const ler = (valor: string) => {
    const h = valor.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = ler(hex);
  const [r2, g2, b2] = ler(com);
  const p = percentual / 100;
  const canal = (a: number, b: number) => Math.round(a * p + b * (1 - p));
  return `rgb(${canal(r1, r2)}, ${canal(g1, g2)}, ${canal(b1, b2)})`;
}

function titulos(modelo: ModeloCurriculo) {
  if (modelo === 'ats') {
    return {
      objetivo: 'Resumo profissional',
      exp: 'Experiência profissional',
      form: 'Formação acadêmica',
      comp: 'Habilidades',
      cert: 'Cursos e certificações',
    };
  }
  return {
    objetivo: 'Objetivo profissional',
    exp: 'Histórico profissional',
    form: 'Formação acadêmica',
    comp: 'Competências',
    cert: 'Cursos e certificações',
  };
}

function Secao({ titulo, cor, children }: { titulo: string; cor: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <section className="cv-secao">
      <h2 style={{ color: cor, borderBottomColor: misturar(cor, '#dddddd', 45) }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Formacoes({ itens }: { itens: Formacao[] }) {
  const lista = itens.filter((item) => item.curso || item.instituicao || item.nivel);
  if (!lista.length) return null;
  return (
    <>
      {lista.map((item) => (
        <div key={item.id} className="cv-item">
          <div className="cv-item-topo">
            <strong>{item.curso || item.nivel}</strong>
            <span>
              {item.status === 'Cursando'
                ? [item.inicio.match(/\d{4}/)?.[0], 'Cursando'].filter(Boolean).join(' — ')
                : [item.inicio.match(/\d{4}/)?.[0], item.fim.match(/\d{4}/)?.[0]].filter(Boolean).join(' — ')}
            </span>
          </div>
          <p>
            {item.instituicao}
            {item.curso && item.nivel ? ` · ${item.nivel}` : ''}
            {item.status && item.status !== 'Completo' && item.status !== 'Cursando' ? ` · ${item.status}` : ''}
          </p>
        </div>
      ))}
    </>
  );
}

function Experiencias({ itens, timeline, cor }: { itens: Experiencia[]; timeline?: boolean; cor: string }) {
  const lista = itens.filter((item) => item.empresa || item.cargo);
  if (!lista.length) return null;
  return (
    <div className={timeline ? 'cv-timeline' : undefined}>
      {lista.map((item) => (
        <div
          key={item.id}
          className="cv-item"
          style={timeline ? { borderLeftColor: misturar(cor, '#dddddd', 55) } : undefined}
        >
          {timeline ? <span className="cv-marco" style={{ background: cor }} /> : null}
          <div className="cv-item-topo">
            <strong>{item.cargo || item.empresa}</strong>
            <span>{periodo(item.inicio, item.fim, item.atual)}</span>
          </div>
          <p>
            {item.empresa}
            {item.cidade ? ` · ${item.cidade}` : ''}
          </p>
          {linhas(item.atividades).length > 0 && (
            <ul>
              {linhas(item.atividades).map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Contato({ data, empilhado }: { data: Curriculo; empilhado?: boolean }) {
  const partes = [
    data.telefone,
    data.email,
    [data.bairro, data.cidade, data.uf].filter(Boolean).join(', '),
    data.nascimento ? `Nasc. ${data.nascimento.split('-').reverse().join('/')}` : '',
  ].filter(Boolean);
  if (empilhado) {
    return (
      <p className="cv-contato">
        {partes.map((parte) => (
          <span key={parte}>
            {parte}
            <br />
          </span>
        ))}
      </p>
    );
  }
  return <p className="cv-contato">{partes.join(' · ')}</p>;
}

function Corpo({
  data,
  modelo,
  cor,
  competencias,
  idiomas,
  certificados,
  semCompetencias,
}: {
  data: Curriculo;
  modelo: ModeloCurriculo;
  cor: string;
  competencias: string[];
  idiomas: Curriculo['idiomas'];
  certificados: Curriculo['certificacoes'];
  semCompetencias?: boolean;
}) {
  const t = titulos(modelo);
  const formacoes = data.formacoes.filter((item) => item.curso || item.instituicao || item.nivel);
  const experiencias = data.experiencias.filter((item) => item.empresa || item.cargo);
  return (
    <>
      {data.objetivo ? (
        <Secao cor={cor} titulo={t.objetivo}>
          <p>{data.objetivo}</p>
        </Secao>
      ) : null}
      {experiencias.length > 0 && (
        <Secao cor={cor} titulo={t.exp}>
          <Experiencias itens={data.experiencias} timeline={modelo === 'timeline'} cor={cor} />
        </Secao>
      )}
      {formacoes.length > 0 && (
        <Secao cor={cor} titulo={t.form}>
          <Formacoes itens={data.formacoes} />
        </Secao>
      )}
      {!semCompetencias && competencias.length > 0 && (
        <Secao cor={cor} titulo={t.comp}>
          <ul className="cv-frases">
            {competencias.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Secao>
      )}
      {!semCompetencias && idiomas.length > 0 && (
        <Secao cor={cor} titulo="Idiomas">
          <p>{idiomas.map((item) => `${item.idioma} (${item.nivel})`).join(' · ')}</p>
        </Secao>
      )}
      {certificados.length > 0 && (
        <Secao cor={cor} titulo={t.cert}>
          {certificados.map((item) => (
            <p key={item.id}>
              {item.nome}
              {item.emissor ? ` · ${item.emissor}` : ''}
              {item.ano ? ` · ${item.ano}` : ''}
            </p>
          ))}
        </Secao>
      )}
      {linhas(data.afiliacoes).length > 0 && (
        <Secao cor={cor} titulo="Afiliações">
          <ul className="cv-frases">
            {linhas(data.afiliacoes).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Secao>
      )}
      {linhas(data.conquistas).length > 0 && (
        <Secao cor={cor} titulo="Conquistas">
          <ul className="cv-frases">
            {linhas(data.conquistas).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Secao>
      )}
      {linhas(data.informacoes).length > 0 && (
        <Secao cor={cor} titulo="Informações adicionais">
          <p>{data.informacoes}</p>
        </Secao>
      )}
      {data.sites.trim() ? (
        <Secao cor={cor} titulo="Sites e links">
          <p>{data.sites}</p>
        </Secao>
      ) : null}
    </>
  );
}

function BarraLateral({
  data,
  competencias,
  idiomas,
  cor,
}: {
  data: Curriculo;
  competencias: string[];
  idiomas: Curriculo['idiomas'];
  cor: string;
}) {
  const titulo = { color: cor, borderBottomColor: misturar(cor, '#dddddd', 45) };
  return (
    <aside style={{ background: misturar(cor, '#f4f4f4', 14) }}>
      {data.foto ? <img src={data.foto} alt="" className="cv-foto" /> : null}
      <h1>{data.nome || 'Nome completo'}</h1>
      <Contato data={data} empilhado />
      {competencias.length > 0 && (
        <div>
          <h2 style={titulo}>Competências</h2>
          <ul className="cv-frases">
            {competencias.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {idiomas.length > 0 && (
        <div>
          <h2 style={titulo}>Idiomas</h2>
          {idiomas.map((item) => (
            <p key={item.id}>
              {item.idioma} — {item.nivel}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}

export function CurriculoPreview({
  data,
  modelo,
  cor,
}: {
  data: Curriculo;
  modelo: ModeloCurriculo;
  cor: CorCurriculo;
}) {
  const accent = hexDaCor(cor);
  const competencias = data.competencias.filter(Boolean);
  const idiomas = data.idiomas.filter((item) => item.idioma);
  const certificados = data.certificacoes.filter((item) => item.nome);
  const corpo = (
    <Corpo
      data={data}
      modelo={modelo}
      cor={accent}
      competencias={competencias}
      idiomas={idiomas}
      certificados={certificados}
      semCompetencias={modelo === 'lateral' || modelo === 'direita'}
    />
  );

  return (
    <div className={`cv-folha cv-${modelo}`}>
      {modelo === 'lateral' || modelo === 'direita' ? (
        <div className="cv-colunas">
          {modelo === 'lateral' ? (
            <>
              <BarraLateral data={data} competencias={competencias} idiomas={idiomas} cor={accent} />
              <div>{corpo}</div>
            </>
          ) : (
            <>
              <div>{corpo}</div>
              <BarraLateral data={data} competencias={competencias} idiomas={idiomas} cor={accent} />
            </>
          )}
        </div>
      ) : modelo === 'executivo' ? (
        <>
          <header className="cv-executivo-topo" style={{ background: accent }}>
            {data.foto ? <img src={data.foto} alt="" className="cv-foto" /> : null}
            <div>
              <h1>{data.nome || 'Nome completo'}</h1>
            </div>
          </header>
          <div className="cv-executivo-corpo">
            <Contato data={data} />
            {corpo}
          </div>
        </>
      ) : (
        <>
          <header
            className="cv-cabecalho"
            style={modelo === 'moderno' ? { background: misturar(accent, '#ffffff', 12) } : undefined}
          >
            {data.foto ? <img src={data.foto} alt="" className="cv-foto" /> : null}
            <div>
              <h1>{data.nome || 'Nome completo'}</h1>
              <Contato data={data} />
            </div>
          </header>
          {corpo}
        </>
      )}
    </div>
  );
}
