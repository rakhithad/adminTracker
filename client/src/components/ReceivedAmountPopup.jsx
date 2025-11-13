import { useState, useEffect } from 'react';
import { getCustomerCreditNotes } from '../api/api';
import SelectCustomerCreditPopup from './SelectCustomerCreditPopup';

export default function ReceivedAmountPopup({ initialData, onClose, onSubmit }) {
  const [amount, setAmount] = useState(initialData.amount || '');
  const [transactionMethod, setTransactionMethod] = useState(initialData.transactionMethod || 'LOYDS');
  const [receivedDate, setReceivedDate] = useState(initialData.receivedDate || new Date().toISOString().split('T')[0]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showCustomerCreditSelect, setShowCustomerCreditSelect] = useState(false);
  const [availableCustomerNotes, setAvailableCustomerNotes] = useState([]);
  const [selectedCustomerCreditNotes, setSelectedCustomerCreditNotes] = useState(initialData.creditNoteDetails || []);
  const [searchBookingId, setSearchBookingId] = useState(''); 

  // CORRECTED Validation Logic
  useEffect(() => {
    let valid = false;
    let errorMsg = '';
    const parsedAmount = parseFloat(amount);

    if (transactionMethod === 'CUSTOMER_CREDIT_NOTE') {
        valid = selectedCustomerCreditNotes.length > 0 &&
                !isNaN(parsedAmount) && parsedAmount > 0 &&
                receivedDate;
        if (!valid && selectedCustomerCreditNotes.length === 0) {
            errorMsg = 'Please select customer credit notes using the original Booking ID.';
        } else if (!valid) {
            errorMsg = 'Please ensure amount is positive and date is selected.';
        } else {
            const totalSelected = selectedCustomerCreditNotes.reduce((sum, n) => sum + n.amountToUse, 0);
            if (Math.abs(totalSelected - parsedAmount) > 0.01) {
                valid = false;
                errorMsg = `Selected credit (£${totalSelected.toFixed(2)}) doesn't match amount (£${parsedAmount.toFixed(2)}). Re-select credit.`;
            }
        }
    } else if (['LOYDS', 'STRIPE', 'WISE', 'HUMM'].includes(transactionMethod)) {
        // Handle standard payment methods
        valid = !isNaN(parsedAmount) && parsedAmount >= 0 && receivedDate;
        if (!valid) {
            errorMsg = 'Please provide a valid non-negative amount and date.';
        }
    } else {
        // Handle the default "Select Method" state
        valid = false;
        errorMsg = 'Please select a transaction method.';
    }

    setIsValid(valid);
    // Only show error message if validation *failed* and a method has been chosen
    setErrorMessage(valid ? '' : (transactionMethod ? errorMsg : ''));
  }, [amount, transactionMethod, receivedDate, selectedCustomerCreditNotes]);

  const handleOpenCustomerCreditPopup = async () => {
      if (!searchBookingId || isNaN(parseInt(searchBookingId))) {
          setErrorMessage("Please enter the numeric Original Booking ID to find credit notes.");
          return;
      }
      setErrorMessage(''); 
      try {
          const response = await getCustomerCreditNotes(parseInt(searchBookingId));
          setAvailableCustomerNotes(response.data.data || []); 
          setShowCustomerCreditSelect(true);
      } catch (err) {
          console.error("Failed to fetch customer credit notes by Booking ID", err);
          setErrorMessage(err.response?.data?.error || "Failed to fetch customer credit notes.");
          setAvailableCustomerNotes([]); 
      }
  };

  const handleCustomerCreditConfirm = (selection) => {
      const totalApplied = selection.reduce((sum, note) => sum + note.amountToUse, 0);
      setAmount(totalApplied.toFixed(2)); 
      setSelectedCustomerCreditNotes(selection);
      setShowCustomerCreditSelect(false);
      setErrorMessage(''); 
  };

  const handleSubmit = () => {
    if (!isValid) return;
    const payload = {
        amount: parseFloat(amount).toFixed(2),
        transactionMethod,
        receivedDate,
        ...(transactionMethod === 'CUSTOMER_CREDIT_NOTE' && { creditNoteDetails: selectedCustomerCreditNotes })
    };
    onSubmit(payload);
  };

  const handleMethodChange = (e) => {
      const newMethod = e.target.value;
      setTransactionMethod(newMethod);
      if (newMethod !== 'CUSTOMER_CREDIT_NOTE') {
          setSelectedCustomerCreditNotes([]);
      } else {
          setAmount('');
          setSelectedCustomerCreditNotes([]);
          setSearchBookingId(''); 
      }
  };

  const handleCancel = () => {
    setAmount('');
    setTransactionMethod('LOYDS');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setSelectedCustomerCreditNotes([]);
    setErrorMessage('');
    setSearchBookingId(''); 
    onClose();
  };

  return (
    <>
      {/* CHANGED: Using bg-black/50 for 50% opacity. */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Add Payment Received</h3>

          {errorMessage && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-lg text-sm">{errorMessage}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Transaction Method*</label>
              <select
                value={transactionMethod}
                onChange={handleMethodChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              >
                <option value="">Select Method</option>
                <option value="LOYDS">LOYDS</option>
                <option value="STRIPE">Stripe</option>
                <option value="WISE">Wise</option>
                <option value="HUMM">Humm</option>
                <option value="CUSTOMER_CREDIT_NOTE">Customer Credit</option>
              </select>
            </div>

            {transactionMethod === 'CUSTOMER_CREDIT_NOTE' ? (
                <>
                    <div>
                        <label className="block text-gray-700 mb-1">Original Booking ID*</label>
                        <input
                            type="number" 
                            value={searchBookingId}
                            onChange={(e) => setSearchBookingId(e.target.value)}
                            placeholder="Enter Booking ID to find notes"
                            className="w-full p-2 bg-gray-100 border rounded-lg"
                            required={transactionMethod === 'CUSTOMER_CREDIT_NOTE'}
                        />
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        {selectedCustomerCreditNotes.length > 0 ? (
                            <p className="text-sm font-medium text-green-700"> Applied £{parseFloat(amount || 0).toFixed(2)} from {selectedCustomerCreditNotes.length} credit note(s).</p>
                        ) : (
                            <p className="text-sm text-gray-600">Enter Original Booking ID and click below.</p>
                        )}
                        <button type="button" onClick={handleOpenCustomerCreditPopup} className="mt-2 text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={!searchBookingId || isNaN(parseInt(searchBookingId))}>
                            {selectedCustomerCreditNotes.length > 0 ? 'Change Credit Selection' : 'Find & Select Credit'}
                        </button>
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-1">Amount (£)</label>
                        <input type="number" value={amount} readOnly className="w-full p-2 bg-gray-200 border rounded-lg cursor-not-allowed" />
                    </div>
                </>
            ) : (
                <div>
                  <label className="block text-gray-700 mb-1">Amount (£)*</label>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 bg-gray-100 border rounded-lg" required />
                </div>
            )}

            <div>
              <label className="block text-gray-700 mb-1">Received Date*</label>
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="w-full p-2 bg-gray-100 border rounded-lg" required />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <button type="button" onClick={handleCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={!isValid} className={`px-4 py-2 rounded-lg text-white ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>Confirm</button>
          </div>
        </div>
      </div>

      {showCustomerCreditSelect && (
          <SelectCustomerCreditPopup
              amountToCover={Infinity} 
              availableNotes={availableCustomerNotes}
              previouslySelectedNotes={selectedCustomerCreditNotes}
              onClose={() => setShowCustomerCreditSelect(false)}
              onConfirm={handleCustomerCreditConfirm}
          />
      )}
    </>
  );
}