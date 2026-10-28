import api from './axiosClient';

export function listAdminPopupMessages() {
  return api.get('/admin/popup-messages');
}

export function createPopupMessage(payload) {
  return api.post('/admin/popup-messages', payload);
}

export function updatePopupMessage(id, payload) {
  return api.put(`/admin/popup-messages/${id}`, payload);
}

export function deletePopupMessage(id) {
  return api.delete(`/admin/popup-messages/${id}`);
}

// group: agrupa las cancelaciones acumuladas en un solo popup (solo al iniciar sesión)
export function getPendingPopupMessages(portal, { group = false } = {}) {
  return api.get('/popup-messages/pending', { params: { portal, ...(group ? { group: 1 } : {}) } });
}

// ids: mensajes que componen un popup agrupado (se marcan todos como leídos)
export function markPopupMessageRead(id, ids) {
  return api.post(`/popup-messages/${id}/read`, ids && ids.length > 1 ? { ids } : undefined);
}
