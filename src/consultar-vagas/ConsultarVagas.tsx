'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  STATUS_CONSULTA,
  type ConsultaRegistrada,
  type EmpresaFiltro,
  type StatusConsulta,
  type VagaAberta,
} from './tipos';

const TIPO: Record<number, string> = {
  1: 'Estágio',
  2: 'CLT',
  4: 'Pessoa jurídica',
};

const STATUS: Record<StatusConsulta, string> = {
  contratada: 'Contratada',
  demitida: 'Demitida',
  cancelada: 'Cancelada',
};

const STATUS_ABERTA: StatusConsulta[] = ['contratada', 'cancelada'];

function tipoNome(tipo: number): string {
  return TIPO[tipo] || 'Vaga';
}

export function ConsultarVagas() {
  const [cargo, setCargo] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [status, setStatus] = useState('');
  const [abertas, setAbertas] = useState<VagaAberta[]>([]);
  const [consultas, setConsultas] = useState<ConsultaRegistrada[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaFiltro[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [marcando, setMarcando] = useState('');

  async function carregar(filtro = { cargo, empresaId, status }) {
    setCarregando(true);
    setErro('');
    const params = new URLSearchParams();
    if (filtro.cargo.trim()) params.set('cargo', filtro.cargo.trim());
    if (filtro.empresaId) params.set('empresaId', filtro.empresaId);
    if (filtro.status) params.set('status', filtro.status);
    try {
      const response = await fetch(`/api/consultar-vagas?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Não foi possível consultar as vagas.');
      }
      setAbertas(payload.abertas || []);
      setConsultas(payload.consultas || []);
      setEmpresas(payload.empresas || []);
    } catch (error) {
      setAbertas([]);
      setConsultas([]);
      setErro(error instanceof Error ? error.message : 'Não foi possível consultar as vagas.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // A lista inicial abre sem filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filtrar(event: FormEvent) {
    event.preventDefault();
    void carregar();
  }

  async function enviar(id: string, corpo: Record<string, string>, falha: string) {
    setMarcando(id);
    setErro('');
    try {
      const response = await fetch('/api/consultar-vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || falha);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : falha);
    } finally {
      setMarcando('');
    }
  }

  return (
    <div className="ge-pagina">
      <form className="form ge-vaga" onSubmit={filtrar}>
        <div className="field c4">
          <label htmlFor="consulta-cargo">Vaga</label>
          <input
            id="consulta-cargo"
            value={cargo}
            placeholder="Cargo"
            onChange={(event) => setCargo(event.target.value)}
          />
        </div>
        <div className="field c4">
          <label htmlFor="consulta-empresa">Empresa</label>
          <select id="consulta-empresa" value={empresaId} onChange={(event) => setEmpresaId(event.target.value)}>
            <option value="">Todas</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field c4">
          <label htmlFor="consulta-status">Status</label>
          <select id="consulta-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {STATUS_CONSULTA.map((item) => (
              <option key={item} value={item}>
                {STATUS[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="ge-acoes">
          <button type="submit" className="submit-button" disabled={carregando}>
            {carregando ? 'Consultando...' : 'Filtrar'}
          </button>
        </div>
      </form>

      {erro ? <div className="message error">{erro}</div> : null}

      <section>
        <h2>Vagas abertas</h2>
        {carregando ? (
          <p className="subtitle">Carregando...</p>
        ) : abertas.length === 0 ? (
          <p className="subtitle">Nenhuma vaga aberta.</p>
        ) : (
          <ul className="ge-lista">
            {abertas.map((vaga) => (
              <li key={vaga.id} className="consulta-item">
                <div>
                  <strong>{vaga.cargo}</strong>
                  <span>
                    {tipoNome(vaga.tipoVaga)} · {vaga.empresaNome}
                  </span>
                </div>
                <div className="ge-acoes">
                  {STATUS_ABERTA.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="ghost-button"
                      disabled={marcando === vaga.id}
                      onClick={() => void enviar(vaga.id, { id: vaga.id, status: item }, 'Não foi possível marcar a vaga.')}
                    >
                      {STATUS[item]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Consultas</h2>
        {carregando ? null : consultas.length === 0 ? (
          <p className="subtitle">Nenhuma consulta.</p>
        ) : (
          <ul className="ge-lista">
            {consultas.map((consulta) => (
              <li key={consulta.id} className="consulta-item">
                <div>
                  <strong>{consulta.cargo}</strong>
                  <span>
                    {tipoNome(consulta.tipoVaga)} · {consulta.empresaNome}
                  </span>
                </div>
                <div className="ge-acoes">
                  <span className="consulta-status">{STATUS[consulta.status]}</span>
                  {consulta.status === 'contratada' ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={marcando === consulta.vagaId}
                      onClick={() =>
                        void enviar(
                          consulta.vagaId,
                          { id: consulta.vagaId, status: 'demitida' },
                          'Não foi possível demitir a vaga.'
                        )
                      }
                    >
                      Demitida
                    </button>
                  ) : null}
                  {consulta.status === 'cancelada' ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={marcando === consulta.vagaId}
                      onClick={() =>
                        void enviar(consulta.vagaId, { id: consulta.vagaId, acao: 'reabrir' }, 'Não foi possível abrir a vaga de novo.')
                      }
                    >
                      Abrir novamente
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
