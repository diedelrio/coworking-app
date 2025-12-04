// frontend/src/api/settings.js
import api from './axiosClient'; // ajusta la ruta si tu axiosClient está en otro lado

export async function fetchSettings() {
  const res = await api.get('/settings');
  return res.data;
}

export async function fetchSettingHistory(id) {
  const res = await api.get(`/settings/${id}/history`);
  return res.data;
}

export async function updateSettingApi(id, data) {
  const res = await api.put(`/settings/${id}`, data);
  return res.data;
}

// Si más adelante quieres permitir crear nuevas reglas desde UI:
export async function createSettingApi(data) {
  const res = await api.post('/settings', data);
  return res.data;
}
