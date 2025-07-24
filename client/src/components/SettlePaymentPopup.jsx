import { useState } from 'react';
import { createSupplierPaymentSettlement } from '../api/api';
import { FaTimes, FaPiggyBank, FaCreditCard, FaHandshake, FaCalendarAlt, FaInfoCircle } from 'react-icons/fa';

export default function SettlePaymentPopup({ booking, supplier, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    amount: '',
    transactionMethod: 'LOYDS',
    settlementDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isCancelled = booking.bookingStatus === 'CANCELLED';

  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount > booking.pendingAmount + 0.01) {
        throw new Error(`Amount (£${amount.toFixed(2)}) exceeds pending amount (£${booking.pendingAmount.toFixed(2)})`);
      }
      if (!transactionMethods.includes(formData.transactionMethod)) {
        throw new Error('Invalid transaction method');
      }
      if (!formData.settlementDate || isNaN(new Date(formData.settlementDate))) {
        throw new Error('Invalid settlement date');
      }

      const response = await createSupplierPaymentSettlement({
        costItemSupplierId: booking.id,
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
  }

  // --- PAYMENT HISTORY LOGIC ---
  const paymentHistory = [];

  // 1. Add Initial Bank/Cash Payments
  // THIS IS THE CORRECTED LINE: Provide a default empty string to prevent the crash.
  const paymentParts = (booking.paymentMethod || '').split('_AND_');
  
  if (paymentParts[0] === 'BANK_TRANSFER' && booking.firstMethodAmount > 0) {
      paymentHistory.push({
          type: 'Initial Payment',
          icon: <FaPiggyBank className="text-blue-500" />,
          amount: parseFloat(booking.firstMethodAmount),
          method: 'Bank Transfer',
          date: booking.createdAt,
          details: 'Paid at booking creation'
      });
  }
  if (paymentParts.length > 1 && paymentParts[1] === 'BANK_TRANSFER' && booking.secondMethodAmount > 0) {
      paymentHistory.push({
          type: 'Initial Payment',
          icon: <FaPiggyBank className="text-blue-500" />,
          amount: parseFloat(booking.secondMethodAmount),
          method: 'Bank Transfer',
          date: booking.createdAt,
          details: 'Paid at booking creation'
      });
  }

  // 2. Add Credit Notes used at Booking Creation
  if (booking.paidByCreditNoteUsage?.length > 0) {
    booking.paidByCreditNoteUsage.forEach(usage => {
      paymentHistory.push({
        type: 'Credit Note',
        icon: <FaCreditCard className="text-green-500" />,
        amount: parseFloat(usage.amountUsed),
        method: 'Credit Note',
        date: usage.usedAt,
        details: `Used Note ID: ${usage.creditNote?.id || 'N/A'}` // Added safe navigation
      });
    });
  }

  // 3. Add subsequent Settlements
  if (booking.settlements?.length > 0) {
    booking.settlements.forEach((settlement) => {
      paymentHistory.push({
        type: 'Settlement',
        icon: <FaHandshake className="text-purple-500" />,
        amount: parseFloat(settlement.amount),
        method: settlement.transactionMethod.replace('_', ' '),
        date: settlement.settlementDate,
        details: `Recorded on: ${formatDate(settlement.createdAt)}`
      });
    });
  }
  
  // 4. Sort all transactions chronologically
  paymentHistory.sort((a, b) => new Date(a.date) - new Date(b.date));


  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-3xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold text-gray-800">
              {isCancelled ? 'Payment History' : 'Payment Details'} for {supplier}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FaTimes size={24} /></button>
        </div>

        <div className="overflow-y-auto pr-4 flex-grow">
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm font-medium text-gray-700">Booking Ref No: <span className="font-bold text-gray-900">{booking.refNo}</span></p>
                <p className="text-sm text-gray-600">Passenger: {booking.paxName}, Category: {booking.category}</p>
                <div className="mt-2 grid grid-cols-3 gap-4 text-center">
                    <div><span className="block text-xs text-gray-500">Total</span><span className="font-bold text-lg">£{booking.amount.toFixed(2)}</span></div>
                    <div><span className="block text-xs text-green-500">Paid</span><span className="font-bold text-lg text-green-600">£{booking.paidAmount.toFixed(2)}</span></div>
                    <div><span className="block text-xs text-red-500">Pending</span><span className="font-bold text-lg text-red-600">£{booking.pendingAmount.toFixed(2)}</span></div>
                </div>
            </div>

            {isCancelled && booking.cancellationOutcome && (
                <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2 flex items-center">
                        <FaInfoCircle className="mr-3" />
                        Cancellation Outcome
                    </h3>
                    <div className="text-sm text-yellow-900">
                        {booking.cancellationOutcome.creditNoteAmount > 0 ? (
                            <p>This cancellation resulted in a <strong>Credit Note of £{booking.cancellationOutcome.creditNoteAmount.toFixed(2)}</strong> from the supplier.</p>
                        ) : booking.cancellationOutcome.payable ? (
                            <p>This cancellation resulted in a <strong>New Payable of £{booking.cancellationOutcome.payable.totalAmount.toFixed(2)}</strong> to the supplier. You can find and settle this in the 'Outstanding Payables' table.</p>
                        ) : (
                            <p>This cancellation was settled with no outstanding credit or debt.</p>
                        )}
                    </div>
                </div>
            )}

            {!isCancelled && booking.pendingAmount > 0.01 && (
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Record New Settlement</h3>
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-600">Amount (£)</label>
                    <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" placeholder={`Max £${booking.pendingAmount.toFixed(2)}`} required />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Method</label>
                    <select name="transactionMethod" value={formData.transactionMethod} onChange={handleChange} className="w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" required>
                        {transactionMethods.map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Date</label>
                    <input type="date" name="settlementDate" value={formData.settlementDate} onChange={handleChange} className="w-full p-2 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div className="md:col-span-3 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className={`px-6 py-2 rounded-lg text-white font-semibold transition-colors ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
                    {isSubmitting ? 'Saving...' : 'Save Settlement'}
                    </button>
                </div>
                </form>
            </div>
            )}

            {isCancelled && (
                 <div className="mb-6 p-4 rounded-lg bg-gray-100 text-center">
                    <p className="text-sm font-medium text-gray-700">This booking is cancelled. No further settlements can be made on this transaction.</p>
                 </div>
            )}
        
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <FaCalendarAlt className="mr-3 text-gray-400"/>
                  Historical Payments
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (£)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {paymentHistory.length > 0 ? (
                            paymentHistory.map((payment, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 flex items-center">
                                    {payment.icon}
                                    <span className="ml-2">{payment.type}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right font-mono">£{payment.amount.toFixed(2)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{payment.method}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(payment.date)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.details}</td>
                            </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                                    No payment history found for this item.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}