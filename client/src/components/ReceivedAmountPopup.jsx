import { useState, useEffect } from 'react';

export default function ReceivedAmountPopup({ initialData, onClose, onSubmit }) {
  const [amount, setAmount] = useState(initialData.amount || '');
  const [transactionMethod, setTransactionMethod] = useState(initialData.transactionMethod || '');
  const [receivedDate, setReceivedDate] = useState(initialData.receivedDate || new Date().toISOString().split('T')[0]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const isValid =
      !isNaN(parseFloat(amount)) &&
      parseFloat(amount) >= 0 &&
      ['BANK_TRANSFER', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES'].includes(transactionMethod) &&
      receivedDate;
    setIsValid(isValid);
    setErrorMessage(
      isValid ? '' : 'Please provide a valid amount, transaction method, and date.'
    );
  }, [amount, transactionMethod, receivedDate]);

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({ amount: parseFloat(amount).toFixed(2), transactionMethod, receivedDate });
  };

  const handleCancel = () => {
    setAmount('');
    setTransactionMethod('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Amount Received Details</h3>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Amount (£)*</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Transaction Method*</label>
            <select
              value={transactionMethod}
              onChange={(e) => setTransactionMethod(e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            >
              <option value="">Select Method</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe</option>
              <option value="WISE">Wise</option>
              <option value="HUMM">Humm</option>
              <option value="CREDIT_NOTES">Credit Notes</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Received Date*</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg text-white ${
              isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}