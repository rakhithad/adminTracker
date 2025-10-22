import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaUserPlus, FaCalculator, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { createPendingBooking, createDateChangeBooking, getAgentsList } from '../api/api';

import PaxDetailsPopup from './PaxDetailsPopup';
import ReceivedAmountPopup from './ReceivedAmountPopup';
import SimpleCostPopup from './SimpleCostPopup';

// --- COLOR PALETTE (from your brand) ---
const COLORS = {
  primaryBlue: '#2D3E50', // Dark blue from logo text
  secondaryBlue: '#0A738A', // Teal/water color from logo
  accentYellow: '#F2C144', // Sun/light from logo
  accentOrange: '#F08A4B', // Sunset orange from logo
  accentRed: '#E05B5B', // Deeper red from logo sunset
  lightGray: '#F9FAFB', // Lighter background for the page
  mediumGray: '#EDF2F7', // Dividers
  darkGrayText: '#374151', // General dark text
  successGreen: '#10B981',
  errorRed: '#EF4444',
};

// FormInput and FormSelect components - (Unchanged)
const FormInput = ({ label, name, required = false, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium" style={{ color: COLORS.darkGrayText, marginBottom: '0.25rem' }}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out ${props.readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      style={{
        borderColor: '#D1D5DB', 
        '--tw-ring-color': COLORS.secondaryBlue, 
      }}
    />
  </div>
);

const FormSelect = ({ label, name, required = false, children, ...props }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium" style={{ color: COLORS.darkGrayText, marginBottom: '0.25rem' }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out bg-white"
        style={{
          borderColor: '#D1D5DB',
          '--tw-ring-color': COLORS.secondaryBlue,
        }}
      >
        {children}
      </select>
    </div>
);

// Styled Initial Payments Display component (Unchanged)
const StyledInitialPaymentsDisplay = ({ payments, totalReceived, onRemovePayment, onAddPaymentClick }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="block text-sm font-medium" style={{ color: COLORS.darkGrayText }}>Payments Received</label>
      <button 
        type="button" 
        onClick={onAddPaymentClick} 
        className="px-3 py-1 text-xs rounded-md transition text-white"
        style={{ backgroundColor: COLORS.secondaryBlue, '&:hover': { backgroundColor: '#075F70' } }}
      >
        + Add
      </button>
    </div>
    <div className="rounded-lg p-3 border h-full" style={{ backgroundColor: COLORS.lightGray, borderColor: '#D1D5DB' }}>
      {payments.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">No payments added.</p>
      )}
      <ul className="space-y-2">
        {payments.map((p, index) => (
          <li key={index} className="flex justify-between items-center text-sm">
            <span className="font-medium" style={{ color: COLORS.darkGrayText }}>£{parseFloat(p.amount).toFixed(2)}</span>
            <span className="text-gray-500 text-xs truncate max-w-[120px]">{p.transactionMethod} ({p.receivedDate})</span>
            <button type="button" onClick={() => onRemovePayment(index)} className="text-red-500 hover:text-red-700 ml-2 shrink-0">
              <FaTimesCircle size={14} />
            </button>
          </li>
        ))}
      </ul>
      {payments.length > 0 && (
        <div className="border-t mt-3 pt-2" style={{ borderColor: '#D1D5DB' }}>
          <div className="flex justify-between items-center text-sm font-bold" style={{ color: COLORS.darkGrayText }}>
            <span>Total Received:</span>
            <span>£{totalReceived}</span>
          </div>
        </div>
      )}
    </div>
  </div>
);


export default function CreateBooking({ onBookingCreated }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  const getInitialFormData = () => ({
    refNo: '', paxName: '', passengers: [], numPax: 1, agentName: '', teamName: '',
    pnr: '', airline: '', fromTo: '', travelDate: '', description: '',
    pcDate: new Date().toISOString().split('T')[0],
    issuedDate: '',
    revenue: '', prodCost: '', prodCostBreakdown: [], surcharge: '',
    profit: '', balance: '',
    initialPayments: [],
    received: '',
    customInstalments: [],
    totalSellingPrice: '',
    trans_fee: '',
    lastPaymentDate: '',
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [originalBookingInfo, setOriginalBookingInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showPaxDetails, setShowPaxDetails] = useState(false);
  const [showReceivedAmount, setShowReceivedAmount] = useState(false);
  const [agents, setAgents] = useState([]);

  // All useEffect and handler functions (fetchAgents, handleChange, handleSubmit, etc.) remain unchanged...
  // ... (omitting all the handler functions for brevity, they are identical to the previous version) ...
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await getAgentsList();
        setAgents(response.data);
      } catch (error) {
        console.error("Failed to fetch agents list", error);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const originalBooking = location.state?.originalBookingForDateChange;
    if (originalBooking) {
      setOriginalBookingInfo({ id: originalBooking.id, folderNo: originalBooking.folderNo });
      setFormData({
        ...getInitialFormData(),
        paxName: originalBooking.paxName,
        passengers: originalBooking.passengers,
        numPax: originalBooking.numPax,
        agentName: originalBooking.agentName,
        teamName: originalBooking.teamName,
        bookingType: 'DATE_CHANGE',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const totalReceived = formData.initialPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const prodCostNum = parseFloat(formData.prodCost) || 0;
    const surchargeNum = parseFloat(formData.surcharge) || 0;
    let newCalculations = { received: totalReceived.toFixed(2) };

    if (selectedPaymentMethod === 'FULL') {
        const revenueNum = parseFloat(formData.revenue) || 0;
        newCalculations.profit = (revenueNum - prodCostNum - surchargeNum).toFixed(2);
        newCalculations.balance = (revenueNum - totalReceived).toFixed(2);
    } else if (selectedPaymentMethod === 'INTERNAL') {
        const sellingPriceNum = parseFloat(formData.totalSellingPrice) || 0;
        const balanceAfterDeposit = sellingPriceNum - totalReceived;
        const lastDate = formData.customInstalments.length > 0
            ? new Date(formData.customInstalments.reduce((latest, inst) => new Date(inst.dueDate) > new Date(latest) ? inst.dueDate : latest, formData.customInstalments[0].dueDate))
            : null;
        
        newCalculations = {
            ...newCalculations,
            revenue: sellingPriceNum.toFixed(2),
            balance: balanceAfterDeposit.toFixed(2),
            profit: (sellingPriceNum - prodCostNum - surchargeNum).toFixed(2),
            lastPaymentDate: lastDate ? lastDate.toISOString().split('T')[0] : '', 
        };
    }
    setFormData(prev => ({ ...prev, ...newCalculations }));
  }, [selectedPaymentMethod, formData.initialPayments, formData.revenue, formData.prodCost, formData.surcharge, formData.totalSellingPrice, formData.customInstalments]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    if (!originalBookingInfo) {
      const coreInfo = {
        refNo: formData.refNo,
        paxName: formData.paxName,
        passengers: formData.passengers,
        numPax: formData.numPax,
        agentName: formData.agentName,
        teamName: formData.teamName,
        pnr: formData.pnr,
        airline: formData.airline,
        fromTo: formData.fromTo,
        travelDate: formData.travelDate,
        pcDate: formData.pcDate
      };
      setFormData({ ...getInitialFormData(), ...coreInfo });
    }
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomInstalmentChange = (index, field, value) => {
    const updatedInstalments = [...formData.customInstalments];
    updatedInstalments[index] = { ...updatedInstalments[index], [field]: value };
    setFormData((prev) => ({ ...prev, customInstalments: updatedInstalments }));
  };

  const addCustomInstalment = () => {
    const today = new Date();
    const defaultDueDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      customInstalments: [...prev.customInstalments, { dueDate: defaultDueDate, amount: '', status: 'PENDING' }],
    }));
  };

  const removeCustomInstalment = (index) => {
    setFormData(prev => ({
      ...prev,
      customInstalments: prev.customInstalments.filter((_, i) => i !== index),
    }));
  };

  const handleDistributeBalance = () => {
    const { balance, customInstalments } = formData;
    if (customInstalments.length === 0 || !balance) return;
    const balanceNum = parseFloat(balance);
    if (balanceNum <= 0) return;
    const numInstalments = customInstalments.length;
    const distributedAmount = (balanceNum / numInstalments).toFixed(2);
    const newInstalments = customInstalments.map(instalment => ({ ...instalment, amount: distributedAmount }));
    setFormData(prev => ({ ...prev, customInstalments: newInstalments }));
  };

  const handleBreakdownSubmit = (simpleBreakdown) => {
    const total = simpleBreakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setFormData((prev) => ({ ...prev, prodCost: total.toFixed(2), prodCostBreakdown: simpleBreakdown }));
    setShowCostBreakdown(false);
  };

  const handlePaxDetailsSubmit = ({ passenger, paxName, numPax }) => {
    setFormData(prev => ({ ...prev, passengers: [passenger], paxName, numPax }));
    setShowPaxDetails(false);
  };

  const handleAddPayment = ({ amount, transactionMethod, receivedDate }) => {
    const newPayment = { amount, transactionMethod, receivedDate };
    setFormData(prev => ({ ...prev, initialPayments: [...prev.initialPayments, newPayment] }));
    setShowReceivedAmount(false);
  };

  const handleRemovePayment = (indexToRemove) => {
    setFormData(prev => ({ ...prev, initialPayments: prev.initialPayments.filter((_, index) => index !== indexToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
        let bookingData = {};
        const commonFields = {
            ref_no: formData.refNo, pax_name: formData.paxName, agent_name: formData.agentName, team_name: formData.teamName,
            pnr: formData.pnr, airline: formData.airline, from_to: formData.fromTo, pcDate: formData.pcDate,
            travelDate: formData.travelDate, description: formData.description, numPax: formData.numPax,
            passengers: formData.passengers, prodCostBreakdown: formData.prodCostBreakdown,
            prodCost: formData.prodCost ? parseFloat(formData.prodCost) : null,
            surcharge: formData.surcharge ? parseFloat(formData.surcharge) : null,
            profit: formData.profit ? parseFloat(formData.profit) : null,
            issuedDate: formData.issuedDate ? formData.issuedDate : null, 
        };

        if (selectedPaymentMethod === 'FULL') {
            const requiredFields = ['refNo', 'paxName', 'agentName', 'pnr', 'travelDate', 'revenue']; 
            const missingFields = requiredFields.filter(f => !formData[f]);
            if(missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            if(formData.initialPayments.length === 0) throw new Error('At least one payment must be added.');

            bookingData = {
                ...commonFields, bookingType: 'FRESH', paymentMethod: selectedPaymentMethod,
                revenue: formData.revenue ? parseFloat(formData.revenue) : null,
                balance: parseFloat(formData.balance), initialPayments: formData.initialPayments, instalments: [],
            };
        } else if (selectedPaymentMethod === 'INTERNAL') {
            const requiredFields = ['refNo', 'paxName', 'agentName', 'pnr', 'travelDate', 'prodCost', 'totalSellingPrice'];
            const missingFields = requiredFields.filter(f => !formData[f]);
            if(missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            if(formData.customInstalments.length === 0) throw new Error('At least one instalment is required for this payment method.');

            bookingData = {
                ...commonFields, bookingType: 'FRESH', paymentMethod: selectedPaymentMethod,
                revenue: formData.totalSellingPrice ? parseFloat(formData.totalSellingPrice) : null,
                received: parseFloat(formData.received), balance: parseFloat(formData.balance),
                transFee: formData.trans_fee ? parseFloat(formData.trans_fee) : 0,
                instalments: formData.customInstalments, lastPaymentDate: formData.lastPaymentDate, initialPayments: formData.initialPayments,
            };
        } else {
            throw new Error("Invalid payment method selected.");
        }

        if (originalBookingInfo) {
          await createDateChangeBooking(originalBookingInfo.id, bookingData);
          setSuccessMessage('Date change booking created successfully!');
          setTimeout(() => navigate('/bookings'), 2000);
        } else {
          const response = await createPendingBooking(bookingData);
          if (onBookingCreated) {
            onBookingCreated(response.data.data);
          }
          setSuccessMessage('Booking submitted for admin approval!');
          setFormData(getInitialFormData());
          setSelectedPaymentMethod('');
        }
    } catch (error) {
      console.error('Booking submission error:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to submit booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgentChange = (e) => {
    const selectedAgentName = e.target.value;
    const selectedAgent = agents.find(agent => agent.fullName === selectedAgentName);
    setFormData(prev => ({ ...prev, agentName: selectedAgentName, teamName: selectedAgent ? selectedAgent.team : '' }));
  };

  // --- UPDATED: CoreBookingInfo no longer has card styles ---
  const CoreBookingInfo = () => (
    <div>
      <h4 className="text-lg font-semibold mb-6 border-b pb-3" style={{ color: COLORS.primaryBlue, borderColor: COLORS.mediumGray }}>
        Core Booking Information
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <FormInput label="Reference No" name="refNo" value={formData.refNo} onChange={handleChange} required/>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGrayText }}>Lead Passenger <span className="text-red-500">*</span></label>
          <div className="flex items-center">
            <input name="paxName" type="text" value={formData.paxName} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
            <button type="button" onClick={() => setShowPaxDetails(true)} className="ml-2 px-4 h-[42px] text-white rounded-lg flex items-center justify-center shrink-0 transition" style={{ backgroundColor: COLORS.secondaryBlue, '&:hover': { backgroundColor: '#075F70' } }}><FaUserPlus /></button>
          </div>
          {formData.passengers.length > 0 && <div className="mt-2 p-2 rounded-md border text-xs" style={{ backgroundColor: COLORS.lightGray, borderColor: COLORS.mediumGray, color: COLORS.darkGrayText }}><p className="font-semibold">{formData.paxName}</p><p>Total Passengers: {formData.numPax}</p></div>}
        </div>
        <FormSelect label="Agent Name" name="agentName" value={formData.agentName} onChange={handleAgentChange} required>
          <option value="">Select an Agent</option>
          {agents.map(agent => ( <option key={agent.id} value={agent.fullName}>{agent.fullName}</option> ))}
        </FormSelect>
        <FormSelect label="Team" name="teamName" value={formData.teamName} onChange={handleChange} required disabled={formData.agentName !== ''}>
            <option value="">Select Team</option> <option value="PH">PH</option> <option value="TOURS">TOURS</option>
        </FormSelect>
        <FormInput label="PNR" name="pnr" value={formData.pnr} onChange={handleChange} required />
        <FormInput label="Airline" name="airline" value={formData.airline} onChange={handleChange} required  />
        <FormInput label="From/To" name="fromTo" value={formData.fromTo} onChange={handleChange} required />
      </div>
    </div>
  );

  return (
    // --- UPDATED: Main wrapper is now the single white surface ---
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-1" style={{ color: COLORS.primaryBlue }}>{originalBookingInfo ? `Create Date Change for: ${originalBookingInfo.folderNo}` : 'Create New Booking'}</h3>
        <p className="text-gray-500">
          {originalBookingInfo ? 'Select the payment method for the new charges.' : 'First, select the payment method for the new booking.'}
        </p>
      </div>

      {/* Segmented Button Toggle (Unchanged) */}
      <div className="flex justify-center mb-8 p-1 rounded-lg" style={{ backgroundColor: COLORS.mediumGray }}>
        <button
          type="button"
          onClick={() => handlePaymentMethodSelect('FULL')}
          className={`w-1/2 px-4 py-2 rounded-md font-semibold text-sm transition-all ${selectedPaymentMethod === 'FULL' ? 'shadow' : 'hover:text-gray-800'}`}
          style={{ 
            backgroundColor: selectedPaymentMethod === 'FULL' ? 'white' : 'transparent',
            color: selectedPaymentMethod === 'FULL' ? COLORS.secondaryBlue : COLORS.darkGrayText,
          }}
        >
          Full Payment
        </button>
        <button
          type="button"
          onClick={() => handlePaymentMethodSelect('INTERNAL')}
          className={`w-1/2 px-4 py-2 rounded-md font-semibold text-sm transition-all ${selectedPaymentMethod === 'INTERNAL' ? 'shadow' : 'hover:text-gray-800'}`}
          style={{ 
            backgroundColor: selectedPaymentMethod === 'INTERNAL' ? 'white' : 'transparent',
            color: selectedPaymentMethod === 'INTERNAL' ? COLORS.secondaryBlue : COLORS.darkGrayText,
          }}
        >
          Internal (Instalments)
        </button>
      </div>

      {successMessage && <div className="flex items-center mb-6 p-4 rounded-lg shadow-sm" style={{ backgroundColor: `${COLORS.successGreen}1A`, color: COLORS.successGreen }}><FaCheckCircle className="mr-3 h-5 w-5" /><span className="font-medium">{successMessage}</span></div>}
      {errorMessage && <div className="flex items-center mb-6 p-4 rounded-lg shadow-sm" style={{ backgroundColor: `${COLORS.errorRed}1A`, color: COLORS.errorRed }}><FaTimesCircle className="mr-3 h-5 w-5" /><span className="font-medium">{errorMessage}</span></div>}

      {(selectedPaymentMethod === 'FULL') && (
        // --- UPDATED: Form now uses space-y-8 and divs with border-t ---
        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
          <CoreBookingInfo />
          
          <div className="border-t pt-8" style={{ borderColor: COLORS.mediumGray }}>
            <h4 className="text-lg font-semibold mb-6 border-b pb-3" style={{ color: COLORS.primaryBlue, borderColor: COLORS.mediumGray }}>
              Booking Dates
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <FormInput label="Travel Date" name="travelDate" type="date" value={formData.travelDate} onChange={handleChange} required />
                <FormInput label="PC Date" name="pcDate" type="date" value={formData.pcDate} onChange={handleChange} required />
            </div>
          </div>

          <div className="border-t pt-8" style={{ borderColor: COLORS.mediumGray }}>
            <h4 className="text-lg font-semibold mb-6 border-b pb-3" style={{ color: COLORS.primaryBlue, borderColor: COLORS.mediumGray }}>
              Financial Details (Full)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <FormInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={formData.revenue} onChange={handleNumberChange} required />
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGrayText }}>Product Cost (£)</label>
                  <div className="flex items-center">
                    <input name="prodCost" type="number" step="0.01" value={formData.prodCost} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                    <button type="button" onClick={() => setShowCostBreakdown(true)} className="ml-2 px-4 h-[42px] text-white rounded-lg hover:bg-indigo-700" style={{ backgroundColor: COLORS.accentOrange }}><FaCalculator /></button>
                  </div>
                </div>
                
                <StyledInitialPaymentsDisplay 
                  payments={formData.initialPayments} 
                  totalReceived={formData.received} 
                  onRemovePayment={handleRemovePayment} 
                  onAddPaymentClick={() => setShowReceivedAmount(true)}
                />
                
                <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={formData.surcharge} onChange={handleNumberChange} />
                <FormInput label="Profit (£)" name="profit" value={formData.profit} readOnly />
                <FormInput label="Balance (£)" name="balance" value={formData.balance} readOnly />

                <div className="lg:col-span-3">
                    <label htmlFor="description" className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGrayText }}>Description / Notes</label>
                    <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" style={{ borderColor: '#D1D5DB' }} />
                </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t" style={{ borderColor: COLORS.mediumGray }}>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition" style={{ backgroundColor: COLORS.secondaryBlue, '&:hover': { backgroundColor: '#075F70' } }}>
              {isSubmitting ? 'Submitting...' : 'Submit Booking for Approval'}
            </button>
          </div>
        </form>
      )}

      {(selectedPaymentMethod === 'INTERNAL') && (
        // --- UPDATED: Form now uses space-y-8 and divs with border-t ---
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-8">
            <CoreBookingInfo />

            <div className="border-t pt-8" style={{ borderColor: COLORS.mediumGray }}>
              <h4 className="text-lg font-semibold mb-6 border-b pb-3" style={{ color: COLORS.primaryBlue, borderColor: COLORS.mediumGray }}>
                Booking Dates
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <FormInput label="Travel Date" name="travelDate" type="date" value={formData.travelDate} onChange={handleChange} required />
                  <FormInput label="PC Date" name="pcDate" type="date" value={formData.pcDate} onChange={handleChange} required />
              </div>
            </div>
            
            <div className="border-t pt-8 space-y-6" style={{ borderColor: COLORS.mediumGray }}>
              <h4 className="text-lg font-semibold border-b pb-3" style={{ color: COLORS.primaryBlue, borderColor: COLORS.mediumGray }}>
                Financial Details (Internal)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <FormInput label="Total Selling Price (£)" name="totalSellingPrice" type="number" step="0.01" value={formData.totalSellingPrice} onChange={handleNumberChange} required />
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: COLORS.darkGrayText }}>Product Cost (£)</label>
                  <div className="flex items-center">
                    <input name="prodCost" type="number" step="0.01" value={formData.prodCost} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                    <button type="button" onClick={() => setShowCostBreakdown(true)} className="ml-2 px-4 h-[42px] text-white rounded-lg" style={{ backgroundColor: COLORS.accentOrange }}><FaCalculator /></button>
                  </div>
                </div>
                <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={formData.surcharge} onChange={handleNumberChange} />
                <FormInput label="Profit (£)" name="profit" value={formData.profit} readOnly />
                <FormInput label="Transaction Fee (£)" name="trans_fee" type="number" step="0.01" value={formData.trans_fee} onChange={handleNumberChange} />
                
                <StyledInitialPaymentsDisplay 
                  payments={formData.initialPayments} 
                  totalReceived={formData.received} 
                  onRemovePayment={handleRemovePayment} 
                  onAddPaymentClick={() => setShowReceivedAmount(true)}
                />
              </div>
            </div>

            <div className="border-t pt-8 space-y-6" style={{ borderColor: COLORS.mediumGray }}>
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: COLORS.mediumGray }}>
                <h4 className="text-lg font-semibold" style={{ color: COLORS.primaryBlue }}>
                  Payment Instalments
                </h4>
                <button type="button" onClick={addCustomInstalment} className="px-3 py-1 text-sm text-white rounded-md" style={{ backgroundColor: COLORS.secondaryBlue, '&:hover': { backgroundColor: '#075F70' } }}>
                  + Add Instalment
                </button>
              </div>

              <div className="flex flex-wrap justify-between items-center p-3 rounded-lg border" style={{ backgroundColor: COLORS.lightGray, borderColor: COLORS.mediumGray }}>
                <div className="text-sm font-medium mb-2 sm:mb-0" style={{ color: COLORS.darkGrayText }}>
                  Total Balance for Instalments: 
                  <span className="text-lg font-bold ml-2" style={{ color: COLORS.secondaryBlue }}>£{formData.balance || '0.00'}</span>
                </div>
                <button 
                  type="button" 
                  onClick={handleDistributeBalance} 
                  className="px-3 py-1 text-xs text-white rounded-md disabled:bg-gray-300"
                  style={{ backgroundColor: COLORS.primaryBlue, '&:hover': { backgroundColor: '#1A2938' } }}
                  disabled={formData.customInstalments.length === 0 || !formData.balance || parseFloat(formData.balance) <= 0}
                >
                  Distribute Equally
                </button>
              </div>

              <div className="space-y-4">
                {formData.customInstalments.map((inst, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <FormInput label={`Due Date ${index + 1}`} type="date" value={inst.dueDate} onChange={e => handleCustomInstalmentChange(index, 'dueDate', e.target.value)} />
                    <FormInput label={`Amount ${index + 1} (£)`} type="number" step="0.01" value={inst.amount} onChange={e => handleCustomInstalmentChange(index, 'amount', e.target.value)} />
                    <div className="flex items-end h-full">
                      <button type="button" onClick={() => removeCustomInstalment(index)} className="mt-6 px-3 py-2 rounded-lg" style={{ backgroundColor: `${COLORS.accentRed}1A`, color: COLORS.accentRed }}>
                        <FaTimesCircle />
                      </button>
                    </div>
                  </div>
                ))}
                {formData.customInstalments.length === 0 && (
                   <p className="text-sm text-gray-500 text-center py-4">No instalments added. Click '+ Add Instalment' to begin.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t" style={{ borderColor: COLORS.mediumGray }}>
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition" style={{ backgroundColor: COLORS.secondaryBlue, '&:hover': { backgroundColor: '#075F70' } }}>
                    {isSubmitting ? 'Submitting...' : 'Submit Booking for Approval'}
                </button>
            </div>
        </form>
      )}

      {showCostBreakdown && <SimpleCostPopup initialCosts={formData.prodCostBreakdown} onClose={() => setShowCostBreakdown(false)} onSubmit={handleBreakdownSubmit} />}
      {showPaxDetails && <PaxDetailsPopup initialData={{ passenger: formData.passengers[0], numPax: formData.numPax }} onClose={() => setShowPaxDetails(false)} onSubmit={handlePaxDetailsSubmit} />}
      {showReceivedAmount && <ReceivedAmountPopup initialData={{}} onClose={() => setShowReceivedAmount(false)} onSubmit={handleAddPayment} />}
    </div>
  );
}