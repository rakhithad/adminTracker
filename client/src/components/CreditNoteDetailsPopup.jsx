// src/components/CreditNoteDetailsPopup.jsx
import React from 'react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB');
};

export default function CreditNoteDetailsPopup({ note, onClose }) {
  if (!note) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Credit Note Details</h3>
            <p className="text-sm text-gray-500">
              For Supplier: <span className="font-semibold text-blue-600">{note.supplier}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">×</button>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 border-t border-b py-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Initial Amount</p>
            <p className="text-lg font-bold text-gray-800">£{note.initialAmount.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Amount Used</p>
            <p className="text-lg font-bold text-red-600">£{(note.initialAmount - note.remainingAmount).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold">Remaining Balance</p>
            <p className="text-lg font-bold text-green-600">£{note.remainingAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Details and History */}
        <div className="overflow-y-auto flex-grow space-y-4">
            <div>
                <p className="text-sm font-semibold text-gray-700">Origin</p>
                <p className="text-sm text-gray-600">Generated on {formatDate(note.createdAt)} from the cancellation of booking <span className="font-medium">{note.generatedFromCancellation.originalBooking.refNo}</span>.</p>
            </div>

            <div>
                <p className="text-sm font-semibold text-gray-700">Usage History</p>
                {note.usageHistory.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 mt-2">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date Used</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Used On Booking</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount Used</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {note.usageHistory.map(use => (
                                <tr key={use.id}>
                                    <td className="px-3 py-2 text-sm">{formatDate(use.usedAt)}</td>
                                    <td className="px-3 py-2 text-sm">{use.usedOnCostItemSupplier.costItem.booking.refNo}</td>
                                    <td className="px-3 py-2 text-sm text-right">£{use.amountUsed.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-sm text-gray-500 italic mt-1">This credit note has not been used yet.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}