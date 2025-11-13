import { FaTimes, FaFileInvoiceDollar, FaBook } from 'react-icons/fa';

export default function CreditNoteDetailsPopup({ note, onClose }) {
  if (!note) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    // CHANGED: Using bg-black/50
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl transform transition-all">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaFileInvoiceDollar className="mr-3 text-blue-500" />
            Credit Note Details (ID: {note.id})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="text-lg font-semibold text-gray-900">{note.supplier}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Status</p>
            <p className={`text-lg font-semibold ${note.status === 'AVAILABLE' ? 'text-green-600' : 'text-yellow-600'}`}>{note.status.replace('_', ' ')}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Initial / Remaining Amount</p>
            <p className="text-lg font-semibold text-gray-900">
              £{note.initialAmount.toFixed(2)} / <span className="text-blue-600">£{note.remainingAmount.toFixed(2)}</span>
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Generated From / On</p>
            <p className="text-lg font-semibold text-gray-900">
              Ref: {note.generatedFromRefNo || 'N/A'} on {formatDate(note.createdAt)}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-gray-700 mb-4 flex items-center">
            <FaBook className="mr-3 text-gray-400" />
            Usage History
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Used On Booking</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Used (£)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Used</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {note.usageHistory && note.usageHistory.length > 0 ? (
                  note.usageHistory.map(usage => (
                    <tr key={usage.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                        {usage.usedOnRefNo || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                        £{usage.amountUsed.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(usage.usedAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                      This credit note has not been used yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}