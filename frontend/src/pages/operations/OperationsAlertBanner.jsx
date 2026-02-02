export default function AlertBanner({ error, message }) {
  if (!error && !message) return null;
  const isError = !!error;

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '0.75rem',
        border: '1px solid',
        borderColor: isError ? '#fecaca' : '#bbf7d0',
        background: isError ? '#fef2f2' : '#f0fdf4',
        color: isError ? '#991b1b' : '#166534',
        marginBottom: '1rem',
      }}
    >
      {error || message}
    </div>
  );
}
