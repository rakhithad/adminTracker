// src/components/InitialPaymentsDisplay.js

import React from 'react';
import { FaMoneyBillWave, FaTimesCircle } from 'react-icons/fa';

export default function InitialPaymentsDisplay({
  payments = [],
  totalReceived = '0.00',
  onRemovePayment,
  onAddPaymentClick,
  label = "Payments Received" // Allow custom label
}) {
  return (
    <div className="lg:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="space-y-2 p-3 border rounded-lg bg-gray-50 min-h-[60px]">
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No initial payments added.</p>
        ) : (
          payments.map((payment, index) => (
            <div key={index} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
              <div>
                <span className="font-semibold text-gray-800">£{payment.amount}</span>
                <span className="text-sm text-gray-600 ml-2">({payment.transactionMethod} on {payment.receivedDate})</span>
              </div>
              <button type="button" onClick={() => onRemovePayment(index)} className="text-red-500 hover:text-red-700">
                <FaTimesCircle />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center mt-2">
        <input
          type="text"
          value={`Total Initial Payments: £${parseFloat(totalReceived || 0).toFixed(2)}`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed font-mono"
          readOnly
        />
        <button
          type="button"
          onClick={onAddPaymentClick}
          className="ml-2 px-4 h-[42px] bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center shrink-0 transition"
        >
          <FaMoneyBillWave className="mr-2" /> Add
        </button>
      </div>
    </div>
  );
}