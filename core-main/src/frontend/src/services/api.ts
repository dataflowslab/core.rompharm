import axios from 'axios';

export const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token dynamically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data, error.config?.url);
    
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      // and if it's not the login request itself
      const isLoginRequest = error.config?.url?.includes('/api/auth/login');
      const isOnLoginPage = window.location.pathname.includes('/login');
      
      if (!isLoginRequest && !isOnLoginPage) {
        console.warn('401 Unauthorized - redirecting to login');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        window.location.href = '/web/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
