import React, { useState } from 'react';
import { 
  Globe, 
  Building2, 
  UserPlus, 
  Search, 
  Check, 
  AlertTriangle, 
  Eye, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  FolderCheck,
  FileText,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Users,
  Database,
  RefreshCw,
  CloudUpload,
  CloudDownload,
  Copy,
  Package,
  Layers,
  Boxes,
  ArrowUpRight,
  ArrowDownLeft,
  CheckSquare,
  DollarSign,
  Wrench
} from 'lucide-react';
import { Dealer, DealerDocument } from '../types';
import { supabase } from '../lib/supabase';
import { downloadInvoiceHTML } from '../utils/csvHelper';

interface CrmAdminPortalProps {
  dealers: Dealer[];
  onRegisterDealer: (newDealer: Dealer) => void;
  // Triggered to simulate logging in as that dealer from admin panel for quick testing
  onSimulateLogin: (dealer: Dealer) => void; 
  onPullDatabase?: () => Promise<void>;
  onPushDatabase?: () => Promise<void>;
  syncStatus?: 'idle' | 'loading' | 'success' | 'error';
  syncLog?: string;
  initialSubTab?: 'audit' | 'create' | 'supabase';
}

export default function CrmAdminPortal({
  dealers,
  onRegisterDealer,
  onSimulateLogin,
  onPullDatabase,
  onPushDatabase,
  syncStatus = 'idle',
  syncLog = '',
  initialSubTab = 'audit'
}: CrmAdminPortalProps) {
  
  // Tab states for CRM
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'create' | 'supabase'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // New dealer form states
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerCode, setNewDealerCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('dealer123'); // Default password
  const [newPhone, setNewPhone] = useState('');
  const [newManager, setNewManager] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  const [formSuccess, setFormSuccess] = useState(false);

  // Searching & Query States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(dealers[0]?.id || null);

  // Base64 Preview Modal State duplicate for admin viewing
  const [adminOpenDocPreview, setAdminOpenDocPreview] = useState<{ name: string; base64: string } | null>(null);

  // Copy state for SQL code block
  const [copiedSql, setCopiedSql] = useState(false);

  // Live Selected Dealer's Stock and Transfers
  const [dealerInventory, setDealerInventory] = useState<any[]>([]);
  const [dealerTransfers, setDealerTransfers] = useState<any[]>([]);
  const [dealerSales, setDealerSales] = useState<any[]>([]);
  const [dealerServiceInvoices, setDealerServiceInvoices] = useState<any[]>([]);
  const [loadingDealerData, setLoadingDealerData] = useState(false);

  // Auto-sync interval to pull updates live every 12 seconds so edits are visible instantly
  React.useEffect(() => {
    if (activeSubTab !== 'audit' || !onPullDatabase) return;
    
    const interval = setInterval(() => {
      onPullDatabase().catch(() => {});
    }, 12000);

    return () => clearInterval(interval);
  }, [activeSubTab, onPullDatabase]);

  // Fetch live stock, transfers, sales, and service invoices from Supabase whenever the selected dealer changes
  React.useEffect(() => {
    if (!selectedDealerId) return;

    let isMounted = true;
    async function fetchDealerStockAndTransfers() {
      if (isMounted) setLoadingDealerData(true);
      try {
        const dealerObj = dealers.find(d => d.id === selectedDealerId);
        
        // 1. Fetch active inventory from dms_inventory_items
        const { data: invData, error: invErr } = await supabase
          .from('dms_inventory_items')
          .select('*')
          .eq('dealer_id', selectedDealerId);

        // 2. Fetch logistics transfers involving this dealer
        let transfersQuery = supabase
          .from('dms_inventory_transfers')
          .select('*');
        
        if (dealerObj) {
          transfersQuery = transfersQuery.or(`receiver_id.eq.${selectedDealerId},sender.eq."${dealerObj.name}"`);
        } else {
          transfersQuery = transfersQuery.eq('receiver_id', selectedDealerId);
        }

        const { data: trsfData, error: trsfErr } = await transfersQuery.order('date', { ascending: false });

        // 3. Fetch retail sales and their line items
        let salesData: any[] = [];
        try {
          const { data: sData, error: sErr } = await supabase
            .from('dms_sales')
            .select('*')
            .eq('dealer_id', selectedDealerId)
            .order('date', { ascending: false });
            
          if (!sErr && sData && sData.length > 0) {
            const { data: sItems } = await supabase
              .from('dms_sale_items')
              .select('*')
              .in('sale_id', sData.map(s => s.id));
              
            salesData = sData.map(s => ({
              id: s.id,
              dealerId: s.dealer_id,
              invoiceNo: s.invoice_no,
              customerName: s.customer_name,
              customerPhone: s.customer_phone,
              totalAmount: Number(s.total_amount),
              paymentMethod: s.payment_method,
              date: s.date,
              salespersonId: s.salesperson_id,
              salespersonName: s.salesperson_name,
              modelNo: s.model_no,
              location: s.location,
              productDesc: s.product_desc,
              hsnNo: s.hsn_no,
              chassisNo: s.chassis_no,
              motorNo: s.motor_no,
              batteryNo: s.battery_no,
              batteryWarranty: s.battery_warranty,
              batteryCapacity: s.battery_capacity,
              vehicleWarranty: s.vehicle_warranty,
              gstNo: s.gst_no,
              leadSource: s.lead_source,
              items: sItems 
                ? sItems.filter(item => item.sale_id === s.id).map(item => ({
                    itemId: item.item_id,
                    name: item.name,
                    quantity: Number(item.quantity),
                    pricePerUnit: Number(item.price_per_unit)
                  }))
                : []
            }));
          } else if (sData) {
            salesData = sData.map(s => ({
              id: s.id,
              dealerId: s.dealer_id,
              invoiceNo: s.invoice_no,
              customerName: s.customer_name,
              customerPhone: s.customer_phone,
              totalAmount: Number(s.total_amount),
              paymentMethod: s.payment_method,
              date: s.date,
              salespersonId: s.salesperson_id,
              salespersonName: s.salesperson_name,
              modelNo: s.model_no,
              location: s.location,
              productDesc: s.product_desc,
              hsnNo: s.hsn_no,
              chassisNo: s.chassis_no,
              motorNo: s.motor_no,
              batteryNo: s.battery_no,
              batteryWarranty: s.battery_warranty,
              batteryCapacity: s.battery_capacity,
              vehicleWarranty: s.vehicle_warranty,
              gstNo: s.gst_no,
              leadSource: s.lead_source,
              items: []
            }));
          }
        } catch (e) {
          console.warn("Failed to fetch sales in CRM:", e);
        }

        // 4. Fetch service invoices and their items
        let serviceInvoicesData: any[] = [];
        try {
          const { data: sInvData, error: sInvErr } = await supabase
            .from('dms_service_invoices')
            .select('*')
            .eq('dealer_id', selectedDealerId)
            .order('date', { ascending: false });
            
          if (!sInvErr && sInvData && sInvData.length > 0) {
            const { data: sInvItems } = await supabase
              .from('dms_service_invoice_items')
              .select('*')
              .in('service_invoice_id', sInvData.map(s => s.id));
              
            serviceInvoicesData = sInvData.map(s => ({
              id: s.id,
              dealerId: s.dealer_id,
              invoiceNo: s.invoice_no,
              customerName: s.customer_name,
              customerPhone: s.customer_phone,
              location: s.location,
              date: s.date,
              labourCharges: Number(s.labour_charges),
              paymentMethod: s.payment_method,
              leadSource: s.lead_source,
              enableGst: s.enable_gst !== false,
              productDescription: s.product_description,
              totalAmount: Number(s.total_amount),
              products: sInvItems 
                ? sInvItems.filter(item => item.service_invoice_id === s.id).map(item => ({
                    id: item.id,
                    name: item.name,
                    price: Number(item.price),
                    quantity: Number(item.quantity)
                  }))
                : []
            }));
          } else if (sInvData) {
            serviceInvoicesData = sInvData.map(s => ({
              id: s.id,
              dealerId: s.dealer_id,
              invoiceNo: s.invoice_no,
              customerName: s.customer_name,
              customerPhone: s.customer_phone,
              location: s.location,
              date: s.date,
              labourCharges: Number(s.labour_charges),
              paymentMethod: s.payment_method,
              leadSource: s.lead_source,
              enableGst: s.enable_gst !== false,
              productDescription: s.product_description,
              totalAmount: Number(s.total_amount),
              products: []
            }));
          }
        } catch (e) {
          console.warn("Failed to fetch service invoices in CRM:", e);
        }

        if (isMounted) {
          if (!invErr && invData) {
            setDealerInventory(invData);
          } else {
            setDealerInventory([]);
          }

          if (!trsfErr && trsfData) {
            setDealerTransfers(trsfData);
          } else {
            setDealerTransfers([]);
          }

          setDealerSales(salesData);
          setDealerServiceInvoices(serviceInvoicesData);
        }
      } catch (err) {
        console.warn("Failed to fetch live dealer data from Supabase:", err);
      } finally {
        if (isMounted) {
          setLoadingDealerData(false);
        }
      }
    }

    fetchDealerStockAndTransfers();

    return () => {
      isMounted = false;
    };
  }, [selectedDealerId, dealers]);

  const handleAcknowledgeReturn = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('dms_inventory_transfers')
        .update({ status: 'Accepted' })
        .eq('id', transferId);

      if (error) {
        alert(`Failed to acknowledge return in database: ${error.message}`);
        return;
      }

      // Update local state
      setDealerTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'Accepted' } : t));
      alert(`Success: Acknowledged receipt of returned stock at Central HQ.`);
    } catch (err) {
      console.error("Error acknowledging return:", err);
    }
  };

  const sqlStructure = `-- =========================================================================
-- PostgreSQL / Supabase Schema for Axigear Dealer Management System (DMS)
-- Prefix 'dms_' is applied to avoid naming collisions with your existing tables.
-- =========================================================================

-- =========================================================================
-- 1. ENUMS & CONSTRAINTS FOR DATA INTEGRITY
-- =========================================================================
CREATE TYPE dms_legal_structure_type AS ENUM ('Sole Proprietorship', 'Partnership', 'Private Limited', 'LLP', '');

-- =========================================================================
-- 2. CORE MASTER AND TRANSACTION ALIGNMENT TABLES
-- =========================================================================

-- DEALERS MASTER (Central franchises details)
CREATE TABLE IF NOT EXISTS public.dms_dealers (
    id TEXT PRIMARY KEY,                       -- Flexible text-based UUID or code-based ID
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    logo_url TEXT,
    phone TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    
    -- Corporate compliance profiles
    company_name TEXT,
    incorporation_no TEXT,
    dba_name TEXT,
    legal_structure TEXT DEFAULT '',
    ownership_details TEXT,
    registered_address TEXT,
    
    -- Secure metadata storage for associated legal documents (JSONB structures)
    document_pan JSONB,
    document_gst JSONB,
    document_shop_license JSONB,
    document_trade_license JSONB,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Force-add compliance columns if the table dms_dealers already existed without them
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS incorporation_no TEXT;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS dba_name TEXT;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS legal_structure TEXT DEFAULT '';
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS ownership_details TEXT;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS registered_address TEXT;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS document_pan JSONB;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS document_gst JSONB;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS document_shop_license JSONB;
ALTER TABLE public.dms_dealers ADD COLUMN IF NOT EXISTS document_trade_license JSONB;

-- EMPLOYEES DIRECTORY (Dealers staff directory)
CREATE TABLE IF NOT EXISTS public.dms_employees (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- STOCKS & INVENTORY SYSTEM (Master inventory stock)
CREATE TABLE IF NOT EXISTS public.dms_inventory_items (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 5,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    location TEXT NOT NULL,                    -- Specific warehouse or store rack location
    image_url TEXT,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dms_inventory_items_dealer_sku_key UNIQUE (dealer_id, sku)
);

-- ATTENDANCE LOG BOOK (Daily attendance logs)
CREATE TABLE IF NOT EXISTS public.dms_attendance_records (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES public.dms_employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
    clock_in TIME,
    clock_out TIME,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOMER EV SALES TRANSACTIONS (Total amount bills)
CREATE TABLE IF NOT EXISTS public.dms_sales (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL,              -- Cash / Card / UPI / Bank Transfer
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    salesperson_id TEXT NOT NULL,
    salesperson_name TEXT NOT NULL,
    
    -- EV Technical specifications & warranty parameters
    model_no TEXT,
    location TEXT,
    product_desc TEXT,
    hsn_no TEXT,
    chassis_no TEXT,
    motor_no TEXT,
    battery_no TEXT,
    battery_warranty TEXT,
    battery_capacity TEXT,
    vehicle_warranty TEXT,
    gst_no TEXT,
    lead_source TEXT,
    display_splits_in_invoice BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dms_sales_dealer_invoice_key UNIQUE (dealer_id, invoice_no)
);

-- DYNAMIC ITEMS WITHIN SALES (Individual parts and accessories)
CREATE TABLE IF NOT EXISTS public.dms_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id TEXT NOT NULL REFERENCES public.dms_sales(id) ON DELETE CASCADE,
    item_id TEXT,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- SERVICE TICKETS (Submitted work issues & warranty claims)
CREATE TABLE IF NOT EXISTS public.dms_service_tickets (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Warranty Claim', 'Parts Support', 'Technical Query', 'Return Merchandise Support')),
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- CHAT MESSAGES LOG HISTORY (Collaboration messages)
CREATE TABLE IF NOT EXISTS public.dms_service_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES public.dms_service_tickets(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('dealer', 'service_center')),
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- SERVICE & WORKSHOP INVOICES
CREATE TABLE IF NOT EXISTS public.dms_service_invoices (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    location TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    labour_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL,
    lead_source TEXT,
    enable_gst BOOLEAN NOT NULL DEFAULT TRUE,
    product_description TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    display_splits_in_invoice BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- SPARE PART REPLACEMENTS WITHIN SERVICE EXECUTIONS
CREATE TABLE IF NOT EXISTS public.dms_service_invoice_items (
    id TEXT PRIMARY KEY,
    service_invoice_id TEXT NOT NULL REFERENCES public.dms_service_invoices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 1
);

-- SERVICE SPLIT TRANSACTION SETTLEMENTS
CREATE TABLE IF NOT EXISTS public.dms_service_invoice_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_invoice_id TEXT NOT NULL REFERENCES public.dms_service_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- SALES PIPELINE ESTIMATIONS (Quotations and leads tracking)
CREATE TABLE IF NOT EXISTS public.dms_estimations (
    id TEXT PRIMARY KEY,
    dealer_id TEXT NOT NULL REFERENCES public.dms_dealers(id) ON DELETE CASCADE,
    slip_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    contact_no TEXT,
    address TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    model TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    lead_source TEXT,
    splits JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- VEHICLES AND SPARES TRANSFERS / LOGISTICS SHIPMENTS (HQ Shipments & Returns)
CREATE TABLE IF NOT EXISTS public.dms_inventory_transfers (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    sender TEXT NOT NULL,
    receiver_id TEXT REFERENCES public.dms_dealers(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    chassis_no TEXT,
    motor_no TEXT,
    battery_no TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. COMPATIBILITY VIEWS FOR EXTERNAL CRM SYSTEMS (crm.axigearelectric.com)
-- =========================================================================

-- Safely rename legacy tables if they exist to prevent "is not a view" error and preserve existing data
ALTER TABLE IF EXISTS public.service_invoices RENAME TO service_invoices_backup;
ALTER TABLE IF EXISTS public.spares RENAME TO spares_backup;
ALTER TABLE IF EXISTS public.inventory RENAME TO inventory_backup;

-- Safe clean up of views if they already exist
DROP VIEW IF EXISTS public.service_invoices CASCADE;
DROP VIEW IF EXISTS public.spares CASCADE;
DROP VIEW IF EXISTS public.inventory CASCADE;

-- Compatibility view for service_invoices table mapping to dms_service_invoices
CREATE OR REPLACE VIEW public.service_invoices AS
SELECT 
    id,
    dealer_id,
    invoice_no,
    customer_name,
    customer_phone,
    location,
    date,
    labour_charges,
    payment_method,
    lead_source,
    enable_gst,
    product_description AS product,
    product_description,
    total_amount,
    display_splits_in_invoice,
    created_at
FROM public.dms_service_invoices;

-- Compatibility view for spares table mapping to dms_inventory_items
CREATE OR REPLACE VIEW public.spares AS
SELECT 
    id,
    dealer_id,
    name AS product,
    sku,
    quantity AS unit,
    price,
    location,
    last_updated
FROM public.dms_inventory_items
WHERE category IN ('spares', 'spare', 'part');

-- Compatibility view for inventory table mapping to dms_inventory_items
CREATE OR REPLACE VIEW public.inventory AS
SELECT 
    id,
    dealer_id,
    name,
    sku,
    category,
    quantity,
    price,
    location,
    last_updated
FROM public.dms_inventory_items;
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlStructure);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCreateDealerSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (dealers.some(d => d.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      alert(`Conflict detected: A dealership with the registered email ID "${newEmail}" already occupies a master lease.`);
      return;
    }

    if (dealers.some(d => d.code.toUpperCase() === newDealerCode.trim().toUpperCase())) {
      alert(`Conflict detected: Branch code "${newDealerCode}" is already designated to an active outlet.`);
      return;
    }

    const payload: Dealer = {
      id: `mstr-dlr-${Math.floor(1000 + Math.random() * 9000).toString()}`,
      name: newDealerName,
      code: newDealerCode.trim().toUpperCase(),
      location: newLocation,
      email: newEmail.trim(),
      password: newPassword,
      phone: newPhone || '+91 80 4402 1122',
      managerName: newManager,
      logoUrl: logoUrl || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?rect=0%2C0%2C400%2C400&q=80&w=200&auto=format&fit=crop'
    };

    onRegisterDealer(payload);
    setFormSuccess(true);
    setSelectedDealerId(payload.id); // auto inspect newly created dealer
    
    // Reset Form fields
    setNewDealerName('');
    setNewDealerCode('');
    setNewLocation('');
    setNewEmail('');
    setNewPhone('');
    setNewManager('');
    setLogoUrl('');
    
    setTimeout(() => {
      setFormSuccess(false);
      setActiveSubTab('audit'); // route back to see the directory
    }, 1500);
  };

  const selectedDealer = dealers.find(d => d.id === selectedDealerId);

  const filteredDealers = dealers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans text-xs">
      
      {/* Visual Browser Mockup Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Mock browser address chrome */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 select-none">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
          </div>
          
          <div className="flex-1 max-w-2xl bg-white border border-gray-200 rounded py-0.5 px-3 flex items-center gap-2 text-[11px] text-gray-500 shadow-inner">
            <Globe className="w-3.5 h-3.5 text-emerald-800 font-bold shrink-0" />
            <span className="font-mono text-[10px] text-gray-800 truncate select-all">
              https://<strong className="font-extrabold text-emerald-800">crm.axigearelectric.com</strong>/dealers/directory
            </span>
            <span className="ml-auto text-[9px] text-gray-300 font-mono tracking-wider shrink-0 uppercase select-none font-black">&bull; ENCRYPTED CONTROL CORE</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline-block text-[9px] font-mono text-emerald-800 font-bold">HQ_SECURE_GATEWAY_CONN</span>
          </div>
        </div>

        {/* Mock browser panel active site workspace */}
        <div className="p-6 bg-slate-50 space-y-6">
          
          {/* CRM Site Banner Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="w-5 h-5 font-bold" />
                <h1 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">
                  AXIGEAR Master Dealers CRM Hub
                </h1>
              </div>
              <p className="text-gray-400 text-[10px] mt-1 font-semibold">
                Central corporate control gateway for dealer provisioning, password credential management, and regulatory compliance paperwork auditing.
              </p>
            </div>

            {/* Quick selector buttons */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shrink-0 shadow-sm">
              <button
                onClick={() => setActiveSubTab('audit')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  activeSubTab === 'audit' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <FolderCheck className="w-3.5 h-3.5" />
                <span>Auditing Directory</span>
                <span className="px-1 rounded text-[9px] bg-emerald-100 text-emerald-800 font-mono">{dealers.length}</span>
              </button>
              <button
                onClick={() => setActiveSubTab('create')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  activeSubTab === 'create' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create New Dealer</span>
              </button>
              <button
                onClick={() => setActiveSubTab('supabase')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  activeSubTab === 'supabase' 
                    ? 'bg-emerald-700 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Supabase Setup</span>
                <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-pulse shrink-0"></span>
              </button>
            </div>
          </div>

          {activeSubTab === 'create' ? (
            // Form space for provision a brand new dealer and give passwords
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="lg:col-span-4 space-y-4 pr-0 lg:pr-6 border-r-0 lg:border-r border-gray-150">
                <span className="bg-emerald-100 text-emerald-800 font-bold uppercase font-mono px-2 py-0.5 rounded text-[9px]">
                  PROVISION PROTOCOL
                </span>
                <h2 className="text-gray-900 font-black text-sm uppercase tracking-wider">Create Authorized Franchise</h2>
                <p className="text-gray-550 text-[11px] leading-relaxed">
                  Allocate unique administrative branch codes, authorized emails, operational cities, and **secure passwords**.
                </p>
                <p className="text-gray-550 text-[11px] leading-relaxed pt-2">
                  Once created, the dealer's profile instantly goes active. You can then use the set email and password to log in and update company dossiers including legal partners name directives, registered tax structures, and compliance receipts.
                </p>
              </div>

              <form onSubmit={handleCreateDealerSubmit} className="lg:col-span-8 space-y-4">
                {formSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-lg flex items-center gap-2 font-bold animate-pulse text-[11px]">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Protocol success: Franchise branch activated inside Axigear ledger directory!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Franchise Branch Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Axigear Chennai East"
                      value={newDealerName}
                      onChange={(e) => setNewDealerName(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Unique Branch Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AXI-CHN-404"
                      value={newDealerCode}
                      onChange={(e) => setNewDealerCode(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Dealership Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Adyar, Chennai"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Official Registered Email ID</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. chn@axigear.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 text-emerald-800">
                      <Lock className="w-3 h-3 text-emerald-700" />
                      <span>Dealer Login Password</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Password allocated to franchise"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Manager full name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Sethupathi"
                      value={newManager}
                      onChange={(e) => setNewManager(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Contact Phone No.</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 44 2445 9900"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Logo Unsplash URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 font-mono text-[10px]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-emerald-800 hover:bg-emerald-950 text-white font-extrabold py-3 rounded-lg text-xs tracking-widest uppercase transition-all shadow-md cursor-pointer"
                  >
                    Activate Dealership Portal Account
                  </button>
                </div>
              </form>
            </div>
          ) : activeSubTab === 'supabase' ? (
            // Supabase setup console and copyable SQL schema script
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sync Dashboard metrics */}
              <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5 h-[560px] overflow-y-auto">
                <div className="space-y-1 border-b border-gray-250 pb-4">
                  <span className="bg-sky-100 text-sky-800 text-[9px] font-black uppercase font-mono px-2 py-0.5 rounded">
                    Supabase Link Active
                  </span>
                  <h3 className="text-gray-900 font-black text-sm uppercase tracking-wider pt-1.5 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-sky-600" />
                    Supabase Console
                  </h3>
                  <p className="text-gray-400 text-[10px] font-semibold">
                    You have linked the database of project:
                  </p>
                  <p className="font-mono text-gray-800 bg-gray-50 px-3 py-1.5 border select-all rounded text-[11px] font-bold break-all">
                    pevjxmhzulmmdidvlbsu
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-gray-900 font-bold uppercase text-[10px] tracking-wider">Sync Control Center</h4>
                  <p className="text-gray-500 leading-normal text-[11px]">
                    All dealers data, inventory levels, attendee rolls, and sales tickets can be fetched and pushed seamlessly to copy records over.
                  </p>

                  <div className="grid grid-cols-1 gap-2 pt-1.5">
                    {/* Pull database button */}
                    <button
                      onClick={onPullDatabase}
                      disabled={syncStatus === 'loading'}
                      className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-extrabold py-2.5 px-4 rounded-lg tracking-wider uppercase transition border font-sans disabled:opacity-50 cursor-pointer shadow-sm text-[10px]"
                    >
                      <CloudDownload className={`w-4 h-4 text-sky-400 ${syncStatus === 'loading' ? 'animate-bounce' : ''}`} />
                      <span>📥 Pull Live DB from Supabase</span>
                    </button>

                    {/* Push database / Seed button */}
                    <button
                      onClick={onPushDatabase}
                      disabled={syncStatus === 'loading'}
                      className="flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-955 text-white font-extrabold py-2.5 px-4 rounded-lg tracking-wider uppercase transition disabled:opacity-50 cursor-pointer shadow-sm text-[10px]"
                    >
                      <CloudUpload className="w-4 h-4 text-emerald-400" />
                      <span>📤 Seed / Push Data to Supabase</span>
                    </button>
                  </div>
                </div>

                {/* Live Sync Status monitor report logs */}
                <div className="p-4 rounded-lg border text-sans text-[11px] space-y-2.5 bg-gray-50 border-gray-200">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-gray-600 text-[10px] uppercase">Connection Status</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
                      <strong className="text-sky-800 font-bold uppercase text-[9px]">Linked & Live</strong>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 font-semibold font-sans">Sync State:</span>
                      <strong className="uppercase font-mono text-gray-700 font-bold">
                        {syncStatus === 'loading' ? '🔄 Processing...' : syncStatus === 'success' ? '✅ Complete' : syncStatus === 'error' ? '❌ Error' : 'Idle'}
                      </strong>
                    </div>

                    {syncLog && (
                      <div className="mt-2 text-[10px] font-mono text-gray-600 bg-white border rounded p-2.5 max-h-[140px] overflow-y-auto whitespace-pre-line leading-relaxed shadow-inner">
                        {syncLog}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-[10.5px] leading-relaxed text-amber-850 text-sans">
                  <p className="font-bold flex items-center gap-1 text-amber-900 border-b pb-1.5 mb-1.5 uppercase font-sans text-[10px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                    Conflict Prevention Check
                  </p>
                  Our system namespaces all table queries with <code className="font-mono bg-white border px-1 rounded text-amber-950">dms_</code>. This guarantees you will suffer **ZERO collisions** with your existing CRM software tables!
                </div>
              </div>

              {/* DDL SQL scripts block display panel */}
              <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-[560px] justify-between overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-gray-900 font-black text-xs uppercase tracking-wider">Supabase Query Script</h4>
                      <p className="text-gray-400 text-[10px] font-sans font-semibold">Copy this script and run it in your Supabase SQL Editor.</p>
                    </div>
                    
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-850 font-bold font-sans rounded-md border border-sky-100 text-[10px] flex items-center gap-1 transition shadow-sm cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-sky-700" />
                      <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 flex flex-col mt-2">
                    <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-850 select-none">
                      <span className="text-[10px] font-mono text-slate-500 font-black">ddl_schema_axigear_portal.sql</span>
                      <span className="text-[9px] font-mono text-emerald-500 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded tracking-wider border border-emerald-900/30">POSTGRESQL</span>
                    </div>
                    
                    <pre className="p-4 overflow-auto text-[10px] font-mono text-sky-300 leading-relaxed flex-1 select-all select-text selection:bg-sky-900">
                      <code>{sqlStructure}</code>
                    </pre>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            // Interactive audit list + individual dealer sheet details info
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Dealers List pane */}
              <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[520px]">
                
                {/* Search header container bar */}
                <div className="bg-gray-50 p-4 border-b border-gray-200 space-y-3">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search dealer, code, location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:border-emerald-600 text-[11px]"
                      />
                    </div>
                    {onPullDatabase && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onPullDatabase();
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        disabled={syncStatus === 'loading'}
                        className="p-2 bg-white border border-gray-200 hover:border-emerald-600 hover:text-emerald-700 rounded-lg text-gray-500 transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-sm"
                        title="Sync Live Profiles & Docs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'loading' ? 'animate-spin text-emerald-600' : ''}`} />
                      </button>
                    )}
                  </div>
                  {syncStatus === 'loading' && (
                    <div className="text-[10px] text-emerald-800 font-bold animate-pulse text-center">
                      Auto-syncing data streams from Supabase...
                    </div>
                  )}
                </div>

                {/* Dealers active column items */}
                <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                  {filteredDealers.map((dl) => {
                    const isSelected = dl.id === selectedDealerId;
                    
                    // Count completed compliance files
                    let uploadCount = 0;
                    if (dl.documentPan) uploadCount++;
                    if (dl.documentGst) uploadCount++;
                    if (dl.documentShopLicense) uploadCount++;
                    if (dl.documentTradeLicense) uploadCount++;

                    const isFullyCompliant = dl.companyName && dl.incorporationNo && dl.legalStructure && dl.ownershipDetails && dl.registeredAddress && dl.documentPan;

                    return (
                      <button
                        key={dl.id}
                        onClick={() => setSelectedDealerId(dl.id)}
                        className={`w-full text-left p-4 transition-all flex items-start gap-3 select-all hover:bg-gray-50/50 ${
                          isSelected ? 'bg-emerald-50/45 border-l-4 border-emerald-700' : 'border-l-4 border-transparent'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white font-black flex items-center justify-center shrink-0 shadow-sm text-sm font-sans uppercase">
                          {dl.code.split('-')[1] || 'DL'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 truncate pr-1">{dl.name}</h4>
                            <span className="font-mono text-[9px] text-gray-400 font-bold shrink-0">{dl.code}</span>
                          </div>
                          
                          <p className="text-gray-400 text-[10px] font-sans truncate mt-0.5">{dl.location}</p>

                          {/* Quick indicators of profile filing details */}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[9px] font-mono text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                              Docs: <strong className="text-emerald-800">{uploadCount}/4</strong> Files
                            </span>
                            
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${
                              isFullyCompliant 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : dl.documentPan 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {isFullyCompliant ? 'Fully Compliant' : dl.documentPan ? 'PAN Filed' : 'Incomplete'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 mt-2 shrink-0" />
                      </button>
                    );
                  })}
                  {filteredDealers.length === 0 && (
                    <div className="p-8 text-center text-gray-400 font-bold">No dealers match filter query parameters.</div>
                  )}
                </div>
              </div>

              {/* Inspector details right card pane */}
              <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col h-[520px] overflow-hidden justify-between">
                
                {selectedDealer ? (
                  <div className="space-y-5 overflow-y-auto flex-1 pr-1">
                    
                    {/* Dealer identity banner */}
                    <div className="flex items-start justify-between border-b border-gray-150 pb-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={selectedDealer.logoUrl || "https://images.unsplash.com/photo-1558981806-ec527fa84c39?rect=0%2C0%2C400%2C400&q=80&w=200&auto=format&fit=crop"} 
                          alt="logo" 
                          className="w-12 h-12 rounded-lg object-cover bg-emerald-50 shrink-0 border"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h3 className="text-sm font-extrabold text-gray-900 leading-tight">{selectedDealer.name}</h3>
                          <span className="font-mono text-[9px] font-extrabold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded block mt-1 tracking-wider w-fit">
                            {selectedDealer.code}
                          </span>
                        </div>
                      </div>

                      {/* Force Login Bypass simulation button */}
                      <button
                        onClick={() => {
                          onSimulateLogin(selectedDealer);
                          alert(`Interception Matrix Bypass: Simulating session login as "${selectedDealer.name}" (${selectedDealer.code}). Redirecting to dealer dashboard overview...`);
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-[10px] flex items-center gap-1 transition shadow-sm shrink-0 cursor-pointer"
                        title="Simulate instant login for this franchise branch"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                        <span>Sign In as Dealer</span>
                      </button>
                    </div>

                    {/* Operational contact parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px] font-sans">
                      <p className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate text-gray-800 font-mono">{selectedDealer.email}</span>
                      </p>
                      <p className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-800">{selectedDealer.phone}</span>
                      </p>
                      <p className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-800 truncate">{selectedDealer.location}</span>
                      </p>
                      <p className="flex items-center gap-2 text-emerald-850 font-bold">
                        <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-gray-900">Manager: <strong className="font-bold">{selectedDealer.managerName}</strong></span>
                      </p>
                    </div>

                    <div className="border border-gray-150 p-2.5 bg-gray-50 rounded-lg flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-bold uppercase tracking-wider font-mono text-[9px]">Portal Authorization Password</span>
                      <strong className="text-gray-900 font-mono select-all bg-white border border-gray-200 px-3 py-1 rounded font-bold">{selectedDealer.password || 'dealer123'}</strong>
                    </div>

                    {/* Dealer Corporate Dossier Section */}
                    <div className="space-y-4 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-emerald-700" />
                        Corporate Entity & Legal Parameters
                      </span>

                      {selectedDealer.companyName ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/10 border border-emerald-100/50 p-4 rounded-xl text-[11px]">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans">Registered Legal Name</span>
                            <p className="font-extrabold text-gray-900 text-xs">{selectedDealer.companyName}</p>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans">Doing Business As (DBA)</span>
                            <p className="font-bold text-gray-800">{selectedDealer.dbaName || '-- Same as Company --'}</p>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans">Legal Constitution</span>
                            <p className="font-mono text-emerald-800 font-bold">{selectedDealer.legalStructure}</p>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans">Incorporation Number</span>
                            <p className="font-mono text-emerald-800 font-bold">{selectedDealer.incorporationNo || '--'}</p>
                          </div>

                          <div className="space-y-0.5 sm:col-span-2 pt-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans block">Shareholders / Directors Registry</span>
                            <p className="text-gray-700 leading-relaxed font-sans mt-0.5 whitespace-pre-line bg-white border p-2.5 rounded-lg">{selectedDealer.ownershipDetails}</p>
                          </div>

                          <div className="space-y-0.5 sm:col-span-2 pt-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase font-sans block">Registered Office Address</span>
                            <p className="text-gray-700 leading-relaxed font-sans mt-0.5 whitespace-pre-line bg-white border p-2.5 rounded-lg">{selectedDealer.registeredAddress}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center flex flex-col justify-center items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                          <div className="space-y-0.5">
                            <strong className="block text-amber-800 font-sans font-bold">Awaiting Onboarding Dossier filing</strong>
                            <p className="text-amber-700/80 text-[10px] font-sans">The dealer branch is activated but has not logged in to file corporate office structures or ownership registers.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Verification files audit dock */}
                    <div className="space-y-3 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <FolderCheck className="w-4 h-4 text-emerald-700" />
                        Compliance Files audit dock
                      </span>

                      <div className="grid grid-cols-2 gap-3 text-[11px] font-sans">
                        
                        {/* PAN card */}
                        {renderAdminDocItem(
                           'PAN Card (Compulsory)',
                          selectedDealer.documentPan,
                          'documentPan'
                        )}

                        {/* GST Certificate */}
                        {renderAdminDocItem(
                          'GST Registration Certificate',
                          selectedDealer.documentGst,
                          'documentGst'
                        )}

                        {/* Shop License */}
                        {renderAdminDocItem(
                          'Shop & Establishment License',
                          selectedDealer.documentShopLicense,
                          'documentShopLicense'
                        )}

                        {/* Trade License */}
                        {renderAdminDocItem(
                          'Trade Certificate',
                          selectedDealer.documentTradeLicense,
                          'documentTradeLicense'
                        )}

                      </div>
                    </div>

                    {/* Live Dealer Inventory & Stock Audit Dock */}
                    <div className="space-y-3 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-indigo-700" />
                        <span>Live Stock & Inventory levels</span>
                        {loadingDealerData && (
                          <span className="text-[10px] text-gray-400 font-normal animate-pulse">(fetching stock...)</span>
                        )}
                      </span>

                      {dealerInventory.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-sans">
                          {/* Vehicles Stock summary */}
                          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 shadow-sm">
                            <span className="text-gray-500 font-bold uppercase tracking-wider font-mono text-[9px] flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Vehicles Inventory</span>
                            </span>
                            <div className="divide-y max-h-[140px] overflow-y-auto">
                              {dealerInventory.filter(i => i.category === 'vehicles' || i.category === 'vehicle').map((item: any) => (
                                <div key={item.id} className="py-1.5 flex items-center justify-between">
                                  <div className="min-w-0 pr-1">
                                    <p className="font-bold text-gray-800 truncate text-[10.5px]" title={item.name}>{item.name}</p>
                                    <p className="text-[9px] font-mono text-gray-400 font-bold">{item.sku}</p>
                                  </div>
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-mono font-extrabold text-[10px] shrink-0">
                                    {item.quantity} qty
                                  </span>
                                </div>
                              ))}
                              {dealerInventory.filter(i => i.category === 'vehicles' || i.category === 'vehicle').length === 0 && (
                                <p className="text-gray-400 py-4 text-center italic text-[10px]">No vehicles in franchisee stock.</p>
                              )}
                            </div>
                          </div>

                          {/* Spares Stock summary */}
                          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 shadow-sm">
                            <span className="text-gray-500 font-bold uppercase tracking-wider font-mono text-[9px] flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Spare Parts & Accessories</span>
                            </span>
                            <div className="divide-y max-h-[140px] overflow-y-auto">
                              {dealerInventory.filter(i => i.category === 'spares' || i.category === 'spare' || i.category === 'part').map((item: any) => (
                                <div key={item.id} className="py-1.5 flex items-center justify-between">
                                  <div className="min-w-0 pr-1">
                                    <p className="font-bold text-gray-800 truncate text-[10.5px]" title={item.name}>{item.name}</p>
                                    <p className="text-[9px] font-mono text-gray-400 font-bold">{item.sku}</p>
                                  </div>
                                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 rounded px-1.5 py-0.5 font-mono font-extrabold text-[10px] shrink-0">
                                    {item.quantity} qty
                                  </span>
                                </div>
                              ))}
                              {dealerInventory.filter(i => i.category === 'spares' || i.category === 'spare' || i.category === 'part').length === 0 && (
                                <p className="text-gray-400 py-4 text-center italic text-[10px]">No spare parts in franchisee stock.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-gray-400 font-medium text-[10px]">
                          No active stock or inventory lines found matching this dealership branch.
                        </div>
                      )}
                    </div>

                    {/* Logistics Transfers & Returns Ledger Dock */}
                    <div className="space-y-3 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4 text-blue-700" />
                        <span>Logistics Pipeline & Return Shipments</span>
                        {loadingDealerData && (
                          <span className="text-[10px] text-gray-400 font-normal animate-pulse">(fetching ledger...)</span>
                        )}
                      </span>

                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-[11px] font-sans">
                        <div className="max-h-[160px] overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b bg-gray-50 text-gray-400 font-mono text-[8px] uppercase font-black sticky top-0 bg-white">
                                <th className="py-2 px-3 text-left">Item Details</th>
                                <th className="py-2 px-3 text-center">Direction</th>
                                <th className="py-2 px-3 text-center">Status</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-gray-700">
                              {dealerTransfers.map((tr: any) => {
                                const isReturn = tr.status === 'Returned to HQ' || tr.status === 'Returned' || tr.status === 'Returned to HQ (Awaiting)';
                                return (
                                  <tr key={tr.id} className="hover:bg-gray-50/50">
                                    <td className="py-2 px-3">
                                      <div className="min-w-0">
                                        <p className="font-bold text-gray-950 truncate max-w-[150px] text-[10px]" title={tr.name}>{tr.name}</p>
                                        <p className="text-[9px] font-mono text-gray-400 font-bold">{tr.sku} &bull; {tr.quantity} units</p>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase font-mono border ${
                                        isReturn 
                                          ? 'bg-blue-50 text-blue-800 border-blue-150' 
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-150'
                                      }`}>
                                        {isReturn ? 'Dealer ➔ HQ' : 'HQ ➔ Dealer'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono">
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${
                                        tr.status === 'Accepted' || tr.status === 'Received at HQ'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : tr.status === 'Returned to HQ' || tr.status === 'Pending Acceptance'
                                          ? 'bg-orange-100 text-orange-800 animate-pulse'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {tr.status}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      {isReturn && (tr.status === 'Returned to HQ' || tr.status === 'Returned to HQ (Awaiting)') ? (
                                        <button
                                          type="button"
                                          onClick={() => handleAcknowledgeReturn(tr.id)}
                                          className="bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold py-1 px-2 rounded text-[9px] uppercase tracking-wide cursor-pointer transition shadow-sm inline-flex items-center gap-0.5"
                                        >
                                          <CheckSquare className="w-2.5 h-2.5" />
                                          <span>Receive</span>
                                        </button>
                                      ) : (
                                        <span className="text-[9px] text-gray-400 italic">No action</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {dealerTransfers.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-6 text-center text-gray-400 italic text-[10px]">
                                    No logged transport movements or returns in queue.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Live Retail Sales Ledger */}
                    <div className="space-y-3 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-700" />
                        <span>Live Franchise Retail Sales ({dealerSales.length})</span>
                        {loadingDealerData && (
                          <span className="text-[10px] text-gray-400 font-normal animate-pulse">(fetching sales...)</span>
                        )}
                      </span>

                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-[11px] font-sans">
                        <div className="max-h-[160px] overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b bg-gray-50 text-gray-400 font-mono text-[8px] uppercase font-black sticky top-0 bg-white">
                                <th className="py-2 px-3 text-left">Invoice No / Date</th>
                                <th className="py-2 px-3 text-left">Customer / Salesperson</th>
                                <th className="py-2 px-3 text-right">Total Value</th>
                                <th className="py-2 px-3 text-right">Invoice</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-gray-700">
                              {dealerSales.map((sale: any) => (
                                <tr key={sale.id} className="hover:bg-gray-50/50">
                                  <td className="py-2 px-3">
                                    <p className="font-bold text-gray-950 text-[10px]">{sale.invoiceNo}</p>
                                    <p className="text-[9px] font-mono text-gray-400 font-bold">{sale.date}</p>
                                  </td>
                                  <td className="py-2 px-3">
                                    <p className="font-bold text-gray-800 text-[10.5px]">{sale.customerName}</p>
                                    <p className="text-[9px] text-gray-400 font-mono">By: {sale.salespersonName || 'N/A'}</p>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                                    ₹{Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => downloadInvoiceHTML(sale, 'sale')}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-1 px-2 rounded text-[9px] uppercase tracking-wide cursor-pointer border border-emerald-200 transition inline-flex items-center gap-0.5"
                                      title="Download/Print PDF tax invoice"
                                    >
                                      <CloudDownload className="w-2.5 h-2.5 text-emerald-700" />
                                      <span>Invoice</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {dealerSales.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-6 text-center text-gray-400 italic text-[10px]">
                                    No recorded retail vehicle or spares sales found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Live Workshop Service Ledger */}
                    <div className="space-y-3 pt-3 border-t border-gray-150">
                      <span className="text-gray-900 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-indigo-700" />
                        <span>Live Franchise Workshop Jobs ({dealerServiceInvoices.length})</span>
                        {loadingDealerData && (
                          <span className="text-[10px] text-gray-400 font-normal animate-pulse">(fetching jobs...)</span>
                        )}
                      </span>

                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-[11px] font-sans">
                        <div className="max-h-[160px] overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b bg-gray-50 text-gray-400 font-mono text-[8px] uppercase font-black sticky top-0 bg-white">
                                <th className="py-2 px-3 text-left">Invoice No / Date</th>
                                <th className="py-2 px-3 text-left">Customer / Service Type</th>
                                <th className="py-2 px-3 text-right">Total Value</th>
                                <th className="py-2 px-3 text-right">Invoice</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-gray-700">
                              {dealerServiceInvoices.map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-gray-50/50">
                                  <td className="py-2 px-3">
                                    <p className="font-bold text-gray-950 text-[10px]">{inv.invoiceNo}</p>
                                    <p className="text-[9px] font-mono text-gray-400 font-bold">{inv.date}</p>
                                  </td>
                                  <td className="py-2 px-3">
                                    <p className="font-bold text-gray-800 text-[10.5px]">{inv.customerName}</p>
                                    <p className="text-[9px] text-gray-400 font-mono truncate max-w-[150px]" title={inv.productDescription}>
                                      {inv.productDescription || 'General Service'}
                                    </p>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-indigo-800">
                                    ₹{Number(inv.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => downloadInvoiceHTML(inv, 'service')}
                                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold py-1 px-2 rounded text-[9px] uppercase tracking-wide cursor-pointer border border-indigo-200 transition inline-flex items-center gap-0.5"
                                      title="Download/Print PDF tax invoice"
                                    >
                                      <CloudDownload className="w-2.5 h-2.5 text-indigo-700" />
                                      <span>Invoice</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {dealerServiceInvoices.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-6 text-center text-gray-400 italic text-[10px]">
                                    No recorded service invoices or workshop repair tickets found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
                    <Building2 className="w-12 h-12 text-gray-300 mb-3" />
                    <strong>No Dealership Selected</strong>
                    <span className="text-xs text-gray-400 max-w-xs mt-1 leading-normal">Query active database entries from the directory list panel on the left.</span>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 select-none flex items-center justify-between text-[9px] text-gray-400 font-mono">
                  <span>AUDITING WORKSTATION V24.16</span>
                  <span>SSL SECURED SYNC ACTIVE</span>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Admin Base64 Document previewer modal */}
      {adminOpenDocPreview && (
        <div className="fixed inset-0 bg-gray-950/65 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-xs font-sans">
          <div className="bg-white rounded-xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-xs uppercase text-[11px] tracking-wider">Compliance Document Auditing Vault</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 font-mono truncate max-w-[340px]">{adminOpenDocPreview.name}</p>
              </div>
              <button 
                onClick={() => setAdminOpenDocPreview(null)}
                className="bg-gray-200 hover:bg-gray-300 rounded-md py-1 px-2.5 text-[10px] font-bold text-gray-700 transition cursor-pointer"
              >
                Close Compliance View
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex items-center justify-center bg-gray-100 flex-1 min-h-[300px]">
              {adminOpenDocPreview.base64.startsWith('data:image/') ? (
                <img 
                  src={adminOpenDocPreview.base64} 
                  alt={adminOpenDocPreview.name} 
                  className="max-w-full max-h-[60vh] object-contain rounded border shadow-sm pointer-events-none" 
                  referrerPolicy="no-referrer"
                />
              ) : adminOpenDocPreview.base64.startsWith('data:application/pdf') ? (
                <div className="text-center space-y-4 p-8 bg-white border border-gray-200 rounded-xl max-w-sm">
                  <FileText className="w-16 h-16 text-indigo-700 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-gray-900">PDF Document Stream Verified</h4>
                    <p className="text-gray-500 font-sans leading-relaxed text-[11px]">
                      This is a raw binary payload stream uploaded by the physical dealer terminal during onboarding self-registration.
                    </p>
                  </div>
                  <a 
                    href={adminOpenDocPreview.base64} 
                    download={adminOpenDocPreview.name}
                    className="inline-block bg-indigo-700 hover:bg-indigo-850 text-white font-bold py-2 px-4 rounded-lg tracking-wider"
                  >
                    Download PDF Archive
                  </a>
                </div>
              ) : (
                <div className="text-center space-y-4 p-8 bg-white border border-gray-200 rounded-xl max-w-sm">
                  <FolderCheck className="w-16 h-16 text-emerald-700 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-gray-900">Raw Serialized Stream</h4>
                    <p className="text-gray-550 font-sans leading-relaxed text-[11px]">
                      Raw file stream successfully synced from franchisee local disk clusters to Master Control panels.
                    </p>
                  </div>
                  <div className="pt-2">
                    <a 
                      href={adminOpenDocPreview.base64} 
                      download={adminOpenDocPreview.name}
                      className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold px-4 py-2 rounded-lg"
                    >
                      Download Copy
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );

  function renderAdminDocItem(
    label: string,
    docObj: DealerDocument | undefined,
    idTag: string
  ) {
    return (
      <div id={idTag} className="border border-gray-150 p-2.5 rounded-lg flex items-center justify-between bg-gray-50/50">
        <div className="min-w-0 pr-1">
          <p className="text-gray-500 font-bold block text-[9px] uppercase tracking-wide truncate">{label}</p>
          {docObj ? (
            <p className="text-emerald-800 font-bold truncate text-[11px] font-sans mt-0.5" title={docObj.fileName}>
              {docObj.fileName}
            </p>
          ) : (
            <p className="text-red-650 font-bold text-[10px] font-mono mt-0.5 tracking-wider uppercase">Missing Document</p>
          )}
        </div>

        {docObj && (
          <button
            type="button"
            onClick={() => setAdminOpenDocPreview({ name: docObj.fileName, base64: docObj.fileData || '' })}
            className="p-1 text-emerald-850 hover:bg-emerald-50 rounded border border-emerald-200 bg-white shadow-sm shrink-0 flex items-center gap-0.5 font-bold cursor-pointer"
            title="Inspect statutory record copy"
          >
            <Eye className="w-3 h-3 text-emerald-700" />
            <span>Audit</span>
          </button>
        )}
      </div>

    );
  }
}
