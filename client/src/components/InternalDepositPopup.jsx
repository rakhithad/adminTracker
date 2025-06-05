import { useState, useEffect, useMemo } from 'react';
import ProductCostBreakdown from './ProductCostBreakdown';

export default function InternalDepositPopup({ initialData, onClose, onSubmit }) {
  const [depositData, setDepositData] = useState({
    period: 'within30days',
    instalmentType: 'weekly',
    numWeeks: 1,
    numWeeksBeyond30: 1,
    customInstalments: [],
    revenue: initialData.revenue || '',
    prod_cost: initialData.prod_cost || '',
    costItems: initialData.costItems || [],
    surcharge: initialData.surcharge || '',
    received: initialData.received || '',
    balance: '',
    profit: '',
    last_payment_date: initialData.last_payment_date || '',
    travel_date: initialData.travel_date || '',
    totalSellingPrice: initialData.totalSellingPrice || '',
    depositPaid: initialData.depositPaid || '',
    repaymentPeriod: '',
    monthlyInstalment: '',
    trans_fee: initialData.trans_fee || '',
    totalBalancePayable: '',
  });

  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const FIXED_INTEREST_RATE = 11;
  const MONTHLY_INTEREST_RATE = FIXED_INTEREST_RATE / 100 / 12;

  // Generate weekly instalments for within 30 days
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

  // Generate weekly instalments for beyond 30 days
  const generateWeeklyInstalmentsBeyond30 = (numWeeks, totalBalancePayable) => {
    const instalments = [];
    const today = new Date();
    const amountPerWeek = (parseFloat(totalBalancePayable) / numWeeks).toFixed(2);

    for (let i = 0; i < numWeeks; i++) {
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + (i + 1) * 7);
      instalments.push({
        dueDate: dueDate.toISOString().split('T')[0],
        amount: amountPerWeek,
        status: 'PENDING',
      });
    }
    return instalments;
  };

  // Generate monthly instalments (30 days apart) for beyond 30 days
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

  // Validate instalments
  const validateInstalments = (instalments, expectedTotal, isWithin30Days = true) => {
    const today = new Date();
    const totalAmount = instalments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
    const within30Days = instalments.every(inst => {
      const dueDate = new Date(inst.dueDate);
      return dueDate.getTime() <= today.getTime() + 30 * 24 * 60 * 60 * 1000;
    });
    const allValid = instalments.every(inst => inst.dueDate && parseFloat(inst.amount) > 0);
    return totalAmount.toFixed(2) === parseFloat(expectedTotal).toFixed(2) &&
           (!isWithin30Days || within30Days) &&
           allValid;
  };

  // Weekly instalments for within 30 days
  const weeklyInstalments = useMemo(() => {
    if (depositData.period === 'within30days' && depositData.instalmentType === 'weekly') {
      const balance = (parseFloat(depositData.revenue) || 0) - (parseFloat(depositData.received) || 0);
      return generateWeeklyInstalments(depositData.numWeeks, balance);
    }
    return [];
  }, [depositData.numWeeks, depositData.revenue, depositData.received]);

  // Weekly instalments for beyond 30 days
  const weeklyInstalmentsBeyond30 = useMemo(() => {
    if (depositData.period === 'beyond30' && depositData.instalmentType === 'weekly') {
      return generateWeeklyInstalmentsBeyond30(depositData.numWeeksBeyond30, depositData.totalBalancePayable);
    }
    return [];
  }, [depositData.numWeeksBeyond30, depositData.totalBalancePayable]);

  // Monthly instalments for beyond 30 days
  const monthlyInstalments = useMemo(() => {
    if (depositData.period === 'beyond30' && depositData.instalmentType === 'monthly') {
      return generateMonthlyInstalments(depositData.repaymentPeriod, depositData.totalBalancePayable);
    }
    return [];
  }, [depositData.repaymentPeriod, depositData.totalBalancePayable]);

  useEffect(() => {
    let profit = '';
    let balance = '';
    let monthlyInstalment = '';
    let trans_fee = '';
    let totalBalancePayable = '';
    let revenue = '';
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
      const areDatesValid =
        depositData.last_payment_date &&
        depositData.travel_date &&
        new Date(depositData.last_payment_date) < new Date(depositData.travel_date);

      setIsValid(isRevenueValid && isProdCostValid && isSurchargeValid && isReceivedValid && areDatesValid && instalmentsValid);
      setErrorMessage(
        !areDatesValid && depositData.last_payment_date && depositData.travel_date
          ? 'Last Payment Date must be before Travel Date'
          : !instalmentsValid
          ? 'Instalments must sum to balance and be within 30 days'
          : ''
      );
    } else if (depositData.period === 'beyond30') {
      const totalSellingPrice = parseFloat(depositData.totalSellingPrice) || 0;
      const depositPaid = parseFloat(depositData.depositPaid) || 0;
      const repaymentPeriod = parseInt(depositData.repaymentPeriod) || 0;
      const prod_cost = parseFloat(depositData.prod_cost) || 0;
      const surcharge = parseFloat(depositData.surcharge) || 0;

      balance = (totalSellingPrice - depositPaid).toFixed(2);
      totalBalancePayable = (
        parseFloat(balance) +
        parseFloat(balance) * MONTHLY_INTEREST_RATE * repaymentPeriod
      ).toFixed(2);
      monthlyInstalment = (parseFloat(totalBalancePayable) / repaymentPeriod).toFixed(2);
      trans_fee = (parseFloat(totalBalancePayable) - parseFloat(balance)).toFixed(2);
      revenue = (depositPaid + parseFloat(totalBalancePayable)).toFixed(2);
      profit = (parseFloat(revenue) - prod_cost - surcharge).toFixed(2);

      if (depositData.instalmentType === 'weekly') {
        instalmentsValid = validateInstalments(weeklyInstalmentsBeyond30, totalBalancePayable, false);
      } else if (depositData.instalmentType === 'monthly') {
        instalmentsValid = validateInstalments(monthlyInstalments, totalBalancePayable, false);
      } else {
        instalmentsValid = validateInstalments(depositData.customInstalments, totalBalancePayable, false);
      }

      const isTotalSellingPriceValid = totalSellingPrice > 0;
      const isDepositPaidValid = depositPaid >= 0;
      const isRepaymentPeriodValid = repaymentPeriod > 0;
      const isProdCostValid = prod_cost >= 0;
      const isSurchargeValid = surcharge >= 0;
      const areDatesValid =
        depositData.last_payment_date &&
        depositData.travel_date &&
        new Date(depositData.last_payment_date) < new Date(depositData.travel_date);

      setIsValid(
        isTotalSellingPriceValid &&
        isDepositPaidValid &&
        isRepaymentPeriodValid &&
        isProdCostValid &&
        isSurchargeValid &&
        areDatesValid &&
        instalmentsValid
      );
      setErrorMessage(
        !areDatesValid && depositData.last_payment_date && depositData.travel_date
          ? 'Last Payment Date must be before Travel Date'
          : !isTotalSellingPriceValid
          ? 'Total Selling Price must be positive'
          : !isRepaymentPeriodValid
          ? 'Repayment Period must be positive'
          : !isProdCostValid
          ? 'Production Cost must be non-negative'
          : !instalmentsValid
          ? 'Instalments must sum to total balance payable'
          : ''
      );
    }

    setDepositData(prev => {
      const newState = {
        ...prev,
        profit: profit !== '' && !isNaN(profit) ? profit : prev.profit,
        balance: balance !== '' && !isNaN(balance) ? balance : prev.balance,
        monthlyInstalment: monthlyInstalment !== '' && !isNaN(monthlyInstalment) ? monthlyInstalment : prev.monthlyInstalment,
        trans_fee: trans_fee !== '' && !isNaN(trans_fee) ? trans_fee : prev.trans_fee,
        totalBalancePayable: totalBalancePayable !== '' && !isNaN(totalBalancePayable) ? totalBalancePayable : prev.totalBalancePayable,
        revenue: revenue !== '' && !isNaN(revenue) ? revenue : prev.revenue,
      };
      if (depositData.period === 'within30days' && depositData.instalmentType === 'weekly') {
        newState.customInstalments = weeklyInstalments;
      } else if (depositData.period === 'beyond30' && depositData.instalmentType === 'weekly') {
        newState.customInstalments = weeklyInstalmentsBeyond30;
      } else if (depositData.period === 'beyond30' && depositData.instalmentType === 'monthly') {
        newState.customInstalments = monthlyInstalments;
      }
      if (
        newState.profit === prev.profit &&
        newState.balance === prev.balance &&
        newState.monthlyInstalment === prev.monthlyInstalment &&
        newState.trans_fee === prev.trans_fee &&
        newState.totalBalancePayable === prev.totalBalancePayable &&
        newState.revenue === prev.revenue &&
        JSON.stringify(newState.customInstalments) === JSON.stringify(prev.customInstalments)
      ) {
        return prev;
      }
      return newState;
    });
  }, [
    depositData.period,
    depositData.instalmentType,
    depositData.numWeeks,
    depositData.numWeeksBeyond30,
    depositData.revenue,
    depositData.prod_cost,
    depositData.surcharge,
    depositData.received,
    depositData.last_payment_date,
    depositData.travel_date,
    depositData.totalSellingPrice,
    depositData.depositPaid,
    depositData.repaymentPeriod,
    weeklyInstalments,
    weeklyInstalmentsBeyond30,
    monthlyInstalments,
  ]);

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDepositData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleIntegerChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d+$/.test(value)) {
      setDepositData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDepositData(prev => ({ ...prev, [name]: value }));
  };

  const handleBreakdownSubmit = (breakdown) => {
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setDepositData(prev => ({
      ...prev,
      prod_cost: total.toFixed(2),
      costItems: breakdown,
    }));
    setShowCostBreakdown(false);
  };

  const handlePeriodChange = (period) => {
    setDepositData(prev => ({
      ...prev,
      period,
      instalmentType: period === 'within30days' ? 'weekly' : 'monthly',
      revenue: period === 'within30days' ? prev.revenue : '',
      prod_cost: prev.prod_cost,
      costItems: prev.costItems,
      surcharge: prev.surcharge,
      received: period === 'within30days' ? prev.received : '',
      totalSellingPrice: period === 'beyond30' ? prev.totalSellingPrice : '',
      depositPaid: period === 'beyond30' ? prev.depositPaid : '',
      repaymentPeriod: period === 'beyond30' ? prev.repaymentPeriod : '',
      balance: '',
      profit: '',
      monthlyInstalment: '',
      trans_fee: period === 'beyond30' ? prev.trans_fee : '',
      totalBalancePayable: '',
      customInstalments: [],
      numWeeks: 1,
      numWeeksBeyond30: 1,
    }));
  };

  const handleInstalmentTypeChange = (type) => {
    setDepositData(prev => ({ ...prev, instalmentType: type, customInstalments: [], numWeeks: 1, numWeeksBeyond30: 1 }));
  };

  const handleCustomInstalmentChange = (index, field, value) => {
    const updatedInstalments = [...depositData.customInstalments];
    updatedInstalments[index] = { ...updatedInstalments[index], [field]: value };
    setDepositData(prev => ({ ...prev, customInstalments: updatedInstalments }));
  };

  const addCustomInstalment = () => {
    setDepositData(prev => ({
      ...prev,
      customInstalments: [...prev.customInstalments, { dueDate: '', amount: '', status: 'PENDING' }],
    }));
  };

  const removeCustomInstalment = (index) => {
    setDepositData(prev => ({
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
      balance: depositData.balance,
      profit: depositData.profit,
      last_payment_date: depositData.last_payment_date,
      travel_date: depositData.travel_date,
      totalSellingPrice: depositData.totalSellingPrice,
      depositPaid: depositData.depositPaid,
      repaymentPeriod: depositData.repaymentPeriod,
      monthlyInstalment: depositData.monthlyInstalment,
      trans_fee: depositData.trans_fee,
      totalBalancePayable: depositData.totalBalancePayable,
      instalments:
        depositData.period === 'within30days'
          ? depositData.instalmentType === 'weekly'
            ? weeklyInstalments
            : depositData.customInstalments
          : depositData.instalmentType === 'weekly'
            ? weeklyInstalmentsBeyond30
            : depositData.instalmentType === 'monthly'
              ? monthlyInstalments
              : depositData.customInstalments,
    };

    onSubmit(dataToSubmit);
  };

  const handleCancel = () => {
    setDepositData({
      period: 'within30days',
      instalmentType: 'weekly',
      numWeeks: 1,
      numWeeksBeyond30: 1,
      customInstalments: [],
      revenue: initialData.revenue || '',
      prod_cost: initialData.prod_cost || '',
      costItems: initialData.costItems || [],
      surcharge: initialData.surcharge || '',
      received: initialData.received || '',
      balance: '',
      profit: '',
      last_payment_date: initialData.last_payment_date || '',
      travel_date: initialData.travel_date || '',
      totalSellingPrice: initialData.totalSellingPrice || '',
      depositPaid: initialData.depositPaid || '',
      repaymentPeriod: '',
      monthlyInstalment: '',
      trans_fee: initialData.trans_fee || '',
      totalBalancePayable: '',
    });
    setShowCostBreakdown(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Internal Deposit</h3>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>
        )}

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="period"
              value="within30days"
              checked={depositData.period === 'within30days'}
              onChange={() => handlePeriodChange('within30days')}
              className="mr-2"
            />
            Within 30 Days
          </label>
          <label className="flex items-center mt-2">
            <input
              type="radio"
              name="period"
              value="beyond30"
              checked={depositData.period === 'beyond30'}
              onChange={() => handlePeriodChange('beyond30')}
              className="mr-2"
            />
            Beyond 30 Days
          </label>
        </div>

        {depositData.period === 'within30days' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Instalment Type*</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="instalmentType"
                    value="weekly"
                    checked={depositData.instalmentType === 'weekly'}
                    onChange={() => handleInstalmentTypeChange('weekly')}
                    className="mr-1"
                  />
                  Weekly
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="instalmentType"
                    value="custom"
                    checked={depositData.instalmentType === 'custom'}
                    onChange={() => handleInstalmentTypeChange('custom')}
                    className="mr-1"
                  />
                  Custom Dates
                </label>
              </div>
            </div>

            {depositData.instalmentType === 'weekly' && (
              <div>
                <label className="block text-gray-700 mb-1">Number of Weeks (1–4)*</label>
                <input
                  name="numWeeks"
                  type="number"
                  min="1"
                  max="4"
                  value={depositData.numWeeks}
                  onChange={handleIntegerChange}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  required
                />
              </div>
            )}

            {depositData.instalmentType === 'custom' && (
              <div>
                <label className="block text-gray-700 mb-1">Custom Instalments*</label>
                {depositData.customInstalments.map((inst, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => handleCustomInstalmentChange(index, 'dueDate', e.target.value)}
                      className="p-2 bg-gray-100 border rounded-lg"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={inst.amount}
                      onChange={(e) => handleCustomInstalmentChange(index, 'amount', e.target.value)}
                      placeholder="Amount (£)"
                      className="p-2 bg-gray-100 border rounded-lg"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomInstalment(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomInstalment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Instalment
                </button>
              </div>
            )}

            <div>
              <label className="block text-gray-700 mb-1">Revenue (£)*</label>
              <input
                name="revenue"
                type="number"
                step="0.01"
                value={depositData.revenue}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex space-x-2">
                <input
                  name="prod_cost"
                  type="number"
                  step="0.01"
                  value={depositData.prod_cost}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {showCostBreakdown ? 'Hide' : 'Breakdown'}
                </button>
              </div>
              {depositData.costItems.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {depositData.costItems.map(item => (
                    <span key={item.id} className="mr-2">
                      {item.category}: £{parseFloat(item.amount).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Surcharge (£)</label>
              <input
                name="surcharge"
                type="number"
                step="0.01"
                value={depositData.surcharge}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Amount Received (£)</label>
              <input
                name="received"
                type="number"
                step="0.01"
                value={depositData.received}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Balance (£)</label>
              <input
                name="balance"
                type="number"
                step="0.01"
                value={depositData.balance}
                className="w-full p-2 bg-gray-100 border-gray-300 rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Profit (£)</label>
              <input
                name="profit"
                type="number"
                step="0.01"
                value={depositData.profit}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Last Payment Date*</label>
              <input
                type="date"
                name="last_payment_date"
                value={depositData.last_payment_date}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="text-gray-700">Travel Date*</label>
              <input
                type="date"
                name="travel_date"
                value={depositData.travel_date}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>
          </div>
        )}

        {depositData.period === 'beyond30' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Instalment Type*</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="instalmentType"
                    value="weekly"
                    checked={depositData.instalmentType === 'weekly'}
                    onChange={() => handleInstalmentTypeChange('weekly')}
                    className="mr-1"
                  />
                  Weekly
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="instalmentType"
                    value="monthly"
                    checked={depositData.instalmentType === 'monthly'}
                    onChange={() => handleInstalmentTypeChange('monthly')}
                    className="mr-1"
                  />
                  Monthly (30 days)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="instalmentType"
                    value="custom"
                    checked={depositData.instalmentType === 'custom'}
                    onChange={() => handleInstalmentTypeChange('custom')}
                    className="mr-1"
                  />
                  Custom
                </label>
              </div>
            </div>

            {depositData.instalmentType === 'weekly' && (
              <div>
                <label className="block text-gray-700 mb-1">Number of Payments*</label>
                <input
                  name="numWeeksBeyond30"
                  type="number"
                  min="1"
                  value={depositData.numWeeksBeyond30}
                  onChange={handleIntegerChange}
                  className="w-full p-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {depositData.instalmentType === 'monthly' && (
              <div>
                <label className="block text-gray-700 mb-1">Number of Payments*</label>
                <input
                  name="repaymentPeriod"
                  type="number"
                  value={depositData.repaymentPeriod}
                  onChange={handleIntegerChange}
                  className="w-full p-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {depositData.instalmentType === 'custom' && (
              <div>
                <label className="block text-gray-700 mb-1">Custom Payments*</label>
                {depositData.customInstalments.map((inst, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => handleCustomInstalmentChange(index, 'dueDate', e.target.value)}
                      className="p-2 bg-gray-100 border rounded-lg"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={inst.amount}
                      onChange={(e) => handleCustomInstalmentChange(index, 'amount', e.target.value)}
                      placeholder="Amount (£)"
                      className="p-2 bg-gray-100 border rounded-lg"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomInstalment(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomInstalment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Payment
                </button>
              </div>
            )}

            <div>
              <label className="block text-gray-700 mb-1">Total Selling Price (£)*</label>
              <input
                name="totalSellingPrice"
                type="number"
                step="0.01"
                value={depositData.totalSellingPrice}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex space-x-2">
                <input
                  name="prod_cost"
                  type="number"
                  step="0.01"
                  value={depositData.prod_cost}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {showCostBreakdown ? 'Hide' : 'Breakdown'}
                </button>
              </div>
              {depositData.costItems.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {depositData.costItems.map(item => (
                    <span key={item.id} className="mr-2">
                      {item.category}: £{parseFloat(item.amount).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Surcharge (£)</label>
              <input
                name="surcharge"
                type="number"
                step="0.01"
                value={depositData.surcharge}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Deposit Paid (£)</label>
              <input
                name="depositPaid"
                type="number"
                step="0.01"
                value={depositData.depositPaid}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Balance After Deposit (£)</label>
              <input
                name="balance"
                type="number"
                step="0.01"
                value={depositData.balance}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Instalment Amount (£)</label>
              <input
                name="monthlyInstalment"
                type="number"
                step="0.01"
                value={depositData.monthlyInstalment}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Transaction Fee (£)</label>
              <input
                name="trans_fee"
                type="number"
                step="0.01"
                value={depositData.trans_fee}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Total Balance Payable (£)</label>
              <input
                name="totalBalancePayable"
                type="number"
                step="0.01"
                value={depositData.totalBalancePayable}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Last Payment Date*</label>
              <input
                type="date"
                name="last_payment_date"
                value={depositData.last_payment_date}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Travel Date*</label>
              <input
                type="date"
                name="travel_date"
                value={depositData.travel_date}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                required
              />
            </div>

            <div className="text-center mt-4">
              <label className="block text-gray-700 font-medium">Revenue (£)</label>
              <span className="text-lg font-semibold">{depositData.revenue || '0.00'}</span>
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Profit (£)</label>
              <input
                name="profit"
                type="number"
                step="0.01"
                value={depositData.profit}
                className="w-full p-2 bg-gray-100 border rounded-lg"
                readOnly
              />
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg text-white ${
              isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>

        {showCostBreakdown && (
          <ProductCostBreakdown
            initialBreakdown={depositData.costItems}
            onClose={() => setShowCostBreakdown(false)}
            onSubmit={handleBreakdownSubmit}
            totalCost={parseFloat(depositData.prod_cost) || 0}
          />
        )}
      </div>
    </div>
  );
}