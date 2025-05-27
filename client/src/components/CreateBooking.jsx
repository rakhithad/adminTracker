import { useState, useEffect } from 'react';
import { createPendingBooking } from '../api/api';
import ProductCostBreakdown from './ProductCostBreakdown';
import InternalDepositPopup from './InternalDepositPopup';

export default function CreateBooking({ onBookingCreated }) {
  const [formData, setFormData] = useState({
    refNo: '',
    paxName: '',
    agentName: '',
    teamName: '',
    pnr: '',
    airline: '',
    fromTo: '',
    bookingType: 'FRESH',
    bookingStatus: 'PENDING',
    pcDate: new Date().toISOString().split('T')[0],
    issuedDate: '',
    paymentMethod: 'FULL',
    lastPaymentDate: '',
    supplier: '',
    travelDate: '',
    revenue: '',
    prodCost: '',
    prodCostBreakdown: [],
    transFee: '',
    surcharge: '',
    received: '',
    balance: '',
    profit: '',
    invoiced: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showInternalDeposit, setShowInternalDeposit] = useState(false);

  useEffect(() => {
    const revenue = parseFloat(formData.revenue) || 0;
    const prodCost = parseFloat(formData.prodCost) || 0;
    const transFee = parseFloat(formData.transFee) || 0;
    const surcharge = parseFloat(formData.surcharge) || 0;
    const received = parseFloat(formData.received) || 0;

    const profit = revenue - prodCost - transFee - surcharge;
    const balance = revenue - received;

    setFormData(prev => ({
      ...prev,
      profit: profit !== 0 ? profit.toFixed(2) : prev.profit,
      balance: balance !== 0 ? balance.toFixed(2) : prev.balance
    }));
  }, [formData.revenue, formData.prodCost, formData.transFee, formData.surcharge, formData.received]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'paymentMethod' && value !== 'INTERNAL') {
      setShowInternalDeposit(false);
    }
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || !isNaN(parseFloat(value))) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleBreakdownSubmit = (breakdown) => {
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setFormData(prev => ({
      ...prev,
      prodCost: total.toFixed(2),
      prodCostBreakdown: breakdown
    }));
  };

  const handleInternalDepositSubmit = (depositData) => {
    setFormData(prev => ({
      ...prev,
      revenue: depositData.revenue || depositData.totalSellingPrice || '',
      prodCost: depositData.prodCost || '',
      prodCostBreakdown: depositData.prodCostBreakdown || [],
      surcharge: depositData.surcharge || '',
      received: depositData.depositPaid || depositData.received || '',
      transFee: depositData.totalTransactionFee || '',
      balance: depositData.balance || '',
      profit: depositData.profit || '',
      lastPaymentDate: depositData.lastPaymentDate || '',
      travelDate: depositData.travelDate || ''
    }));
    setShowInternalDeposit(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const requiredFields = ['refNo', 'paxName', 'agentName', 'teamName', 'pnr', 'airline', 'fromTo', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'supplier', 'travelDate'];
      const missingFields = requiredFields.filter(field => !formData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
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
        bookingStatus: formData.bookingStatus,
        pcDate: formData.pcDate,
        issuedDate: formData.issuedDate || null,
        paymentMethod: formData.paymentMethod,
        lastPaymentDate: formData.lastPaymentDate || null,
        supplier: formData.supplier || null,
        travelDate: formData.travelDate || null,
        revenue: formData.revenue ? parseFloat(formData.revenue) : null,
        prodCost: formData.prodCost ? parseFloat(formData.prodCost) : null,
        prodCostBreakdown: formData.prodCostBreakdown,
        transFee: formData.transFee ? parseFloat(formData.transFee) : null,
        surcharge: formData.surcharge ? parseFloat(formData.surcharge) : null,
        received: formData.received ? parseFloat(formData.received) : null,
        balance: formData.balance ? parseFloat(formData.balance) : null,
        profit: formData.profit ? parseFloat(formData.profit) : null,
        invoiced: formData.invoiced,
        status: 'PENDING'
      };

      const response = await createPendingBooking(bookingData);
      const newPendingBooking = response.data.data;

      setSuccessMessage('Booking submitted for admin approval!');
      if (onBookingCreated) {
        onBookingCreated(newPendingBooking);
      }

      setFormData({
        refNo: '',
        paxName: '',
        agentName: '',
        teamName: '',
        pnr: '',
        airline: '',
        fromTo: '',
        bookingType: 'FRESH',
        bookingStatus: 'PENDING',
        pcDate: new Date().toISOString().split('T')[0],
        issuedDate: '',
        paymentMethod: 'FULL',
        lastPaymentDate: '',
        supplier: '',
        travelDate: '',
        revenue: '',
        prodCost: '',
        prodCostBreakdown: [],
        transFee: '',
        surcharge: '',
        received: '',
        balance: '',
        profit: '',
        invoiced: ''
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
    <div className="bg-gray-100 p-6 rounded-lg shadow h-full">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Create New Booking</h3>
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {errorMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Reference No*</label>
            <input
              name="refNo"
              type="text"
              value={formData.refNo}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Passenger Name*</label>
            <input
              name="paxName"
              type="text"
              value={formData.paxName}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Agent Name*</label>
            <input
              name="agentName"
              type="text"
              value={formData.agentName}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Team*</label>
            <select
              name="teamName"
              value={formData.teamName}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            >
              <option value="">SELECT TEAM</option>
              <option value="PH">PH</option>
              <option value="TOURS">TOURS</option>
            </select>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">PNR*</label>
            <input
              name="pnr"
              type="text"
              value={formData.pnr}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Airline*</label>
            <input
              name="airline"
              type="text"
              value={formData.airline}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">From/To*</label>
            <input
              name="fromTo"
              type="text"
              placeholder="e.g., NYC-LON"
              value={formData.fromTo}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Booking Type*</label>
            <select
              name="bookingType"
              value={formData.bookingType}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            >
              <option value="FRESH">FRESH</option>
              <option value="DATE_CHANGE">DATE_CHANGE</option>
              <option value="CANCELLATION">CANCELLATION</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Travel Date*</label>
            <input
              type="date"
              name="travelDate"
              value={formData.travelDate}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Payment Method*</label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={(e) => {
                handleChange(e);
                if (e.target.value === 'INTERNAL') {
                  setShowInternalDeposit(true);
                }
              }}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            >
              <option value="FULL">FULL</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="REFUND">REFUND</option>
              <option value="FULL_HUMM">FULL_HUMM</option>
              <option value="INTERNAL_HUMM">INTERNAL_HUMM</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Booking Status</label>
            <select
              name="bookingStatus"
              value={formData.bookingStatus}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">PC Date*</label>
            <input
              type="date"
              name="pcDate"
              value={formData.pcDate}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Last Payment Date</label>
            <input
              type="date"
              name="lastPaymentDate"
              value={formData.lastPaymentDate}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
            />
          </div>
        </div>
        <div className="md:col-span-3 border-t pt-4 mt-4">
          <h4 className="text-lg font-semibold mb-3">Financial Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-1">Supplier*</label>
              <select
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              >
                <option value="">SELECT SUPPLIER</option>
                <option value="BTRES">BTRES</option>
                <option value="LYCA">LYCA</option>
                <option value="CEBU">CEBU</option>
                <option value="BTRES_LYCA">BTRES_LYCA</option>
                <option value="BA">BA</option>
                <option value="TRAINLINE">TRAINLINE</option>
                <option value="EASYJET">EASYJET</option>
                <option value="FLYDUBAI">FLYDUBAI</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Issued Date*</label>
              <input
                type="date"
                name="issuedDate"
                value={formData.issuedDate}
                onChange={handleChange}
                className="w-full p-2 bg-gray-200 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Revenue (£)</label>
              <input
                name="revenue"
                type="number"
                step="0.01"
                value={formData.revenue}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-200 border rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Production Cost (£)</label>
              <div className="flex">
                <input
                  name="prodCost"
                  type="number"
                  step="0.01"
                  value={formData.prodCost}
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
              {formData.prodCostBreakdown.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {formData.prodCostBreakdown.map(item => (
                    <span key={item.id} className="mr-2">
                      {item.category}: £{parseFloat(item.amount).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Transaction Fee (£)</label>
              <input
                name="transFee"
                type="number"
                step="0.01"
                value={formData.transFee}
                onChange={handleNumberChange}
                className="w-full p-2 bg-gray-200 border rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Surcharge (£)</label>
              <input
                name="surcharge"
                type="number"
                step="0.01"
                value={formData.surcharge}
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
                value={formData.received}
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
                value={formData.balance}
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
                value={formData.profit}
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Invoiced</label>
              <input
                name="invoiced"
                type="text"
                value={formData.invoiced}
                onChange={handleChange}
                className="w-full p-2 bg-gray-200 border rounded"
              />
            </div>
          </div>
        </div>
        <div className="md:col-span-3 mt-4">
          <button
            type="submit"
            className={`py-2 px-6 rounded text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Booking'}
          </button>
        </div>
      </form>
      {showCostBreakdown && (
        <ProductCostBreakdown
          initialBreakdown={formData.prodCostBreakdown}
          onClose={() => setShowCostBreakdown(false)}
          onSubmit={handleBreakdownSubmit}
          totalCost={parseFloat(formData.prodCost) || 0}
        />
      )}
      {showInternalDeposit && (
        <InternalDepositPopup
          initialData={{
            revenue: formData.revenue,
            prodCost: formData.prodCost,
            prodCostBreakdown: formData.prodCostBreakdown,
            surcharge: formData.surcharge,
            received: formData.received,
            lastPaymentDate: formData.lastPaymentDate,
            travelDate: formData.travelDate,
            totalSellingPrice: formData.revenue,
            depositPaid: formData.received,
            totalTransactionFee: formData.transFee
          }}
          onClose={() => setShowInternalDeposit(false)}
          onSubmit={handleInternalDepositSubmit}
        />
      )}
    </div>
  );
}