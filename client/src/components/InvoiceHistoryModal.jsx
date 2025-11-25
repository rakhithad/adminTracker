import React, { useState, useEffect } from 'react';
import { FaTimes, FaPencilAlt, FaSpinner, FaDownload } from 'react-icons/fa';
import { getInvoiceHistoryForBooking, updateInternalInvoice, downloadInvoiceReceipt } from '../api/api';

const formatDisplayMonth = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
};

const formatInputMonth = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toISOString().slice(0, 7);
};

export default function InvoiceHistoryModal({ record, onClose, onSave }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ amount: '', invoiceDate: '' });

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // This now correctly calls the updated API function
            const response = await getInvoiceHistoryForBooking(record.id, record.recordType);
            setHistory(response.data.data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [record.id, record.recordType]);

    const handleEdit = (item) => {
        setEditingId(item.id);
        setEditData({
            amount: item.amount.toString(),
            invoiceDate: new Date(item.invoiceDate).toISOString().split('T')[0],
            commissionMonth: formatInputMonth(item.commissionMonth),
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditData({ amount: '', invoiceDate: '' });
    };

    const handleSaveEdit = async () => {
        await updateInternalInvoice(editingId, {
            amount: parseFloat(editData.amount),
            invoiceDate: editData.invoiceDate,
            commissionMonth: editData.commissionMonth,
            recordType: record.recordType // Pass recordType for backend logic
        });
        setEditingId(null);
        fetchHistory();
        onSave(); // This refreshes the main page table
    };

    const handleDownload = async (invoiceId) => {
        await downloadInvoiceReceipt(invoiceId, record.folderNo);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Invoice History for: {record.folderNo}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200"><FaTimes /></button>
                </div>
                {loading ? <div className="flex justify-center py-4"><FaSpinner className="animate-spin" /></div> : (
                    <div className="max-h-[60vh] overflow-y-auto">
                        <ul className="divide-y divide-slate-200">
                            {history.length === 0 ? (
                                <p className="text-center py-4">No invoice history found.</p>
                            ) : (
                                history.map(item => (
                                    <li key={item.id} className="py-3 flex justify-between items-center">
                                        {editingId === item.id ? (
                                            <div className="w-full grid grid-cols-4 items-center gap-3">
                                                <input type="number" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} className="border-slate-300 rounded-md" />
                                                <input type="month" value={editData.commissionMonth} onChange={e => setEditData({ ...editData, commissionMonth: e.target.value })} className="border-slate-300 rounded-md" />
                                                <input type="date" value={editData.invoiceDate} onChange={e => setEditData({ ...editData, invoiceDate: e.target.value })} className="border-slate-300 rounded-md" />
                                                <div className="flex items-center gap-3">
                                                    <button onClick={handleSaveEdit} className="text-sm font-semibold text-green-600">Save</button>
                                                    <button onClick={handleCancelEdit} className="text-sm font-medium text-slate-500">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <p className="font-semibold text-blue-700">£{item.amount.toFixed(2)}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Paid on {new Date(item.invoiceDate).toLocaleDateString('en-GB')}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs text-slate-500 uppercase">Comm. Month</p>
                                                    <p className="font-semibold text-slate-700">{formatDisplayMonth(item.commissionMonth)}</p>
                                                </div>
                                                <div className="text-center">
                                                     <p className="text-xs text-slate-500">by {item.createdBy?.firstName || 'User'}</p>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <button onClick={() => handleDownload(item.id)} title="Download Receipt"><FaDownload className="text-slate-500 hover:text-green-600"/></button>
                                                    <button onClick={() => handleEdit(item)} title="Edit"><FaPencilAlt className="text-slate-500 hover:text-blue-600"/></button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}