import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';

export default function SelectCreditNotesPopup({
  amountToCover,
  availableNotes,
  previouslySelectedNotes,
  onClose,
  onConfirm,
}) {
  const [selectedNotes, setSelectedNotes] = useState({});
  const [totalApplied, setTotalApplied] = useState(0);

  useEffect(() => {
    // Pre-populate selections from previous state
    const initialSelections = {};
    let initialTotal = 0;
    previouslySelectedNotes.forEach(note => {
      initialSelections[note.id] = note.amountToUse;
      initialTotal += note.amountToUse;
    });
    setSelectedNotes(initialSelections);
    setTotalApplied(initialTotal);
  }, [previouslySelectedNotes]);

  const handleSelectionChange = (noteId, amountStr) => {
    const amount = parseFloat(amountStr) || 0;
    const note = availableNotes.find(n => n.id === noteId);

    // Validate input: cannot be more than available or more than needed
    const remainingToCover = amountToCover - (totalApplied - (selectedNotes[noteId] || 0));
    const maxCanApply = Math.min(note.remainingAmount, remainingToCover);
    
    const validatedAmount = Math.max(0, Math.min(amount, maxCanApply));

    setSelectedNotes(prev => ({
      ...prev,
      [noteId]: validatedAmount,
    }));
  };

  const handleCheckboxChange = (noteId, isChecked) => {
    if (isChecked) {
        const note = availableNotes.find(n => n.id === noteId);
        const remainingToCover = amountToCover - totalApplied;
        const amountToApply = Math.min(note.remainingAmount, remainingToCover);
        setSelectedNotes(prev => ({ ...prev, [noteId]: amountToApply }));
    } else {
        setSelectedNotes(prev => {
            const newSelections = { ...prev };
            delete newSelections[noteId];
            return newSelections;
        });
    }
  };


  useEffect(() => {
    // Recalculate total applied whenever selections change
    const newTotal = Object.values(selectedNotes).reduce((sum, val) => sum + val, 0);
    setTotalApplied(newTotal);
  }, [selectedNotes]);

  const handleConfirm = () => {
    const finalSelection = Object.entries(selectedNotes)
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => ({
        id: parseInt(id, 10),
        amountToUse: amount,
      }));
    onConfirm(finalSelection);
    onClose();
  };
  
  const isFullyCovered = Math.abs(totalApplied - amountToCover) < 0.01;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Select Credit Notes to Apply</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FaTimes size={20} /></button>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4">
            <div className="flex justify-between items-center font-medium">
                <span className="text-gray-700">Amount to Cover:</span>
                <span className="text-xl text-blue-800">£{amountToCover.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 font-medium">
                <span className="text-gray-700">Total Applied:</span>
                <span className={`text-xl ${isFullyCovered ? 'text-green-600' : 'text-red-600'}`}>
                    £{totalApplied.toFixed(2)}
                </span>
            </div>
             {!isFullyCovered && (
                <div className="text-right text-red-600 text-sm mt-1">
                    Remaining: £{(amountToCover - totalApplied).toFixed(2)}
                </div>
            )}
        </div>

        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
          {availableNotes.length > 0 ? availableNotes.map(note => (
            <div key={note.id} className="border p-3 rounded-lg flex items-center gap-4 bg-gray-50">
              <input
                type="checkbox"
                className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                checked={!!selectedNotes[note.id]}
                onChange={e => handleCheckboxChange(note.id, e.target.checked)}
                disabled={totalApplied >= amountToCover && !selectedNotes[note.id]}
              />
              <div className="flex-grow">
                <p className="font-semibold text-gray-800">ID: {note.id} - Avail: £{note.remainingAmount.toFixed(2)}</p>
                <p className="text-xs text-gray-500">From Ref: {note.generatedFromCancellation?.originalBooking?.refNo || 'N/A'}</p>
              </div>
              <div className="flex items-center">
                 <span className="mr-1 text-gray-600">£</span>
                 <input
                    type="number"
                    step="0.01"
                    className="w-28 p-2 border rounded-lg"
                    value={selectedNotes[note.id] || '0'}
                    onChange={e => handleSelectionChange(note.id, e.target.value)}
                    disabled={!selectedNotes[note.id]}
                 />
              </div>
            </div>
          )) : <p className="text-center text-gray-500">No available credit notes for this supplier.</p>}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!isFullyCovered}
            className="px-6 py-2 rounded-lg text-white flex items-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
          >
            <FaCheckCircle className="mr-2"/> Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}