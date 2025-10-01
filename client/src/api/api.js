import axios from 'axios';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(
  async (config) => {
    // Retrieve the session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // If the token exists, add the Authorization header
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
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

export const voidBooking = async (bookingId, reason) => {
  return await api.post(`/bookings/${bookingId}/void`, { reason });
};

export const unvoidBooking = async (bookingId) => {
  return await api.post(`/bookings/${bookingId}/unvoid`);
};





export const createUser = async (userData) => {
  return await api.post('/auth/create', userData);
};

export const getMyProfile = () => {
    return api.get('/auth/me');
};
export const updateMyProfile = (profileData) => {
    return api.put('/auth/me', profileData);
};

export const getAgentsList = () => {
  return api.get('/auth/agents'); 
};

export const getAllUsers = async () => {
  return await api.get('/auth');
};

export const updateUserById = async (userId, userData) => {
  return await api.put(`/auth/${userId}`, userData);
};


//audit history
export const getAuditHistory = (modelName, recordId) => {
    return api.get(`/audit-history?modelName=${modelName}&recordId=${recordId}`);
};


export const generateInvoicePDF = async (bookingId, invoiceNumber) => {
  try {
    // FIX: Use the 'api' instance, not the global 'axios'
    const response = await api.post(`/bookings/${bookingId}/invoice`, {}, {
      responseType: 'blob', // Important: we expect a file back
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    // Use the invoiceNumber from the response if available, otherwise create a new one
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `invoice-${invoiceNumber || 'download'}.pdf`;
    if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch.length === 2)
            fileName = fileNameMatch[1];
    }
    
    saveAs(blob, fileName);
    
    return { success: true };
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return { success: false, message: "Could not generate PDF." };
  }
};

export const getInternalInvoicingReport = async () => {
  return await api.get('/reports/internal-invoicing');
};

export const createInternalInvoice = async (data) => {
    // data can be { bookingId, amount, invoiceDate, commissionAmount? }
    try {
        const response = await api.post('/reports/internal-invoicing', data, {
            responseType: 'blob', // Expect a PDF file back
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        // Extract filename from headers if possible
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'commission-receipt.pdf';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
        }
        saveAs(blob, fileName);
        return { success: true };
    } catch (error) {
        console.error("Error creating internal invoice:", error);
        return { success: false, message: "Could not generate PDF receipt." };
    }
};

export const updateInternalInvoice = async (invoiceId, data) => {
  // data should be { amount, invoiceDate }
  return await api.put(`/reports/internal-invoicing/${invoiceId}`, data);
};

export const getInvoiceHistoryForBooking = async (recordId, recordType) => {
  return await api.get(`/reports/internal-invoicing/${recordType}/${recordId}/history`);
};


export const updateCommissionAmount = async (recordId, recordType, commissionAmount) => {
  return await api.put(`/reports/internal-invoicing/commission-amount`, { 
    recordId, 
    recordType, 
    commissionAmount 
  });
};

export const downloadInvoiceReceipt = async (invoiceId, folderNo) => {
    try {
        const response = await api.get(`/reports/internal-invoicing/${invoiceId}/pdf`, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        saveAs(blob, `commission-receipt-${folderNo}-${invoiceId}.pdf`);
        return { success: true };
    } catch (error) {
        console.error("Error downloading receipt:", error);
        return { success: false, message: "Could not download PDF." };
    }
};

export const updateRecordAccountingMonth = async (recordId, recordType, accountingMonth) => {
  return await api.put('/reports/internal-invoicing/accounting-month', {
    recordId,
    recordType,
    accountingMonth,
  });
};

export const generateCommissionSummaryPDF = async (filters) => {
    try {
        const response = await api.post('/reports/internal-invoicing/summary-pdf', filters, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        saveAs(blob, 'commission-summary-report.pdf');
        return { success: true };
    } catch (error) {
        console.error("Error generating summary PDF:", error);
        return { success: false };
    }
};

export const generateTransactionReportPDF = async (filters) => {
    try {
        const response = await api.post('/transactions/summary-pdf', filters, {
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        saveAs(blob, 'transaction-report.pdf');
        return { success: true };
    } catch (error) {
        console.error("Error generating transaction PDF:", error);
        return { success: false };
    }
};