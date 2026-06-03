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
    <div className="admin-page admin-operations-page">
      <div className="admin-operations-header">
        <h1>Operaciones</h1>
        <p>Centro de procesos de backoffice. Elegí una operación en el menú.</p>
      </div>

      <div className="admin-card admin-operations-selector-card">
        <label className="admin-operations-label">Proceso</label>

        <select
          className="admin-operations-select"
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <p className="admin-operations-selected-desc">{active?.desc}</p>
      </div>

      <div className="admin-card admin-operations-detail-card">
        <div className="admin-operations-detail-head">
          <h2>{active?.title}</h2>
          <p>{active?.desc}</p>
        </div>

        {active?.component}
      </div>
    </div>
  </Layout>
);
}
