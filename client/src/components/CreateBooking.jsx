import { useState } from 'react';
import { createBooking } from '../api/api';

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
    revenue: '',
    prodCost: '',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? null : parseFloat(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      
      const bookingData = {
        ref_no: formData.refNo,
        pax_name: formData.paxName,
        agent_name: formData.agentName,
        team_name: formData.teamName || null, 
        pnr: formData.pnr,
        airline: formData.airline,
        from_to: formData.fromTo,
        bookingType: formData.bookingType,
        bookingStatus: formData.bookingStatus || 'PENDING',
        pcDate: formData.pcDate,
        issuedDate: formData.issuedDate ? new Date(formData.issuedDate) : null,
        paymentMethod: formData.paymentMethod,
        lastPaymentDate: formData.lastPaymentDate ? new Date(formData.lastPaymentDate) : null,
        revenue: formData.revenue,
        prodCost: formData.prodCost,
        transFee: formData.transFee,
        surcharge: formData.surcharge,
        received: formData.received,
        balance: formData.balance,
        profit: formData.profit,
        invoiced: formData.invoiced

      };

      const response = await createBooking(bookingData);
      const newBooking = response.data.data;
      
      setSuccessMessage('Booking created successfully!');
      onBookingCreated(newBooking);
      
      // Reset form
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
        lastPaymentDate: ''

      });
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Booking creation error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-200 p-6 rounded-lg shadow">
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
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-gray-700 mb-1">Reference No*</label>
          <input 
            name="refNo" 
            type="text" 
            value={formData.refNo} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Team Name</label>
          <input 
            name="teamName" 
            type="text" 
            value={formData.teamName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">PNR*</label>
          <input 
            name="pnr" 
            type="text" 
            value={formData.pnr} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-gray-700 mb-1">From/To*</label>
          <input 
            name="fromTo" 
            type="text" 
            placeholder="e.g., NYC-LON"
            value={formData.fromTo} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Booking Type*</label>
          <select
            name="bookingType"
            value={formData.bookingType}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="FRESH">FRESH</option>
            <option value="DATE_CHANGE">DATE_CHANGE</option>
            <option value="CANCELLATION">CANCELLATION</option>
          </select>
        </div>


        <div>
          <label className="block text-gray-700 mb-1">Payment Method*</label>
          <select
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleChange}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
          >
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
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
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Issued Date*</label>
          <input
            type="date"
            name="issuedDate"
            value={formData.issuedDate}
            onChange={handleChange}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="md:col-span-2 border-t pt-4 mt-4">
  <h4 className="text-lg font-semibold mb-3">Financial Information</h4>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-gray-700 mb-1">Revenue</label>
      <input
        name="revenue"
        type="number"
        step="0.01"
        value={formData.revenue ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Production Cost</label>
      <input
        name="prodCost"
        type="number"
        step="0.01"
        value={formData.prodCost ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Transaction Fee</label>
      <input
        name="transFee"
        type="number"
        step="0.01"
        value={formData.transFee ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Surcharge</label>
      <input
        name="surcharge"
        type="number"
        step="0.01"
        value={formData.surcharge ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Amount Received</label>
      <input
        name="received"
        type="number"
        step="0.01"
        value={formData.received ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Balance</label>
      <input
        name="balance"
        type="number"
        step="0.01"
        value={formData.balance ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Profit</label>
      <input
        name="profit"
        type="number"
        step="0.01"
        value={formData.profit ?? ''}
        onChange={handleNumberChange}
        className="w-full p-2 border rounded"
      />
    </div>

    <div>
      <label className="block text-gray-700 mb-1">Invoice Number</label>
      <input
        name="invoiced"
        type="text"
        value={formData.invoiced ?? ''}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />
    </div>
  </div>
</div>

        <div className="md:col-span-2">
          <button 
            type="submit" 
            className={`py-2 px-4 rounded text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}