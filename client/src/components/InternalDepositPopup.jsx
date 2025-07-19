import { useState, useEffect, useMemo } from 'react';
import ProductCostBreakdown from './ProductCostBreakdown';
import ReceivedAmountPopup from './ReceivedAmountPopup';

// A reusable component for creating segmented button controls from radio buttons
const SegmentedControl = ({ options, selectedValue, onChange }) => (
  <div className="flex w-full rounded-lg bg-gray-200 p-1">
    {options.map(({ value, label }) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        className={`w-full rounded-md py-2 text-sm font-semibold transition-colors duration-200 ease-in-out
          ${
            selectedValue === value
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:bg-gray-300'
          }
        `}
      >
        {label}
      </button>
    ))}
  </div>
);

// A reusable styled input component
const FormInput = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      {...props}
      className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
    />
  </div>
);

// A reusable component for displaying read-only calculated values
const DisplayField = ({ label, value, unit = '£' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600">{label}</label>
        <div className="mt-1 p-2 bg-gray-100 rounded-lg text-gray-800 font-mono text-base">
            {unit} {parseFloat(value || 0).toFixed(2)}
        </div>
    </div>
);


export default function InternalDepositPopup({ initialData, onClose, onSubmit }) {
  // --- All your existing state and logic hooks remain unchanged ---
  const [depositData, setDepositData] = useState({
    period: 'within30days',
    instalmentType: 'weekly',
    numWeeks: 1,
    customInstalments: [],
    revenue: initialData.revenue || '',
    prod_cost: initialData.prod_cost || '',
    costItems: initialData.costItems || [],
    surcharge: initialData.surcharge || '',
    received: initialData.received || '',
    transactionMethod: initialData.transactionMethod || '',
    receivedDate: initialData.receivedDate || new Date().toISOString().split('T')[0],
    balance: '',
    profit: '',
    last_payment_date: initialData.last_payment_date || '',
    travel_date: initialData.travel_date || '',
    totalSellingPrice: initialData.totalSellingPrice || '',
    depositPaid: initialData.depositPaid || '',
    repaymentPeriod: '',
    trans_fee: initialData.trans_fee || '',
    totalBalancePayable: '',
  });

  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showReceivedAmount, setShowReceivedAmount] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const FIXED_INTEREST_RATE = 11;
  const MONTHLY_INTEREST_RATE = FIXED_INTEREST_RATE / 100 / 12;

  // --- All your calculation and validation functions remain unchanged ---
  // generateWeeklyInstalments, generateMonthlyInstalments, calculateRepaymentPeriod, etc.
  // ... (Your existing functions go here, they don't need to be changed)

  const generateWeeklyInstalments = (numWeeks, balance) => {
    const instalments = [];
    const today = new Date();
    const amountPerWeek = (parseFloat(balance) / numWeeks).toFixed(2);

    for (let i = 0; i < numWeeks; i++) {
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + (i + 1) * 7);
      if (dueDate.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
        return [];
      }
      instalments.push({
        dueDate: dueDate.toISOString().split('T')[0],
        amount: amountPerWeek,
        status: 'PENDING',
      });
    }
    return instalments;
  };

  const generateMonthlyInstalments = (repaymentPeriod, totalBalancePayable) => {
    const instalments = [];
    const today = new Date();
    const amountPerMonth = (parseFloat(totalBalancePayable) / repaymentPeriod).toFixed(2);

    for (let i = 0; i < repaymentPeriod; i++) {
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + (i + 1) * 30);
      instalments.push({
        dueDate: dueDate.toISOString().split('T')[0],
        amount: amountPerMonth,
        status: 'PENDING',
      });
    }
    return instalments;
  };

  const calculateRepaymentPeriod = (instalments) => {
    if (!instalments.length) return 0;
    const today = new Date();
    const lastInstalmentDate = new Date(
      instalments.reduce((latest, inst) => {
        const instDate = new Date(inst.dueDate);
        return instDate > new Date(latest) ? inst.dueDate : latest;
      }, instalments[0].dueDate)
    );
    const diffDays = Math.ceil((lastInstalmentDate - today) / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 30); // Count 30-day periods
  };

  const validateInstalments = (instalments, expectedTotal, isWithin30Days = true) => {
    if (!instalments || instalments.length === 0) {
       // If expected total is zero, no instalments are needed.
       return parseFloat(expectedTotal) === 0;
    }
    const today = new Date();
    // Allow a small tolerance for floating point issues
    const totalAmount = instalments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
    const within30Days = instalments.every((inst) => {
      const dueDate = new Date(inst.dueDate);
      return dueDate.getTime() <= today.getTime() + 30 * 24 * 60 * 60 * 1000;
    });
    const allValid = instalments.every(
      (inst) => inst.dueDate && parseFloat(inst.amount) > 0 && new Date(inst.dueDate) >= today
    );
    return (
      Math.abs(totalAmount - parseFloat(expectedTotal)) < 0.01 &&
      (!isWithin30Days || within30Days) &&
      allValid
    );
  };

  const weeklyInstalments = useMemo(() => {
    if (depositData.period === 'within30days' && depositData.instalmentType === 'weekly') {
      const balance = (parseFloat(depositData.revenue) || 0) - (parseFloat(depositData.received) || 0);
      return generateWeeklyInstalments(depositData.numWeeks, balance);
    }
    return [];
  }, [depositData.numWeeks, depositData.revenue, depositData.received, depositData.period, depositData.instalmentType]);

  const monthlyInstalments = useMemo(() => {
    if (depositData.period === 'beyond30' && depositData.instalmentType === 'monthly') {
      return generateMonthlyInstalments(depositData.repaymentPeriod, depositData.totalBalancePayable);
    }
    return [];
  }, [depositData.repaymentPeriod, depositData.totalBalancePayable, depositData.period, depositData.instalmentType]);

  const handleReceivedAmountSubmit = ({ amount, transactionMethod, receivedDate }) => {
    setDepositData((prev) => ({
      ...prev,
      received: depositData.period === 'within30days' ? amount : prev.received,
      depositPaid: depositData.period === 'beyond30' ? amount : prev.depositPaid,
      transactionMethod,
      receivedDate,
    }));
    setShowReceivedAmount(false);
  };

  useEffect(() => {
    // This entire useEffect hook remains the same.
    let profit = '';
    let balance = '';
    let trans_fee = '';
    let totalBalancePayable = '';
    let revenue = '';
    let repaymentPeriod = depositData.repaymentPeriod;
    let last_payment_date = depositData.last_payment_date;
    let instalmentsValid = true;

    if (depositData.period === 'within30days') {
      const revenueNum = parseFloat(depositData.revenue) || 0;
      const prod_cost = parseFloat(depositData.prod_cost) || 0;
      const surcharge = parseFloat(depositData.surcharge) || 0;
      const received = parseFloat(depositData.received) || 0;

      profit = (revenueNum - prod_cost - surcharge).toFixed(2);
      balance = (revenueNum - received).toFixed(2);

      if (depositData.instalmentType === 'weekly') {
        instalmentsValid = validateInstalments(weeklyInstalments, balance);
      } else {
        instalmentsValid = validateInstalments(depositData.customInstalments, balance);
      }

      const isRevenueValid = revenueNum > 0;
      const isProdCostValid = prod_cost >= 0;
      const isSurchargeValid = surcharge >= 0;
      const isReceivedValid = received >= 0;
      const isTransactionMethodValid = depositData.transactionMethod
        ? ['BANK_TRANSFER', 'LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'].includes(
            depositData.transactionMethod
          )
        : true; // Optional for FULL payment
      const isReceivedDateValid = depositData.receivedDate ? new Date(depositData.receivedDate) <= new Date() : true; // Optional
      const areDatesValid =
        depositData.travel_date &&
        (!depositData.last_payment_date ||
          new Date(depositData.last_payment_date) < new Date(depositData.travel_date)); // last_payment_date optional

      setIsValid(
        isRevenueValid &&
          isProdCostValid &&
          isSurchargeValid &&
          isReceivedValid &&
          isTransactionMethodValid &&
          isReceivedDateValid &&
          areDatesValid &&
          instalmentsValid
      );
      setErrorMessage(
        !areDatesValid && depositData.last_payment_date && depositData.travel_date
          ? 'Last Payment Date must be before Travel Date'
          : !instalmentsValid
          ? 'Instalments must sum to balance and be within 30 days'
          : !isTransactionMethodValid
          ? 'Invalid transaction method'
          : !isReceivedDateValid
          ? 'Received date cannot be in the future'
          : ''
      );
    } else if (depositData.period === 'beyond30') {
      const totalSellingPrice = parseFloat(depositData.totalSellingPrice) || 0;
      const depositPaid = parseFloat(depositData.depositPaid) || 0;
      const prod_cost = parseFloat(depositData.prod_cost) || 0;
      const surcharge = parseFloat(depositData.surcharge) || 0;

      balance = (totalSellingPrice - depositPaid).toFixed(2);

      if (depositData.instalmentType === 'custom') {
        repaymentPeriod = calculateRepaymentPeriod(depositData.customInstalments);
        if (depositData.customInstalments.length > 0) {
          last_payment_date = depositData.customInstalments.reduce((latest, inst) => {
            const instDate = new Date(inst.dueDate);
            return instDate > new Date(latest) ? inst.dueDate : latest;
          }, depositData.customInstalments[0].dueDate);
        }
      }

      totalBalancePayable = (
        parseFloat(balance) +
        parseFloat(balance) * MONTHLY_INTEREST_RATE * (parseInt(repaymentPeriod) || 0)
      ).toFixed(2);
      trans_fee = (parseFloat(totalBalancePayable) - parseFloat(balance)).toFixed(2);
      revenue = (depositPaid + parseFloat(totalBalancePayable)).toFixed(2);
      profit = (parseFloat(revenue) - prod_cost - surcharge).toFixed(2);

      if (depositData.instalmentType === 'monthly') {
        instalmentsValid = validateInstalments(monthlyInstalments, totalBalancePayable, false);
      } else {
        instalmentsValid = validateInstalments(depositData.customInstalments, totalBalancePayable, false);
      }

      const isTotalSellingPriceValid = totalSellingPrice > 0;
      const isDepositPaidValid = depositPaid >= 0;
      const isRepaymentPeriodValid = parseInt(repaymentPeriod) > 0;
      const isProdCostValid = prod_cost >= 0;
      const isSurchargeValid = surcharge >= 0;
      const isTransactionMethodValid = depositData.transactionMethod
        ? ['BANK_TRANSFER', 'LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'].includes(
            depositData.transactionMethod
          )
        : true; // Optional
      const isReceivedDateValid = depositData.receivedDate ? new Date(depositData.receivedDate) <= new Date() : true; // Optional
      const areDatesValid =
        last_payment_date &&
        depositData.travel_date &&
        new Date(last_payment_date) < new Date(depositData.travel_date);

      setIsValid(
        isTotalSellingPriceValid &&
          isDepositPaidValid &&
          isRepaymentPeriodValid &&
          isProdCostValid &&
          isSurchargeValid &&
          isTransactionMethodValid &&
          isReceivedDateValid &&
          areDatesValid &&
          instalmentsValid
      );
      setErrorMessage(
        !areDatesValid && last_payment_date && depositData.travel_date
          ? 'Last Payment Date must be before Travel Date'
          : !isTotalSellingPriceValid
          ? 'Total Selling Price must be positive'
          : !isRepaymentPeriodValid
          ? 'Repayment Period must be positive'
          : !isProdCostValid
          ? 'Production Cost must be non-negative'
          : !instalmentsValid
          ? 'Instalments must sum to total balance payable'
          : !isTransactionMethodValid
          ? 'Invalid transaction method'
          : !isReceivedDateValid
          ? 'Received date cannot be in the future'
          : ''
      );
    }

    setDepositData((prev) => ({
      ...prev,
      profit: profit !== '' && !isNaN(profit) ? profit : prev.profit,
      balance: balance !== '' && !isNaN(balance) ? balance : prev.balance,
      trans_fee: trans_fee !== '' && !isNaN(trans_fee) ? trans_fee : prev.trans_fee,
      totalBalancePayable:
        totalBalancePayable !== '' && !isNaN(totalBalancePayable) ? totalBalancePayable : prev.totalBalancePayable,
      revenue: revenue !== '' && !isNaN(revenue) ? revenue : prev.revenue,
      repaymentPeriod: repaymentPeriod !== '' && !isNaN(repaymentPeriod) ? repaymentPeriod : prev.repaymentPeriod,
      last_payment_date: last_payment_date || prev.last_payment_date,
    }));
  }, [
    depositData.period,
    depositData.instalmentType,
    depositData.numWeeks,
    depositData.revenue,
    depositData.prod_cost,
    depositData.surcharge,
    depositData.received,
    depositData.transactionMethod,
    depositData.receivedDate,
    depositData.last_payment_date,
    depositData.travel_date,
    depositData.totalSellingPrice,
    depositData.depositPaid,
    depositData.repaymentPeriod,
    depositData.customInstalments,
    weeklyInstalments,
    monthlyInstalments,
  ]);

  // --- All your handler functions remain unchanged ---
  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDepositData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleIntegerChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d+$/.test(value)) {
      setDepositData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDepositData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBreakdownSubmit = (breakdown) => {
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setDepositData((prev) => ({
      ...prev,
      prod_cost: total.toFixed(2),
      costItems: breakdown,
    }));
    setShowCostBreakdown(false);
  };

  const handlePeriodChange = (period) => {
    setDepositData((prev) => ({
      ...prev,
      period,
      instalmentType: period === 'within30days' ? 'weekly' : 'monthly',
      revenue: period === 'within30days' ? prev.revenue : '',
      prod_cost: prev.prod_cost,
      costItems: prev.costItems,
      surcharge: prev.surcharge,
      received: period === 'within30days' ? prev.received : '',
      transactionMethod: '', // Reset transactionMethod
      receivedDate: new Date().toISOString().split('T')[0], // Reset receivedDate
      totalSellingPrice: period === 'beyond30' ? prev.totalSellingPrice : '',
      depositPaid: period === 'beyond30' ? prev.depositPaid : '',
      repaymentPeriod: '',
      balance: '',
      profit: '',
      trans_fee: period === 'beyond30' ? prev.trans_fee : '',
      totalBalancePayable: '',
      customInstalments: [],
      numWeeks: 1,
    }));
  };

  const handleInstalmentTypeChange = (type) => {
    setDepositData((prev) => ({ ...prev, instalmentType: type, customInstalments: [], repaymentPeriod: '' }));
  };

  const handleCustomInstalmentChange = (index, field, value) => {
    const updatedInstalments = [...depositData.customInstalments];
    updatedInstalments[index] = { ...updatedInstalments[index], [field]: value };
    setDepositData((prev) => ({ ...prev, customInstalments: updatedInstalments }));
  };

  const addCustomInstalment = () => {
    const today = new Date();
    const lastInstalment = depositData.customInstalments[depositData.customInstalments.length - 1];
    const defaultDueDate = lastInstalment
      ? new Date(new Date(lastInstalment.dueDate).setDate(new Date(lastInstalment.dueDate).getDate() + 30))
          .toISOString()
          .split('T')[0]
      : new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];
    setDepositData((prev) => ({
      ...prev,
      customInstalments: [...prev.customInstalments, { dueDate: defaultDueDate, amount: '', status: 'PENDING' }],
    }));
  };

  const removeCustomInstalment = (index) => {
    setDepositData((prev) => ({
      ...prev,
      customInstalments: prev.customInstalments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const dataToSubmit = {
      revenue: depositData.revenue,
      prod_cost: depositData.prod_cost,
      costItems: depositData.costItems,
      surcharge: depositData.surcharge,
      received: depositData.received,
      transactionMethod: depositData.transactionMethod || null,
      receivedDate: depositData.receivedDate || null,
      balance: depositData.balance,
      profit: depositData.profit,
      last_payment_date: depositData.last_payment_date || null,
      travel_date: depositData.travel_date,
      totalSellingPrice: depositData.totalSellingPrice,
      depositPaid: depositData.depositPaid,
      repaymentPeriod: depositData.repaymentPeriod,
      trans_fee: depositData.trans_fee || null,
      totalBalancePayable: depositData.totalBalancePayable,
      instalments:
        depositData.period === 'within30days'
          ? depositData.instalmentType === 'weekly'
            ? weeklyInstalments
            : depositData.customInstalments
          : depositData.instalmentType === 'monthly'
          ? monthlyInstalments
          : depositData.customInstalments,
    };

    onSubmit(dataToSubmit);
  };

  const handleCancel = () => {
    // This function can also be simplified by just calling onClose,
    // as the component will unmount and state will be reset on next open.
    // Keeping it for explicit state reset if needed.
    onClose();
  };

  // --- NEW STYLED JSX ---
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {/* Increased max-width, added max-height and overflow for better responsiveness */}
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Internal Deposit</h2>
        <p className="text-center text-gray-500 mb-6">Select a payment period and fill in the details.</p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mb-6">
          <SegmentedControl
            options={[
              { value: 'within30days', label: 'Within 30 Days' },
              { value: 'beyond30', label: 'Beyond 30 Days' },
            ]}
            selectedValue={depositData.period}
            onChange={handlePeriodChange}
          />
        </div>

        {/* --- WITHIN 30 DAYS FORM --- */}
        {depositData.period === 'within30days' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 border border-gray-200 rounded-lg space-y-4">
                <label className="block text-sm font-medium text-gray-700">Instalment Type*</label>
                <SegmentedControl
                    options={[
                        { value: 'weekly', label: 'Automatic Weekly' },
                        { value: 'custom', label: 'Custom Dates' },
                    ]}
                    selectedValue={depositData.instalmentType}
                    onChange={handleInstalmentTypeChange}
                />
            </div>

            {depositData.instalmentType === 'weekly' && (
              <FormInput
                label="Number of Weeks (1–4)*"
                name="numWeeks"
                type="number"
                min="1"
                max="4"
                value={depositData.numWeeks}
                onChange={handleIntegerChange}
                required
              />
            )}

            {/* Custom Instalments UI - Improved layout */}
            {depositData.instalmentType === 'custom' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Custom Instalments*</label>
                {depositData.customInstalments.map((inst, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <FormInput label="" name="dueDate" type="date" value={inst.dueDate} onChange={(e) => handleCustomInstalmentChange(index, 'dueDate', e.target.value)} required />
                    <FormInput label="" name="amount" type="number" step="0.01" value={inst.amount} onChange={(e) => handleCustomInstalmentChange(index, 'amount', e.target.value)} placeholder="Amount (£)" required />
                    <button type="button" onClick={() => removeCustomInstalment(index)} className="h-10 w-10 mt-1 md:mt-0 flex-shrink-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center transition-colors">×</button>
                  </div>
                ))}
                <button type="button" onClick={addCustomInstalment} className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors">Add Instalment</button>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-4">
                <FormInput label="Revenue (£)*" name="revenue" type="number" step="0.01" value={depositData.revenue} onChange={handleNumberChange} required />
                <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={depositData.surcharge} onChange={handleNumberChange} />
            </div>

            {/* Input with attached button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex space-x-2">
                <input value={`£ ${parseFloat(depositData.prod_cost || 0).toFixed(2)}`} className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg font-mono" readOnly />
                <button type="button" onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">{showCostBreakdown ? 'Hide' : 'Breakdown'}</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (£)</label>
              <div className="flex space-x-2">
                 <input value={`£ ${parseFloat(depositData.received || 0).toFixed(2)}`} className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg font-mono" readOnly />
                <button type="button" onClick={() => setShowReceivedAmount(true)} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Input</button>
              </div>
              {depositData.transactionMethod && depositData.receivedDate && <div className="mt-2 text-xs text-gray-500">Method: {depositData.transactionMethod}, Date: {new Date(depositData.receivedDate).toLocaleDateString()}</div>}
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <DisplayField label="Balance (£)" value={depositData.balance} />
                <DisplayField label="Profit (£)" value={depositData.profit} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <FormInput label="Last Payment Date" type="date" name="last_payment_date" value={depositData.last_payment_date} onChange={handleDateChange} />
                <FormInput label="Travel Date*" type="date" name="travel_date" value={depositData.travel_date} onChange={handleDateChange} required />
            </div>
          </div>
        )}

        {/* --- BEYOND 30 DAYS FORM --- */}
        {depositData.period === 'beyond30' && (
          <div className="space-y-5 animate-fade-in">
             <div className="p-4 border border-gray-200 rounded-lg space-y-4">
                <label className="block text-sm font-medium text-gray-700">Instalment Type*</label>
                <SegmentedControl
                    options={[
                        { value: 'monthly', label: 'Automatic Monthly' },
                        { value: 'custom', label: 'Custom Payments' },
                    ]}
                    selectedValue={depositData.instalmentType}
                    onChange={handleInstalmentTypeChange}
                />
            </div>
            
            {depositData.instalmentType === 'monthly' && (
                <FormInput label="Number of Payments*" name="repaymentPeriod" type="number" value={depositData.repaymentPeriod} onChange={handleIntegerChange} required />
            )}
            
            {depositData.instalmentType === 'custom' && (
               <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Custom Payments*</label>
                {depositData.customInstalments.map((inst, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <FormInput label="" name="dueDate" type="date" value={inst.dueDate} onChange={(e) => handleCustomInstalmentChange(index, 'dueDate', e.target.value)} required />
                    <FormInput label="" name="amount" type="number" step="0.01" value={inst.amount} onChange={(e) => handleCustomInstalmentChange(index, 'amount', e.target.value)} placeholder="Amount (£)" required />
                    <button type="button" onClick={() => removeCustomInstalment(index)} className="h-10 w-10 mt-1 md:mt-0 flex-shrink-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center transition-colors">×</button>
                  </div>
                ))}
                <button type="button" onClick={addCustomInstalment} className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors">Add Payment</button>
              </div>
            )}
            
            <FormInput label="Total Selling Price (£)*" name="totalSellingPrice" type="number" step="0.01" value={depositData.totalSellingPrice} onChange={handleNumberChange} required />
            
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex space-x-2">
                <input value={`£ ${parseFloat(depositData.prod_cost || 0).toFixed(2)}`} className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg font-mono" readOnly />
                <button type="button" onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">{showCostBreakdown ? 'Hide' : 'Breakdown'}</button>
              </div>
            </div>

            <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={depositData.surcharge} onChange={handleNumberChange} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Paid (£)</label>
              <div className="flex space-x-2">
                 <input value={`£ ${parseFloat(depositData.depositPaid || 0).toFixed(2)}`} className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg font-mono" readOnly />
                <button type="button" onClick={() => setShowReceivedAmount(true)} className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Input</button>
              </div>
              {depositData.transactionMethod && depositData.receivedDate && <div className="mt-2 text-xs text-gray-500">Method: {depositData.transactionMethod}, Date: {new Date(depositData.receivedDate).toLocaleDateString()}</div>}
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-800 text-center">Calculated Summary</h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <DisplayField label="Balance After Deposit" value={depositData.balance} />
                    <DisplayField label="Transaction Fee" value={depositData.trans_fee} />
                    <DisplayField label="Total Balance Payable" value={depositData.totalBalancePayable} />
                </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <DisplayField label="Number of Payments" value={depositData.repaymentPeriod} unit="" />
                    <div>
                        <label className="block text-sm font-medium text-gray-600">Last Payment Date*</label>
                        <div className="mt-1 p-2 bg-gray-100 rounded-lg text-gray-800">{depositData.last_payment_date || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <FormInput label="Travel Date*" type="date" name="travel_date" value={depositData.travel_date} onChange={handleDateChange} required />
            
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-indigo-50 rounded-lg">
                <div className="text-center">
                    <label className="block text-sm font-medium text-indigo-800">Final Revenue (£)</label>
                    <span className="text-2xl font-bold text-indigo-600 font-mono">{parseFloat(depositData.revenue || 0).toFixed(2)}</span>
                </div>
                 <div className="text-center">
                    <label className="block text-sm font-medium text-indigo-800">Final Profit (£)</label>
                    <span className="text-2xl font-bold text-indigo-600 font-mono">{parseFloat(depositData.profit || 0).toFixed(2)}</span>
                </div>
            </div>
          </div>
        )}

        {/* --- ACTION BUTTONS --- */}
        <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
          <button type="button" onClick={handleCancel} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="px-6 py-2 rounded-lg text-white font-semibold transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>

        {/* --- MODALS --- */}
        {showCostBreakdown && (
          <ProductCostBreakdown
            initialBreakdown={depositData.costItems}
            onClose={() => setShowCostBreakdown(false)}
            onSubmit={handleBreakdownSubmit}
            totalCost={parseFloat(depositData.prod_cost) || 0}
          />
        )}
        {showReceivedAmount && (
          <ReceivedAmountPopup
            initialData={{
              amount: depositData.period === 'within30days' ? depositData.received : depositData.depositPaid,
              transactionMethod: depositData.transactionMethod,
              receivedDate: depositData.receivedDate,
            }}
            onClose={() => setShowReceivedAmount(false)}
            onSubmit={handleReceivedAmountSubmit}
          />
        )}
      </div>
    </div>
  );
}