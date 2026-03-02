import axios from 'axios';

// In production, the backend serves the frontend, so relative /api works perfectly.
// In development, it defaults to the localhost backend.
const isDev = import.meta.env.MODE === 'development';
const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000/api' : '/api');

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  // Use localStorage instead of Cookies for highly reliable token retrieval
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
