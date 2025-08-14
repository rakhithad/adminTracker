import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage (or wherever you store it after login)
    const token = localStorage.getItem('token'); // <-- You might have named this 'token', 'jwt', etc.
    
    if (token) {
      // If the token exists, add the Authorization header
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config; // Continue with the request
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

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

export const updatePendingBooking = async (bookingId, updates) => {
  return await api.put(`/bookings/pending/${bookingId}`, updates);
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

export const getCustomerDeposits = async () => {
  return await api.get('/bookings/customer-deposits');
};

export const updateInstalment = async (id, data) => {
  return await api.patch(`/bookings/instalments/${id}`, data);
};


export const getSuppliersInfo = async () => {
  return await api.get('/bookings/suppliers-info');
};

export const createSupplierPaymentSettlement = async (data) => {
  return await api.post('/bookings/suppliers/settlements', data);
};

export const recordSettlementPayment = async (bookingId, paymentData) => {
  return await api.post(`/bookings/${bookingId}/record-settlement-payment`, paymentData);
};

export const getTransactions = async () => {
  return await api.get('/bookings/transactions');
};

export const createCancellation = async (originalBookingId, data) => {
  return await api.post(`/bookings/${originalBookingId}/cancel`, data);
};

export const getAvailableCreditNotes = async (supplier) => {
  return await api.get(`/bookings/credit-notes/available/${supplier}`);
};

export const createDateChangeBooking = async (originalBookingId, bookingData) => {
  return await api.post(`/bookings/${originalBookingId}/date-change`, bookingData);
};

export const createSupplierPayableSettlement = async(data) => {
  return await api.post(`/bookings/supplier-payable/settle`, data);
}

export const settleCustomerPayable = async(payableId, data) => {
  return await api.post(`/bookings/customer-payable/${payableId}/settle`, data);
}

export const recordPassengerRefund = async(cancellationId, data) => {
  return await api.post(`/bookings/cancellations/${cancellationId}/record-refund`, data);
}



//auth
export const registerUser = async (userData) => {
  return await api.post('/auth/register', userData);
};

export const loginUser = async (credentials) => {
  return await api.post('/auth/login', credentials);
};


//audit history
export const getAuditHistory = (modelName, recordId) => {
    return api.get(`/audit-history?modelName=${modelName}&recordId=${recordId}`);
};