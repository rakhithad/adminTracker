import InitialPaymentsDisplay from './InitialPaymentsDisplay';

// Reusable components (can be moved to a shared file)
const SegmentedControl = ({ options, selectedValue, onChange }) => (
  <div className="flex w-full rounded-lg bg-gray-200 p-1">
    {options.map(({ value, label }) => (
      <button
        key={value} type="button" onClick={() => onChange(value)}
        className={`w-full rounded-md py-2 text-sm font-semibold transition-colors duration-200 ease-in-out ${selectedValue === value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-300'}`}>
        {label}
      </button>
    ))}
  </div>
);
const FormInput = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input {...props} className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/>
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

// The main presentational component
export default function InternalPaymentForm({
  formData,
  onDataChange,
  onNumberChange,
  onInstalmentChange,
  onAddInstalment,
  onRemoveInstalment,
  onShowCostBreakdown,
  // New props for the payment display
  initialPayments,
  onRemovePayment,
  onShowAddPaymentModal
}) {
  const { period } = formData;

  return (
    <div className="space-y-8 pt-6 border-t border-gray-200">
        <h4 className="text-lg font-semibold text-gray-800">Instalment Plan Details</h4>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Period*</label>
            <SegmentedControl
                options={[
                    { value: 'within30days', label: 'Payment Within 30 Days' },
                    { value: 'beyond30', label: 'Payment Beyond 30 Days (with interest)' },
                ]}
                selectedValue={period}
                onChange={(value) => onDataChange({ target: { name: 'period', value }})}
            />
        </div>
        
        {period === 'within30days' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 border border-gray-200 rounded-lg space-y-3">
              <label className="block text-base font-semibold text-gray-700">Payment Instalments*</label>
              {formData.customInstalments.map((inst, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <FormInput label="" name="dueDate" type="date" value={inst.dueDate} onChange={(e) => onInstalmentChange(index, 'dueDate', e.target.value)} required />
                  <FormInput label="" name="amount" type="number" step="0.01" value={inst.amount} onChange={(e) => onInstalmentChange(index, 'amount', e.target.value)} placeholder="Amount (£)" required />
                  <button type="button" onClick={() => onRemoveInstalment(index)} className="h-10 w-10 mt-1 md:mt-0 flex-shrink-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center transition-colors">×</button>
                </div>
              ))}
              <button type="button" onClick={onAddInstalment} className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors">Add Instalment</button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput label="Total Revenue (£)*" name="revenue" type="number" step="0.01" value={formData.revenue} onChange={onNumberChange} required />
                
                <InitialPaymentsDisplay
                    payments={initialPayments}
                    totalReceived={formData.received}
                    onRemovePayment={onRemovePayment}
                    onAddPaymentClick={onShowAddPaymentModal}
                    label="Initial Payments Received"
                />
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <DisplayField label="Balance for Instalments" value={formData.balance} />
                <DisplayField label="Calculated Profit" value={formData.profit} />
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
          </div>
        )}

        {period === 'beyond30' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 border border-gray-200 rounded-lg space-y-3">
              <label className="block text-base font-semibold text-gray-700">Payment Instalments*</label>
              {formData.customInstalments.map((inst, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <FormInput label="" name="dueDate" type="date" value={inst.dueDate} onChange={(e) => onInstalmentChange(index, 'dueDate', e.target.value)} required />
                  <FormInput label="" name="amount" type="number" step="0.01" value={inst.amount} onChange={(e) => onInstalmentChange(index, 'amount', e.target.value)} placeholder="Amount (£)" required />
                  <button type="button" onClick={() => onRemoveInstalment(index)} className="h-10 w-10 mt-1 md:mt-0 flex-shrink-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center transition-colors">×</button>
                </div>
              ))}
              <button type="button" onClick={onAddInstalment} className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors">Add Instalment</button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormInput label="Total Selling Price (£)*" name="totalSellingPrice" type="number" step="0.01" value={formData.totalSellingPrice} onChange={onNumberChange} required />
              
              <InitialPaymentsDisplay
                  payments={initialPayments}
                  totalReceived={formData.received}
                  onRemovePayment={onRemovePayment}
                  onAddPaymentClick={onShowAddPaymentModal}
                  label="Initial Deposit(s) Paid"
              />
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                    <DisplayField label="Balance After Deposit" value={formData.balance} />
                    <DisplayField label="Interest / Trans. Fee" value={formData.trans_fee} />
                    <DisplayField label="Total Balance Payable" value={formData.totalBalancePayable} />
                </div>
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

            <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-indigo-50 rounded-lg">
                <div className="text-center">
                    <label className="block text-sm font-medium text-indigo-800">Final Revenue</label>
                    <span className="text-2xl font-bold text-indigo-600 font-mono">£{parseFloat(formData.revenue || 0).toFixed(2)}</span>
                </div>
                 <div className="text-center">
                    <label className="block text-sm font-medium text-indigo-800">Final Profit</label>
                    <span className="text-2xl font-bold text-indigo-600 font-mono">£{parseFloat(formData.profit || 0).toFixed(2)}</span>
                </div>
            </div>
          </div>
        )}
    </div>
  );
}