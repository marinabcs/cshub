export function ErrorMessage({ error }) {
  if (!error) return null;

  return (
    <p style={{
      color: '#ef4444',
      fontSize: '13px',
      margin: '6px 0 0 0',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      <span style={{ fontSize: '14px' }}>!</span>
      {error}
    </p>
  );
}
