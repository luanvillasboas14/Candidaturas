'use client';

import { MouseEvent, useEffect, useMemo, useState } from 'react';

interface OrigemItem {
  nome: string;
  quantidade: number;
  percentual: number;
}

interface CampanhaItem {
  origem: string;
  campanha: string;
  quantidade: number;
}

interface DashboardData {
  total: number;
  origens: OrigemItem[];
  campanhas: CampanhaItem[];
}

interface PieSlice {
  item: OrigemItem;
  start: number;
  end: number;
  color: string;
}

interface PieHover {
  item: OrigemItem;
  color: string;
  x: number;
  y: number;
}

const PIE_COLORS = ['#ff7a08', '#6a5cff', '#38bdf8', '#4ade80', '#f472b6', '#facc15', '#fb7185'];

function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return iso;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startPoint = polar(cx, cy, r, start);
  const endPoint = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${large} 1 ${endPoint.x} ${endPoint.y} Z`;
}

function CanalPie({ origens }: { origens: OrigemItem[] }) {
  const [hover, setHover] = useState<PieHover | null>(null);
  const slices = useMemo<PieSlice[]>(() => {
    let angle = 0;
    return origens.map((item, index) => {
      const sweep = (item.percentual / 100) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { item, start, end, color: PIE_COLORS[index % PIE_COLORS.length] };
    });
  }, [origens]);

  function moveTooltip(event: MouseEvent<SVGElement>, slice: PieSlice) {
    const box = event.currentTarget.closest('.origem-pie-chart')?.getBoundingClientRect();
    if (!box) return;
    setHover({
      item: slice.item,
      color: slice.color,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
  }

  return (
    <div className="origem-pie-block">
      <div className="origem-pie-chart">
        <svg
          viewBox="0 0 240 240"
          className="origem-pie"
          role="img"
          aria-label="Canais de origem"
          onMouseLeave={() => setHover(null)}
        >
          {slices.length === 1 ? (
            <circle
              cx="120"
              cy="120"
              r="100"
              fill={slices[0].color}
              onMouseMove={(event) => moveTooltip(event, slices[0])}
            />
          ) : (
            slices.map((slice) => (
              <path
                key={slice.item.nome}
                d={slicePath(120, 120, 100, slice.start, slice.end)}
                fill={slice.color}
                onMouseMove={(event) => moveTooltip(event, slice)}
              />
            ))
          )}
        </svg>
        {hover && (
          <div
            className="origem-pie-tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            <strong>{hover.item.nome}</strong>
            <span>
              <i style={{ background: hover.color }} />
              {hover.item.quantidade} leads ({hover.item.percentual}%)
            </span>
          </div>
        )}
      </div>
      <ul className="origem-pie-legend">
        {slices.map((slice) => (
          <li key={slice.item.nome}>
            <i style={{ background: slice.color }} />
            <span>{slice.item.nome}</span>
            <em>
              {slice.item.quantidade} ({slice.item.percentual}%)
            </em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OrigemDashboard() {
  const [fromDisplay, setFromDisplay] = useState('');
  const [toDisplay, setToDisplay] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fromDate = brToIso(fromDisplay);
  const toDate = brToIso(toDisplay);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        const query = params.toString();
        const response = await fetch(`/api/tracker-leads${query ? `?${query}` : ''}`);
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Não foi possível carregar o dashboard.');
        }
        if (!cancelled) setData(payload);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Erro ao carregar o dashboard.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate]);

  return (
    <div className="origem-dashboard">
      <div className="origem-filters">
        <label>
          De
          <input
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={fromDisplay}
            onChange={(event) => setFromDisplay(maskBrDate(event.target.value))}
          />
        </label>
        <label>
          Até
          <input
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={toDisplay}
            onChange={(event) => setToDisplay(maskBrDate(event.target.value))}
          />
        </label>
        {(fromDisplay || toDisplay) && (
          <button
            type="button"
            className="origem-clear-dates"
            onClick={() => {
              setFromDisplay('');
              setToDisplay('');
            }}
          >
            Limpar datas
          </button>
        )}
      </div>

      {isLoading && <p className="subtitle">Carregando origem dos candidatos…</p>}
      {errorMessage && <div className="message error">{errorMessage}</div>}
      {!isLoading && !errorMessage && data && data.total === 0 && (
        <p className="subtitle">Nenhum lead nesse período.</p>
      )}

      {!isLoading && !errorMessage && data && data.total > 0 && (
        <>
          <div className="origem-kpi">
            <span>Total de leads</span>
            <strong>{data.total}</strong>
          </div>

          <section>
            <h2>Canais</h2>
            <CanalPie origens={data.origens} />
          </section>

          <section>
            <h2>Campanhas</h2>
            <ul className="origem-campaigns">
              {data.campanhas.map((item) => (
                <li key={`${item.origem}-${item.campanha}`}>
                  <div>
                    <strong>{item.campanha}</strong>
                    <span>{item.origem}</span>
                  </div>
                  <em>{item.quantidade}</em>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
