import { FaDivide } from 'react-icons/fa';
import InitialPaymentsDisplay from './InitialPaymentsDisplay';

const FormInput = ({ label, required = false, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className={`w-full p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 ${props.readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
    />
  </div>
);

const DisplayField = ({ label, value, unit = '£' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600">{label}</label>
        <div className="mt-1 p-2 bg-gray-100 rounded-lg text-gray-800 font-mono text-base">
            {unit} {parseFloat(value || 0).toFixed(2)}
        </div>
    </div>
);

export default function InternalPaymentForm({
  formData,
  onNumberChange,
  onInstalmentChange,
  onAddInstalment,
  onRemoveInstalment,
  onShowCostBreakdown,
  initialPayments,
  onRemovePayment,
  onShowAddPaymentModal,
  onDistributeBalance // New prop for the button handler
}) {

  return (
    <div className="space-y-8 pt-6 border-t border-gray-200">
        <h4 className="text-lg font-semibold text-gray-800">Instalment Plan Details</h4>

        {/* 1. New Warning Message */}
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-sm text-yellow-800 font-medium">
                Please calculate the transaction fee from the 'Internal Deposit Calculator' before filling out the fields below.
            </p>
        </div>

        <div className="space-y-6 animate-fade-in">
          {/* Financial Inputs are now at the top */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormInput
              label="Total Selling Price (£)*"
              name="totalSellingPrice"
              type="number"
              step="0.01"
              value={formData.totalSellingPrice}
              onChange={onNumberChange}
              required
              placeholder="e.g. 1250.00"
            />
            <FormInput
              label="Transaction Fee (£)"
              name="trans_fee"
              type="number"
              step="0.01"
              value={formData.trans_fee}
              onChange={onNumberChange}
              placeholder="e.g. 50.00"
            />
            <InitialPaymentsDisplay
                payments={initialPayments}
                totalReceived={formData.received}
                onRemovePayment={onRemovePayment}
                onAddPaymentClick={onShowAddPaymentModal}
                label="Initial Deposit(s) Paid"
            />
          </div>

          <div className="p-4 bg-gray-50 border rounded-lg">
              <DisplayField label="Total Balance for Instalments" value={formData.balance} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex space-x-2">
                <input value={`£ ${parseFloat(formData.prodCost || 0).toFixed(2)}`} className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg font-mono" readOnly />
                <button type="button" onClick={onShowCostBreakdown} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Breakdown</button>
              </div>
            </div>
            <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={formData.surcharge} onChange={onNumberChange} />
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg text-center">
              <label className="block text-sm font-medium text-indigo-800">Final Calculated Profit</label>
              <span className="text-2xl font-bold text-indigo-600 font-mono">£{parseFloat(formData.profit || 0).toFixed(2)}</span>
          </div>

          {/* 3. New "Equally Distribute" Button */}
          {formData.customInstalments.length > 0 && (
            <div className="pt-4 border-t">
                <button
                    type="button"
                    onClick={onDistributeBalance}
                    disabled={formData.customInstalments.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                    <FaDivide />
                    Equally Distribute Balance to Instalments
                </button>
            </div>
          )}

          {/* 2. Payment Instalments section moved to the bottom */}
          <div className="p-4 border border-gray-200 rounded-lg space-y-3">
            <label className="block text-base font-semibold text-gray-700">Payment Instalments*</label>
            <p className="text-sm text-gray-500">Add the required number of instalment rows first, then use the button above to distribute the balance automatically if needed.</p>
            {formData.customInstalments.map((inst, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <FormInput label={`Due Date ${index + 1}`} name="dueDate" type="date" value={inst.dueDate} onChange={(e) => onInstalmentChange(index, 'dueDate', e.target.value)} required />
                <FormInput label={`Amount ${index + 1} (£)`} name="amount" type="number" step="0.01" value={inst.amount} onChange={(e) => onInstalmentChange(index, 'amount', e.target.value)} placeholder="Amount (£)" required />
                <button type="button" onClick={() => onRemoveInstalment(index)} className="h-10 w-10 flex-shrink-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center transition-colors">×</button>
              </div>
            ))}
            <button type="button" onClick={onAddInstalment} className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors">
              Add New Instalment
            </button>
          </div>
        </div>
    </div>
  );
}