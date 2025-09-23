// src/pages/ReportsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaFileInvoiceDollar, FaChevronRight } from 'react-icons/fa';

// A reusable component for each report link
const ReportCard = ({ to, icon, title, description }) => (
    <Link
        to={to}
        className="block bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
    >
        <div className="flex items-center">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-full mr-4">
                {icon}
            </div>
            <div className="flex-grow">
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <p className="text-sm text-slate-600 mt-1">{description}</p>
            </div>
            <FaChevronRight className="text-slate-400 ml-4 group-hover:text-blue-600 transition-colors" />
        </div>
    </Link>
);

export default function ReportsPage() {
    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Reports Dashboard</h1>
                <p className="text-slate-600 mt-1">Select a report to view and generate data.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* --- Link to the Internal Invoicing Report --- */}
                <ReportCard
                    to="/reports/internal-invoicing"
                    icon={<FaFileInvoiceDollar size={24} />}
                    title="Internal Invoicing Report"
                    description="Track and invoice profit from bookings for accounting."
                />

                {/* 
                  Future reports can be easily added here. For example:
                  <ReportCard 
                    to="/reports/sales-summary" 
                    icon={<FaChartBar size={24} />} 
                    title="Sales Summary"
                    description="View sales performance by agent and team."
                  />
                */}
            </div>
        </div>
    );
}