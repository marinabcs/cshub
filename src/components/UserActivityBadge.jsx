import { Crown } from 'lucide-react';
import { USER_ACTIVITY_CONFIG } from '../hooks/useUserActivityStatus';

/**
 * Badge visual para indicar o status de atividade do usuário
 *
 * @param {string} status - 'heavy_user' | 'active' | 'inactive'
 * @param {boolean} showLabel - Se deve mostrar o label ao lado do ícone
 * @param {string} size - 'sm' | 'md' | 'lg'
 */
export default function UserActivityBadge({ status = 'inactive', showLabel = false, size = 'sm' }) {
  const config = USER_ACTIVITY_CONFIG[status] || USER_ACTIVITY_CONFIG.inactive;

  const sizes = {
    sm: { dot: 8, crown: 12, fontSize: '10px', gap: '4px' },
    md: { dot: 10, crown: 14, fontSize: '11px', gap: '6px' },
    lg: { dot: 12, crown: 16, fontSize: '12px', gap: '8px' }
  };

  const sizeConfig = sizes[size] || sizes.sm;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeConfig.gap
      }}
      title={config.label}
    >
      {config.icon === 'crown' ? (
        <Crown
          style={{
            width: `${sizeConfig.crown}px`,
            height: `${sizeConfig.crown}px`,
            color: config.color,
            flexShrink: 0
          }}
        />
      ) : (
        <span
          style={{
            width: `${sizeConfig.dot}px`,
            height: `${sizeConfig.dot}px`,
            borderRadius: '50%',
            backgroundColor: config.color,
            flexShrink: 0,
            boxShadow: status === 'active' ? `0 0 6px ${config.color}60` : 'none'
          }}
        />
      )}
      {showLabel && (
        <span
          style={{
            fontSize: sizeConfig.fontSize,
            color: config.color,
            fontWeight: '500'
          }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Badge compacto para usar inline com nome/email
 * Mostra apenas o ícone (coroa ou bolinha)
 */
export function UserActivityDot({ status = 'inactive' }) {
  const config = USER_ACTIVITY_CONFIG[status] || USER_ACTIVITY_CONFIG.inactive;

  if (config.icon === 'crown') {
    return (
      <Crown
        style={{
          width: '12px',
          height: '12px',
          color: config.color,
          flexShrink: 0,
          marginLeft: '4px'
        }}
        title="Heavy User"
      />
    );
  }

  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: config.color,
        flexShrink: 0,
        marginLeft: '6px',
        boxShadow: status === 'active' ? `0 0 6px ${config.color}60` : 'none'
      }}
      title={config.label}
    />
  );
}
