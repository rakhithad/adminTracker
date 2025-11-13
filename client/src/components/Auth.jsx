import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaSpinner } from 'react-icons/fa';

// --- BRAND COLORS ---
const COLORS = {
 primaryBlue: '#2D3E50', 
 secondaryBlue: '#0A738A',
 lightGray: '#F9FAFB', 
 darkGrayText: '#374151',
};

// --- Reusable Styled Input ---
const FormInput = ({ label, name, ...props }) => (
    <div>
        <label 
            htmlFor={name} 
            className="block text-sm font-medium" 
            style={{ color: COLORS.darkGrayText }}
        >
            {label}
        </label>
        <input
            id={name}
            name={name}
            {...props}
            className="w-full px-4 py-3 mt-1 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': COLORS.secondaryBlue }}
        />
    </div>
);

export default function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(''); // For displaying errors
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(''); // Clear previous errors

        try {
            // We only need the login logic
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // On success, the onAuthStateChange listener in AuthContext
            // will fire, fetch the user, and App.jsx will redirect.
            navigate('/dashboard'); // Navigate to a protected route
            
        } catch (error) {
            // Use the state to show the error message, not alert()
            setError(error.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-4" 
            style={{ backgroundColor: COLORS.lightGray }}
        >
            <div className="max-w-md w-full p-8 bg-white shadow-xl rounded-2xl border border-slate-200">
                
                {/* You can place your logo here */}
                {/* <img src="/logo.png" alt="Logo" className="mx-auto h-12 w-auto mb-4" /> */}
                
                <h2 
                    className="mt-2 text-center text-3xl font-bold" 
                    style={{color: COLORS.primaryBlue}}
                >
                    Sign in to your account
                </h2>
                
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {/* --- Styled Error Message --- */}
                    {error && (
                        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}
                    
                    <FormInput
                        label="Email Address"
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <FormInput
                        label="Password"
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-lg text-white shadow-md disabled:bg-opacity-70 transition-colors"
                            style={{ backgroundColor: COLORS.secondaryBlue }}
                            onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#085f73')}
                            onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = COLORS.secondaryBlue)}
                        >
                            {loading && <FaSpinner className="animate-spin mr-2" />}
                            {loading ? 'Processing...' : 'Sign In'}
                        </button>
                    </div>
                </form>
                
                {/* The "Sign Up" toggle is removed to align with your
                  admin-only user creation (CreateUserPage.js)
                */}

            </div>
        </div>
    );
}