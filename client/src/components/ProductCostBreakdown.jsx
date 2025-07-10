import { useState, useEffect } from 'react';
import { getAvailableCreditNotes } from '../api/api';

export default function ProductCostBreakdown({ initialBreakdown, onClose, onSubmit, totalCost }) {
  const suppliersList = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
  const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
  const paymentMethods = [
    'BANK_TRANSFER',
    'CREDIT',
    'CREDIT_NOTES',
    'BANK_TRANSFER_AND_CREDIT',
    'BANK_TRANSFER_AND_CREDIT_NOTES',
    'CREDIT_AND_CREDIT_NOTES',
  ];

  const [breakdown, setBreakdown] = useState(
    initialBreakdown.length > 0
      ? initialBreakdown.map((item, index) => ({
          ...item,
          id: item.id || index + 1, // Ensure ID exists for key prop
          suppliers: item.suppliers.map((supplier) => ({
            ...supplier,
            transactionMethod: supplier.transactionMethod || 'LOYDS',
            paymentMethod: supplier.paymentMethod || 'BANK_TRANSFER',
            firstMethodAmount: supplier.firstMethodAmount || '',
            secondMethodAmount: supplier.secondMethodAmount || '',
            paidAmount: supplier.paidAmount || 0,
            pendingAmount: supplier.pendingAmount || 0,
          })),
        }))
      : [
          {
            id: 1,
            category: 'Flight',
            amount: totalCost || 0,
            suppliers: [
              {
                supplier: '',
                amount: totalCost || 0,
                transactionMethod: 'LOYDS',
                paymentMethod: 'BANK_TRANSFER',
                firstMethodAmount: totalCost || '',
                secondMethodAmount: '',
                paidAmount: totalCost || 0,
                pendingAmount: 0,
              },
            ],
          },
        ]
  );

  const [nextId, setNextId] = useState(Math.max(...(initialBreakdown.map((item) => item.id || 0)), 1) + 1);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // NEW STATE for available credit notes
  const [availableNotes, setAvailableNotes] = useState({});

  // NEW FUNCTION to fetch credit notes
  const fetchCreditNotes = async (itemId, supplierIndex, supplierName) => {
    const key = `${itemId}-${supplierIndex}`;
    if (!supplierName) {
      setAvailableNotes(prev => ({ ...prev, [key]: [] }));
      return;
    }
    try {
      const response = await getAvailableCreditNotes(supplierName);
      setAvailableNotes(prev => ({ ...prev, [key]: response.data.data || [] }));
    } catch (error) {
      console.error("Failed to fetch credit notes for", supplierName, error);
      setAvailableNotes(prev => ({ ...prev, [key]: [] }));
    }
  };

  useEffect(() => {
    // Initial fetch for any pre-existing credit note selections on component mount
    breakdown.forEach(item => {
        item.suppliers.forEach((supplier, index) => {
            if (supplier.paymentMethod === 'CREDIT_NOTES' && supplier.supplier) {
                fetchCreditNotes(item.id, index, supplier.supplier);
            }
        });
    });
  }, []); // Run only once

  useEffect(() => {
    const isValidBreakdown = breakdown.every((item) => {
      const itemAmount = parseFloat(item.amount) || 0;
      if (itemAmount <= 0) return false;
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      return (
        Math.abs(itemAmount - supplierTotal) < 0.01 &&
        item.suppliers.every((s) => {
          const supplierAmount = parseFloat(s.amount) || 0;
          if (!s.supplier || supplierAmount <= 0 || !transactionMethods.includes(s.transactionMethod)) return false;
          if (!paymentMethods.includes(s.paymentMethod)) return false;
          // New validation for credit notes
          if (s.paymentMethod === 'CREDIT_NOTES' && !s.creditNoteId) return false;
          if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(s.paymentMethod)) {
            const firstAmount = parseFloat(s.firstMethodAmount) || 0;
            const secondAmount = parseFloat(s.secondMethodAmount) || 0;
            return firstAmount > 0 && secondAmount > 0 && Math.abs(firstAmount + secondAmount - supplierAmount) < 0.01;
          }
          return (parseFloat(s.firstMethodAmount) || 0) === supplierAmount;
        })
      );
    });
    setIsValid(isValidBreakdown);
    setErrorMessage(isValidBreakdown ? '' : 'Each category/supplier must have a positive amount, sums must match, and credit notes must be selected if chosen.');
  }, [breakdown]);

  const handleCategoryChange = (id, value) => {
    setBreakdown((prev) => prev.map((item) => (item.id === id ? { ...item, category: value } : item)));
  };

  const handleSupplierChange = (itemId, supplierIndex, field, value) => {
    // Special handling for creditNoteId to not trigger a full re-render logic
    if (field === 'creditNoteId') {
      setBreakdown(prev =>
        prev.map(item => {
          if (item.id !== itemId) return item;
          const newSuppliers = [...item.suppliers];
          newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: value };
          return { ...item, suppliers: newSuppliers };
        })
      );
      return;
    }

    setBreakdown((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        
        let newSuppliers = [...item.suppliers];
        const oldSupplierState = newSuppliers[supplierIndex];
        newSuppliers[supplierIndex] = { ...oldSupplierState, [field]: value };
        
        const supplier = newSuppliers[supplierIndex];

        // LOGIC TO FETCH NOTES WHEN SUPPLIER OR METHOD CHANGES
        if (field === 'supplier' || field === 'paymentMethod') {
            if (supplier.paymentMethod === 'CREDIT_NOTES' && supplier.supplier) {
                fetchCreditNotes(itemId, supplierIndex, supplier.supplier);
            } else {
                const key = `${itemId}-${supplierIndex}`;
                setAvailableNotes(prevNotes => ({...prevNotes, [key]: []}));
                newSuppliers[supplierIndex].creditNoteId = ''; // Clear selection
            }
        }
        
        // Refactored amount update logic
        const updateAmounts = (supplierToUpdate) => {
             if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(supplierToUpdate.paymentMethod)) {
                const firstAmount = parseFloat(supplierToUpdate.firstMethodAmount) || 0;
                const secondAmount = parseFloat(supplierToUpdate.secondMethodAmount) || 0;
                supplierToUpdate.amount = (firstAmount + secondAmount).toFixed(2);
                const firstMethod = supplierToUpdate.paymentMethod.split('_AND_')[0];
                const secondMethod = supplierToUpdate.paymentMethod.split('_AND_')[1];
                const isFirstPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(firstMethod);
                const isSecondPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(secondMethod);
                supplierToUpdate.paidAmount = ((isFirstPaid ? firstAmount : 0) + (isSecondPaid ? secondAmount : 0)).toFixed(2);
                supplierToUpdate.pendingAmount = ((isFirstPaid ? 0 : firstAmount) + (isSecondPaid ? 0 : secondAmount)).toFixed(2);
            } else {
                const firstAmount = parseFloat(supplierToUpdate.firstMethodAmount) || 0;
                supplierToUpdate.amount = firstAmount.toFixed(2);
                const isPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(supplierToUpdate.paymentMethod);
                supplierToUpdate.paidAmount = (isPaid ? firstAmount : 0).toFixed(2);
                supplierToUpdate.pendingAmount = (isPaid ? 0 : firstAmount).toFixed(2);
            }
        };

        if (['firstMethodAmount', 'secondMethodAmount'].includes(field)) {
             if (value === '' || /^\d*\.?\d*$/.test(value)) {
                updateAmounts(supplier);
             } else {
                return item;
             }
        }
        
        if (field === 'paymentMethod') {
            const supplierAmount = parseFloat(supplier.amount) || 0;
            if (['BANK_TRANSFER', 'CREDIT_NOTES'].includes(value)) {
                supplier.paidAmount = supplierAmount.toFixed(2);
                supplier.pendingAmount = '0.00';
                supplier.firstMethodAmount = supplierAmount.toFixed(2);
                supplier.secondMethodAmount = '';
            } else if (value === 'CREDIT') {
                supplier.paidAmount = '0.00';
                supplier.pendingAmount = supplierAmount.toFixed(2);
                supplier.firstMethodAmount = supplierAmount.toFixed(2);
                supplier.secondMethodAmount = '';
            }
        }
        
        const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        return { ...item, amount: newItemAmount.toFixed(2), suppliers: newSuppliers };
      })
    );
  };

  const addSupplier = (itemId) => {
    setBreakdown((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              suppliers: [
                ...item.suppliers,
                {
                  supplier: '',
                  amount: 0,
                  transactionMethod: 'LOYDS',
                  paymentMethod: 'BANK_TRANSFER',
                  firstMethodAmount: '',
                  secondMethodAmount: '',
                  paidAmount: 0,
                  pendingAmount: 0,
                },
              ],
            }
          : item
      )
    );
  };

  const removeSupplier = (itemId, supplierIndex) => {
    setBreakdown((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newSuppliers = item.suppliers.filter((_, index) => index !== supplierIndex);
        const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        return {
          ...item,
          amount: newItemAmount.toFixed(2),
          suppliers: newSuppliers.length > 0
            ? newSuppliers
            : [
                {
                  supplier: '',
                  amount: 0,
                  transactionMethod: 'LOYDS',
                  paymentMethod: 'BANK_TRANSFER',
                  firstMethodAmount: '',
                  secondMethodAmount: '',
                  paidAmount: 0,
                  pendingAmount: 0,
                },
              ],
        };
      })
    );
  };

  const addNewCategory = () => {
    const newId = nextId;
    setBreakdown((prev) => [
      ...prev,
      {
        id: newId,
        category: '',
        amount: 0,
        suppliers: [
          {
            supplier: '',
            amount: 0,
            transactionMethod: 'LOYDS',
            paymentMethod: 'BANK_TRANSFER',
            firstMethodAmount: '',
            secondMethodAmount: '',
            paidAmount: 0,
            pendingAmount: 0,
          },
        ],
      },
    ]);
    setNextId(newId + 1);
  };

  const removeCategory = (id) => {
    if (breakdown.length <= 1) return;
    setBreakdown((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = () => {
    // Re-validate before submitting
    const validationErrors = [];
    breakdown.forEach((item) => {
      // ... (your existing validation logic from the original handleSubmit can go here)
      item.suppliers.forEach((s) => {
        if (s.paymentMethod === 'CREDIT_NOTES' && !s.creditNoteId) {
          validationErrors.push(`A credit note must be selected for supplier ${s.supplier}.`);
        }
      });
    });

    if (validationErrors.length > 0) {
      setErrorMessage(validationErrors.join(' '));
      setIsValid(false);
      return;
    }

    const validBreakdown = breakdown
      .filter((item) => item.amount && parseFloat(item.amount) > 0)
      .map((item) => ({
        id: item.id,
        category: item.category || 'Other',
        amount: parseFloat(item.amount),
        suppliers: item.suppliers
          .filter((s) => s.supplier && parseFloat(s.amount) > 0)
          .map((s) => ({
            supplier: s.supplier,
            amount: parseFloat(s.amount),
            transactionMethod: s.transactionMethod,
            paymentMethod: s.paymentMethod,
            paidAmount: parseFloat(s.paidAmount) || 0,
            pendingAmount: parseFloat(s.pendingAmount) || 0,
            firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
            secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
            creditNoteId: s.creditNoteId || undefined,
          })),
      }));

    onSubmit(validBreakdown);
  };

  const calculateTotal = () => {
    return breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl shadow-xl overflow-y-auto max-h-[90vh]">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Product Cost Breakdown</h3>

        {errorMessage && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>}

        <div className="space-y-4 mb-4">
          {breakdown.map((item) => (
            <div key={item.id} className="border p-4 rounded-lg bg-gray-50">
              <div className="flex items-center space-x-2 mb-2">
                <input type="text" value={item.category} onChange={(e) => handleCategoryChange(item.id, e.target.value)} placeholder="Category name" className="flex-1 p-2 border rounded-lg bg-white" />
                <span className="px-3 py-2 bg-gray-200 rounded-lg w-28 text-center">
                  £{parseFloat(item.amount || 0).toFixed(2)}
                </span>
                <button type="button" onClick={() => removeCategory(item.id)} className="p-2 text-red-600 hover:text-red-800" aria-label="Remove category" disabled={breakdown.length <= 1}>×</button>
              </div>
              <div className="ml-4 space-y-2">
                <h4 className="text-sm font-medium">Supplier Allocations</h4>
                {item.suppliers.map((s, index) => {
                  const creditNoteOptions = availableNotes[`${item.id}-${index}`] || [];
                  return (
                  <div key={index} className="border-t pt-3 mt-2 space-y-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                      <select value={s.supplier} onChange={(e) => handleSupplierChange(item.id, index, 'supplier', e.target.value)} className="p-2 border rounded-lg bg-white min-w-[120px] flex-grow">
                        <option value="">Select Supplier</option>
                        {suppliersList.map((sup) => (<option key={sup} value={sup}>{sup}</option>))}
                      </select>
                      <input type="text" value={`£${parseFloat(s.amount || 0).toFixed(2)}`} readOnly className="p-2 bg-gray-200 rounded-lg w-28 text-center" />
                      <select value={s.transactionMethod} onChange={(e) => handleSupplierChange(item.id, index, 'transactionMethod', e.target.value)} className="p-2 border rounded-lg bg-white min-w-[120px]">
                        <option value="">Method</option>
                        {transactionMethods.map((m) => (<option key={m} value={m}>{m.replace('_', ' ')}</option>))}
                      </select>
                      <select value={s.paymentMethod} onChange={(e) => handleSupplierChange(item.id, index, 'paymentMethod', e.target.value)} className="p-2 border rounded-lg bg-white min-w-[150px] flex-grow">
                        <option value="">Payment</option>
                        {paymentMethods.map((m) => (<option key={m} value={m}>{m.replace('_AND_', ' + ').replace('_', ' ')}</option>))}
                      </select>
                      {['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(s.paymentMethod) ? (
                        <>
                          <input type="text" inputMode="decimal" value={s.firstMethodAmount} onChange={(e) => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder={`${s.paymentMethod.split('_AND_')[0].replace('_', ' ')} £`} className="w-32 p-2 border rounded-lg bg-white"/>
                          <input type="text" inputMode="decimal" value={s.secondMethodAmount} onChange={(e) => handleSupplierChange(item.id, index, 'secondMethodAmount', e.target.value)} placeholder={`${s.paymentMethod.split('_AND_')[1].replace('_', ' ')} £`} className="w-32 p-2 border rounded-lg bg-white"/>
                        </>
                      ) : (
                        <input type="text" inputMode="decimal" value={s.firstMethodAmount} onChange={(e) => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder="Amount £" className="w-28 p-2 border rounded-lg bg-white"/>
                      )}
                      <button type="button" onClick={() => removeSupplier(item.id, index)} className="p-2 text-red-600 hover:text-red-800" disabled={item.suppliers.length <= 1}>×</button>
                    </div>

                    {s.paymentMethod === 'CREDIT_NOTES' && (
                        <div className="pl-4 mt-2">
                            <label className="block text-sm font-medium text-gray-600">Available Credit Notes for {s.supplier}</label>
                            <select required value={s.creditNoteId || ''} onChange={(e) => handleSupplierChange(item.id, index, 'creditNoteId', e.target.value)} className="w-full p-2 border rounded-lg bg-white shadow-sm">
                                <option value="" disabled>-- Select a Credit Note --</option>
                                {creditNoteOptions.map(note => (
                                    <option key={note.id} value={note.id}>
                                        ID: {note.id} - Remaining: £{note.remainingAmount.toFixed(2)} (Created: {new Date(note.createdAt).toLocaleDateString('en-GB')})
                                    </option>
                                ))}
                            </select>
                            {creditNoteOptions.length === 0 && <p className="text-xs text-red-500 mt-1">No available credit notes for this supplier.</p>}
                        </div>
                    )}
                  </div>
                  );
                })}
                <button type="button" onClick={() => addSupplier(item.id)} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">+ Add Supplier</button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addNewCategory} className="w-full px-4 py-2 mb-4 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors">
          <span className="mr-1">+</span> Add Category
        </button>

        <div className="mb-4 p-3 bg-gray-100 rounded-lg">
          <div className="flex justify-between">
            <span className="font-medium">Breakdown Total:</span>
            <span className="font-medium">£{total.toFixed(2)}</span>
          </div>
          {totalCost > 0 && (
            <div className="flex justify-between mt-1">
              <span>Product Cost:</span>
              <span>£{totalCost.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
            Close
          </button>
          <button type="button" onClick={handleSubmit} disabled={!isValid} className={`px-4 py-2 rounded-lg text-white ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}