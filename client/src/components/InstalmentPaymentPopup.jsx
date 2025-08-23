import { useState } from 'react';
import { updateInstalment } from '../api/api';

export default function InstalmentPaymentPopup({ instalment, booking, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: instalment.amount.toString(),
    transactionMethod: 'LOYDS',
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'PAID',
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
      if (!transactionMethods.includes(formData.transactionMethod)) {
        throw new Error('Invalid transaction method');
      }
      if (!formData.paymentDate || isNaN(new Date(formData.paymentDate))) {
        throw new Error('Invalid payment date');
      }

      const response = await updateInstalment(instalment.id, {
        amount: parseFloat(formData.amount),
        status: formData.status,
        transactionMethod: formData.transactionMethod,
        paymentDate: formData.paymentDate,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to save payment');
      }
      

      onSubmit(response.data.data); 
      onClose();
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to save payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prepare payment history
  const paymentHistory = (instalment.payments || []).map((payment) => ({
    amount: parseFloat(payment.amount),
    transactionMethod: payment.transactionMethod,
    paymentDate: payment.paymentDate,
    recordedAt: payment.createdAt,
  }));

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Record Payment for Instalment</h3>
        {error && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Booking ID: {booking.id}</label>
            <p className="text-sm text-gray-600">Ref No: {booking.refNo}, Passenger: {booking.paxName}</p>
            <p className="text-sm text-gray-600">
              Due Date: {new Date(instalment.dueDate).toLocaleDateString('en-GB')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Amount (£)</label>
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
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
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
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paymentHistory.map((payment, index) => (
                    <tr key={`payment-${index}`}>
                      <td className="px-4 py-2 text-sm">£{payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{payment.transactionMethod.replace('_', ' ')}</td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(payment.paymentDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(payment.recordedAt).toLocaleDateString('en-GB')}
                      </td>
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