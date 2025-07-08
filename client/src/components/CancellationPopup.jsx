import { useState } from 'react';

export default function CancellationPopup({ booking, onClose, onConfirm }) {
  const [supplierCancellationFee, setSupplierCancellationFee] = useState('');
  const [refundToPassenger, setRefundToPassenger] = useState('');
  // --- ADD STATE FOR THE NEW FIELD ---
  const [refundTransactionMethod, setRefundTransactionMethod] = useState('LOYDS');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];

  const handleSubmit = async () => {
    // Add validation for the new field
    if (!supplierCancellationFee || !refundToPassenger || !refundTransactionMethod) {
      setError('All fields are required.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      // Pass the new field in the payload
      await onConfirm({
        supplierCancellationFee: parseFloat(supplierCancellationFee),
        refundToPassenger: parseFloat(refundToPassenger),
        refundTransactionMethod: refundTransactionMethod,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold text-red-600">Cancel Booking</h3>
        <p className="text-sm text-gray-600 mb-4">Ref: {booking.refNo}</p>
        
        {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Supplier Cancellation Fee (£)</label>
            <input type="number" step="0.01" value={supplierCancellationFee} onChange={e => setSupplierCancellationFee(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g., 300" />
            <p className="text-xs text-gray-500 mt-1">This is the non-refundable amount kept by the supplier. Original Product Cost was £{(booking.prodCost || 0).toFixed(2)}.</p>
          </div>
          <div>
            <label className="block text-sm font-medium">Refund to Passenger (£)</label>
            <input type="number" step="0.01" value={refundToPassenger} onChange={e => setRefundToPassenger(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g., 200" />
          </div>
          {/* --- ADD THE NEW INPUT FIELD --- */}
          <div>
            <label className="block text-sm font-medium">Refund Transaction Method</label>
            <select
                value={refundTransactionMethod}
                onChange={e => setRefundTransactionMethod(e.target.value)}
                className="w-full p-2 border rounded bg-white"
            >
              {transactionMethods.map(method => (
                <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100">Back</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400">
            {isSubmitting ? 'Processing...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}