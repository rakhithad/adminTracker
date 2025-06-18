
import { useState, useEffect } from 'react';

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
      ? initialBreakdown.map((item) => ({
          ...item,
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

  const [nextId, setNextId] = useState(Math.max(...initialBreakdown.map((item) => item.id || 0), 1) + 1);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
          if (
            ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              s.paymentMethod
            )
          ) {
            const firstAmount = parseFloat(s.firstMethodAmount) || 0;
            const secondAmount = parseFloat(s.secondMethodAmount) || 0;
            return firstAmount >= 0 && secondAmount >= 0 && Math.abs(firstAmount + secondAmount - supplierAmount) < 0.01;
          }
          return (parseFloat(s.firstMethodAmount) || 0) === supplierAmount;
        })
      );
    });
    setIsValid(isValidBreakdown);
    setErrorMessage(
      isValidBreakdown
        ? ''
        : 'Each category must have a positive amount, supplier amounts must sum to the category total, and payment amounts must match supplier totals.'
    );
  }, [breakdown]);

  const handleCategoryChange = (id, value) => {
    setBreakdown((prev) => prev.map((item) => (item.id === id ? { ...item, category: value } : item)));
  };

  const handleSupplierChange = (itemId, supplierIndex, field, value) => {
    // Allow decimal inputs for amount fields
    if (['firstMethodAmount', 'secondMethodAmount'].includes(field)) {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setBreakdown((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const newSuppliers = [...item.suppliers];
            newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: value };
            const supplier = newSuppliers[supplierIndex];
            const firstAmount = parseFloat(supplier.firstMethodAmount) || 0;
            const secondAmount = parseFloat(supplier.secondMethodAmount) || 0;
            // Update supplier amount
            supplier.amount = ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              supplier.paymentMethod
            )
              ? (firstAmount + secondAmount).toFixed(2)
              : firstAmount.toFixed(2);
            // Update paid/pending amounts
            if (
              ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
                supplier.paymentMethod
              )
            ) {
              const firstMethod = supplier.paymentMethod.split('_AND_')[0].toUpperCase();
              const secondMethod = supplier.paymentMethod.split('_AND_')[1].toUpperCase();
              const isFirstPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(firstMethod);
              const isSecondPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(secondMethod);
              supplier.paidAmount = (
                (isFirstPaid ? firstAmount : 0) + (isSecondPaid ? secondAmount : 0)
              ).toFixed(2);
              supplier.pendingAmount = (
                (isFirstPaid ? 0 : firstAmount) + (isSecondPaid ? 0 : secondAmount)
              ).toFixed(2);
            } else {
              const isPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(supplier.paymentMethod);
              supplier.paidAmount = (isPaid ? firstAmount : 0).toFixed(2);
              supplier.pendingAmount = (isPaid ? 0 : firstAmount).toFixed(2);
            }
            // Update category amount
            const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
            return { ...item, amount: newItemAmount.toFixed(2), suppliers: newSuppliers };
          })
        );
      }
      return;
    }

    setBreakdown((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newSuppliers = [...item.suppliers];
        newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: value };
        // Update paid/pending amounts when paymentMethod changes
        if (field === 'paymentMethod') {
          const supplier = newSuppliers[supplierIndex];
          const supplierAmount = parseFloat(supplier.amount) || 0;
          if (['BANK_TRANSFER', 'CREDIT_NOTES'].includes(supplier.paymentMethod)) {
            supplier.firstMethodAmount = supplierAmount.toFixed(2);
            supplier.secondMethodAmount = '';
            supplier.paidAmount = supplierAmount.toFixed(2);
            supplier.pendingAmount = '0.00';
          } else if (supplier.paymentMethod === 'CREDIT') {
            supplier.firstMethodAmount = supplierAmount.toFixed(2);
            supplier.secondMethodAmount = '';
            supplier.paidAmount = '0.00';
            supplier.pendingAmount = supplierAmount.toFixed(2);
          } else if (
            ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              supplier.paymentMethod
            )
          ) {
            supplier.firstMethodAmount = '';
            supplier.secondMethodAmount = '';
            supplier.amount = '0.00';
            supplier.paidAmount = '0.00';
            supplier.pendingAmount = '0.00';
          }
          // Update category amount
          const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
          return { ...item, amount: newItemAmount.toFixed(2), suppliers: newSuppliers };
        }
        return { ...item, suppliers: newSuppliers };
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
    const validationErrors = [];
    breakdown.forEach((item) => {
      const itemAmount = parseFloat(item.amount) || 0;
      if (itemAmount <= 0) {
        validationErrors.push(`Category ${item.category || 'Other'} must have a positive amount.`);
      }
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (Math.abs(itemAmount - supplierTotal) > 0.01) {
        validationErrors.push(`Supplier amounts for ${item.category || 'Other'} must sum to £${itemAmount.toFixed(2)}.`);
      }
      item.suppliers.forEach((s) => {
        if (!s.supplier) {
          validationErrors.push('Each supplier must have a valid supplier selected.');
        }
        if (!transactionMethods.includes(s.transactionMethod)) {
          validationErrors.push(`Invalid transaction method for supplier ${s.supplier}.`);
        }
        if (!paymentMethods.includes(s.paymentMethod)) {
          validationErrors.push(`Invalid payment method for supplier ${s.supplier}.`);
        }
        if (
          ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
            s.paymentMethod
          )
        ) {
          const firstAmount = parseFloat(s.firstMethodAmount) || 0;
          const secondAmount = parseFloat(s.secondMethodAmount) || 0;
          if (firstAmount <= 0 || secondAmount <= 0) {
            validationErrors.push(`Combined payment amounts for ${s.supplier} must be positive.`);
          }
          if (Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01) {
            validationErrors.push(
              `Combined payment amounts for ${s.supplier} must sum to £${parseFloat(s.amount).toFixed(2)}.`
            );
          }
        } else if (parseFloat(s.firstMethodAmount) <= 0 && s.firstMethodAmount !== '') {
          validationErrors.push(`Amount for ${s.supplier} must be positive.`);
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
            firstMethodAmount: ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              s.paymentMethod
            )
              ? parseFloat(s.firstMethodAmount) || 0
              : parseFloat(s.firstMethodAmount) || parseFloat(s.amount),
            secondMethodAmount: ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              s.paymentMethod
            )
              ? parseFloat(s.secondMethodAmount) || 0
              : 0,
          })),
      }));

    onSubmit(validBreakdown);
  };

  const calculateTotal = () => {
    return breakdown.reduce((sum, item) => {
      const itemAmount = parseFloat(item.amount) || 0;
      return sum + itemAmount;
    }, 0);
  };

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Product Cost Breakdown</h3>

        {errorMessage && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>}

        <div className="space-y-4 mb-4">
          {breakdown.map((item) => (
            <div key={item.id} className="border p-4 rounded-lg bg-gray-50">
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={item.category}
                  onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                  placeholder="Category name"
                  className="flex-1 p-2 border rounded-lg bg-gray-100"
                />
                <span className="px-3 py-2 bg-gray-200 rounded-lg w-24 text-center">
                  £{parseFloat(item.amount || 0).toFixed(2)}
                </span>
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
                  <div key={index} className="flex items-center space-x-2 flex-wrap">
                    <select
                      value={s.supplier}
                      onChange={(e) => handleSupplierChange(item.id, index, 'supplier', e.target.value)}
                      className="flex-1 p-2 border rounded-lg bg-gray-100"
                    >
                      <option value="">Select Supplier</option>
                      {suppliersList.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                    <span className="px-3 py-2 bg-gray-200 rounded-lg w-24 text-center">
                      £{parseFloat(s.amount || 0).toFixed(2)}
                    </span>
                    <select
                      value={s.transactionMethod}
                      onChange={(e) => handleSupplierChange(item.id, index, 'transactionMethod', e.target.value)}
                      className="w-32 p-2 border rounded-lg bg-gray-100"
                    >
                      <option value="">Select Transaction Method</option>
                      {transactionMethods.map((method) => (
                        <option key={method} value={method}>
                          {method.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.paymentMethod}
                      onChange={(e) => handleSupplierChange(item.id, index, 'paymentMethod', e.target.value)}
                      className="w-48 p-2 border rounded-lg bg-gray-100"
                    >
                      <option value="">Select Payment Method</option>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method.replace('_AND_', ' + ').replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    {['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
                      s.paymentMethod
                    ) ? (
                      <>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={s.firstMethodAmount}
                          onChange={(e) => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)}
                          placeholder={`${s.paymentMethod.split('_AND_')[0].replace('_', ' ')} Amount`}
                          className="w-32 p-2 border rounded-lg bg-gray-100"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={s.secondMethodAmount}
                          onChange={(e) => handleSupplierChange(item.id, index, 'secondMethodAmount', e.target.value)}
                          placeholder={`${s.paymentMethod.split('_AND_')[1].replace('_', ' ')} Amount`}
                          className="w-32 p-2 border rounded-lg bg-gray-100"
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={s.firstMethodAmount}
                        onChange={(e) => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)}
                        placeholder="Amount"
                        className="w-24 p-2 border rounded-lg bg-gray-100"
                      />
                    )}
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
