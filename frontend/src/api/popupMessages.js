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

export function getPendingPopupMessages(portal) {
  return api.get('/popup-messages/pending', { params: { portal } });
}

export function markPopupMessageRead(id) {
  return api.post(`/popup-messages/${id}/read`);
}
