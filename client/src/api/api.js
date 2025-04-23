import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.backendURL || "http://localhost:5000/api" ,
});

export const getBookings = () => api.get('/bookings');
export const createBooking = (bookingData) => api.post('/bookings', bookingData);
export const updateBooking = (id, updates) => api.put(`/bookings/${id}`, updates);

export const getUsers = () => api.get('/users');
export const createUser = (userData) => api.post('/users', userData);

