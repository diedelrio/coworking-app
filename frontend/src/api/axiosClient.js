import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  // Sin timeout, una petición colgada deja la pantalla esperando indefinidamente.
  // Crear series recurrentes puede tardar más: usar { timeout: 90000 } en esa llamada.
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
