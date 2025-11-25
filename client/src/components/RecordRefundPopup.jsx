import { useState } from 'react';
import { recordPassengerRefund } from '../api/api';
import { FaTimes, FaMoneyBillWave } from 'react-icons/fa';

export default function RecordRefundPopup({ cancellation, booking, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: cancellation.refundToPassenger.toString(),
    transactionMethod: cancellation.refundTransactionMethod || 'LOYDS',
    refundDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await recordPassengerRefund(cancellation.id, formData);
      onSubmit(); // This will trigger the parent page to refetch data
      onClose();
    } catch (err) {
      console.error('Record refund error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to record refund.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // CHANGED: Using bg-black/50 and ensured backdrop-blur-sm
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaMoneyBillWave className="mr-3 text-green-500" />
            Record Passenger Refund
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes size={24} />
          </button>
        </div>
        <div className="bg-green-50 p-4 rounded-lg mb-6 text-center">
          <p className="text-sm text-gray-600">For Booking: <span className="font-semibold text-gray-800">{booking.refNo}</span></p>
          <p className="text-sm text-gray-600 mt-2">
            Amount to Refund: <span className="font-bold text-xl text-green-600">£{cancellation.refundToPassenger.toFixed(2)}</span>
          </p>
        </div>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Refund Amount (£)</label>
            <input id="amount" type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} readOnly className="mt-1 w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"/>
          </div>
          <div>
            <label htmlFor="transactionMethod" className="block text-sm font-medium text-gray-700">Transaction Method</label>
            <select id="transactionMethod" name="transactionMethod" value={formData.transactionMethod} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md bg-white">
              {transactionMethods.map((method) => (<option key={method} value={method}>{method.replace('_', ' ')}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor="refundDate" className="block text-sm font-medium text-gray-700">Refund Date</label>
            <input id="refundDate" type="date" name="refundDate" value={formData.refundDate} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2 border rounded-lg font-semibold hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isSubmitting} className={`px-5 py-2 rounded-lg text-white font-semibold ${isSubmitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
              {isSubmitting ? 'Saving...' : 'Confirm Refund Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}