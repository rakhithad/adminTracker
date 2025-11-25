import { useState, useEffect, useMemo } from 'react';
import { FaSpinner, FaPencilAlt, FaDownload, FaExclamationTriangle } from 'react-icons/fa';
import {
    getInternalInvoicingReport, createInternalInvoice, updateRecordAccountingMonth,
    updateCommissionAmount, getAgentsList, generateCommissionSummaryPDF
} from '../api/api';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import InvoiceHistoryModal from '../components/InvoiceHistoryModal';
import EditCommissionModal from '../components/EditCommissionModal';

const compareFolderNumbers = (a, b) => {
    const partsA = a.toString().split('.').map(part => parseInt(part, 10));
    const partsB = b.toString().split('.').map(part => parseInt(part, 10));
    if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
    const subA = partsA.length > 1 ? partsA[1] : 0;
    const subB = partsB.length > 1 ? partsB[1] : 0;
    return subA - subB;
};

const getDisplayType = (record) => {
    if (record.recordType === 'cancellation') return 'Cancellation';
    if (record.bookingStatus === 'CANCELLED') return 'Original (Cancelled)';
    if (record.folderNo.toString().includes('.')) return 'Date Change';
    return 'Booking';
};

export default function InternalInvoicingPage() {
    const [allReportData, setAllReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [agentFilter, setAgentFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('');
    const [agentList, setAgentList] = useState([]);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const fetchInitialData = async () => {
        try {
            setError(null);
            setLoading(true);
            const [reportRes, agentsRes] = await Promise.all([
                getInternalInvoicingReport(),
                getAgentsList()
            ]);
            setAllReportData(reportRes.data.data);
            setAgentList(agentsRes.data);
        } catch (err) {
            setError("Failed to load initial page data." + err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const filteredAndSortedData = useMemo(() => {
        let data = [...allReportData];
        if (agentFilter !== 'all') {
            data = data.filter(item => item.agentName === agentFilter);
        }
        if (monthFilter) {
            data = data.filter(item => {
                const itemMonth = item.accountingMonth ? item.accountingMonth.slice(0, 7) : null;
                return itemMonth === monthFilter;
            });
        }
        return data.sort((a, b) => compareFolderNumbers(a.folderNo, b.folderNo));
    }, [allReportData, agentFilter, monthFilter]);

    const openModal = (type, record) => {
        setSelectedRecord(record);
        setModalType(type);
    };

    const closeModal = () => {
        setSelectedRecord(null);
        setModalType(null);
    };

    const handleCreateInvoice = async (invoiceData) => {
        await createInternalInvoice(invoiceData);
        closeModal();
        fetchInitialData();
    };

    const handleUpdateCommission = async (recordId, recordType, newAmount) => {
        await updateCommissionAmount(recordId, recordType, newAmount);
        closeModal();
        fetchInitialData();
    };

    const handleMonthChange = async (recordId, recordType, newMonth) => {
        const date = new Date(`${newMonth}-01`);
        await updateRecordAccountingMonth(recordId, recordType, date);
        setAllReportData(prevData =>
            prevData.map(r =>
                (r.id === recordId && r.recordType === recordType)
                ? { ...r, accountingMonth: date.toISOString() }
                : r
            )
        );
    };

    const formatAccountingMonth = (dateString) => {
        if (!dateString) return '';
        // The date string from the DB is UTC. We can safely slice it without timezone math.
        return dateString.slice(0, 7);
    };
    
    const handleGenerateReport = async () => {
        setIsGeneratingPdf(true);
        const filters = {
            agent: agentFilter === 'all' ? null : agentFilter,
            month: monthFilter || null,
        };
        await generateCommissionSummaryPDF(filters);
        setIsGeneratingPdf(false);
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><FaSpinner className="animate-spin text-blue-500 h-10 w-10" /></div>;
    if (error) return <div className="m-4 p-3 bg-red-100 text-red-700 rounded-lg"><FaExclamationTriangle className="inline mr-2" />{error}</div>;

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900">Internal Invoicing Report</h1>
                <p className="text-slate-600 mt-1">Filter, manage, and export commission reports.</p>
            </header>

            <div className="mb-6 p-4 bg-white rounded-lg shadow-sm flex items-center gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700">Agent</label>
                    <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm">
                        <option value="all">All Agents</option>
                        {agentList.map(agent => (
                            <option key={agent.id} value={agent.fullName}>{agent.fullName}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700">Accounting Month</label>
                    <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm" />
                </div>
                <div className="pt-6">
                    <button
                        onClick={handleGenerateReport}
                        disabled={(agentFilter === 'all' && !monthFilter) || isGeneratingPdf}
                        className="px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-300"
                    >
                        {isGeneratingPdf ? <FaSpinner className="animate-spin" /> : "Generate PDF Report"}
                    </button>
                </div>
            </div>

            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Folder #</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Agent</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Profit / Loss</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Commission Amt.</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Amount Invoiced</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Remaining</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Acct. Month</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredAndSortedData.map(record => {
                                const displayType = getDisplayType(record);
                                const isFinanciallyClosed = record.recordType === 'cancellation' || record.bookingStatus === 'CANCELLED';
                                const commissionSet = record.commissionAmount !== null && record.commissionAmount !== undefined;
                                const remaining = commissionSet ? record.commissionAmount - record.totalInvoiced : null;
                                const isChild = record.folderNo.toString().includes('.');
                                const profitClass = record.finalProfit < 0 ? 'text-red-600' : 'text-green-700';

                                return (
                                    <tr key={`${record.recordType}-${record.id}`} className={isFinanciallyClosed ? 'bg-gray-100 text-gray-600' : 'hover:bg-slate-50'}>
                                        <td className={`py-3 font-bold ${isFinanciallyClosed ? '' : 'text-blue-600'} ${isChild ? 'pl-8 pr-4' : 'px-4'}`}>
                                            {isChild && <span className="mr-2 text-slate-400 font-normal">↳</span>}
                                            {record.folderNo}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                record.recordType === 'cancellation' ? 'bg-red-100 text-red-800' :
                                                record.bookingStatus === 'CANCELLED' ? 'bg-gray-200 text-gray-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {displayType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{record.agentName}</td>
                                        <td className={`px-4 py-3 font-medium ${profitClass}`}>£{record.finalProfit?.toFixed(2) || '0.00'}</td>
                                        <td className="px-4 py-3 font-medium text-purple-700">
                                            {commissionSet ? (
                                                <div className="flex items-center gap-2">
                                                    <span>£{record.commissionAmount.toFixed(2)}</span>
                                                    {!isFinanciallyClosed && <button onClick={() => openModal('edit', record)} className="text-slate-400 hover:text-blue-600"><FaPencilAlt size={12} /></button>}
                                                </div>
                                            ) : <span className="text-slate-400 italic">Not Set</span>}
                                        </td>
                                        <td className="px-4 py-3 font-medium cursor-pointer hover:underline" onClick={() => openModal('history', record)}>
                                            £{record.totalInvoiced?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className={`px-4 py-3 font-bold ${!commissionSet ? 'text-slate-400' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {commissionSet ? `£${remaining.toFixed(2)}` : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input type="month" value={formatAccountingMonth(record.accountingMonth)}
                                                onChange={(e) => handleMonthChange(record.id, record.recordType, e.target.value)}
                                                className="border-slate-300 rounded-md shadow-sm text-sm p-1.5"
                                            />
                                        </td>
                                        <td className="px-4 py-3 flex items-center space-x-2">
                                            <button onClick={() => openModal('create', record)} className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Invoice</button>
                                            {record.totalInvoiced > 0 && <button onClick={() => openModal('history', record)} title="View History / Download Receipts" className="p-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"><FaDownload /></button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedRecord && modalType === 'create' && <CreateInvoiceModal record={selectedRecord} onClose={closeModal} onSave={handleCreateInvoice} />}
            {selectedRecord && modalType === 'history' && <InvoiceHistoryModal record={selectedRecord} onClose={closeModal} onSave={fetchInitialData} />}
            {selectedRecord && modalType === 'edit' && <EditCommissionModal record={selectedRecord} onClose={closeModal} onSave={handleUpdateCommission} />}
        </div>
    );
}