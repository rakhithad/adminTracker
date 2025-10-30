import React, { useMemo } from 'react';
import { FaCreditCard, FaHandHoldingUsd, FaMoneyBillWave, FaReceipt, FaUndo, FaExclamationCircle } from 'react-icons/fa';

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildPaymentHistory = (booking) => {
    if (!booking) return [];

    const history = [];

    (booking.initialPayments || []).forEach(payment => {
        let methodDisplay = payment.transactionMethod;
        let details = 'Initial payment';
        let icon = <FaHandHoldingUsd className="text-green-500" />;

        if (payment.transactionMethod === 'CUSTOMER_CREDIT_NOTE' && payment.appliedCustomerCreditNoteUsage) {
            methodDisplay = 'Customer Credit';
            const creditNote = payment.appliedCustomerCreditNoteUsage.creditNote;
            const originalRefNo = creditNote?.generatedFromCancellation?.originalBooking?.refNo?.trim();
            details = `Used Note ID: ${creditNote.id} (from ${originalRefNo || 'N/A'})`;
            icon = <FaCreditCard className="text-blue-500" />;
        }

        history.push({
            id: `initial-${payment.id}`,
            date: payment.paymentDate,
            type: 'Initial Payment',
            method: methodDisplay.replace(/_/g, ' '),
            amount: parseFloat(payment.amount || 0),
            details: details,
            icon: icon,
        });
    });

    (booking.instalments || []).forEach(instalment => {
        (instalment.payments || []).forEach(payment => {
            history.push({
                id: `instalment-${payment.id}`,
                date: payment.paymentDate,
                type: 'Instalment Payment',
                method: payment.transactionMethod.replace(/_/g, ' '),
                amount: parseFloat(payment.amount || 0),
                details: `For instalment due ${formatDate(instalment.dueDate)}`,
                icon: <FaMoneyBillWave className="text-gray-500" />,
            });
        });
    });

    if (booking.cancellation) {
        const cancellation = booking.cancellation;

        if (cancellation.createdCustomerPayable) {
            (cancellation.createdCustomerPayable.settlements || []).forEach(settlement => {
                history.push({
                    id: `cp-settle-${settlement.id}`,
                    date: settlement.paymentDate,
                    type: 'Cancellation Debt Paid',
                    method: settlement.transactionMethod.replace(/_/g, ' '),
                    amount: parseFloat(settlement.amount || 0),
                    details: `Settled payable for ${cancellation.folderNo}`,
                    icon: <FaExclamationCircle className="text-orange-500" />,
                });
            });
        }

        if (cancellation.refundPayment) {
             history.push({
                id: 'refund-paid',
                date: cancellation.refundPayment.refundDate,
                type: 'Passenger Refund (Cash)',
                method: cancellation.refundPayment.transactionMethod.replace(/_/g, ' '),
                amount: -parseFloat(cancellation.refundPayment.amount || 0),
                details: `Refund processed for ${cancellation.folderNo}`,
                icon: <FaUndo className="text-red-500" />,
            });
        }

        if (cancellation.generatedCustomerCreditNote) {
            const creditNote = cancellation.generatedCustomerCreditNote;
            const originalRefNo = creditNote.generatedFromCancellation?.originalBooking?.refNo?.trim();

            let usageDetails = (creditNote.usageHistory || []).map(usage => {
                const refNo = usage.usedOnInitialPayment?.booking?.refNo?.trim() || 'N/A';
                return `Used £${usage.amountUsed.toFixed(2)} on ${refNo}`;
            }).join(', ');

            history.push({
                id: `ccn-issued-${creditNote.id}`,
                date: creditNote.createdAt,
                type: 'Credit Note Issued',
                method: 'CUSTOMER_CREDIT_NOTE',
                amount: parseFloat(creditNote.initialAmount || 0),
                details: `Note ID: ${creditNote.id} (from ${originalRefNo || 'N/A'}) ${usageDetails ? `| ${usageDetails}` : ''}`,
                icon: <FaReceipt className="text-purple-500" />,
            });
        }
    }

    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    return history;
};


export default function PaymentHistoryPopup({ booking, onClose }) {
    const paymentHistory = useMemo(() => buildPaymentHistory(booking), [booking]);

    if (!booking) return null;

    const revenue = parseFloat(booking.revenue || 0);
    const received = parseFloat(booking.received || 0);
    const balance = parseFloat(booking.balance || 0);
    const cancellation = booking.cancellation;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl transform transition-all max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Payment History</h3>
                        <p className="text-sm text-gray-500">
                            For Booking: <span className="font-semibold text-blue-600">{booking.refNo} ({booking.folderNo})</span>
                        </p>
                         <p className="text-sm text-gray-500">
                            Passenger: <span className="font-semibold">{booking.paxName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 border-t border-b py-4">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total Revenue</p>
                        <p className="text-lg font-bold text-gray-800">£{revenue.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total Paid by Pax</p>
                        <p className="text-lg font-bold text-green-600">£{received.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Final Balance</p>
                        <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : (balance < 0 ? 'text-blue-600' : 'text-green-600')}`}>
                            £{balance.toFixed(2)}
                        </p>
                    </div>
                </div>

                {cancellation && (
                    <div className="space-y-3 mb-6 border-b pb-4">
                        <h4 className="text-md font-semibold text-gray-700 -mb-1">Cancellation Breakdown</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-red-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Admin Fee</span>
                                    <span className="text-sm font-medium text-red-700">- £{parseFloat(cancellation.adminFee || 0).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Supplier Fee</span>
                                    <span className="text-sm font-medium text-red-700">- £{parseFloat(cancellation.supplierCancellationFee || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-3 mt-2 border-t">
                            {cancellation.generatedCustomerCreditNote && (
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-800 uppercase font-bold">Credit Note Issued</p>
                                    <p className="text-2xl font-extrabold text-blue-600">£{parseFloat(cancellation.generatedCustomerCreditNote.initialAmount).toFixed(2)}</p>
                                    <p className="text-sm font-medium text-gray-700">Remaining: £{parseFloat(cancellation.generatedCustomerCreditNote.remainingAmount).toFixed(2)}</p>
                                </div>
                            )}
                            {cancellation.refundStatus === 'PENDING' && (
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                    <p className="text-sm text-orange-800 uppercase font-bold">Cash Refund Pending</p>
                                    <p className="text-2xl font-extrabold text-orange-600">£{parseFloat(cancellation.refundToPassenger).toFixed(2)}</p>
                                </div>
                            )}
                             {cancellation.refundStatus === 'PAID' && (
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <p className="text-sm text-green-800 uppercase font-bold">Cash Refund Paid</p>
                                    <p className="text-2xl font-extrabold text-green-600">£{parseFloat(cancellation.refundToPassenger).toFixed(2)}</p>
                                </div>
                            )}
                            {(cancellation.createdCustomerPayable?.pendingAmount || 0) > 0 && (
                                <div className="text-center p-3 bg-red-50 rounded-lg">
                                    <p className="text-sm text-red-800 uppercase font-bold">Amount Owed by Passenger</p>
                                    <p className="text-2xl font-extrabold text-red-600">£{parseFloat(cancellation.createdCustomerPayable.pendingAmount).toFixed(2)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto flex-grow">
                    <h4 className="text-md font-semibold text-gray-700 mb-2">Payment Transactions</h4>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount (£)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paymentHistory.length > 0 ? (
                                    paymentHistory.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(payment.date)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {payment.icon} <span>{payment.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.method}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.details}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${payment.amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                                {payment.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-10 text-gray-500">No payment history found.</td>
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