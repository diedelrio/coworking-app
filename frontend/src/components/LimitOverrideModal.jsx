// frontend/src/components/LimitOverrideModal.jsx

export default function LimitOverrideModal({
  open,
  info,
  loading,
  onClose,
  onConfirm,
}) {
  if (!open || !info) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.75rem',
          width: '90vw',
          maxWidth: '480px',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: '0.5rem',
            fontSize: '1.25rem',
          }}
        >
          Solicitar autorización al administrador
        </h2>

        <p
          style={{
            fontSize: '0.9rem',
            color: '#4b5563',
            marginBottom: '0.75rem',
          }}
        >
          Has alcanzado un límite de reservas. Si necesitas usar más tiempo
          o más espacios de los permitidos, puedes enviar una solicitud al
          administrador.
        </p>

        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: '0.75rem',
            padding: '0.75rem 0.9rem',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <strong>Fecha:</strong> {info.date}
          </div>
          <div>
            <strong>Horario:</strong> {info.startTime} – {info.endTime}
          </div>
          {info.limitMessage && (
            <div
              style={{
                marginTop: '0.35rem',
                color: '#b91c1c',
              }}
            >
              <strong>Motivo del límite:</strong> {info.limitMessage}
            </div>
          )}
        </div>

        <p
          style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            marginBottom: '1rem',
          }}
        >
          El administrador recibirá los detalles de tu solicitud y se pondrá
          en contacto contigo en breve.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '0.5rem 1.2rem',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}
