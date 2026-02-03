import { TrendingUp, Heart, Eye, AlertTriangle } from 'lucide-react';
import { getSegmentoInfo } from '../../utils/segmentoCS';

const SEGMENTO_ICONS = {
  CRESCIMENTO: TrendingUp,
  ESTAVEL: Heart,
  ALERTA: Eye,
  RESGATE: AlertTriangle
};

function getIcon(segmento) {
  const info = getSegmentoInfo(segmento);
  const normalized = info?.value || segmento;
  return SEGMENTO_ICONS[normalized] || null;
}

/**
 * Badge component for displaying customer segment
 * Uses inline styles following CS Hub pattern
 */
export function SegmentoBadge({ segmento, showLabel = true, showIcon = true, size = 'md' }) {
  const info = getSegmentoInfo(segmento);
  if (!info) return null;

  const Icon = getIcon(segmento);

  const sizes = {
    sm: {
      padding: '4px 8px',
      fontSize: '11px',
      iconSize: 12,
      gap: '4px',
      borderRadius: '6px'
    },
    md: {
      padding: '6px 12px',
      fontSize: '12px',
      iconSize: 14,
      gap: '6px',
      borderRadius: '8px'
    },
    lg: {
      padding: '8px 16px',
      fontSize: '14px',
      iconSize: 16,
      gap: '8px',
      borderRadius: '10px'
    }
  };

  const s = sizes[size] || sizes.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        background: info.bgColor,
        border: `1px solid ${info.borderColor}`,
        borderRadius: s.borderRadius,
        color: info.color,
        fontSize: s.fontSize,
        fontWeight: '600',
        whiteSpace: 'nowrap'
      }}
    >
      {showIcon && Icon && (
        <Icon style={{ width: s.iconSize, height: s.iconSize, flexShrink: 0 }} />
      )}
      {showLabel && info.label}
    </span>
  );
}

/**
 * Compact badge showing only icon with tooltip
 */
export function SegmentoIcon({ segmento, size = 'md' }) {
  const info = getSegmentoInfo(segmento);
  if (!info) return null;

  const Icon = getIcon(segmento);

  const sizes = {
    sm: { size: 16, padding: '4px' },
    md: { size: 18, padding: '6px' },
    lg: { size: 20, padding: '8px' }
  };

  const s = sizes[size] || sizes.md;

  return (
    <span
      title={`${info.label}: ${info.description}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: s.padding,
        background: info.bgColor,
        border: `1px solid ${info.borderColor}`,
        borderRadius: '8px',
        color: info.color,
        cursor: 'help'
      }}
    >
      <Icon style={{ width: s.size, height: s.size }} />
    </span>
  );
}

/**
 * Full segment card with description and actions
 */
export function SegmentoCard({ segmento, showAcoes = true, onAcaoClick }) {
  const info = getSegmentoInfo(segmento);
  if (!info) return null;

  const Icon = getIcon(segmento);

  return (
    <div
      style={{
        background: info.bgColor,
        border: `1px solid ${info.borderColor}`,
        borderRadius: '12px',
        padding: '16px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: info.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon style={{ width: 20, height: 20, color: 'white' }} />
        </div>
        <div>
          <div style={{ color: info.color, fontSize: '16px', fontWeight: '700' }}>
            {info.label}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>
            {info.description}
          </div>
        </div>
      </div>

      {/* Criterios */}
      <div style={{ marginBottom: showAcoes ? '16px' : '0' }}>
        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
          Criterios
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {info.criterios.map((criterio, i) => (
            <span
              key={i}
              style={{
                padding: '4px 8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '12px'
              }}
            >
              {criterio}
            </span>
          ))}
        </div>
      </div>

      {/* Acoes */}
      {showAcoes && (
        <div>
          <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
            Acoes Recomendadas
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {info.acoes.map((acao, i) => (
              <li
                key={i}
                onClick={() => onAcaoClick?.(acao)}
                style={{
                  color: info.color,
                  fontSize: '13px',
                  marginBottom: '6px',
                  cursor: onAcaoClick ? 'pointer' : 'default'
                }}
              >
                {acao}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SegmentoBadge;
