import { useState, useEffect } from 'react';
import { createPendingBooking } from '../api/api';
import ProductCostBreakdown from './ProductCostBreakdown';
import InternalDepositPopup from './InternalDepositPopup';
import PaxDetailsPopup from './PaxDetailsPopup';

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
    invoiced: '',
    instalments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showInternalDeposit, setShowInternalDeposit] = useState(false);
  const [showPaxDetails, setShowPaxDetails] = useState(false);

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
        'supplier',
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

      // Validate prodCostBreakdown
      if (formData.prodCostBreakdown.length > 0) {
        const validPaymentMethods = ['credit', 'full', 'custom'];
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
              isNaN(parseFloat(s.amount)) ||
              parseFloat(s.amount) <= 0 ||
              !validPaymentMethods.includes(s.paymentMethod)
            ) {
              throw new Error('Each supplier must have a valid supplier, positive amount, and valid payment method');
            }
            if (s.paymentMethod === 'custom') {
              if (
                isNaN(parseFloat(s.paidAmount)) ||
                parseFloat(s.paidAmount) <= 0 ||
                parseFloat(s.paidAmount) >= parseFloat(s.amount)
              ) {
                throw new Error(`Custom payment for supplier ${s.supplier} must have a valid paid amount (0 < paidAmount < amount)`);
              }
              if (isNaN(parseFloat(s.pendingAmount)) || parseFloat(s.pendingAmount) !== parseFloat(s.amount) - parseFloat(s.paidAmount)) {
                throw new Error(`Pending amount for supplier ${s.supplier} must equal amount - paidAmount`);
              }
            } else if (s.paymentMethod === 'credit') {
              if (parseFloat(s.paidAmount) !== 0 || parseFloat(s.pendingAmount) !== parseFloat(s.amount)) {
                throw new Error(`Credit payment for supplier ${s.supplier} must have paidAmount = 0 and pendingAmount = amount`);
              }
            } else if (s.paymentMethod === 'full') {
              if (parseFloat(s.paidAmount) !== parseFloat(s.amount) || parseFloat(s.pendingAmount) !== 0) {
                throw new Error(`Full payment for supplier ${s.supplier} must have paidAmount = amount and pendingAmount = 0`);
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
        status: 'PENDING',
        instalments: formData.instalments,
        passengers: formData.passengers,
        numPax: formData.numPax,
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
        invoiced: '',
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
    <div className="bg-gray-100 p-6 rounded-lg shadow h-full">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Create New Booking</h3>
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">{successMessage}</div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{errorMessage}</div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Reference No*</label>
            <input
              name="refNo"
              type="text"
              placeholder="e.g., IBE13260992"
              value={formData.refNo}
              onChange={handleChange}
              className="w-full p-2 bg-gray-200 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Passenger Name*</label>
            <div className="flex">
              <input
                name="paxName"
                type="text"
                value={formData.paxName}
                className="w-full p-2 bg-gray-200 border rounded"
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowPaxDetails(true)}
                className="ml-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Input
              </button>
            </div>
            {formData.passengers.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {formData.passengers.map((pax, index) => (
                  <div key={index}>
                    {pax.title}. {pax.lastName}/{pax.middleName ? pax.middleName + ' ' : ''}{pax.firstName} ({pax.category})
                  </div>
                ))}
                <div>Total Passengers: {formData.numPax}</div>
              </div>
            )}
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
              placeholder="e.g., JJ55WW"
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
              placeholder="e.g., QR"
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
              <label className="block text-gray-700 mb-1">Product Cost (£)</label>
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
                  {formData.prodCostBreakdown.map((item) => (
                    <div key={item.id} className="mb-2">
                      <span className="font-medium">{item.category}: £{parseFloat(item.amount).toFixed(2)}</span>
                      <div className="ml-4">
                        {item.suppliers.map((supplier, index) => (
                          <div key={index}>
                            {supplier.supplier}: £{parseFloat(supplier.amount).toFixed(2)} (
                            {supplier.paymentMethod === 'full'
                              ? 'Paid in Full'
                              : supplier.paymentMethod === 'credit'
                              ? 'On Credit'
                              : `Custom - Paid: £${parseFloat(supplier.paidAmount).toFixed(2)}, Pending: £${parseFloat(
                                  supplier.pendingAmount
                                ).toFixed(2)}`})
                          </div>
                        ))}
                      </div>
                    </div>
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
            {formData.instalments.length > 0 && (
              <div>
                <label className="block text-gray-700 mb-1">Instalments</label>
                <div className="mt-2 text-sm text-gray-600">
                  {formData.instalments.map((inst, index) => (
                    <div key={index} className="mb-1">
                      <span>
                        Due: {new Date(inst.dueDate).toLocaleDateString()} - £
                        {parseFloat(inst.amount).toFixed(2)} ({inst.status})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="md:col-span-3 mt-4">
          <button
            type="submit"
            className={`py-2 px-6 rounded text-white ${
              isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
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
            prod_cost: formData.prodCost,
            costItems: formData.prodCostBreakdown,
            surcharge: formData.surcharge,
            received: formData.received,
            last_payment_date: formData.lastPaymentDate,
            travel_date: formData.travelDate,
            totalSellingPrice: formData.revenue,
            depositPaid: formData.received,
            trans_fee: formData.transFee,
          }}
          onClose={() => setShowInternalDeposit(false)}
          onSubmit={handleInternalDepositSubmit}
        />
      )}
      {showPaxDetails && (
        <PaxDetailsPopup
          initialData={{ passenger: formData.passengers[0], numPax: formData.numPax }}
          onClose={() => setShowPaxDetails(false)}
          onSubmit={handlePaxDetailsSubmit}
        />
      )}
    </div>
  );
}