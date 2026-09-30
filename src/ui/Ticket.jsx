import React from 'react';
import { REQUIREMENTS, SURFACES, SURFACE_LABEL } from '../model/pressure.js';

const SHORT = { FRONT: 'F', LEFT_COPY: 'L', RIGHT_DATA: 'R', BACK: 'B' };

// Brief ticket: a perforated job-ticket stub. Drag it onto the package, or tap
// it and then tap a face / an ink column.
export function Ticket({
  kind, weight, placed, selected, dragging, disabled, onPointerDown, onKeySelect, onUnplace, onRemove, index,
}) {
  const meta = REQUIREMENTS[kind];
  return (
    <li
      className={'ticket' + (placed ? ' placed' : '') + (selected ? ' selected' : '') + (dragging ? ' lifted' : '')}
      style={{ '--ink': meta.color, '--i': index }}
    >
      <button
        className="ticket-body"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKeySelect(); } }}
        aria-pressed={selected}
        aria-label={`${meta.label}, weight ${Math.round(weight * 100)} percent, ${placed ? 'on ' + SURFACE_LABEL[placed] : 'unplaced'}. Drag onto the package or press Enter then choose a surface.`}
      >
        <span className="ticket-ink" aria-hidden="true" />
        <span className="ticket-main">
          <b>{meta.label}</b>
          <small>{meta.sub}</small>
        </span>
        <span className="ticket-meta">
          <em title="Share of a face this requirement uses">{Math.round(weight * 100)}</em>
          <span className={'ticket-slot' + (placed ? ' on' : '')}>{placed ? SHORT[placed] : '○'}</span>
        </span>
      </button>
      {!disabled && (placed || !meta.core) && (
        <button
          className="ticket-x"
          onClick={placed ? onUnplace : onRemove}
          aria-label={placed ? `Unplace ${meta.label}` : `Remove ${meta.label} from the job`}
          title={placed ? 'Unplace' : 'Remove from job'}
        >
          {placed ? '×' : '−'}
        </button>
      )}
    </li>
  );
}

// The dragged ghost — tilts with pointer velocity (floating dimensionality).
export function TicketGhost({ drag }) {
  if (!drag) return null;
  const meta = REQUIREMENTS[drag.kind];
  const tilt = Math.max(-14, Math.min(14, drag.vx * 0.6));
  return (
    <div
      className={'ticket-ghost' + (drag.surface ? ' over-surface' : '') + (drag.over ? ' over-ink' : '')}
      style={{ '--ink': meta.color, transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -60%) rotate(${tilt}deg)` }}
      aria-hidden="true"
    >
      <b>{meta.label}</b>
      <small>{drag.surface ? `→ ${SURFACE_LABEL[drag.surface]}` : 'drop on a face'}</small>
    </div>
  );
}

// Press-control ink strip: one density column per printable face.
export function InkStrip({ pressures, basePressures, preview, target, disabled, onPick, compact = false }) {
  return (
    <div className={'ink-strip' + (compact ? ' compact' : '')} role="group" aria-label="Ink load per surface">
      {SURFACES.map((surface, i) => {
        const ratio = pressures[surface] || 0;
        const base = Math.min(1, basePressures[surface] || 0);
        const ghost = preview && preview.surface === surface ? preview.to : null;
        const over = ratio > 1;
        const ghostOver = ghost !== null && ghost > 1;
        return (
          <button
            key={surface}
            className={'ink-col' + (over ? ' over' : '') + (target ? ' target' : '') + (ghost !== null ? ' previewing' : '') + (ghostOver ? ' ghost-over' : '')}
            style={{ '--fill': Math.min(1, ratio), '--base': base, '--ghost': ghost === null ? 0 : Math.min(1, ghost), '--i': i }}
            disabled={disabled || !target}
            onClick={() => target && onPick(surface)}
            aria-label={`${SURFACE_LABEL[surface]} ${Math.round(ratio * 100)} percent${target ? '. Place selected requirement here.' : ''}`}
          >
            <span className="ink-tube">
              <i className="ink-base" />
              <i className="ink-fill" />
              {ghost !== null && <i className="ink-ghost" />}
              {(over || ghostOver) && <i className="ink-spill" />}
            </span>
            <b>{SHORT[surface]}</b>
            <small>{Math.round((ghost ?? ratio) * 100)}<span>%</span></small>
          </button>
        );
      })}
    </div>
  );
}
