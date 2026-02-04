import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Calcular páginas visíveis (max 5)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
  const pages = [];
  for (let i = startPage; i <= endPage; i++) pages.push(i);

  const btnBase = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease'
  };

  const navBtn = (disabled) => ({
    ...btnBase,
    width: '34px',
    height: '34px',
    background: disabled ? 'transparent' : 'rgba(30, 27, 75, 0.6)',
    color: disabled ? '#3730a3' : '#94a3b8',
    cursor: disabled ? 'default' : 'pointer',
    border: disabled ? '1px solid rgba(55, 48, 163, 0.3)' : '1px solid rgba(139, 92, 246, 0.15)'
  });

  const pageBtn = (isActive) => ({
    ...btnBase,
    width: '34px',
    height: '34px',
    background: isActive ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'rgba(30, 27, 75, 0.4)',
    color: isActive ? 'white' : '#94a3b8',
    border: isActive ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(139, 92, 246, 0.1)'
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0',
      marginTop: '16px'
    }}>
      <span style={{ color: '#64748b', fontSize: '13px' }}>
        Mostrando {start}–{end} de {totalItems}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          style={navBtn(currentPage === 1)}
          title="Primeira"
        >
          <ChevronsLeft style={{ width: '16px', height: '16px' }} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={navBtn(currentPage === 1)}
          title="Anterior"
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} />
        </button>

        {startPage > 1 && (
          <span style={{ color: '#64748b', fontSize: '12px', padding: '0 4px' }}>...</span>
        )}

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={pageBtn(p === currentPage)}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <span style={{ color: '#64748b', fontSize: '12px', padding: '0 4px' }}>...</span>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={navBtn(currentPage === totalPages)}
          title="Próxima"
        >
          <ChevronRight style={{ width: '16px', height: '16px' }} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={navBtn(currentPage === totalPages)}
          title="Última"
        >
          <ChevronsRight style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </div>
  );
}
