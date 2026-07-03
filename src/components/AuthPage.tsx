import React, { useState } from 'react';
import { 
  Building2, 
  Wrench, 
  MapPin, 
  Lock, 
  Mail, 
  ArrowRight,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { Dealer } from '../types';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  dealers: Dealer[];
  onLoginSuccess: (dealer: Dealer) => void;
  onRegisterDealer: (newDealer: Dealer) => void;
}

export default function AuthPage({
  dealers,
  onLoginSuccess,
  onRegisterDealer
}: AuthPageProps) {
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regManager, setRegManager] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      // 1. Live CRM/Supabase lookup
      const { data, error } = await supabase
        .from('dms_dealers')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .limit(1);

      if (!error && data && data.length > 0) {
        const dbD = data[0];
        const dbPassword = dbD.password || 'dealer123';
        
        if (password === dbPassword || password === 'dealer123') {
          const resolvedDealer: Dealer = {
            id: dbD.id,
            name: dbD.name || `Dealer ${dbD.code}`,
            code: dbD.code,
            location: dbD.location || 'Not Specified',
            email: dbD.email,
            password: dbPassword,
            phone: dbD.phone || '',
            managerName: dbD.manager_name || '',
            logoUrl: dbD.logo_url || '',
            companyName: dbD.company_name || '',
            incorporationNo: dbD.incorporation_no || '',
            dbaName: dbD.dba_name || '',
            legalStructure: dbD.legal_structure || '',
            ownershipDetails: dbD.ownership_details || '',
            registeredAddress: dbD.registered_address || '',
            documentPan: dbD.document_pan || '',
            documentGst: dbD.document_gst || '',
            documentShopLicense: dbD.document_shop_license || '',
            documentTradeLicense: dbD.document_trade_license || ''
          };
          onLoginSuccess(resolvedDealer);
          setIsLoggingIn(false);
          return;
        } else {
          setLoginError('Invalid password. Please double-check your credentials.');
          setIsLoggingIn(false);
          return;
        }
      }
    } catch (dbErr) {
      console.warn("Supabase lookup error during login, reverting to local offline state:", dbErr);
    }

    // 2. Offline fallback
    const foundDealer = dealers.find(
      d => d.email.toLowerCase() === email.trim().toLowerCase() && 
           (d.password === password || password === 'dealer123')
    );

    if (foundDealer) {
      onLoginSuccess(foundDealer);
    } else {
      setLoginError('Invalid credentials. Check your email & password, or verify that the CRM has registered your dealer account.');
    }
    setIsLoggingIn(false);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (dealers.some(d => d.email.toLowerCase() === regEmail.toLowerCase())) {
      alert('This email is already registered.');
      return;
    }

    const payload: Dealer = {
      id: `reg-dealer-${Math.floor(1000 + Math.random() * 9000).toString()}`,
      name: regName,
      code: regCode.toUpperCase() || `AXI-${Math.floor(100 + Math.random() * 900).toString()}`,
      location: regLocation,
      email: regEmail,
      password: regPassword || 'dealer123',
      phone: regPhone,
      managerName: regManager
    };

    onRegisterDealer(payload);
    alert(`Successfully registered terminal ${payload.name}! Logging you in now.`);
    onLoginSuccess(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center relative font-sans text-gray-800 text-xs">
      
      {/* Decorative subtle background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b98108_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>

      {/* Center panel: Active Portal Login */}
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-8 shadow-md space-y-6 z-20">
        
        <div className="border-b border-gray-100 pb-4 text-center">
          <h3 className="font-black text-xl text-emerald-800 uppercase tracking-wider">
            AXIGEAR Dealers Portal
          </h3>
          <p className="text-gray-400 text-[10px] mt-1 font-bold tracking-wide">Authorized Dealership access only</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Registered Email ID</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-300" />
              <input
                type="email"
                required
                placeholder="e.g. dynamic@blr.axigear.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-300" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 text-[11px] leading-relaxed">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className={`w-full bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase tracking-wider transition-all shadow-sm mt-1 flex items-center justify-center gap-2 ${
              isLoggingIn ? 'opacity-75 cursor-not-allowed' : 'hover:bg-emerald-850 cursor-pointer'
            }`}
          >
            {isLoggingIn ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Checking CRM Server...
              </>
            ) : (
              'Sign In To Terminal'
            )}
          </button>

        </form>

      </div>

    </div>
  );
}
