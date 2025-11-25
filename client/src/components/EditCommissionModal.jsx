import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

export default function EditCommissionModal({ record, onClose, onSave }) {
    const [amount, setAmount] = useState(record.commissionAmount || '');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const newAmount = parseFloat(amount);
        if (isNaN(newAmount) || newAmount < 0) {
            setError('Please enter a valid, non-negative amount.');
            return;
        }
        onSave(record.id, record.recordType, newAmount);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Edit Commission for: {record.folderNo}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200"><FaTimes /></button>
                </div>
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Total Commission Amount (£)</label>
                        <input type="number" step="0.01" value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md"
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
}