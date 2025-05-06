import { useState, useEffect } from 'react';

export default function ProductCostBreakdown({ initialBreakdown, onClose, onSubmit, totalCost }) {
  const [breakdown, setBreakdown] = useState(
    initialBreakdown.length > 0
      ? initialBreakdown
      : [
          { id: 1, category: 'Flight', amount: '' },
          { id: 2, category: 'Hotels', amount: '' },
          { id: 3, category: 'Cruise', amount: '' }
        ]
  );

  const [nextId, setNextId] = useState(Math.max(...initialBreakdown.map(item => item.id || 0), 3) + 1);
  const [isValid, setIsValid] = useState(true); // Start as valid

  // Calculate totals and validate whenever breakdown changes
  useEffect(() => {
    const total = calculateTotal();
    setIsValid(total > 0);
  }, [breakdown]);

  const handleAmountChange = (id, value) => {
    // Only allow numbers and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBreakdown(prev => prev.map(item =>
        item.id === id ? { ...item, amount: value } : item
      ));
    }
  };

  const handleCategoryChange = (id, value) => {
    setBreakdown(prev => prev.map(item =>
      item.id === id ? { ...item, category: value } : item
    ));
  };

  const addNewCategory = () => {
    const newId = nextId;
    setBreakdown(prev => [...prev, { id: newId, category: '', amount: '' }]);
    setNextId(newId + 1);
  };

  const removeCategory = (id) => {
    if (breakdown.length <= 1) return; // Always keep at least one category
    setBreakdown(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    const validBreakdown = breakdown
      .filter(item => item.amount && parseFloat(item.amount) > 0)
      .map(item => ({
        id: item.id,
        category: item.category || 'Other',
        amount: parseFloat(item.amount)
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
    <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Product Cost Breakdown</h3>

        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-2">
          {breakdown.map((item) => (
            <div key={item.id} className="flex items-center space-x-2">
              <div className="p-2 border rounded flex-1 bg-gray-50">
                <input
                  type="text"
                  value={item.category}
                  onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                  placeholder="Category name"
                  className="w-full bg-transparent outline-none"
                />
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={item.amount}
                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                placeholder="0.00"
                className="p-2 border rounded w-24"
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
          ))}
        </div>

        <button
          type="button"
          onClick={addNewCategory}
          className="w-full px-4 py-2 mb-4 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <span className="mr-1">+</span> Add Category
        </button>

        <div className="mb-4 p-3 bg-gray-100 rounded">
          <div className="flex justify-between">
            <span className="font-medium">Breakdown Total:</span>
            <span className="font-medium">${total.toFixed(2)}</span>
          </div>
          {totalCost > 0 && (
            <div className="flex justify-between mt-1">
              <span>Product Cost:</span>
              <span>${totalCost.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded text-white transition-colors ${
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