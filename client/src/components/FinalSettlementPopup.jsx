import { useState } from 'react';

export default function FinalSettlementPopup({ booking, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: '',
    transactionMethod: 'BANK_TRANSFER',
    paymentDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transactionMethods = ['BANK_TRANSFER', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(booking.id, formData);
      onClose();
    } catch (err) {
      console.error('Settlement error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Record Final Settlement</h3>
        <p className="text-sm text-gray-600 mb-4">
          For Booking: <span className="font-medium">{booking.refNo}</span>.
          Final Balance Due: <span className="font-bold text-red-600">£{parseFloat(booking.balance).toFixed(2)}</span>
        </p>

        {error && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Amount (£)</label>
            <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50" placeholder="Enter amount paid" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Transaction Method</label>
            <select name="transactionMethod" value={formData.transactionMethod} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50" required>
              {transactionMethods.map((method) => (
                <option key={method} value={method}>{method.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50" required />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isSubmitting} className={`px-4 py-2 rounded text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}