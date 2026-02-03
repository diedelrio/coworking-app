import { useMemo, useState } from 'react';
import Layout from '../components/Layout';

import OperationsCompleteReservations from './operations/OperationsCompleteReservations';
import OperationsBilling from './operations/OperationsBilling';
import OperationsUserBatchImport from './operations/OperationsUserBatchImport';
import OperationsOfficeClosures from './operations/OperationsOfficeClosures';
import OperationsBulkEmail from './operations/OperationsBulkEmail';
import OperationsBulkTokenRegen from './operations/OperationsBulkTokenRegen';

export default function AdminOperations() {
  const processes = useMemo(
    () => [
      {
        id: 'complete',
        title: 'Completar reservas',
        desc: 'Pasar reservas ACTIVE a COMPLETED (por filtros o selección).',
        component: <OperationsCompleteReservations />,
      },
      {
        id: 'billing',
        title: 'Facturación',
        desc: 'Generación manual de liquidaciones para reservas pendientes.',
        component: <OperationsBilling />,
      },
      {
        id: 'userBatch',
        title: 'Alta masiva de usuarios',
        desc: 'Importar CSV/TXT, preview, crear usuarios y enviar activación.',
        component: <OperationsUserBatchImport />,
      },
      {
        id: 'bulkEmail',
        title: 'Envío masivo de emails',
        desc: 'Enviar un template por key a clientes / clasificación / tag.',
        component: <OperationsBulkEmail />,
      },
      {
        id: 'bulkTokenRegen',
        title: 'Regenerar tokens + enviar',
        desc: 'Regenerar tokens de activación/reset y reenviar por template.',
        component: <OperationsBulkTokenRegen />,
      },
      {
        id: 'closures',
        title: 'Cierres de oficina',
        desc: 'CRUD de cierres/feriados. Bloquea disponibilidad de reservas.',
        component: <OperationsOfficeClosures />,
      },
    ],
    []
  );

  const [activeId, setActiveId] = useState(processes[0]?.id || 'complete');
  const active = processes.find((p) => p.id === activeId) || processes[0];

  return (
    <Layout>
      <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Operaciones</h1>
        <p style={{ marginTop: 0, color: '#6b7280' }}>Centro de procesos de backoffice. Elegí una operación en el menú.</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {/* Sidebar */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>Procesos</div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {processes.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveId(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderRadius: '0.8rem',
                      border: '1px solid #e5e7eb',
                      background: isActive ? '#eef2ff' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#111827' }}>{p.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 4 }}>{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main */}
          <div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#111827' }}>{active?.title}</div>
              <div style={{ color: '#6b7280' }}>{active?.desc}</div>
            </div>

            {active?.component}
          </div>
        </div>
      </div>
    </Layout>
  );
}
