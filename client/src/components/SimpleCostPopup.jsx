import { useState, useMemo } from 'react';

const categoryOptions = ['Flight', 'Hotels', 'Cruise', 'Transfers', 'Other'];

export default function SimpleCostPopup({ initialCosts, onClose, onSubmit }) {
  const getInitialState = () => {
    if (initialCosts && initialCosts.length > 0) {
      return initialCosts.map((item, index) => ({ ...item, key: index + 1 }));
    }
    return [{ key: 1, category: 'Flight', amount: '' }];
  };

  const [costs, setCosts] = useState(getInitialState);
  const [nextKey, setNextKey] = useState(Math.max(...costs.map(c => c.key)) + 1);

  const totalCost = useMemo(() => {
    return costs.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [costs]);

  const handleChange = (key, field, value) => {
    setCosts(prev =>
      prev.map(item => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const handleAddRow = () => {
    setCosts(prev => [...prev, { key: nextKey, category: 'Flight', amount: '' }]);
    setNextKey(prev => prev + 1);
  };

  const handleRemoveRow = (key) => {
    if (costs.length <= 1) return;
    setCosts(prev => prev.filter(item => item.key !== key));
  };

  const handleSubmit = () => {
    // This is the corrected section. We explicitly remove the 'key'
    // which is clearer and avoids the linting warning.
    const finalCosts = costs.map(item => {
        // Updated destructuring to avoid linting errors if 'key' is not used
        const {  ...rest } = item; // Destructure to separate the key
        return rest; // Return only the rest of the properties
    });
    onSubmit(finalCosts);
  };

  return (
    // CHANGED: Using bg-black/50 for 50% opacity.
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">Enter Product Costs</h3>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {/* This is the corrected map function */}
          {costs.map((item) => (
            <div key={item.key} className="flex items-center space-x-2">
              <select
                value={item.category}
                onChange={e => handleChange(item.key, 'category', e.target.value)}
                className="flex-1 p-2 border rounded-lg bg-white"
              >
                {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={item.amount}
                onChange={e => handleChange(item.key, 'amount', e.target.value)}
                className="w-32 p-2 border rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={() => handleRemoveRow(item.key)}
                className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-300"
                disabled={costs.length <= 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="w-full mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
        >
          + Add Another Category
        </button>
        <div className="flex justify-end font-bold text-lg p-2 mt-4 bg-gray-100 rounded-md">
          Total Cost: £{totalCost.toFixed(2)}
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg text-white bg-green-600">Confirm Costs</button>
        </div>
      </div>
    </div>
  );
}