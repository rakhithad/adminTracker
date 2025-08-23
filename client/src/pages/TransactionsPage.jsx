import Transactions from '../components/Transactions';

export default function TransactionsPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-gray-600 mt-1">A unified log of all financial movements in the system.</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
            <Transactions />
        </div>
      </div>
    </div>
  );
};