// src/components/InvoiceHistoryModal.jsx
import { useState, useEffect } from 'react';
import { FaTimes, FaPencilAlt, FaSpinner, FaDownload  } from 'react-icons/fa';
import { getInvoiceHistoryForBooking, updateInternalInvoice, downloadInvoiceReceipt } from '../api/api';

export default function InvoiceHistoryModal({ booking, onClose, onSave }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ amount: '', invoiceDate: '' });

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await getInvoiceHistoryForBooking(booking.id);
            setHistory(response.data.data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [booking.id]);

    const handleEdit = (item) => {
        setEditingId(item.id);
        setEditData({
            amount: item.amount.toString(),
            invoiceDate: new Date(item.invoiceDate).toISOString().split('T')[0],
        });
    };

    const handleSaveEdit = async () => {
        await updateInternalInvoice(editingId, {
            amount: parseFloat(editData.amount),
            invoiceDate: editData.invoiceDate
        });
        setEditingId(null);
        fetchHistory(); // Refresh history
        onSave(); // Refresh the main page table
    };

    const handleDownload = async (invoiceId) => {
        await downloadInvoiceReceipt(invoiceId, booking.folderNo);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Invoice History for: {booking.folderNo}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200"><FaTimes /></button>
                </div>

                {loading ? <FaSpinner className="animate-spin mx-auto text-blue-500" /> : (
                    <ul className="divide-y divide-slate-200">
                        {history.length === 0 ? <p className="text-center text-slate-500 py-4">No invoice history found.</p> :
                            history.map(item => (
                                <li key={item.id} className="py-3 flex justify-between items-center">
                                    {editingId === item.id ? (
                                        <>
                                            <input type="number" value={editData.amount} onChange={e => setEditData({...editData, amount: e.target.value})} className="w-24 border-slate-300 rounded" />
                                            <input type="date" value={editData.invoiceDate} onChange={e => setEditData({...editData, invoiceDate: e.target.value})} className="border-slate-300 rounded" />
                                            <div>
                                                <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 font-semibold mr-2">Save</button>
                                                <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="font-semibold text-blue-700">£{item.amount.toFixed(2)}</p>
                                                <p className="text-xs text-slate-500">
                                                    by {item.createdBy?.firstName} on {new Date(item.invoiceDate).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <button onClick={() => handleDownload(item.id)} title="Download Receipt" className="text-slate-500 hover:text-green-600"><FaDownload /></button>
                                                <button onClick={() => handleEdit(item)} title="Edit" className="text-slate-500 hover:text-blue-600"><FaPencilAlt /></button>
                                            </div>                                        </>
                                    )}
                                </li>
                            ))
                        }
                    </ul>
                )}
            </div>
        </div>
    );
}