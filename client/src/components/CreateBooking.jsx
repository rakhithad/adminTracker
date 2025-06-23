import { useState, useEffect } from 'react';
import { FaUserPlus, FaCalculator, FaMoneyBillWave, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { createPendingBooking } from '../api/api';
import ProductCostBreakdown from './ProductCostBreakdown';
import InternalDepositPopup from './InternalDepositPopup';
import PaxDetailsPopup from './PaxDetailsPopup';
import ReceivedAmountPopup from './ReceivedAmountPopup';

// A reusable input component for consistent styling
const FormInput = ({ label, name, required = false, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out ${props.readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
    />
  </div>
);

// A reusable select component
const FormSelect = ({ label, name, required = false, children, ...props }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out bg-white"
      >
        {children}
      </select>
    </div>
  );


export default function CreateBooking({ onBookingCreated }) {
  const [formData, setFormData] = useState({
    refNo: '',
    paxName: '',
    passengers: [],
    numPax: 1,
    agentName: '',
    teamName: '',
    pnr: '',
    airline: '',
    fromTo: '',
    bookingType: 'FRESH',
    pcDate: new Date().toISOString().split('T')[0],
    issuedDate: '',
    paymentMethod: 'FULL',
    lastPaymentDate: '',
    travelDate: '',
    revenue: '',
    prodCost: '',
    prodCostBreakdown: [],
    transFee: '',
    surcharge: '',
    received: '',
    transactionMethod: '',
    receivedDate: new Date().toISOString().split('T')[0],
    balance: '',
    profit: '',
    invoiced: '',
    description: '',
    instalments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showInternalDeposit, setShowInternalDeposit] = useState(false);
  const [showPaxDetails, setShowPaxDetails] = useState(false);
  const [showReceivedAmount, setShowReceivedAmount] = useState(false);

  useEffect(() => {
    const revenue = parseFloat(formData.revenue) || 0;
    const prodCost = parseFloat(formData.prodCost) || 0;
    const transFee = parseFloat(formData.transFee) || 0;
    const surcharge = parseFloat(formData.surcharge) || 0;
    const received = parseFloat(formData.received) || 0;

    const profit = revenue - prodCost - transFee - surcharge;
    const balance = revenue - received;

    setFormData((prev) => ({
      ...prev,
      profit: profit !== 0 ? profit.toFixed(2) : prev.profit,
      balance: balance !== 0 ? balance.toFixed(2) : prev.balance,
    }));
  }, [formData.revenue, formData.prodCost, formData.transFee, formData.surcharge, formData.received]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'paymentMethod' && value !== 'INTERNAL') {
      setShowInternalDeposit(false);
      setFormData((prev) => ({ ...prev, instalments: [] }));
    }
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || !isNaN(parseFloat(value))) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleBreakdownSubmit = (breakdown) => {
    console.log('Received breakdown:', JSON.stringify(breakdown, null, 2));
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setFormData((prev) => ({
      ...prev,
      prodCost: total.toFixed(2),
      prodCostBreakdown: breakdown,
    }));
    setShowCostBreakdown(false);
  };

  const handleInternalDepositSubmit = (depositData) => {
    setFormData((prev) => ({
      ...prev,
      revenue: depositData.revenue || depositData.totalSellingPrice || '',
      prodCost: depositData.prod_cost || '',
      prodCostBreakdown: depositData.costItems || [],
      surcharge: depositData.surcharge || '',
      received: depositData.depositPaid || depositData.received || '',
      transFee: depositData.trans_fee || '',
      balance: depositData.balance || '',
      profit: depositData.profit || '',
      lastPaymentDate: depositData.last_payment_date || '',
      travelDate: depositData.travel_date || '',
      instalments: depositData.instalments || [],
    }));
    setShowInternalDeposit(false);
  };

  const handlePaxDetailsSubmit = ({ passenger, paxName, numPax }) => {
    setFormData((prev) => ({
      ...prev,
      passengers: [passenger],
      paxName,
      numPax,
    }));
    setShowPaxDetails(false);
    setSuccessMessage('Lead passenger details saved successfully! Please complete the remaining fields.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleReceivedAmountSubmit = ({ amount, transactionMethod, receivedDate }) => {
    setFormData((prev) => ({
      ...prev,
      received: amount,
      transactionMethod,
      receivedDate,
    }));
    setShowReceivedAmount(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const requiredFields = [
        'refNo',
        'paxName',
        'agentName',
        'teamName',
        'pnr',
        'airline',
        'fromTo',
        'bookingType',
        'paymentMethod',
        'pcDate',
        'issuedDate',
        'travelDate',
      ];
      const missingFields = requiredFields.filter((field) => !formData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      }

      if (formData.paymentMethod === 'INTERNAL' && formData.instalments.length === 0) {
        throw new Error('Instalments are required for INTERNAL payment method');
      }

      if (formData.passengers.length === 0) {
        throw new Error('At least one passenger detail (lead passenger) must be provided');
      }

      // Fix balance calculation
      const revenue = parseFloat(formData.revenue) || 0;
      const received = parseFloat(formData.received) || 0;
      formData.balance = (revenue - received).toFixed(2);

      // Validate prodCostBreakdown
      if (formData.prodCostBreakdown.length > 0) {
        const validPaymentMethods = [
          'BANK_TRANSFER',
          'CREDIT',
          'CREDIT_NOTES',
          'BANK_TRANSFER_AND_CREDIT',
          'BANK_TRANSFER_AND_CREDIT_NOTES',
          'CREDIT_AND_CREDIT_NOTES',
        ];
        const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
        const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
        for (const item of formData.prodCostBreakdown) {
          if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
            throw new Error('Each cost item must have a valid category and positive amount');
          }
          if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
            throw new Error('Each cost item must have at least one supplier allocation');
          }
          const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
          if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
            throw new Error('Supplier amounts must sum to the cost item amount');
          }
          for (const s of item.suppliers) {
            if (
              !s.supplier ||
              !validSuppliers.includes(s.supplier) ||
              isNaN(parseFloat(s.amount)) ||
              parseFloat(s.amount) <= 0 ||
              !validPaymentMethods.includes(s.paymentMethod) ||
              !validTransactionMethods.includes(s.transactionMethod)
            ) {
              throw new Error('Each supplier must have a valid supplier, positive amount, payment method, and transaction method');
            }
            if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(s.paymentMethod)) {
              const firstAmount = parseFloat(s.firstMethodAmount) || 0;
              const secondAmount = parseFloat(s.secondMethodAmount) || 0;
              if (
                firstAmount <= 0 ||
                secondAmount <= 0 ||
                Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01
              ) {
                throw new Error(`For supplier ${s.supplier}, combined payment method amounts must be positive and sum to the supplier amount`);
              }
              const firstMethod = s.paymentMethod.split('_AND_')[0].toUpperCase();
              const secondMethod = s.paymentMethod.split('_AND_')[1].toUpperCase();
              const isFirstPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(firstMethod);
              const isSecondPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(secondMethod);
              if (
                Math.abs(parseFloat(s.paidAmount) - ((isFirstPaid ? firstAmount : 0) + (isSecondPaid ? secondAmount : 0))) > 0.01 ||
                Math.abs(parseFloat(s.pendingAmount) - ((isFirstPaid ? 0 : firstAmount) + (isSecondPaid ? 0 : secondAmount))) > 0.01
              ) {
                throw new Error(`Paid and pending amounts for supplier ${s.supplier} must match payment method logic`);
              }
            } else {
              const isPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(s.paymentMethod);
              if (
                Math.abs(parseFloat(s.paidAmount) - (isPaid ? parseFloat(s.amount) : 0)) > 0.01 ||
                Math.abs(parseFloat(s.pendingAmount) - (isPaid ? 0 : parseFloat(s.amount))) > 0.01 ||
                Math.abs(parseFloat(s.firstMethodAmount) - parseFloat(s.amount)) > 0.01 ||
                parseFloat(s.secondMethodAmount) > 0
              ) {
                throw new Error(`Payment amounts for supplier ${s.supplier} must match payment method logic`);
              }
            }
          }
        }
      }

      const bookingData = {
        ref_no: formData.refNo,
        pax_name: formData.paxName,
        agent_name: formData.agentName,
        team_name: formData.teamName || null,
        pnr: formData.pnr,
        airline: formData.airline,
        from_to: formData.fromTo,
        bookingType: formData.bookingType,
        pcDate: formData.pcDate,
        issuedDate: formData.issuedDate || null,
        paymentMethod: formData.paymentMethod,
        lastPaymentDate: formData.lastPaymentDate || null,
        travelDate: formData.travelDate || null,
        revenue: formData.revenue ? parseFloat(formData.revenue) : null,
        prodCost: formData.prodCost ? parseFloat(formData.prodCost) : null,
        prodCostBreakdown: formData.prodCostBreakdown,
        transFee: formData.transFee ? parseFloat(formData.transFee) : 0, // Fix: Ensure number
        surcharge: formData.surcharge ? parseFloat(formData.surcharge) : null,
        received: formData.received ? parseFloat(formData.received) : null,
        transactionMethod: formData.transactionMethod || null,
        receivedDate: formData.receivedDate || null,
        balance: parseFloat(formData.balance) || null, // Use fixed balance
        profit: formData.profit ? parseFloat(formData.profit) : null,
        invoiced: formData.invoiced || null,
        description: formData.description || null,
        status: 'PENDING',
        instalments: formData.instalments,
        passengers: formData.passengers,
        numPax: formData.numPax,
      };

      console.log('Full bookingData:', JSON.stringify(bookingData, null, 2));

      const response = await createPendingBooking(bookingData);
      const newPendingBooking = response.data.data;

      setSuccessMessage('Booking submitted for admin approval!');
      if (onBookingCreated) {
        onBookingCreated(newPendingBooking);
      }

      setFormData({
        refNo: '',
        paxName: '',
        passengers: [],
        numPax: 1,
        agentName: '',
        teamName: '',
        pnr: '',
        airline: '',
        fromTo: '',
        bookingType: 'FRESH',
        pcDate: new Date().toISOString().split('T')[0],
        issuedDate: '',
        paymentMethod: 'FULL',
        lastPaymentDate: '',
        travelDate: '',
        revenue: '',
        prodCost: '',
        prodCostBreakdown: [],
        transFee: '',
        surcharge: '',
        received: '',
        transactionMethod: '',
        receivedDate: new Date().toISOString().split('T')[0],
        balance: '',
        profit: '',
        invoiced: '',
        description: '',
        instalments: [],
      });

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Booking submission error:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full">
      <h3 className="text-2xl font-bold mb-1 text-gray-900">Create New Booking</h3>
      <p className="text-gray-500 mb-6">Fill in the details below to create a booking pending for approval.</p>

      {successMessage && (
        <div className="flex items-center mb-6 p-4 bg-green-100 text-green-800 rounded-lg shadow-sm">
          <FaCheckCircle className="mr-3 h-5 w-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center mb-6 p-4 bg-red-100 text-red-800 rounded-lg shadow-sm">
          <FaTimesCircle className="mr-3 h-5 w-5" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Section 1: Core Information */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Core Booking Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            <FormInput label="Reference No" name="refNo" value={formData.refNo} onChange={handleChange} required placeholder="e.g., IBE13260992" />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Passenger <span className="text-red-500">*</span></label>
              <div className="flex items-center">
                <input name="paxName" type="text" value={formData.paxName} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly placeholder="Click Input button ->" />
                <button type="button" onClick={() => setShowPaxDetails(true)} className="ml-2 px-4 h-[42px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center shrink-0 transition" aria-label="Input Passenger Details">
                  <FaUserPlus />
                </button>
              </div>
              {formData.passengers.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded-md border text-xs text-gray-600">
                  <p className="font-semibold">{formData.paxName}</p>
                  <p>Total Passengers: {formData.numPax}</p>
                </div>
              )}
            </div>

            <FormInput label="Agent Name" name="agentName" value={formData.agentName} onChange={handleChange} required />
            <FormSelect label="Team" name="teamName" value={formData.teamName} onChange={handleChange} required>
              <option value="">Select Team</option>
              <option value="PH">PH</option>
              <option value="TOURS">TOURS</option>
            </FormSelect>
            <FormInput label="PNR" name="pnr" value={formData.pnr} onChange={handleChange} required placeholder="e.g., JJ55WW" />
            <FormInput label="Airline" name="airline" value={formData.airline} onChange={handleChange} required placeholder="e.g., QR, EK" />
            <FormInput label="From/To" name="fromTo" value={formData.fromTo} onChange={handleChange} required placeholder="e.g., LHR-DXB" />
          </div>
        </div>

        {/* Section 2: Dates & Payment Type */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Dates & Payment</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            <FormSelect label="Booking Type" name="bookingType" value={formData.bookingType} onChange={handleChange} required>
              <option value="FRESH">Fresh</option>
              <option value="DATE_CHANGE">Date Change</option>
              <option value="CANCELLATION">Cancellation</option>
            </FormSelect>
            <FormInput label="Travel Date" name="travelDate" type="date" value={formData.travelDate} onChange={handleChange} required />
            <FormInput label="PC Date" name="pcDate" type="date" value={formData.pcDate} onChange={handleChange} required />
            <FormInput label="Issued Date" name="issuedDate" type="date" value={formData.issuedDate} onChange={handleChange} required />
            <FormSelect label="Payment Method" name="paymentMethod" value={formData.paymentMethod} onChange={(e) => { handleChange(e); if (e.target.value === 'INTERNAL' || e.target.value === 'INTERNAL_HUMM') { setShowInternalDeposit(true); } }} required>
              <option value="FULL">Full</option>
              <option value="INTERNAL">Internal (Instalments)</option>
              <option value="REFUND">Refund</option>
              <option value="FULL_HUMM">Full Humm</option>
              <option value="INTERNAL_HUMM">Internal Humm</option>
            </FormSelect>
            <FormInput label="Last Payment Date" name="lastPaymentDate" type="date" value={formData.lastPaymentDate} onChange={handleChange} />
          </div>
        </div>
        
        {/* Section 3: Financials */}
        <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <FormInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={formData.revenue} onChange={handleNumberChange} />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Cost (£)</label>
                  <div className="flex items-center">
                    <input name="prodCost" type="number" step="0.01" value={formData.prodCost} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                    <button type="button" onClick={() => setShowCostBreakdown(true)} className="ml-2 px-4 h-[42px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center shrink-0 transition" aria-label="Input Product Cost Breakdown">
                        <FaCalculator />
                    </button>
                  </div>
                  {formData.prodCostBreakdown.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-md border text-xs text-gray-600 space-y-1">
                      {formData.prodCostBreakdown.map((item, i) => <div key={i}>{item.category}: £{parseFloat(item.amount).toFixed(2)}</div>)}
                    </div>
                  )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (£)</label>
                    <div className="flex items-center">
                        <input name="received" type="number" step="0.01" value={formData.received} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                        <button type="button" onClick={() => setShowReceivedAmount(true)} className="ml-2 px-4 h-[42px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center shrink-0 transition" aria-label="Input Received Amount">
                           <FaMoneyBillWave />
                        </button>
                    </div>
                    {formData.transactionMethod && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md border text-xs text-gray-600">
                           {formData.transactionMethod.replace('_', ' ')} on {new Date(formData.receivedDate).toLocaleDateString('en-GB')}
                        </div>
                    )}
                </div>

                <FormInput label="Transaction Fee (£)" name="transFee" type="number" step="0.01" value={formData.transFee} onChange={handleNumberChange} />
                <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={formData.surcharge} onChange={handleNumberChange} />
                <FormInput label="Invoiced" name="invoiced" value={formData.invoiced} onChange={handleChange} placeholder="e.g., INV-123" />
                
                <FormInput label="Balance (£)" name="balance" value={formData.balance} readOnly />
                <FormInput label="Profit (£)" name="profit" value={formData.profit} readOnly />

                <div className="lg:col-span-3">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
                    <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white" rows="3" placeholder="Optional notes about the booking..." />
                </div>
            </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            type="submit"
            className="inline-flex items-center justify-center py-3 px-8 border border-transparent text-base font-semibold rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-wait transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Booking for Approval'}
          </button>
        </div>
      </form>

      {/* --- POPUPS (UNCHANGED) --- */}
      {showCostBreakdown && <ProductCostBreakdown initialBreakdown={formData.prodCostBreakdown} onClose={() => setShowCostBreakdown(false)} onSubmit={handleBreakdownSubmit} totalCost={parseFloat(formData.prodCost) || 0} />}
      {showInternalDeposit && <InternalDepositPopup initialData={{ revenue: formData.revenue, prod_cost: formData.prodCost, costItems: formData.prodCostBreakdown, surcharge: formData.surcharge, received: formData.received, last_payment_date: formData.lastPaymentDate, travel_date: formData.travelDate, totalSellingPrice: formData.revenue, depositPaid: formData.received, trans_fee: formData.transFee, }} onClose={() => setShowInternalDeposit(false)} onSubmit={handleInternalDepositSubmit} />}
      {showPaxDetails && <PaxDetailsPopup initialData={{ passenger: formData.passengers[0], numPax: formData.numPax }} onClose={() => setShowPaxDetails(false)} onSubmit={handlePaxDetailsSubmit} />}
      {showReceivedAmount && <ReceivedAmountPopup initialData={{ amount: formData.received, transactionMethod: formData.transactionMethod, receivedDate: formData.receivedDate, }} onClose={() => setShowReceivedAmount(false)} onSubmit={handleReceivedAmountSubmit} />}
    </div>
  );
}