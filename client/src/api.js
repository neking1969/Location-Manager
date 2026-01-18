import axios from 'axios';

// Use environment variable for API URL in production, or proxy in development
export const API_BASE_URL = (process.env.REACT_APP_API_URL || '') + '/api';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || ''
});

export default api;
