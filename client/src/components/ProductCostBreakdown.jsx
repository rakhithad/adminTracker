import { useState, useEffect } from 'react';

export default function ProductCostBreakdown({ initialBreakdown, onClose, onSubmit, totalCost }) {
  const suppliersList = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];

  const [breakdown, setBreakdown] = useState(
    initialBreakdown.length > 0
      ? initialBreakdown.map(item => ({
          ...item,
          suppliers: item.suppliers || [{ supplier: '', amount: '' }],
        }))
      : [
          { id: 1, category: 'Flight', amount: '', suppliers: [{ supplier: '', amount: '' }] },
          { id: 2, category: 'Hotels', amount: '', suppliers: [{ supplier: '', amount: '' }] },
          { id: 3, category: 'Cruise', amount: '', suppliers: [{ supplier: '', amount: '' }] },
        ]
  );

  const [nextId, setNextId] = useState(Math.max(...initialBreakdown.map(item => item.id || 0), 3) + 1);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const isValidBreakdown = breakdown.every(item => {
      const amount = parseFloat(item.amount) || 0;
      if (amount <= 0) return false;
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      return Math.abs(amount - supplierTotal) < 0.01 && item.suppliers.every(s => s.supplier && parseFloat(s.amount) > 0);
    });
    setIsValid(isValidBreakdown);
    setErrorMessage(
      isValidBreakdown
        ? ''
        : 'Each category must have a positive amount, and supplier amounts must sum to the category total.'
    );
  }, [breakdown]);

  const handleAmountChange = (id, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBreakdown(prev =>
        prev.map(item =>
          item.id === id ? { ...item, amount: value, suppliers: [{ supplier: '', amount: '' }] } : item
        )
      );
    }
  };

  const handleCategoryChange = (id, value) => {
    setBreakdown(prev =>
      prev.map(item => (item.id === id ? { ...item, category: value } : item))
    );
  };

  const handleSupplierChange = (itemId, supplierIndex, field, value) => {
    setBreakdown(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const newSuppliers = [...item.suppliers];
        newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: value };
        return { ...item, suppliers: newSuppliers };
      })
    );
  };

  const addSupplier = (itemId) => {
    setBreakdown(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, suppliers: [...item.suppliers, { supplier: '', amount: '' }] }
          : item
      )
    );
  };

  const removeSupplier = (itemId, supplierIndex) => {
    setBreakdown(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const newSuppliers = item.suppliers.filter((_, index) => index !== supplierIndex);
        return { ...item, suppliers: newSuppliers.length > 0 ? newSuppliers : [{ supplier: '', amount: '' }] };
      })
    );
  };

  const addNewCategory = () => {
    const newId = nextId;
    setBreakdown(prev => [
      ...prev,
      { id: newId, category: '', amount: '', suppliers: [{ supplier: '', amount: '' }] },
    ]);
    setNextId(newId + 1);
  };

  const removeCategory = (id) => {
    if (breakdown.length <= 1) return;
    setBreakdown(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const validBreakdown = breakdown
      .filter(item => item.amount && parseFloat(item.amount) > 0)
      .map(item => ({
        id: item.id,
        category: item.category || 'Other',
        amount: parseFloat(item.amount),
        suppliers: item.suppliers
          .filter(s => s.supplier && parseFloat(s.amount) > 0)
          .map(s => ({
            supplier: s.supplier,
            amount: parseFloat(s.amount),
          })),
      }));

    onSubmit(validBreakdown);
  };

  const calculateTotal = () => {
    return breakdown.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Product Cost Breakdown</h3>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>
        )}

        <div className="space-y-4 mb-4">
          {breakdown.map(item => (
            <div key={item.id} className="border p-4 rounded-lg bg-gray-50">
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={item.category}
                  onChange={e => handleCategoryChange(item.id, e.target.value)}
                  placeholder="Category name"
                  className="flex-1 p-2 border rounded-lg bg-gray-100"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.amount}
                  onChange={e => handleAmountChange(item.id, e.target.value)}
                  placeholder="0.00"
                  className="w-24 p-2 border rounded-lg bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => removeCategory(item.id)}
                  className="p-2 text-red-600 hover:text-red-800"
                  aria-label="Remove category"
                  disabled={breakdown.length <= 1}
                >
                  ×
                </button>
              </div>
              <div className="ml-4 space-y-2">
                <h4 className="text-sm font-medium">Supplier Allocations</h4>
                {item.suppliers.map((s, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <select
                      value={s.supplier}
                      onChange={e => handleSupplierChange(item.id, index, 'supplier', e.target.value)}
                      className="flex-1 p-2 border rounded-lg bg-gray-100"
                    >
                      <option value="">Select Supplier</option>
                      {suppliersList.map(supplier => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.amount}
                      onChange={e => handleSupplierChange(item.id, index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-24 p-2 border rounded-lg bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeSupplier(item.id, index)}
                      className="p-2 text-red-600 hover:text-red-800"
                      aria-label="Remove supplier"
                      disabled={item.suppliers.length <= 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSupplier(item.id)}
                  className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
                >
                  + Add Supplier
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addNewCategory}
          className="w-full px-4 py-2 mb-4 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
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
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg text-white ${
              isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
