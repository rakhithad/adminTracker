import { useState, useEffect } from 'react';
import ProductCostBreakdown from './ProductCostBreakdown';

export default function InternalDepositPopup({ initialData, onClose, onSubmit }) {
  const [depositData, setDepositData] = useState({
    period: 'within30', // Default to "Within 30 Days"
    revenue: initialData.revenue || '',
    prodCost: initialData.prodCost || '',
    prodCostBreakdown: initialData.prodCostBreakdown || [],
    surcharge: initialData.surcharge || '',
    received: initialData.received || '',
    balance: '',
    profit: '',
    lastPaymentDate: initialData.lastPaymentDate || '',
    travelDate: initialData.travelDate || '',
    totalSellingPrice: initialData.totalSellingPrice || '',
    depositPaid: initialData.depositPaid || '',
    repaymentPeriod: '',
    monthlyInstalment: '',
    totalTransactionFee: initialData.totalTransactionFee || '',
    totalBalancePayable: ''
  });

  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fixed interest rate for Beyond 30 Days calculations
  const FIXED_INTEREST_RATE = 11;
  const MONTHLY_INTEREST_RATE = FIXED_INTEREST_RATE / 100 / 12;

  // Auto-calculate fields based on period
  useEffect(() => {
    let profit = '';
    let balance = '';
    let monthlyInstalment = '';
    let totalTransactionFee = '';
    let totalBalancePayable = '';
    let revenue = '';

    if (depositData.period === 'within30') {
      const revenueNum = parseFloat(depositData.revenue) || 0;
      const prodCost = parseFloat(depositData.prodCost) || 0;
      const surcharge = parseFloat(depositData.surcharge) || 0;
      const received = parseFloat(depositData.received) || 0;

      profit = (revenueNum - prodCost - surcharge).toFixed(2);
      balance = (revenueNum - received).toFixed(2);

      // Validate for Within 30 Days
      const isRevenueValid = revenueNum > 0;
      const isProdCostValid = prodCost >= 0;
      const isSurchargeValid = surcharge >= 0;
      const isReceivedValid = received >= 0;
      const areDatesValid =
        depositData.lastPaymentDate &&
        depositData.travelDate &&
        new Date(depositData.lastPaymentDate) < new Date(depositData.travelDate);

      setIsValid(isRevenueValid && isProdCostValid && isSurchargeValid && isReceivedValid && areDatesValid);
      setErrorMessage(
        !areDatesValid && depositData.lastPaymentDate && depositData.travelDate
          ? 'Last Payment Date must be before Travel Date'
          : ''
      );
    } else if (depositData.period === 'beyond30') {
      const totalSellingPrice = parseFloat(depositData.totalSellingPrice) || 0;
      const depositPaid = parseFloat(depositData.depositPaid) || 0;
      const repaymentPeriod = parseInt(depositData.repaymentPeriod) || 0;
      const prodCost = parseFloat(depositData.prodCost) || 0;
      const surcharge = parseFloat(depositData.surcharge) || 0;

      balance = (totalSellingPrice - depositPaid).toFixed(2);
      totalBalancePayable = (
        parseFloat(balance) +
        parseFloat(balance) * MONTHLY_INTEREST_RATE * repaymentPeriod
      ).toFixed(2);
      monthlyInstalment = (parseFloat(totalBalancePayable) / repaymentPeriod).toFixed(2);
      totalTransactionFee = (parseFloat(totalBalancePayable) - parseFloat(balance)).toFixed(2);
      revenue = (depositPaid + parseFloat(totalBalancePayable)).toFixed(2);
      profit = (parseFloat(revenue) - prodCost - surcharge).toFixed(2);

      // Validate for Beyond 30 Days
      const isTotalSellingPriceValid = totalSellingPrice > 0;
      const isDepositPaidValid = depositPaid >= 0;
      const isRepaymentPeriodValid = repaymentPeriod > 0;
      const isProdCostValid = prodCost >= 0;
      const isSurchargeValid = surcharge >= 0;
      const areDatesValid =
        depositData.lastPaymentDate &&
        depositData.travelDate &&
        new Date(depositData.lastPaymentDate) < new Date(depositData.travelDate);

      setIsValid(
        isTotalSellingPriceValid &&
        isDepositPaidValid &&
        isRepaymentPeriodValid &&
        isProdCostValid &&
        isSurchargeValid &&
        areDatesValid
      );
      setErrorMessage(
        !areDatesValid && depositData.lastPaymentDate && depositData.travelDate
          ? 'Last Payment Date must be before Travel Date'
          : !isTotalSellingPriceValid
          ? 'Total Selling Price must be greater than 0'
          : !isRepaymentPeriodValid
          ? 'Repayment Period must be greater than 0'
          : !isProdCostValid
          ? 'Production Cost must be non-negative'
          : ''
      );
    }

    setDepositData(prev => ({
      ...prev,
      profit: profit !== '' && !isNaN(profit) ? profit : prev.profit,
      balance: balance !== '' && !isNaN(balance) ? balance : prev.balance,
      monthlyInstalment: monthlyInstalment !== '' && !isNaN(monthlyInstalment) ? monthlyInstalment : prev.monthlyInstalment,
      totalTransactionFee: totalTransactionFee !== '' && !isNaN(totalTransactionFee) ? totalTransactionFee : prev.totalTransactionFee,
      totalBalancePayable: totalBalancePayable !== '' && !isNaN(totalBalancePayable) ? totalBalancePayable : prev.totalBalancePayable,
      revenue: revenue !== '' && !isNaN(revenue) ? revenue : prev.revenue
    }));
  }, [
    depositData.period,
    depositData.revenue,
    depositData.prodCost,
    depositData.surcharge,
    depositData.received,
    depositData.lastPaymentDate,
    depositData.travelDate,
    depositData.totalSellingPrice,
    depositData.depositPaid,
    depositData.repaymentPeriod
  ]);

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDepositData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleIntegerChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d+$/.test(value)) {
      setDepositData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDepositData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBreakdownSubmit = (breakdown) => {
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setDepositData(prev => ({
      ...prev,
      prodCost: total.toFixed(2),
      prodCostBreakdown: breakdown
    }));
    setShowCostBreakdown(false);
  };

  const handlePeriodChange = (period) => {
    setDepositData(prev => ({
      ...prev,
      period,
      // Preserve relevant fields when switching periods
      revenue: period === 'within30' ? prev.revenue : '',
      prodCost: prev.prodCost,
      prodCostBreakdown: prev.prodCostBreakdown,
      surcharge: prev.surcharge,
      received: period === 'within30' ? prev.received : '',
      totalSellingPrice: period === 'beyond30' ? prev.totalSellingPrice : '',
      depositPaid: period === 'beyond30' ? prev.depositPaid : '',
      repaymentPeriod: period === 'beyond30' ? prev.repaymentPeriod : '',
      balance: '',
      profit: '',
      monthlyInstalment: '',
      totalTransactionFee: period === 'beyond30' ? prev.totalTransactionFee : '',
      totalBalancePayable: ''
    }));
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const dataToSubmit = {
      revenue: depositData.revenue,
      prodCost: depositData.prodCost,
      prodCostBreakdown: depositData.prodCostBreakdown,
      surcharge: depositData.surcharge,
      received: depositData.received,
      balance: depositData.balance,
      profit: depositData.profit,
      lastPaymentDate: depositData.lastPaymentDate,
      travelDate: depositData.travelDate,
      totalSellingPrice: depositData.totalSellingPrice,
      depositPaid: depositData.depositPaid,
      repaymentPeriod: depositData.repaymentPeriod,
      monthlyInstalment: depositData.monthlyInstalment,
      totalTransactionFee: depositData.totalTransactionFee,
      totalBalancePayable: depositData.totalBalancePayable
    };

    onSubmit(dataToSubmit);
  };

  const handleCancel = () => {
    setDepositData({
      period: 'within30',
      revenue: initialData.revenue || '',
      prodCost: initialData.prodCost || '',
      prodCostBreakdown: initialData.prodCostBreakdown || [],
      surcharge: initialData.surcharge || '',
      received: initialData.received || '',
      balance: '',
      profit: '',
      lastPaymentDate: initialData.lastPaymentDate || '',
      travelDate: initialData.travelDate || '',
      totalSellingPrice: initialData.totalSellingPrice || '',
      depositPaid: initialData.depositPaid || '',
      repaymentPeriod: '',
      monthlyInstalment: '',
      totalTransactionFee: initialData.totalTransactionFee || '',
      totalBalancePayable: ''
    });
    setShowCostBreakdown(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-center">Internal Deposit</h3>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">
            {errorMessage}
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={depositData.period === 'within30'}
              onChange={() => handlePeriodChange('within30')}
              className="mr-2"
            />
            Within 30 Days
          </label>
          <label className="flex items-center mt-2">
            <input
              type="checkbox"
              checked={depositData.period === 'beyond30'}
              onChange={() => handlePeriodChange('beyond30')}
              className="mr-2"
            />
            Beyond 30 Days
          </label>
        </div>

        {depositData.period === 'within30' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Revenue (£)*</label>
              <input
                name="revenue"
                type="number"
                step="0.01"
                value={depositData.revenue}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex">
                <input
                  name="prodCost"
                  type="number"
                  step="0.01"
                  value={depositData.prodCost}
                  className="w-full p-2 bg-gray-200 border rounded"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  className="ml-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showCostBreakdown ? 'Hide' : 'Breakdown'}
                </button>
              </div>
              {depositData.prodCostBreakdown.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {depositData.prodCostBreakdown.map(item => (
                    <span key={item.id} className="mr-2">
                      {item.category}: ${parseFloat(item.amount).toFixed(2)}
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
                className="w-full p-2 bg-gray-200 border rounded"
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
                className="w-full p-2 bg-gray-200 border rounded"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Balance (£)</label>
              <input
                name="balance"
                type="number"
                step="0.01"
                value={depositData.balance}
                className="w-full p-2 bg-gray-200 border rounded"
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
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Last Payment Date*</label>
              <input
                type="date"
                name="lastPaymentDate"
                value={depositData.lastPaymentDate}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Travel Date*</label>
              <input
                type="date"
                name="travelDate"
                value={depositData.travelDate}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>
          </div>
        )}

        {depositData.period === 'beyond30' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Total Selling Price (£)*</label>
              <input
                name="totalSellingPrice"
                type="number"
                step="0.01"
                value={depositData.totalSellingPrice}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Production Cost (£)*</label>
              <div className="flex">
                <input
                  name="prodCost"
                  type="number"
                  step="0.01"
                  value={depositData.prodCost}
                  className="w-full p-2 bg-gray-200 border rounded"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  className="ml-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showCostBreakdown ? 'Hide' : 'Breakdown'}
                </button>
              </div>
              {depositData.prodCostBreakdown.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {depositData.prodCostBreakdown.map(item => (
                    <span key={item.id} className="mr-2">
                      {item.category}: ${parseFloat(item.amount).toFixed(2)}
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
                className="w-full p-2 bg-gray-200 border rounded"
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
                className="w-full p-2 bg-gray-200 border rounded"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Repayment Period (months)*</label>
              <input
                name="repaymentPeriod"
                type="number"
                value={depositData.repaymentPeriod}
                onChange={handleIntegerChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Balance After Deposit (£)</label>
              <input
                name="balance"
                type="number"
                step="0.01"
                value={depositData.balance}
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Monthly Instalment (£)</label>
              <input
                name="monthlyInstalment"
                type="number"
                step="0.01"
                value={depositData.monthlyInstalment}
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Total Transaction Fee (£)</label>
              <input
                name="totalTransactionFee"
                type="number"
                step="0.01"
                value={depositData.totalTransactionFee}
                className="w-full p-2 bg-gray-200 border rounded"
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
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Last Payment Date*</label>
              <input
                type="date"
                name="lastPaymentDate"
                value={depositData.lastPaymentDate}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Travel Date*</label>
              <input
                type="date"
                name="travelDate"
                value={depositData.travelDate}
                onChange={handleDateChange}
                className="w-full p-2 bg-gray-200 border rounded"
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
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded text-white transition-colors ${
              isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>

        {showCostBreakdown && (
          <ProductCostBreakdown
            initialBreakdown={depositData.prodCostBreakdown}
            onClose={() => setShowCostBreakdown(false)}
            onSubmit={handleBreakdownSubmit}
            totalCost={parseFloat(depositData.prodCost) || 0}
          />
        )}
      </div>
    </div>
  );
}