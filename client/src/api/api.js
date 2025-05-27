import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api',
});

export const createPendingBooking = async (bookingData) => {
  return await api.post('/bookings/pending', bookingData);
};

export const getPendingBookings = async () => {
  return await api.get('/bookings/pending');
};

export const approveBooking = async (bookingId) => {
  return await api.post(`/bookings/pending/${bookingId}/approve`);
};

export const rejectBooking = async (bookingId) => {
  return await api.post(`/bookings/pending/${bookingId}/reject`);
};

export const createBooking = async (bookingData) => {
  return await api.post('/bookings', bookingData);
};

export const getBookings = async () => {
  return await api.get('/bookings');
};

export const updateBooking = async (id, updates) => {
  return await api.put(`/bookings/${id}`, updates);
};

export const getUsers = async () => {
  return await api.get('/users');
};

export const createUser = async (userData) => {
  return await api.post('/users', userData);
};

export const getDashboardStats = async () => {
  return await api.get('/bookings/dashboard/stats');
};

export const getRecentBookings = async () => {
  return await api.get('/bookings/dashboard/recent');
};