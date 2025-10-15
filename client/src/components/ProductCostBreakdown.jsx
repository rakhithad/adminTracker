import { useState } from 'react';
import { getAvailableCreditNotes } from '../api/api';
import SelectCreditNotesPopup from './SelectCreditNotesPopup';

// NEW: Added your list of categories
const categoryOptions = ['Flight', 'Hotels', 'Cruise', 'Transfers', 'Other'];

export default function ProductCostBreakdown({ initialBreakdown, onClose, onSubmit, totalCost }) {
    const suppliersList = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'N/A'];
    const paymentMethods = [
      'BANK_TRANSFER', 'CREDIT', 'CREDIT_NOTES', 'BANK_TRANSFER_AND_CREDIT',
      'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES',
    ];

    const getInitialState = () => {
        if (initialBreakdown && initialBreakdown.length > 0) {
            return initialBreakdown.map((item, index) => ({
                ...item,
                id: item.id || index + 1,
                suppliers: item.suppliers.map(s => ({
                    ...s,
                    transactionMethod: s.transactionMethod || 'N/A',
                    paymentMethod: s.paymentMethod || 'BANK_TRANSFER',
                    firstMethodAmount: s.firstMethodAmount || '',
                    secondMethodAmount: s.secondMethodAmount || '',
                    selectedCreditNotes: s.selectedCreditNotes || [],
                })),
            }));
        }
        return [{ id: 1, category: 'Flight', amount: totalCost || 0, suppliers: [{ supplier: '', amount: totalCost || 0, transactionMethod: 'LOYDS', paymentMethod: 'BANK_TRANSFER', firstMethodAmount: totalCost || '', secondMethodAmount: '', paidAmount: totalCost || 0, pendingAmount: 0, selectedCreditNotes: [] }] }];
    };

    const [breakdown, setBreakdown] = useState(getInitialState);
    const [nextId, setNextId] = useState(Math.max(...(initialBreakdown?.map(item => item.id || 0) || [0]), 1) + 1);
    const [errorMessage, setErrorMessage] = useState('');
    const [popupState, setPopupState] = useState({ isOpen: false, itemId: null, supplierIndex: null });
    const [availableNotes, setAvailableNotes] = useState([]);

    const shouldShowTransactionMethod = (paymentMethod) =>
        ['BANK_TRANSFER', 'BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES'].includes(paymentMethod);

    const handleOpenCreditNotePopup = async (itemId, supplierIndex) => {
        const supplierName = breakdown.find(i => i.id === itemId)?.suppliers[supplierIndex]?.supplier;
        if (!supplierName) {
            setErrorMessage("Please select a supplier before selecting credit notes.");
            return;
        }
        setErrorMessage('');
        try {
            const response = await getAvailableCreditNotes(supplierName);
            setAvailableNotes(response.data.data || []);
            setPopupState({ isOpen: true, itemId, supplierIndex });
        } catch (error) {
            console.error("Failed to fetch credit notes", error);
            setErrorMessage("Failed to fetch credit notes.");
        }
    };

    const handleCreditNoteConfirm = (selection) => {
        const { itemId, supplierIndex } = popupState;
        setBreakdown(prev =>
            prev.map(item => {
                if (item.id === itemId) {
                    const newSuppliers = [...item.suppliers];
                    const supplier = newSuppliers[supplierIndex];
                    const totalApplied = selection.reduce((sum, note) => sum + note.amountToUse, 0);

                    if (supplier.paymentMethod.endsWith('_CREDIT_NOTES')) {
                        supplier.secondMethodAmount = totalApplied.toFixed(2);
                    } else {
                        supplier.firstMethodAmount = totalApplied.toFixed(2);
                    }

                    supplier.selectedCreditNotes = selection;

                    const updatedItem = { ...item, suppliers: newSuppliers };
                    recalculateSupplierAndItem(updatedItem, itemId, supplierIndex);
                    return updatedItem;
                }
                return item;
            })
        );
        setPopupState({ isOpen: false, itemId: null, supplierIndex: null });
    };

    const recalculateSupplierAndItem = (item, itemId, supplierIndex) => {
        const newSuppliers = [...item.suppliers];
        const supplier = newSuppliers[supplierIndex];
        const firstAmount = parseFloat(supplier.firstMethodAmount) || 0;
        const secondAmount = parseFloat(supplier.secondMethodAmount) || 0;
        const totalAmount = firstAmount + secondAmount;
        supplier.amount = totalAmount.toFixed(2);

        const paymentParts = supplier.paymentMethod.split('_AND_');
        const firstMethod = paymentParts[0];
        const secondMethod = paymentParts[1];

        let paidAmount = 0;
        if (firstMethod === 'BANK_TRANSFER' || firstMethod === 'CREDIT_NOTES') paidAmount += firstAmount;
        if (secondMethod === 'BANK_TRANSFER' || secondMethod === 'CREDIT_NOTES') paidAmount += secondAmount;

        supplier.paidAmount = paidAmount.toFixed(2);
        supplier.pendingAmount = (totalAmount - paidAmount).toFixed(2);

        const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        item.amount = newItemAmount.toFixed(2);
    };

    const handleSupplierChange = (itemId, supplierIndex, field, value) => {
        setBreakdown(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const newSuppliers = [...item.suppliers];
            const supplier = { ...newSuppliers[supplierIndex] };
            supplier[field] = value;

            if (field === 'paymentMethod') {
                supplier.firstMethodAmount = '';
                supplier.secondMethodAmount = '';
                supplier.selectedCreditNotes = [];
                if (!shouldShowTransactionMethod(value)) {
                    supplier.transactionMethod = 'N/A';
                }
            }
            
            newSuppliers[supplierIndex] = supplier;
            const updatedItem = { ...item, suppliers: newSuppliers };
            
            recalculateSupplierAndItem(updatedItem, itemId, supplierIndex);
            return updatedItem;
        }));
    };

    const handleSubmit = () => onSubmit(breakdown);
    const addSupplier = (itemId) => setBreakdown(prev => prev.map(item => item.id === itemId ? { ...item, suppliers: [...item.suppliers, { supplier: '', amount: 0, transactionMethod: 'N/A', paymentMethod: 'BANK_TRANSFER', firstMethodAmount: '', secondMethodAmount: '', paidAmount: 0, pendingAmount: 0, selectedCreditNotes: [] }] } : item));
    const removeSupplier = (itemId, supplierIndex) => {
        setBreakdown((prev) =>
            prev.map((item) => {
                if (item.id !== itemId) return item;
                const newSuppliers = item.suppliers.filter((_, index) => index !== supplierIndex);
                const newItemAmount = newSuppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                return { ...item, amount: newItemAmount.toFixed(2), suppliers: newSuppliers };
            })
        );
    };
    const addNewCategory = () => {
        const newId = nextId;
        setBreakdown(prev => [...prev, { id: newId, category: '', amount: 0, suppliers: [{ supplier: '', amount: 0, transactionMethod: 'N/A', paymentMethod: 'BANK_TRANSFER', firstMethodAmount: '', secondMethodAmount: '', paidAmount: 0, pendingAmount: 0, selectedCreditNotes: [] }] }]);
        setNextId(newId + 1);
    };
    const removeCategory = (id) => {
        if (breakdown.length <= 1) return;
        setBreakdown(prev => prev.filter(item => item.id !== id));
    };
    const handleCategoryChange = (id, field, value) => {
        setBreakdown(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updatedItem = { ...item, [field]: value };
            if(field === 'amount') {
                if(updatedItem.suppliers.length > 0) {
                    updatedItem.suppliers[0].firstMethodAmount = value;
                    recalculateSupplierAndItem(updatedItem, id, 0);
                }
            }
            return updatedItem;
        }))
    }
    const calculateTotal = () => breakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const total = calculateTotal();

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-5xl shadow-xl overflow-y-auto max-h-[90vh]">
                    <h3 className="text-xl font-semibold mb-4 text-center text-gray-800">Product Cost Breakdown</h3>
                    {errorMessage && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>}
                    <div className="space-y-4 mb-4">
                        {breakdown.map((item) => (
                            <div key={item.id} className="border p-4 rounded-lg bg-gray-50">
                                <div className="flex items-center space-x-2 mb-2">
                                    {/* CHANGED: Replaced text input with a select dropdown */}
                                    <select
                                        value={item.category}
                                        onChange={e => handleCategoryChange(item.id, 'category', e.target.value)}
                                        className="flex-1 p-2 border rounded-lg bg-white"
                                    >
                                        <option value="" disabled>Select Category</option>
                                        {categoryOptions.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <input type="text" value={`£${parseFloat(item.amount || 0).toFixed(2)}`} readOnly className="p-2 bg-gray-200 rounded-lg w-28 text-center"/>
                                    <button type="button" onClick={() => removeCategory(item.id)} className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-300" disabled={breakdown.length <= 1}>×</button>
                                </div>
                                <div className="ml-4 space-y-2">
                                    {item.suppliers.map((s, index) => {
                                        const totalCreditApplied = (s.selectedCreditNotes || []).reduce((sum, note) => sum + note.amountToUse, 0);
                                        const isSingleCreditNoteMethod = s.paymentMethod === 'CREDIT_NOTES';
                                        const isSplitCreditNoteMethod = s.paymentMethod.endsWith('_CREDIT_NOTES');
                                        const involvesCreditNotes = isSingleCreditNoteMethod || isSplitCreditNoteMethod;
                                        const amountToCoverByNotes = isSingleCreditNoteMethod
                                            ? parseFloat(s.firstMethodAmount) || 0
                                            : (isSplitCreditNoteMethod ? parseFloat(s.secondMethodAmount) || 0 : 0);

                                        return (
                                            <div key={index} className="border-t pt-3 mt-2 space-y-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    <select value={s.supplier} onChange={e => handleSupplierChange(item.id, index, 'supplier', e.target.value)} className="p-2 border rounded-lg bg-white">
                                                        <option value="">Select Supplier</option>
                                                        {suppliersList.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                                                    </select>
                                                    <select value={s.paymentMethod} onChange={e => handleSupplierChange(item.id, index, 'paymentMethod', e.target.value)} className="p-2 border rounded-lg bg-white">
                                                        <option value="">Payment Method</option>
                                                        {paymentMethods.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                                                    </select>
                                                    {shouldShowTransactionMethod(s.paymentMethod) && (
                                                        <select value={s.transactionMethod} onChange={e => handleSupplierChange(item.id, index, 'transactionMethod', e.target.value)} className="p-2 border rounded-lg bg-white">
                                                            {transactionMethods.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                                                        </select>
                                                    )}
                                                    <button type="button" onClick={() => removeSupplier(item.id, index)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg disabled:text-gray-300 disabled:hover:bg-transparent" disabled={item.suppliers.length <= 1}>Remove</button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                                    { s.paymentMethod.includes('_AND_') ? (
                                                        <>
                                                            <input type="number" step="0.01" value={s.firstMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder={`${s.paymentMethod.split('_AND_')[0].replace(/_/g, ' ')} Amount`} className="p-2 border rounded-lg bg-white"/>
                                                            <input type="number" step="0.01" value={s.secondMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'secondMethodAmount', e.target.value)} placeholder={`${s.paymentMethod.split('_AND_')[1].replace(/_/g, ' ')} Amount`} className="p-2 border rounded-lg bg-white"/>
                                                        </>
                                                    ) : (
                                                        <input type="number" step="0.01" value={s.firstMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder="Total Amount" className="p-2 border rounded-lg bg-white md:col-span-2"/>
                                                    )}
                                                </div>

                                                {involvesCreditNotes && (
                                                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                                                        <p className="text-sm font-medium">Credit Note Application</p>
                                                        <p className="text-xs">Amount to cover with notes: £{amountToCoverByNotes.toFixed(2)}</p>
                                                        <p className="text-xs font-bold text-green-700">Applied from notes: £{totalCreditApplied.toFixed(2)}</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenCreditNotePopup(item.id, index)}
                                                            className="mt-2 text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                                                            disabled={amountToCoverByNotes <= 0}
                                                        >
                                                            Select Credit Notes
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                    <button type="button" onClick={() => addSupplier(item.id)} className="mt-2 px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">+ Add Supplier</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addNewCategory} className="w-full px-4 py-2 mb-4 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <span className="mr-1">+</span> Add Another Cost Category
                    </button>
                    <div className="flex justify-end font-bold text-lg p-2 bg-gray-100 rounded-md">
                        Total Cost: £{total.toFixed(2)}
                    </div>
                    <div className="flex justify-end space-x-2 border-t pt-4 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Close</button>
                        <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg text-white bg-green-600">Apply Changes</button>
                    </div>
                </div>
            </div>
            {popupState.isOpen && (
                <SelectCreditNotesPopup
                    amountToCover={
                        (() => {
                            const s = breakdown.find(i => i.id === popupState.itemId)?.suppliers[popupState.supplierIndex];
                            if (!s) return 0;
                            if (s.paymentMethod === 'CREDIT_NOTES') return (parseFloat(s.firstMethodAmount) || 0);
                            if (s.paymentMethod.endsWith('_CREDIT_NOTES')) return (parseFloat(s.secondMethodAmount) || 0);
                            return 0;
                        })()
                    }
                    availableNotes={availableNotes}
                    previouslySelectedNotes={breakdown.find(i => i.id === popupState.itemId)?.suppliers[popupState.supplierIndex]?.selectedCreditNotes || []}
                    onClose={() => setPopupState({ isOpen: false, itemId: null, supplierIndex: null })}
                    onConfirm={handleCreditNoteConfirm}
                />
            )}
        </>
    );
}