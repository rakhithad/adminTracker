import React, { useState } from 'react';
import { createSupplierPaymentSettlement } from '../api/api';

export default function SettlePaymentPopup({ booking, supplier, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: '',
    transactionMethod: 'LOYDS',
    settlementDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount > booking.pendingAmount) {
        throw new Error(`Amount (£${amount.toFixed(2)}) exceeds pending amount (£${booking.pendingAmount.toFixed(2)})`);
      }
      if (!transactionMethods.includes(formData.transactionMethod)) {
        throw new Error('Invalid transaction method');
      }
      if (!formData.settlementDate || isNaN(new Date(formData.settlementDate))) {
        throw new Error('Invalid settlement date');
      }

      const response = await createSupplierPaymentSettlement({
        costItemSupplierId: booking.costItemSupplierId,
        amount,
        transactionMethod: formData.transactionMethod,
        settlementDate: formData.settlementDate,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to save settlement');
      }

      onSubmit(response.data.data);
      onClose();
    } catch (err) {
      console.error('Settlement error:', err);
      setError(err.message || 'Failed to save settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prepare payment history: combine initial payment and settlements
  const paymentHistory = [];

  // Add initial payment(s) if applicable
  if (booking.paymentMethod && booking.paidAmount > 0) {
    if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(booking.paymentMethod)) {
      if (booking.firstMethodAmount > 0) {
        const firstMethod = booking.paymentMethod.split('_AND_')[0].toUpperCase();
        paymentHistory.push({
          amount: parseFloat(booking.firstMethodAmount),
          transactionMethod: booking.transactionMethod || firstMethod,
          paymentDate: booking.createdAt,
          recordedAt: booking.createdAt,
          isInitial: true,
        });
      }
      if (booking.secondMethodAmount > 0) {
        const secondMethod = booking.paymentMethod.split('_AND_')[1].toUpperCase();
        paymentHistory.push({
          amount: parseFloat(booking.secondMethodAmount),
          transactionMethod: booking.transactionMethod || secondMethod,
          paymentDate: booking.createdAt,
          recordedAt: booking.createdAt,
          isInitial: true,
        });
      }
    } else {
      paymentHistory.push({
        amount: parseFloat(booking.paidAmount),
        transactionMethod: booking.transactionMethod || booking.paymentMethod,
        paymentDate: booking.createdAt,
        recordedAt: booking.createdAt,
        isInitial: true,
      });
    }
  }

  // Add subsequent settlements
  if (booking.settlements?.length > 0) {
    booking.settlements.forEach((settlement) => {
      paymentHistory.push({
        amount: parseFloat(settlement.amount),
        transactionMethod: settlement.transactionMethod,
        paymentDate: settlement.settlementDate,
        recordedAt: settlement.createdAt,
        isInitial: false,
      });
    });
  }

  // Sort by recordedAt date
  paymentHistory.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Payment Details for {supplier}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Booking ID: {booking.bookingId}</label>
          <p className="text-sm text-gray-600">Ref No: {booking.refNo}, Passenger: {booking.paxName}</p>
          <p className="text-sm text-gray-600">
            Total: £{booking.amount.toFixed(2)}, Paid: £{booking.paidAmount.toFixed(2)}, Pending: £{booking.pendingAmount.toFixed(2)}
          </p>
          {booking.pendingAmount === 0 && booking.amount > 0 && (
            <p className="text-sm font-semibold text-green-600 mt-2">Fully Paid</p>
          )}
        </div>
        {booking.pendingAmount > 0 && (
          <>
            {error && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Settlement Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full p-2 border rounded bg-gray-100"
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Transaction Method</label>
                <select
                  name="transactionMethod"
                  value={formData.transactionMethod}
                  onChange={handleChange}
                  className="w-full p-2 border rounded bg-gray-100"
                  required
                >
                  {transactionMethods.map((method) => (
                    <option key={method} value={method}>
                      {method.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Settlement Date</label>
                <input
                  type="date"
                  name="settlementDate"
                  value={formData.settlementDate}
                  onChange={handleChange}
                  className="w-full p-2 border rounded bg-gray-100"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded text-white ${
                    isSubmitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Settlement'}
                </button>
              </div>
            </form>
          </>
        )}
        {paymentHistory.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Payment History</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount (£)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction Method</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recorded At</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paymentHistory.map((payment, index) => (
                    <tr key={payment.isInitial ? `initial-${index}` : `settlement-${payment.id}`}>
                      <td className="px-4 py-2 text-sm">£{payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{payment.transactionMethod.replace('_', ' ')}</td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(payment.paymentDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(payment.recordedAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 text-sm">{payment.isInitial ? 'Initial Payment' : 'Settlement'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}