import React from 'react';

// Helper function to format dates
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
};

export default function PaymentHistoryPopup({ booking, onClose }) {
  if (!booking) return null;

  // Extract main financial figures and cancellation details for easier access
  const revenue = parseFloat(booking.revenue || 0);
  const received = parseFloat(booking.received || 0);
  const balance = parseFloat(booking.balance || 0);
  const cancellation = booking.cancellation;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl transform transition-all max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Payment History</h3>
            <p className="text-sm text-gray-500">
              For Booking: <span className="font-semibold text-blue-600">{booking.refNo}</span> - {booking.paxName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Block 1: Original Financial Summary (Always Visible) */}
        <div className="grid grid-cols-3 gap-4 mb-4 border-t border-b py-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Original Revenue</p>
            <p className="text-lg font-bold text-gray-800">£{revenue.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Total Paid by Pax</p>
            <p className="text-lg font-bold text-green-600">£{received.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Pre-Cancellation Balance</p>
            <p className="text-lg font-bold text-red-600">£{balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Block 2: Cancellation Breakdown (Only shows if booking is cancelled) */}
        {cancellation && (
          <div className="space-y-3 mb-6 border-b pb-4">
             <h4 className="text-md font-semibold text-gray-700 -mb-1">Cancellation Breakdown</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-red-50 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Admin Fee</span>
                        <span className="text-sm font-medium text-red-700">- £{parseFloat(cancellation.adminFee || 0).toFixed(2)}</span>
                    </div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Supplier Fee</span>
                        <span className="text-sm font-medium text-red-700">- £{parseFloat(cancellation.supplierCancellationFee || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            {/* Final Outcome */}
            <div className="grid grid-cols-1 gap-4 pt-3 mt-2 border-t">
                {parseFloat(cancellation.refundToPassenger || 0) > 0 && (
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800 uppercase font-bold">Final Refund Due to Passenger</p>
                        <p className="text-2xl font-extrabold text-blue-600">£{parseFloat(cancellation.refundToPassenger).toFixed(2)}</p>
                    </div>
                )}
                {(cancellation.createdCustomerPayable?.pendingAmount || 0) > 0 && (
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <p className="text-sm text-orange-800 uppercase font-bold">Final Amount Owed by Passenger</p>
                        <p className="text-2xl font-extrabold text-orange-600">£{parseFloat(cancellation.createdCustomerPayable.pendingAmount).toFixed(2)}</p>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Block 3: Payment Transaction History (Always Visible) */}
        <div className="overflow-y-auto flex-grow">
          <h4 className="text-md font-semibold text-gray-700 mb-2">Payment Transactions</h4>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount (£)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {booking.paymentHistory && booking.paymentHistory.length > 0 ? (
                booking.paymentHistory.map((payment, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{payment.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.method.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium text-right">
                      {parseFloat(payment.amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-gray-500">No payment history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}