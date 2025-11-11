import { useState } from 'react';
import { getAvailableCreditNotes } from '../api/api';
import SelectCreditNotesPopup from './SelectCreditNotesPopup';
import { FaTimes, FaPlus, FaTrashAlt, FaSave, FaCreditCard } from 'react-icons/fa';

const categoryOptions = ['Flight', 'Hotels', 'Cruise', 'Transfers', 'Other'];
// --- Reusable Styled Form Components ---
const FormInput = ({ label, name, ...props }) => (
    <div>
        {label && <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>}
        <input
            id={name}
            name={name}
            {...props}
            className={`w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 ${props.disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
            style={{ '--tw-ring-color': '#0A738A' }}
        />
    </div>
);

const FormSelect = ({ label, name, children, ...props }) => (
    <div>
        {label && <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>}
        <select
            id={name}
            name={name}
            {...props}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#0A738A' }}
        >
            {children}
        </select>
    </div>
);
// --- End Reusable Form Components ---


export default function ProductCostBreakdown({ initialBreakdown, onClose, onSubmit, totalCost }) {
    const suppliersList = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    const transactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'N/A'];
    const paymentMethods = [
      'BANK_TRANSFER', 'CREDIT', 'CREDIT_NOTES', 'BANK_TRANSFER_AND_CREDIT',
      'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES',
    ];

    const getInitialState = () => {
        const breakdownData = initialBreakdown || [];

        if (breakdownData.length === 0) {
            return [{ id: 1, category: 'Flight', amount: totalCost || 0, suppliers: [{ supplier: '', amount: totalCost || 0, transactionMethod: 'LOYDS', paymentMethod: 'BANK_TRANSFER', firstMethodAmount: totalCost || '', secondMethodAmount: '', paidAmount: totalCost || 0, pendingAmount: 0, selectedCreditNotes: [] }] }];
        }

        return breakdownData.map((item, index) => {
            if (!item.suppliers || item.suppliers.length === 0) {
                return {
                    ...item,
                    id: item.id || index + 1,
                    suppliers: [{
                        supplier: '',
                        amount: item.amount || 0,
                        transactionMethod: 'N/A',
                        paymentMethod: 'BANK_TRANSFER',
                        firstMethodAmount: item.amount || '',
                        secondMethodAmount: '',
                        paidAmount: item.amount || 0,
                        pendingAmount: 0,
                        selectedCreditNotes: []
                    }]
                };
            }
            
            return {
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
            };
        });
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
            <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                <div 
                    className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
                    style={{minHeight: '400px'}}
                >
                    {/* --- Modal Header --- */}
                    <header className="flex justify-between items-center p-5 border-b border-slate-200 flex-shrink-0">
                        <h3 className="text-2xl font-bold" style={{color: '#2D3E50'}}>Product Cost Breakdown</h3>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <FaTimes size={20} />
                        </button>
                    </header>
                    
                    {errorMessage && (
                        <div className="m-4 p-3 bg-red-100 text-red-800 rounded-lg flex-shrink-0">
                            {errorMessage}
                        </div>
                    )}

                    {/* --- Scrollable Content Area --- */}
                    <div className="overflow-y-auto p-6 space-y-6" style={{backgroundColor: '#F9FAFB'}}>
                        
                        {breakdown.map((item) => (
                            <fieldset key={item.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-md">
                                {/* --- Category Row --- */}
                                <legend className="px-2 text-lg font-semibold" style={{color: '#2D3E50'}}>
                                    Cost Category
                                </legend>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="flex-1">
                                        <FormSelect
                                            name={`category-${item.id}`}
                                            value={item.category}
                                            onChange={e => handleCategoryChange(item.id, 'category', e.target.value)}
                                        >
                                            <option value="" disabled>Select Category</option>
                                            {categoryOptions.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </FormSelect>
                                    </div>
                                    <div className="w-36">
                                        <FormInput
                                            label="Category Total"
                                            name={`amount-${item.id}`}
                                            value={`£ ${parseFloat(item.amount || 0).toFixed(2)}`}
                                            readOnly
                                            disabled
                                            className="font-bold text-center !text-slate-700"
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => removeCategory(item.id)} 
                                        className="p-2.5 text-red-500 hover:bg-red-100 rounded-lg disabled:text-slate-300 disabled:hover:bg-transparent transition-colors mt-6" 
                                        disabled={breakdown.length <= 1}
                                        title="Remove Category"
                                    >
                                        <FaTrashAlt />
                                    </button>
                                </div>

                                {/* --- Suppliers Section --- */}
                                <div className="pl-4 border-l-2 border-slate-200 space-y-4">
                                    {item.suppliers.map((s, index) => {
                                        const totalCreditApplied = (s.selectedCreditNotes || []).reduce((sum, note) => sum + note.amountToUse, 0);
                                        const isSingleCreditNoteMethod = s.paymentMethod === 'CREDIT_NOTES';
                                        const isSplitCreditNoteMethod = s.paymentMethod.endsWith('_CREDIT_NOTES');
                                        const involvesCreditNotes = isSingleCreditNoteMethod || isSplitCreditNoteMethod;
                                        const amountToCoverByNotes = isSingleCreditNoteMethod
                                            ? (parseFloat(s.firstMethodAmount) || 0)
                                            : (isSplitCreditNoteMethod ? (parseFloat(s.secondMethodAmount) || 0) : 0);

                                        return (
                                            <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    <FormSelect label="Supplier" name={`supplier-${item.id}-${index}`} value={s.supplier} onChange={e => handleSupplierChange(item.id, index, 'supplier', e.target.value)}>
                                                        <option value="">Select Supplier</option>
                                                        {suppliersList.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                                                    </FormSelect>
                                                    <FormSelect label="Payment Method" name={`paymentMethod-${item.id}-${index}`} value={s.paymentMethod} onChange={e => handleSupplierChange(item.id, index, 'paymentMethod', e.target.value)}>
                                                        {paymentMethods.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                                                    </FormSelect>
                                                    
                                                    {shouldShowTransactionMethod(s.paymentMethod) ? (
                                                        <FormSelect label="Transaction Via" name={`transactionMethod-${item.id}-${index}`} value={s.transactionMethod} onChange={e => handleSupplierChange(item.id, index, 'transactionMethod', e.target.value)}>
                                                            {transactionMethods.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                                                        </FormSelect>
                                                    ) : <div />}
                                                    
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeSupplier(item.id, index)} 
                                                        className="self-end p-2.5 text-red-500 hover:bg-red-100 rounded-lg disabled:text-slate-300 disabled:hover:bg-transparent transition-colors" 
                                                        disabled={item.suppliers.length <= 1}
                                                        title="Remove Supplier"
                                                    >
                                                        <FaTrashAlt />
                                                    </button>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    { s.paymentMethod.includes('_AND_') ? (
                                                        <>
                                                            <FormInput label={s.paymentMethod.split('_AND_')[0].replace(/_/g, ' ')} name={`firstAmount-${item.id}-${index}`} type="number" step="0.01" value={s.firstMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder="Amount" />
                                                            <FormInput label={s.paymentMethod.split('_AND_')[1].replace(/_/g, ' ')} name={`secondAmount-${item.id}-${index}`} type="number" step="0.01" value={s.secondMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'secondMethodAmount', e.target.value)} placeholder="Amount" />
                                                        </>
                                                    ) : (
                                                        <FormInput label="Total Amount" name={`firstAmount-${item.id}-${index}`} type="number" step="0.01" value={s.firstMethodAmount} onChange={e => handleSupplierChange(item.id, index, 'firstMethodAmount', e.target.value)} placeholder="Total Amount" className="md:col-span-2"/>
                                                    )}
                                                </div>

                                                {involvesCreditNotes && (
                                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                        <p className="text-sm font-semibold text-blue-800">Credit Note Application</p>
                                                        <div className="flex flex-wrap justify-between items-center gap-2 mt-1">
                                                            <div className="text-xs">
                                                                <span className="text-slate-600">Amount to cover: </span><span className="font-medium">£{amountToCoverByNotes.toFixed(2)}</span>
                                                                <br/>
                                                                <span className="text-slate-600">Applied from notes: </span><span className="font-bold text-green-700">£{totalCreditApplied.toFixed(2)}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenCreditNotePopup(item.id, index)}
                                                                className="text-sm px-3 py-1.5 font-semibold text-white rounded-md shadow-sm flex items-center gap-2"
                                                                style={{ backgroundColor: '#0A738A' }}
                                                                disabled={amountToCoverByNotes <= 0 && totalCreditApplied <= 0}
                                                            >
                                                                <FaCreditCard /> Select Notes
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <button 
                                        type="button" 
                                        onClick={() => addSupplier(item.id)} 
                                        className="mt-2 px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                                        style={{color: '#0A738A'}}
                                    >
                                        <FaPlus className="inline mr-1" /> Add Supplier
                                    </button>
                                </div>
                            </fieldset>
                        ))}
                        
                        <button 
                            type="button" 
                            onClick={addNewCategory} 
                            className="w-full py-2.5 px-4 text-sm font-semibold text-slate-500 border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-100 hover:border-slate-400 transition-colors flex items-center justify-center"
                        >
                            <FaPlus className="mr-2" /> Add Cost Category
                        </button>
                    </div>

                    {/* --- Modal Footer --- */}
                    <footer className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center bg-slate-50 p-4 border-t border-slate-200 space-y-2 md:space-y-0">
                        <div className="text-xl font-bold" style={{color: '#2D3E50'}}>
                            Total Cost:
                            <span className="ml-2 text-2xl">£ {total.toFixed(2)}</span>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Close
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSubmit} 
                                className="px-5 py-2.5 rounded-lg text-white font-semibold bg-green-600 hover:bg-green-700 shadow-sm flex items-center gap-2"
                            >
                                <FaSave /> Apply Changes
                            </button>
                        </div>
                    </footer>
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