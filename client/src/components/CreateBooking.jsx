import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaUserPlus, FaCalculator, FaMoneyBillWave, FaCheckCircle, FaTimesCircle, FaLock } from 'react-icons/fa';
import { createPendingBooking, createDateChangeBooking, getAgentsList } from '../api/api';

import ProductCostBreakdown from './ProductCostBreakdown';
import PaxDetailsPopup from './PaxDetailsPopup';
import ReceivedAmountPopup from './ReceivedAmountPopup';
import InternalPaymentForm from './InternalPaymentForm'; // <-- Make sure to create this new file

// Reusable components (can be moved to a shared file later)
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
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  const getInitialFormData = () => ({
    // Core Fields
    refNo: '', paxName: '', passengers: [], numPax: 1, agentName: '', teamName: '',
    pnr: '', airline: '', fromTo: '', travelDate: '', description: '',
    pcDate: new Date().toISOString().split('T')[0],
    issuedDate: new Date().toISOString().split('T')[0], // <-- ADDED THIS LINE
    
    // Financial Fields (for all workflows)
    revenue: '', prodCost: '', prodCostBreakdown: [], surcharge: '', received: '',
    transactionMethod: '', receivedDate: new Date().toISOString().split('T')[0],
    profit: '', balance: '',
    
    // -- Internal/Instalment Specific Fields --
    period: 'within30days',
    customInstalments: [],
    totalSellingPrice: '',
    depositPaid: '',
    repaymentPeriod: '',
    trans_fee: '',
    totalBalancePayable: '',
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

  useEffect(() => {
  const fetchAgents = async () => {
    try {
      // You should create a function in your api.js file for this
      const response = await getAgentsList(); 
      setAgents(response.data); // Assuming your API returns the data in response.data
    } catch (error) {
      console.error("Failed to fetch agents list", error);
      // Optionally set an error message to display to the user
    }
  };

  fetchAgents();
}, []);

  // Corrected Code
useEffect(() => {
    const originalBooking = location.state?.originalBookingForDateChange;
    if (originalBooking) {
      console.log("Date Change mode activated for booking:", originalBooking);
      setOriginalBookingInfo({ id: originalBooking.id, folderNo: originalBooking.folderNo });
      
      // --- THE FIX ---
      // Tell the UI to behave like a 'Full Payment' form.
      setSelectedPaymentMethod('FULL'); 
      
      // Set the form data, pre-filling from the original booking
      // and correctly setting the bookingType property for the back-end.
      setFormData({
        ...getInitialFormData(),
        paxName: originalBooking.paxName,
        passengers: originalBooking.passengers,
        numPax: originalBooking.numPax,
        agentName: originalBooking.agentName,
        teamName: originalBooking.teamName,
        bookingType: 'DATE_CHANGE', // This correctly sets the data property
      });
      
      // Clear the location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
}, [location.state]);


  // Calculation Engine for all workflows
  useEffect(() => {
    let newCalculations = {};
    const prodCostNum = parseFloat(formData.prodCost) || 0;
    const surchargeNum = parseFloat(formData.surcharge) || 0;
    
    if (selectedPaymentMethod === 'FULL') {
        const revenue = parseFloat(formData.revenue) || 0;
        const received = parseFloat(formData.received) || 0;
        newCalculations.profit = (revenue - prodCostNum - surchargeNum).toFixed(2);
        newCalculations.balance = (revenue - received).toFixed(2);
    } else if (selectedPaymentMethod === 'INTERNAL') {
        const { period, customInstalments } = formData;

        if (period === 'within30days') {
            const revenueNum = parseFloat(formData.revenue) || 0;
            const receivedNum = parseFloat(formData.received) || 0;
            newCalculations.profit = (revenueNum - prodCostNum - surchargeNum).toFixed(2);
            newCalculations.balance = (revenueNum - receivedNum).toFixed(2);
        } else if (period === 'beyond30') {
            const FIXED_INTEREST_RATE = 11;
            const MONTHLY_INTEREST_RATE = FIXED_INTEREST_RATE / 100 / 12;

            const price = parseFloat(formData.totalSellingPrice) || 0;
            const deposit = parseFloat(formData.depositPaid) || 0;
            const balanceAfterDeposit = price - deposit;
            
            const today = new Date();
            const lastDate = customInstalments.length > 0 ? new Date(customInstalments.reduce((latest, inst) => new Date(inst.dueDate) > new Date(latest) ? inst.dueDate : latest, customInstalments[0].dueDate)) : today;
            const diffDays = Math.max(0, Math.ceil((lastDate - today) / (1000 * 60 * 60 * 24)));
            const repaymentPeriodMonths = Math.ceil(diffDays / 30);

            const interest = balanceAfterDeposit * MONTHLY_INTEREST_RATE * repaymentPeriodMonths;
            const totalPayable = balanceAfterDeposit + interest;
            const finalRevenue = deposit + totalPayable;
            
            newCalculations = {
                balance: balanceAfterDeposit.toFixed(2),
                repaymentPeriod: repaymentPeriodMonths,
                trans_fee: interest.toFixed(2),
                totalBalancePayable: totalPayable.toFixed(2),
                revenue: finalRevenue.toFixed(2),
                profit: (finalRevenue - prodCostNum - surchargeNum).toFixed(2),
                last_payment_date: lastDate.toISOString().split('T')[0],
            };
        }
    }

    setFormData(prev => ({ ...prev, ...newCalculations }));

  }, [
    selectedPaymentMethod,
    formData.revenue, formData.prodCost, formData.surcharge, formData.received,
    formData.period, formData.totalSellingPrice, formData.depositPaid, formData.customInstalments
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'period') {
      const coreData = { refNo: formData.refNo, paxName: formData.paxName, passengers: formData.passengers, numPax: formData.numPax, agentName: formData.agentName, teamName: formData.teamName, pnr: formData.pnr, airline: formData.airline, fromTo: formData.fromTo };
      setFormData({ ...getInitialFormData(), ...coreData, period: value });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };
  
  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setFormData(getInitialFormData());
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

  const handleBreakdownSubmit = (breakdown) => {
    const total = breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setFormData((prev) => ({ ...prev, prodCost: total.toFixed(2), prodCostBreakdown: breakdown }));
    setShowCostBreakdown(false);
  };
  
  const handlePaxDetailsSubmit = ({ passenger, paxName, numPax }) => {
    setFormData(prev => ({ ...prev, passengers: [passenger], paxName, numPax }));
    setShowPaxDetails(false);
  };

  const handleReceivedAmountSubmit = ({ amount, transactionMethod, receivedDate }) => {
    let fieldToUpdate = 'received';
    if (selectedPaymentMethod === 'INTERNAL' && formData.period === 'beyond30') {
        fieldToUpdate = 'depositPaid';
    }
    setFormData(prev => ({ ...prev, [fieldToUpdate]: amount, transactionMethod, receivedDate }));
    setShowReceivedAmount(false);
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
        };
        
        if (selectedPaymentMethod === 'FULL') {
            const requiredFields = ['refNo', 'paxName', 'agentName', 'pnr', 'travelDate', 'revenue', 'received'];
            const missingFields = requiredFields.filter(f => !formData[f]);
            if(missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);

            bookingData = {
                ...commonFields,
                bookingType: 'FRESH',
                paymentMethod: 'FULL',
                issuedDate: new Date().toISOString().split('T')[0],
                revenue: formData.revenue ? parseFloat(formData.revenue) : null,
                received: formData.received ? parseFloat(formData.received) : null,
                balance: parseFloat(formData.balance),
                transFee: 0,
                instalments: [],
                transactionMethod: formData.transactionMethod,
                receivedDate: formData.receivedDate,
            };
        } else if (selectedPaymentMethod === 'INTERNAL') {
    // --- VALIDATION for INTERNAL (CORRECTED) ---
    const requiredFields = ['refNo', 'paxName', 'agentName', 'pnr', 'travelDate', 'prodCost', 'pcDate', 'issuedDate']; // <-- ADDED DATES
    if(formData.period === 'within30days') requiredFields.push('revenue', 'received');
    else requiredFields.push('totalSellingPrice', 'depositPaid');
    const missingFields = requiredFields.filter(f => !formData[f]);
    if(missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    if(formData.customInstalments.length === 0) throw new Error('At least one instalment is required for Internal payment method.');

    // --- Build INTERNAL data payload (CORRECTED) ---
    bookingData = {
        ...commonFields, // commonFields already includes pcDate
        bookingType: 'FRESH',
        paymentMethod: 'INTERNAL',
        issuedDate: formData.issuedDate, // <-- CORRECTED
        revenue: formData.revenue ? parseFloat(formData.revenue) : null,
        received: (formData.period === 'within30days') ? parseFloat(formData.received) : parseFloat(formData.depositPaid),
        balance: parseFloat(formData.balance),
        transFee: formData.trans_fee ? parseFloat(formData.trans_fee) : 0,
        instalments: formData.customInstalments,
        lastPaymentDate: formData.lastPaymentDate,
        transactionMethod: formData.transactionMethod,
        receivedDate: formData.receivedDate,
    };
} else {
            throw new Error("Invalid payment method selected.");
        }

        if (originalBookingInfo) {
          // This logic would need to be adapted for date changes if they can be internal/full
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

  // Find the full agent object from our state using the selected name
  const selectedAgent = agents.find(agent => agent.fullName === selectedAgentName);

  // Update both the agentName and teamName in the form data
  setFormData(prev => ({
    ...prev,
    agentName: selectedAgentName,
    // If an agent is found, use their team. Otherwise, reset the team field.
    teamName: selectedAgent ? selectedAgent.team : '' 
  }));
};

  const CoreBookingInfo = () => (
    <div className="border-t border-gray-200 pt-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-4">Core Booking Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <FormInput label="Reference No" name="refNo" value={formData.refNo} onChange={handleChange} required/>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lead Passenger <span className="text-red-500">*</span></label>
          <div className="flex items-center">
            <input name="paxName" type="text" value={formData.paxName} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
            <button type="button" onClick={() => setShowPaxDetails(true)} className="ml-2 px-4 h-[42px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center shrink-0 transition"><FaUserPlus /></button>
          </div>
          {formData.passengers.length > 0 && <div className="mt-2 p-2 bg-gray-50 rounded-md border text-xs text-gray-600"><p className="font-semibold">{formData.paxName}</p><p>Total Passengers: {formData.numPax}</p></div>}
          </div>
          <FormSelect 
      label="Agent Name" 
      name="agentName" 
      value={formData.agentName} 
      onChange={handleAgentChange} 
      required
    >
      <option value="">Select an Agent</option>
      {agents.map(agent => (
        <option key={agent.id} value={agent.fullName}>
          {agent.fullName}
        </option>
      ))}
    </FormSelect>
        <FormSelect 
    label="Team" 
    name="teamName" 
    value={formData.teamName} 
    onChange={handleChange} 
    required 
    // Disable this field if an agent's name has been filled in
    disabled={formData.agentName !== ''} 
>
    <option value="">Select Team</option>
    <option value="PH">PH</option>
    <option value="TOURS">TOURS</option>
</FormSelect>
        <FormInput label="PNR" name="pnr" value={formData.pnr} onChange={handleChange} required />
        <FormInput label="Airline" name="airline" value={formData.airline} onChange={handleChange} required  />
        <FormInput label="From/To" name="fromTo" value={formData.fromTo} onChange={handleChange} required />
      </div>
    </div>
  );
  
    return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-1 text-gray-900">{originalBookingInfo ? `Create Date Change for: ${originalBookingInfo.folderNo}` : 'Create New Booking'}</h3>
          <p className="text-gray-500">{originalBookingInfo ? 'Inherited data is locked.' : 'First, select the payment method for the new booking.'}</p>
        </div>
        {!originalBookingInfo && (
            <div className="w-full max-w-xs">
                <FormSelect label="Select Payment Method" name="paymentMethod" value={selectedPaymentMethod} onChange={(e) => handlePaymentMethodSelect(e.target.value)}>
                    <option value="" disabled>-- Choose a method --</option>
                    <option value="FULL">Full Payment</option>
                    <option value="INTERNAL">Internal (Instalments)</option>
                </FormSelect>
            </div>
        )}
      </div>

      {successMessage && <div className="flex items-center mb-6 p-4 bg-green-100 text-green-800 rounded-lg shadow-sm"><FaCheckCircle className="mr-3 h-5 w-5" /><span className="font-medium">{successMessage}</span></div>}
      {errorMessage && <div className="flex items-center mb-6 p-4 bg-red-100 text-red-800 rounded-lg shadow-sm"><FaTimesCircle className="mr-3 h-5 w-5" /><span className="font-medium">{errorMessage}</span></div>}

      {(selectedPaymentMethod === 'FULL' || originalBookingInfo) && (
        <form onSubmit={handleSubmit} className="space-y-10 animate-fade-in">
          <CoreBookingInfo />
          <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Dates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <FormInput label="Travel Date" name="travelDate" type="date" value={formData.travelDate} onChange={handleChange} required />
                  <FormInput label="PC Date" name="pcDate" type="date" value={formData.pcDate} onChange={handleChange} required />
                  <FormInput label="Issued Date" name="issuedDate" type="date" value={formData.issuedDate} onChange={handleChange} required />
              </div>
          </div>
          <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <FormInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={formData.revenue} onChange={handleNumberChange} required />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Cost (£)</label>
                    <div className="flex items-center">
                      <input name="prodCost" type="number" step="0.01" value={formData.prodCost} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                      <button type="button" onClick={() => setShowCostBreakdown(true)} className="ml-2 px-4 h-[42px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><FaCalculator /></button>
                    </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (£)</label>
                      <div className="flex items-center">
                          <input name="received" type="number" step="0.01" value={formData.received} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" readOnly />
                          <button type="button" onClick={() => setShowReceivedAmount(true)} className="ml-2 px-4 h-[42px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><FaMoneyBillWave /></button>
                      </div>
                  </div>
                  <FormInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={formData.surcharge} onChange={handleNumberChange} />
                  <FormInput label="Profit (£)" name="profit" value={formData.profit} readOnly />
                  <div className="lg:col-span-3">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
                      <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" />
                  </div>
              </div>
          </div>
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">
              {isSubmitting ? 'Submitting...' : 'Submit Booking for Approval'}
            </button>
          </div>
        </form>
      )}

      {selectedPaymentMethod === 'INTERNAL' && !originalBookingInfo && (
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-10">
            <CoreBookingInfo />
            
            {/* --- NEW/CORRECTED DATES SECTION FOR INTERNAL --- */}
            <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Booking Dates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    <FormInput label="Travel Date" name="travelDate" type="date" value={formData.travelDate} onChange={handleChange} required />
                    <FormInput label="PC Date" name="pcDate" type="date" value={formData.pcDate} onChange={handleChange} required />
                    <FormInput label="Issued Date" name="issuedDate" type="date" value={formData.issuedDate} onChange={handleChange} required />
                </div>
            </div>
            
            <InternalPaymentForm
                formData={formData}
                onDataChange={handleChange}
                onNumberChange={handleNumberChange}
                onInstalmentChange={handleCustomInstalmentChange}
                onAddInstalment={addCustomInstalment}
                onRemoveInstalment={removeCustomInstalment}
                onShowCostBreakdown={() => setShowCostBreakdown(true)}
                onShowReceivedAmount={() => setShowReceivedAmount(true)}
            />
            
            <div className="flex justify-end pt-6 border-t border-gray-200">
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">
                    {isSubmitting ? 'Submitting...' : 'Submit Booking for Approval'}
                </button>
            </div>
        </form>
      )}
      
      {showCostBreakdown && <ProductCostBreakdown initialBreakdown={formData.prodCostBreakdown} onClose={() => setShowCostBreakdown(false)} onSubmit={handleBreakdownSubmit} totalCost={parseFloat(formData.prodCost) || 0} />}
      {showPaxDetails && <PaxDetailsPopup initialData={{ passenger: formData.passengers[0], numPax: formData.numPax }} onClose={() => setShowPaxDetails(false)} onSubmit={handlePaxDetailsSubmit} />}
      {showReceivedAmount && <ReceivedAmountPopup initialData={{ amount: selectedPaymentMethod === 'INTERNAL' && formData.period === 'beyond30' ? formData.depositPaid : formData.received, transactionMethod: formData.transactionMethod, receivedDate: formData.receivedDate, }} onClose={() => setShowReceivedAmount(false)} onSubmit={handleReceivedAmountSubmit} />}
    </div>
  );
}