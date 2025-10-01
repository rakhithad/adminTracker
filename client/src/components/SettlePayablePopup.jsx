import { useState } from 'react';
import { createSupplierPayableSettlement } from '../api/api';
import { FaTimes, FaFileInvoiceDollar, FaHistory } from 'react-icons/fa';

export default function SettlePayablePopup({ payable, supplier, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: '',
    transactionMethod: 'LOYDS',
    settlementDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  // Helper function to format dates consistently
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number.');
      }
      if (amount > payable.pendingAmount + 0.01) {
        throw new Error(`Amount (£${amount.toFixed(2)}) exceeds the pending amount (£${payable.pendingAmount.toFixed(2)}).`);
      }
      
      const payload = {
        payableId: payable.id,
        amount: amount,
        transactionMethod: formData.transactionMethod,
        settlementDate: formData.settlementDate,
      };

      const response = await createSupplierPayableSettlement(payload);

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to save the settlement.');
      }

      onSubmit();
      onClose();

    } catch (err) {
      console.error('Payable settlement error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl transform transition-all max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaFileInvoiceDollar className="mr-3 text-red-500" />
            Settle Payable to {supplier}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes size={24} />
          </button>
        </div>
        
        <div className="overflow-y-auto pr-2">
          <div className="bg-gray-50 p-4 rounded-lg mb-6 text-center">
            <p className="text-sm text-gray-600">Reason: <span className="font-semibold text-gray-800">{payable.reason}</span></p>
            <p className="text-sm text-gray-600 mt-1">
              Pending Amount: <span className="font-bold text-xl text-red-600">£{payable.pendingAmount.toFixed(2)}</span>
            </p>
          </div>
          
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* Settlement form will only show if there is a pending amount */}
          {payable.pendingAmount > 0.01 && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {/* Form fields for Amount, Method, Date */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Settlement Amount (£)</label>
                <input id="amount" type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" placeholder={`Max £${payable.pendingAmount.toFixed(2)}`} required />
              </div>
              <div>
                <label htmlFor="transactionMethod" className="block text-sm font-medium text-gray-700">Transaction Method</label>
                <select id="transactionMethod" name="transactionMethod" value={formData.transactionMethod} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" required>
                  {transactionMethods.map((method) => (<option key={method} value={method}>{method.replace('_', ' ')}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="settlementDate" className="block text-sm font-medium text-gray-700">Settlement Date</label>
                <input id="settlementDate" type="date" name="settlementDate" value={formData.settlementDate} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" required />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className={`px-5 py-2 rounded-lg text-white font-semibold transition-colors ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>
                  {isSubmitting ? 'Saving...' : 'Save Settlement'}
                </button>
              </div>
            </form>
          )}

          {/* --- NEW: PAYMENT HISTORY SECTION --- */}
          {payable.settlements && payable.settlements.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                <FaHistory className="mr-2 text-gray-400" />
                Payment History
              </h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount (£)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {payable.settlements.map((settlement, index) => (
                      <tr key={settlement.id || index}>
                        <td className="px-4 py-2 text-sm text-gray-800 font-medium">£{settlement.amount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{settlement.transactionMethod.replace('_', ' ')}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{formatDate(settlement.settlementDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}