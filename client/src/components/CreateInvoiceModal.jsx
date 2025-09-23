// src/components/CreateInvoiceModal.jsx
import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

export default function CreateInvoiceModal({ booking, onClose, onSave }) {
    const today = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(today);
    const [commissionAmount, setCommissionAmount] = useState('');
    const [error, setError] = useState(''); // This will now be used

    const isFirstInvoice = booking.commissionAmount === null || booking.commissionAmount === undefined;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors on a new submission

        const invoiceAmount = parseFloat(amount);
        const totalCommission = isFirstInvoice ? parseFloat(commissionAmount) : booking.commissionAmount;

        // --- Validation Logic ---
        if (isFirstInvoice && (isNaN(totalCommission) || totalCommission <= 0)) {
            setError('Please set a valid, positive Total Commission Amount.');
            return;
        }
        if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
            setError('Please enter a valid, positive Installment Amount.');
            return;
        }

        const remainingOnBooking = (booking.commissionAmount || 0) - (booking.totalInvoiced || 0);

        if (!isFirstInvoice && invoiceAmount > remainingOnBooking) {
            setError(`Amount cannot exceed the remaining commission of £${remainingOnBooking.toFixed(2)}.`);
            return;
        }
        if (isFirstInvoice && invoiceAmount > totalCommission) {
            setError('The first installment cannot be greater than the Total Commission Amount.');
            return;
        }

        // If validation passes, create the payload
        const invoicePayload = {
            bookingId: booking.id,
            amount: invoiceAmount,
            invoiceDate: invoiceDate
        };
        if (isFirstInvoice) {
            invoicePayload.commissionAmount = totalCommission;
        }
        onSave(invoicePayload);
    };

    const remainingCommission = isFirstInvoice ?
        (parseFloat(commissionAmount) || 0) :
        (booking.commissionAmount || 0) - booking.totalInvoiced;

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Invoice for: {booking.folderNo}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200"><FaTimes /></button>
                </div>

                {!isFirstInvoice && (
                    <div className="text-sm text-slate-600 mb-4 p-3 bg-slate-50 rounded-md">
                        <p>Total Commission: <span className="font-semibold">£{booking.commissionAmount?.toFixed(2)}</span></p>
                        <p>Already Invoiced: <span className="font-semibold">£{booking.totalInvoiced?.toFixed(2)}</span></p>
                        <p>Remaining: <span className="font-bold text-blue-600">£{remainingCommission.toFixed(2)}</span></p>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded-md">{error}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {isFirstInvoice && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Set Total Commission Amount (£)</label>
                            <input type="number" step="0.01" value={commissionAmount}
                                onChange={(e) => setCommissionAmount(e.target.value)} required
                                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Installment Amount (£)</label>
                        <input type="number" step="0.01" value={amount}
                            onChange={(e) => setAmount(e.target.value)} required
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Payment Date</label>
                        <input type="date" value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)} required
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md">Submit & Generate Receipt</button>
                    </div>
                </form>
            </div>
        </div>
    );
}