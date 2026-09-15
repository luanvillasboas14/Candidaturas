'use client';

import { DragEvent, FormEvent, useState } from 'react';

type Status = 'idle' | 'analyzing' | 'creating' | 'success' | 'error';

interface Candidate {
  id: string;
  nome: string;
  telefone: string;
}

function imageFromList(files: FileList | null): File | null {
  if (!files || files.length === 0) return null;
  const file = files[0];
  if (!file.type || !file.type.startsWith('image/')) return null;
  return file;
}

export function SoContratoForm() {
  const [foto, setFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [photoKey, setPhotoKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  function resetPhoto(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
    setCandidates([]);
    setStatus('idle');
    setStatusMessage('');
  }

  async function analyzePhoto(file: File) {
    setStatus('analyzing');
    setStatusMessage('');
    setCandidates([]);

    try {
      const body = new FormData();
      body.set('foto', file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 70000);
      const response = await fetch('/api/so-contrato/analisar', {
        method: 'POST',
        body,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const raw = await response.text();
      let result: { success?: boolean; message?: string; candidatos?: unknown } = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        setStatus('error');
        setStatusMessage('Não foi possível ler a foto. Tente novamente.');
        return;
      }

      if (!response.ok || !result.success) {
        setStatus('error');
        setStatusMessage(result.message || 'Não foi possível ler a foto.');
        return;
      }

      const list = Array.isArray(result.candidatos)
        ? result.candidatos.map((item: { nome?: string; telefone?: string }, index: number) => ({
            id: `${Date.now()}-${index}`,
            nome: item.nome || '',
            telefone: item.telefone || '',
          }))
        : [];

      setCandidates(list);
      setStatus('idle');
      setStatusMessage(result.message || '');
    } catch (error) {
      setStatus('error');
      setStatusMessage(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'A leitura da foto demorou demais. Tente uma imagem menor ou mais nítida.'
          : 'Erro inesperado ao analisar a foto.'
      );
    }
  }

  async function handlePhoto(file: File | null) {
    resetPhoto(file);
    if (file) await analyzePhoto(file);
  }

  function updateCandidate(id: string, field: 'nome' | 'telefone', value: string) {
    setCandidates((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeCandidate(id: string) {
    setCandidates((current) => current.filter((item) => item.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const people = candidates
      .map((item) => ({ nome: item.nome.trim(), telefone: item.telefone.trim() }))
      .filter((item) => item.nome && item.telefone);

    if (people.length === 0) {
      setStatus('error');
      setStatusMessage('Nenhum candidato para criar.');
      return;
    }

    setStatus('creating');
    setStatusMessage('');

    try {
      const response = await fetch('/api/so-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidatos: people,
          fotoNome: foto?.name || 'contrato.jpg',
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setStatus('error');
        setStatusMessage(result.message || 'Não foi possível criar os leads.');
        return;
      }

      setStatus('success');
      setStatusMessage(result.message);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFoto(null);
      setPreviewUrl('');
      setCandidates([]);
      setPhotoKey((current) => current + 1);
    } catch {
      setStatus('error');
      setStatusMessage('Erro inesperado. Tente novamente.');
    }
  }

  const isBusy = status === 'analyzing' || status === 'creating';
  const canCreate = candidates.length > 0 && !isBusy;

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isBusy) setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isBusy) return;

    const file = imageFromList(event.dataTransfer.files);
    if (!file) {
      setStatus('error');
      setStatusMessage('Solte uma imagem em JPG, PNG, WEBP ou GIF.');
      return;
    }

    void handlePhoto(file);
  }

  return (
    <form onSubmit={handleSubmit} className="form" autoComplete="off">
      <div className="field">
        <label htmlFor="foto">Foto do contrato</label>
        <label
          className={`photo-drop${foto ? ' has-file' : ''}${isDragging ? ' is-dragging' : ''}`}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            key={photoKey}
            id="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={isBusy}
            onChange={(event) => void handlePhoto(event.target.files?.[0] || null)}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Prévia do contrato" className="photo-preview" />
          ) : (
            <span>Clique ou arraste a foto</span>
          )}
        </label>
      </div>

      {status === 'analyzing' && <div className="message">Analisando a foto...</div>}

      {candidates.length > 0 && (
        <div className="field">
          <label>Candidatos encontrados</label>
          <ul className="candidate-list">
            {candidates.map((item, index) => (
              <li key={item.id} className="candidate-item">
                <span className="candidate-index">{index + 1}</span>
                <div className="candidate-fields">
                  <input
                    type="text"
                    value={item.nome}
                    onChange={(event) => updateCandidate(item.id, 'nome', event.target.value)}
                    disabled={isBusy}
                    aria-label={`Nome do candidato ${index + 1}`}
                  />
                  <input
                    type="tel"
                    value={item.telefone}
                    onChange={(event) => updateCandidate(item.id, 'telefone', event.target.value)}
                    disabled={isBusy}
                    aria-label={`Telefone do candidato ${index + 1}`}
                  />
                </div>
                <button
                  type="button"
                  className="candidate-remove"
                  onClick={() => removeCandidate(item.id)}
                  disabled={isBusy}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length > 0 && (
        <button type="submit" disabled={!canCreate} className="submit-button">
          {status === 'creating' ? 'Criando...' : 'Criar leads'}
        </button>
      )}

      {status === 'success' && <div className="message success">{statusMessage}</div>}
      {status === 'error' && <div className="message error">{statusMessage}</div>}
      {status === 'idle' && statusMessage && candidates.length > 0 && (
        <div className="hint">{statusMessage}</div>
      )}
    </form>
  );
}
