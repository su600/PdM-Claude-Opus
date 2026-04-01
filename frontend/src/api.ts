import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pdm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pdm_token');
      localStorage.removeItem('pdm_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;
