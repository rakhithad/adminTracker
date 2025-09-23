import React, { useState, useEffect, useMemo } from 'react';
import { FaSpinner, FaPencilAlt, FaExclamationTriangle, FaDownload } from 'react-icons/fa';
import {
    getInternalInvoicingReport,
    createInternalInvoice,
    updateBookingAccountingMonth,
    updateCommissionAmount
} from '../api/api';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import InvoiceHistoryModal from '../components/InvoiceHistoryModal';
import EditCommissionModal from '../components/EditCommissionModal';

const compareFolderNumbers = (a, b) => {
    const partsA = a.toString().split('.').map(part => parseInt(part, 10));
    const partsB = b.toString().split('.').map(part => parseInt(part, 10));

    if (partsA[0] !== partsB[0]) {
        return partsA[0] - partsB[0];
    }

    const subA = partsA.length > 1 ? partsA[1] : 0;
    const subB = partsB.length > 1 ? partsB[1] : 0;
    return subA - subB;
};

export default function InternalInvoicingPage() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBookingForCreate, setSelectedBookingForCreate] = useState(null);
    const [selectedBookingForHistory, setSelectedBookingForHistory] = useState(null);
    const [editingCommission, setEditingCommission] = useState(null);

    const fetchReport = async () => {
        try {
            setError(null);
            const response = await getInternalInvoicingReport();
            setReportData(response.data.data);
        } catch (error) {
            console.error("Failed to fetch report:", error);
            setError("Failed to load report data. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const sortedReportData = useMemo(() => {
        if (!reportData) return [];
        return [...reportData].sort((a, b) => compareFolderNumbers(a.folderNo, b.folderNo));
    }, [reportData]);

    const handleCreateInvoice = async (invoiceData) => {
        const result = await createInternalInvoice(invoiceData);
        if (result.success) {
            setSelectedBookingForCreate(null);
            fetchReport();
        } else {
            console.error(result.message);
        }
    };

    const handleUpdateCommission = async (bookingId, newAmount) => {
        await updateCommissionAmount(bookingId, newAmount);
        setEditingCommission(null);
        fetchReport();
    };

    const handleMonthChange = async (bookingId, newMonth) => {
        const date = new Date(`${newMonth}-01`);
        await updateBookingAccountingMonth(bookingId, date);
        setReportData(prevData =>
            prevData.map(b => b.id === bookingId ? { ...b, accountingMonth: date.toISOString() } : b)
        );
    };

    const formatAccountingMonth = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toISOString().slice(0, 7);
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><FaSpinner className="animate-spin text-blue-500 h-10 w-10" /></div>;
    if (error) return <div className="m-4 p-3 bg-red-100 text-red-700 rounded-lg"><FaExclamationTriangle className="inline mr-2" />{error}</div>;

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900">Internal Invoicing Report</h1>
                <p className="text-slate-600 mt-1">Set commission and invoice payments for accounting.</p>
            </header>
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Folder #</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Agent</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Total Profit</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Commission Amt.</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Amount Invoiced</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Remaining</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Accounting Month</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedReportData.map(booking => {
                                const commissionSet = booking.commissionAmount !== null && booking.commissionAmount !== undefined;
                                const remaining = commissionSet ? booking.commissionAmount - booking.totalInvoiced : null;
                                const isChildBooking = booking.folderNo.toString().includes('.');

                                return (
                                    <tr key={booking.id} className="hover:bg-slate-50">
                                        <td className={`py-3 font-bold text-blue-600 ${isChildBooking ? 'pl-8 pr-4' : 'px-4'}`}>
                                            {isChildBooking && <span className="mr-2 text-slate-400 font-normal">↳</span>}
                                            {booking.folderNo}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{booking.agentName}</td>
                                        <td className="px-4 py-3 font-medium text-green-700">£{booking.profit?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-3 font-medium text-purple-700">
                                            {commissionSet ? (
                                                <div className="flex items-center gap-2">
                                                    <span>£{booking.commissionAmount.toFixed(2)}</span>
                                                    <button onClick={() => setEditingCommission(booking)} className="text-slate-400 hover:text-blue-600"><FaPencilAlt size={12} /></button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Not Set</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700 cursor-pointer hover:underline" onClick={() => setSelectedBookingForHistory(booking)}>
                                            £{booking.totalInvoiced?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className={`px-4 py-3 font-bold ${!commissionSet ? 'text-slate-400' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {commissionSet ? `£${remaining.toFixed(2)}` : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input type="month" value={formatAccountingMonth(booking.accountingMonth)}
                                                onChange={(e) => handleMonthChange(booking.id, e.g.et.value)}
                                                className="border-slate-300 rounded-md shadow-sm text-sm p-1.5"
                                            />
                                        </td>
                                        <td className="px-4 py-3 flex items-center space-x-2">
                                            <button
                                                onClick={() => setSelectedBookingForCreate(booking)}
                                                className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                            >
                                                Invoice
                                            </button>
                                            {booking.totalInvoiced > 0 && (
                                                <button
                                                    onClick={() => setSelectedBookingForHistory(booking)}
                                                    title="View History / Download Receipts"
                                                    className="p-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                                                >
                                                    <FaDownload />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedBookingForCreate && (
                <CreateInvoiceModal
                    booking={selectedBookingForCreate}
                    onClose={() => setSelectedBookingForCreate(null)}
                    onSave={handleCreateInvoice}
                />
            )}
            {selectedBookingForHistory && (
                <InvoiceHistoryModal
                    booking={selectedBookingForHistory}
                    onClose={() => setSelectedBookingForHistory(null)}
                    onSave={fetchReport}
                />
            )}
            {editingCommission && (
                <EditCommissionModal
                    booking={editingCommission}
                    onClose={() => setEditingCommission(null)}
                    onSave={handleUpdateCommission}
                />
            )}
        </div>
    );
}