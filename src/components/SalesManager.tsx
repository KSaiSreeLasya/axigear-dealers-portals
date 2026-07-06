import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Eye,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  X,
  Printer,
  Edit2
} from 'lucide-react';
import { Sale, InventoryItem, Employee, Dealer, ServiceInvoice, ServiceInvoiceItem } from '../types';
import { saveServiceInvoiceToDb } from '../lib/supabase';
import { downloadCSV, downloadInvoiceHTML } from '../utils/csvHelper';

export const SERVICE_PRODUCTS_PRESETS = [
  { name: 'Lithium Battery Pack Refurbishing', price: 12000 },
  { name: 'Smart Controller Assembly V2', price: 4500 },
  { name: 'Brushless DC Motor (BLDC) 250W Hub', price: 9500 },
  { name: 'Regenerative Braking Power Unit', price: 1800 },
  { name: 'Premium Heavy Duty Hydraulic Fork Front', price: 3200 },
  { name: 'High Traction Tubeless EV Tire 10"', price: 1400 },
  { name: 'High-Flow LED Headlamp Console', price: 1100 },
  { name: 'Reinforced Steel Main Chassis Fork', price: 6500 },
  { name: 'Carbon Fiber Smart Dashboard Visor', price: 900 },
  { name: 'Replacement Key Fob / NFC Card Pair', price: 750 }
];

interface SalesManagerProps {
  currentDealer: Dealer;
  inventory: InventoryItem[];
  sales: Sale[];
  employees: Employee[];
  onAddSale: (sale: Omit<Sale, 'id' | 'dealerId' | 'invoiceNo' | 'date'> & { date?: string; invoiceNo?: string }) => void;
  onDeleteSale?: (id: string) => void;
  onEditSale?: (sale: Sale) => void;
  onDeductInventoryStock: (itemId: string, quantity: number) => void;
}

export interface EstimationSplit {
  amount: number;
  paymentMethod: string;
  date: string;
}

export interface Estimation {
  id: string;
  dealerId: string;
  slipNo: string;
  customerName: string;
  contactNo: string;
  address: string;
  date: string;
  model: string;
  totalAmount: number;
  paymentMethod: string;
  leadSource: string;
  splits: EstimationSplit[];
}

export default function SalesManager({
  currentDealer,
  inventory,
  sales,
  employees,
  onAddSale,
  onDeleteSale,
  onEditSale,
  onDeductInventoryStock
}: SalesManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'projects' | 'pipeline' | 'serviceInvoices'>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEstimation, setEditingEstimation] = useState<Estimation | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingServiceInvoice, setEditingServiceInvoice] = useState<ServiceInvoice | null>(null);

  // Local isolation states
  const dealerSales = sales.filter(s => s.dealerId === currentDealer.id);
  const activeEmployees = employees.filter(e => e.dealerId === currentDealer.id && e.status === 'Active');

  // --- Estimations / Sales Pipeline synced to local storage ---
  const [estimations, setEstimations] = useState<Estimation[]>(() => {
    const disk = localStorage.getItem('axigear_estimations');
    if (disk) return JSON.parse(disk);
    
    // Seed initial estimations as shown in Image 2
    return [
      {
        id: 'est-seed-1',
        dealerId: '',
        slipNo: 'EST/26-27/001',
        customerName: 'Ananth Gowda',
        contactNo: '9845011223',
        address: 'Whitefield, Bangalore',
        date: '2026-06-22',
        model: 'Carbon X Pro',
        totalAmount: 145000,
        paymentMethod: 'UPI',
        leadSource: 'Walk In',
        splits: [
          { amount: 50000, paymentMethod: 'UPI', date: '2026-06-22' },
          { amount: 95000, paymentMethod: 'Bank Transfer', date: '2026-06-22' }
        ]
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('axigear_estimations', JSON.stringify(estimations));
  }, [estimations]);

  // --- Pipeline / Estimations State form ---
  const [estSlipNo, setEstSlipNo] = useState('');
  const [estCustomerName, setEstCustomerName] = useState('');
  const [estContactNo, setEstContactNo] = useState('');
  const [estAddress, setEstAddress] = useState('');
  const [estDate, setEstDate] = useState('2026-06-22');
  const [estModel, setEstModel] = useState('');
  const [estAmount, setEstAmount] = useState(0);
  const [estPaymentMethod, setEstPaymentMethod] = useState('Cash');
  const [estLeadSource, setEstLeadSource] = useState('Walk In');
  
  // Splits
  const [estSplits, setEstSplits] = useState<EstimationSplit[]>([
    { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }
  ]);

  // Smart numbering: reuse deleted slots
  const getNextEstimationSlipNo = () => {
    const dealerEsts = estimations.filter(e => e.dealerId === currentDealer.id);

    // Extract all used numbers from slip numbers like AAV-RRE-CODE-001
    const usedNumbers = new Set<number>();
    dealerEsts.forEach(est => {
      const match = est.slipNo.match(/-(\d{3})$/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    // Find first available slot
    let nextNum = 1;
    while (usedNumbers.has(nextNum)) {
      nextNum++;
    }

    return `AAV-RRE-ZENZ-EST-${String(nextNum).padStart(3, '0')}`;
  };

  useEffect(() => {
    // Auto-generate estimation slip number only if not editing
    if (!editingEstimation) {
      setEstSlipNo(getNextEstimationSlipNo());
    }
  }, [estimations, currentDealer.id, currentDealer.code, editingEstimation]);

  const handleAddSplit = () => {
    setEstSplits([...estSplits, { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const handleRemoveSplit = (idx: number) => {
    if (estSplits.length === 1) {
      setEstSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    } else {
      setEstSplits(estSplits.filter((_, i) => i !== idx));
    }
  };

  const handleSplitChange = (idx: number, field: keyof EstimationSplit, value: any) => {
    const next = [...estSplits];
    if (field === 'amount') {
      next[idx][field] = Number(value);
    } else {
      next[idx][field] = value;
    }
    setEstSplits(next);
  };

  const totalPaidInSplits = estSplits.reduce((acc, current) => acc + current.amount, 0);
  const remainingSplitAmount = estAmount - totalPaidInSplits;

  const handleSaveEstimation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!estCustomerName || !estModel || estAmount <= 0) {
      alert('Estimation requires Customer Name, Model name and correct total Amount.');
      return;
    }

    if (editingEstimation) {
      // Update existing estimation
      const updatedEst: Estimation = {
        ...editingEstimation,
        slipNo: estSlipNo,
        customerName: estCustomerName,
        contactNo: estContactNo,
        address: estAddress,
        date: estDate,
        model: estModel,
        totalAmount: estAmount,
        paymentMethod: estPaymentMethod,
        leadSource: estLeadSource,
        splits: estSplits.filter(s => s.amount > 0)
      };

      setEstimations(estimations.map(est => est.id === editingEstimation.id ? updatedEst : est));
      setEditingEstimation(null);
      alert('Estimation updated successfully!');
    } else {
      // Create new estimation
      const newEst: Estimation = {
        id: `est-uuid-${Math.floor(1000 + Math.random() * 9000)}`,
        dealerId: currentDealer.id,
        slipNo: estSlipNo,
        customerName: estCustomerName,
        contactNo: estContactNo,
        address: estAddress,
        date: estDate,
        model: estModel,
        totalAmount: estAmount,
        paymentMethod: estPaymentMethod,
        leadSource: estLeadSource,
        splits: estSplits.filter(s => s.amount > 0)
      };

      setEstimations([newEst, ...estimations]);
      alert('Estimation saved successfully!');
    }

    // reset fields
    setEstCustomerName('');
    setEstContactNo('');
    setEstAddress('');
    setEstModel('');
    setEstAmount(0);
    setEstSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const handleEditEstimation = (estimation: Estimation) => {
    setEditingEstimation(estimation);
    setEstSlipNo(estimation.slipNo);
    setEstCustomerName(estimation.customerName);
    setEstContactNo(estimation.contactNo);
    setEstAddress(estimation.address);
    setEstDate(estimation.date);
    setEstModel(estimation.model);
    setEstAmount(estimation.totalAmount);
    setEstPaymentMethod(estimation.paymentMethod);
    setEstLeadSource(estimation.leadSource);
    setEstSplits(estimation.splits.length > 0 ? estimation.splits : [{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEstimation = (id: string) => {
    if (confirm('Are you sure you want to delete this estimation?')) {
      setEstimations(estimations.filter(est => est.id !== id));
    }
  };

  const handleCancelEditEstimation = () => {
    setEditingEstimation(null);
    setEstCustomerName('');
    setEstContactNo('');
    setEstAddress('');
    setEstModel('');
    setEstAmount(0);
    setEstPaymentMethod('Cash');
    setEstLeadSource('Walk In');
    setEstSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const handleDeleteSale = (id: string) => {
    if (confirm('Are you sure you want to delete this sale?')) {
      if (onDeleteSale) {
        onDeleteSale(id);
      } else {
        console.log('Delete sale:', id);
        alert('Delete functionality handled by parent App component');
      }
    }
  };

  const handleDeleteServiceInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this service invoice?')) {
      setServiceInvoices(serviceInvoices.filter(inv => inv.id !== id));
    }
  };

  const handleEditServiceInvoice = (invoice: ServiceInvoice) => {
    setEditingServiceInvoice(invoice);
    setSrvInvoiceNo(invoice.invoiceNo);
    setSrvCustomerName(invoice.customerName);
    setSrvContactNo(invoice.customerPhone);
    setSrvLocation(invoice.location);
    setSrvInvoiceDate(invoice.date);
    setSrvLabourCharges(invoice.labourCharges);
    setSrvPaymentMethod(invoice.paymentMethod);
    setSrvLeadSource(invoice.leadSource);
    setSrvEnableGst(invoice.enableGst);
    setSrvProducts(invoice.products.length > 0 ? invoice.products : [{ id: 'srv-p-1', name: '', price: 0, quantity: 1 }]);
    setSrvProductDescription(invoice.productDescription);
    setSrvSplits(invoice.splits.length > 0 ? invoice.splits : [{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    setSrvDisplaySplits(invoice.displaySplitsInInvoice);
  };

  const handleCancelEditServiceInvoice = () => {
    setEditingServiceInvoice(null);
    setSrvCustomerName('');
    setSrvContactNo('');
    setSrvLocation('');
    setSrvLabourCharges(0);
    setSrvLeadSource('');
    setSrvProductDescription('');
    setSrvProducts([{ id: 'srv-p-1', name: '', price: 0, quantity: 1 }]);
    setSrvSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    setSrvDisplaySplits(false);
  };

  // --- Project / Sale Modal states matching Image 3 ---
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [viewingTaxInvoice, setViewingTaxInvoice] = useState<{
    type: 'sale' | 'estimation' | 'service';
    data: any;
  } | null>(null);

  // Invoice Form parameters (Image 1 and 2 fields)
  const [saleModelNo, setSaleModelNo] = useState('');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleContactNo, setSaleContactNo] = useState('');
  const [saleLocation, setSaleLocation] = useState('');
  const [saleProductDesc, setSaleProductDesc] = useState('');
  const [saleHsnNo, setSaleHsnNo] = useState('871160');
  const [saleChassisNo, setSaleChassisNo] = useState('');
  const [saleMotorNo, setSaleMotorNo] = useState('');
  const [saleBatteryNo, setSaleBatteryNo] = useState('');
  
  // Specifications
  const [saleBatteryWarranty, setSaleBatteryWarranty] = useState('36months or 30,000kms');
  const [saleBatteryCapacity, setSaleBatteryCapacity] = useState('45V-30AH');
  const [saleVehicleWarranty, setSaleVehicleWarranty] = useState('12 months');

  const [saleInvoiceDate, setSaleInvoiceDate] = useState('2026-06-22');
  const [saleAmount, setSaleAmount] = useState(0);
  const [salePaymentMode, setSalePaymentMode] = useState<'Cash' | 'Card' | 'UPI' | 'Bank Transfer'>('Cash');
  const [saleLeadSource, setSaleLeadSource] = useState('');
  const [saleGstNo, setSaleGstNo] = useState(() => {
    const dealerName = currentDealer.name?.toLowerCase() || '';
    if (dealerName.includes('zen') || dealerName.includes('zenz')) {
      return '36ABLFR7464F1ZR';
    }
    return '36ACJFA4386L1ZW';
  });
  const [saleDisplaySplits, setSaleDisplaySplits] = useState(false);
  const [saleSplits, setSaleSplits] = useState<Array<{ amount: number; paymentMethod: string; date: string }>>([
    { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }
  ]);

  // --- Service Invoice state initialization (Image 3) ---
  const [serviceInvoices, setServiceInvoices] = useState<ServiceInvoice[]>(() => {
    const disk = localStorage.getItem('axigear_service_invoices');
    if (disk) return JSON.parse(disk);
    return [
      {
        id: 'srv-seed-1',
        dealerId: currentDealer.id,
        invoiceNo: 'SRV/2026-27/001',
        customerName: 'Kambam venkata Maheswarlu',
        customerPhone: '970086927',
        location: 'Hyderabad',
        date: '2026-06-22',
        labourCharges: 1500,
        paymentMethod: 'Cash',
        leadSource: 'Direct Walk-in',
        enableGst: true,
        products: [
          { id: 'p-1', name: 'Brake Pad Replacement', price: 800, quantity: 1 },
          { id: 'p-2', name: 'Lithium Battery Connector', price: 450, quantity: 2 }
        ],
        productDescription: 'General general maintenance with complete connectors setup',
        totalAmount: 3360,
        splits: [
          { amount: 3360, paymentMethod: 'Cash', date: '2026-06-22' }
        ],
        displaySplitsInInvoice: true
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('axigear_service_invoices', JSON.stringify(serviceInvoices));
  }, [serviceInvoices]);

  const [srvInvoiceNo, setSrvInvoiceNo] = useState('SRV/2026-27/003');
  const [srvCustomerName, setSrvCustomerName] = useState('');
  const [srvContactNo, setSrvContactNo] = useState('');
  const [srvLocation, setSrvLocation] = useState('');
  const [srvInvoiceDate, setSrvInvoiceDate] = useState('2026-06-22');
  const [srvLabourCharges, setSrvLabourCharges] = useState(0);
  const [srvPaymentMethod, setSrvPaymentMethod] = useState('Cash');
  const [srvLeadSource, setSrvLeadSource] = useState('');
  const [srvEnableGst, setSrvEnableGst] = useState(true);
  const [srvProducts, setSrvProducts] = useState<ServiceInvoiceItem[]>([
    { id: 'srv-p-1', name: '', price: 0, quantity: 1 }
  ]);
  const [srvProductDescription, setSrvProductDescription] = useState('');
  const [srvSplits, setSrvSplits] = useState<Array<{ amount: number; paymentMethod: string; date: string }>>([
    { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }
  ]);
  const [srvDisplaySplits, setSrvDisplaySplits] = useState(false);

  useEffect(() => {
    // Auto-generate service invoice number
    const dealerSrvCount = serviceInvoices.filter(s => s.dealerId === currentDealer.id).length + 1;
    setSrvInvoiceNo(`AAV-RRE-ZENZ-SRV-${String(dealerSrvCount).padStart(3, '0')}`);
  }, [serviceInvoices, currentDealer.id, currentDealer.code]);

  // Split calculations for Sale Entry
  const totalPaidInSaleSplits = saleSplits.reduce((acc, current) => acc + current.amount, 0);
  const remainingSaleSplitAmount = saleAmount - totalPaidInSaleSplits;

  const handleAddSaleSplit = () => {
    setSaleSplits([...saleSplits, { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const handleRemoveSaleSplit = (idx: number) => {
    if (saleSplits.length === 1) {
      setSaleSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    } else {
      setSaleSplits(saleSplits.filter((_, i) => i !== idx));
    }
  };

  const handleSaleSplitChange = (idx: number, field: keyof EstimationSplit, value: any) => {
    const next = [...saleSplits];
    if (field === 'amount') {
      next[idx][field] = Number(value);
    } else {
      next[idx][field] = value;
    }
    setSaleSplits(next);
  };

  // Service Invoice Products utilities
  const handleAddSrvProduct = () => {
    setSrvProducts([...srvProducts, { id: `srv-p-${Date.now()}-${Math.random()}`, name: '', price: 0, quantity: 1 }]);
  };

  const handleRemoveSrvProduct = (idx: number) => {
    if (srvProducts.length === 1) {
      setSrvProducts([{ id: `srv-p-1`, name: '', price: 0, quantity: 1 }]);
    } else {
      setSrvProducts(srvProducts.filter((_, i) => i !== idx));
    }
  };

  const handleSrvProductChange = (idx: number, field: keyof ServiceInvoiceItem, value: any) => {
    const next = [...srvProducts];
    if (field === 'price' || field === 'quantity') {
      next[idx][field] = Number(value);
    } else {
      next[idx][field] = value as any;
    }
    setSrvProducts(next);
  };

  const srvProductTotal = srvProducts.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const srvSubtotal = srvProductTotal + srvLabourCharges;
  const srvGstAmount = srvEnableGst ? Math.round(srvSubtotal * 0.05 * 100) / 100 : 0;
  const srvInvoiceTotal = srvSubtotal + srvGstAmount;

  // Split calculations for Service
  const totalPaidInSrvSplits = srvSplits.reduce((acc, current) => acc + current.amount, 0);
  const remainingSrvSplitAmount = srvInvoiceTotal - totalPaidInSrvSplits;

  const handleAddSrvSplit = () => {
    setSrvSplits([...srvSplits, { amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const handleRemoveSrvSplit = (idx: number) => {
    if (srvSplits.length === 1) {
      setSrvSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    } else {
      setSrvSplits(srvSplits.filter((_, i) => i !== idx));
    }
  };

  const handleSrvSplitChange = (idx: number, field: keyof EstimationSplit, value: any) => {
    const next = [...srvSplits];
    if (field === 'amount') {
      next[idx][field] = Number(value);
    } else {
      next[idx][field] = value;
    }
    setSrvSplits(next);
  };

  // Add Service Invoice handle
  const handleCreateServiceInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvCustomerName) {
      alert('Customer Name is mandatory.');
      return;
    }

    if (editingServiceInvoice) {
      // Update existing invoice
      const updatedSrvInvoice: ServiceInvoice = {
        ...editingServiceInvoice,
        invoiceNo: srvInvoiceNo,
        customerName: srvCustomerName,
        customerPhone: srvContactNo,
        location: srvLocation,
        date: srvInvoiceDate,
        labourCharges: srvLabourCharges,
        paymentMethod: srvPaymentMethod,
        leadSource: srvLeadSource,
        enableGst: srvEnableGst,
        products: srvProducts.filter(p => p.name !== ''),
        productDescription: srvProductDescription,
        totalAmount: srvInvoiceTotal,
        splits: srvSplits.filter(s => s.amount > 0),
        displaySplitsInInvoice: srvDisplaySplits
      };

      setServiceInvoices(serviceInvoices.map(inv => inv.id === editingServiceInvoice.id ? updatedSrvInvoice : inv));
      saveServiceInvoiceToDb(updatedSrvInvoice).catch(console.error);
      alert('Service invoice updated successfully!');
    } else {
      // Create new invoice
      const newSrvInvoice: ServiceInvoice = {
        id: `srv-uuid-${Math.floor(1000 + Math.random() * 9000)}`,
        dealerId: currentDealer.id,
        invoiceNo: srvInvoiceNo,
        customerName: srvCustomerName,
        customerPhone: srvContactNo,
        location: srvLocation,
        date: srvInvoiceDate,
        labourCharges: srvLabourCharges,
        paymentMethod: srvPaymentMethod,
        leadSource: srvLeadSource,
        enableGst: srvEnableGst,
        products: srvProducts.filter(p => p.name !== ''),
        productDescription: srvProductDescription,
        totalAmount: srvInvoiceTotal,
        splits: srvSplits.filter(s => s.amount > 0),
        displaySplitsInInvoice: srvDisplaySplits
      };

      setServiceInvoices([newSrvInvoice, ...serviceInvoices]);
      saveServiceInvoiceToDb(newSrvInvoice).catch(console.error);
      alert('Service invoice created successfully!');
    }

    // reset fields
    setSrvCustomerName('');
    setSrvContactNo('');
    setSrvLocation('');
    setSrvLabourCharges(0);
    setSrvLeadSource('');
    setSrvProductDescription('');
    setSrvProducts([{ id: 'srv-p-1', name: '', price: 0, quantity: 1 }]);
    setSrvSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
    setSrvDisplaySplits(false);
    setEditingServiceInvoice(null);
  };

  const handleCreateSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerName || !saleModelNo || !saleChassisNo) {
      alert('Model number, Customer name and Chassis number keys are mandatory.');
      return;
    }

    const saleData = {
      customerName: saleCustomerName,
      customerPhone: saleContactNo,
      items: [
        {
          itemId: `bike-${Math.floor(100 + Math.random() * 900)}`,
          name: `${saleModelNo} - ${saleProductDesc || 'Electric Bike'}`,
          quantity: 1,
          pricePerUnit: saleAmount
        }
      ],
      totalAmount: saleAmount,
      paymentMethod: salePaymentMode,
      salespersonId: activeEmployees[0]?.id || 'staff-1',
      salespersonName: activeEmployees[0]?.name || 'Branch Office Head',
      modelNo: saleModelNo,
      location: saleLocation,
      productDesc: saleProductDesc,
      hsnNo: saleHsnNo,
      chassisNo: saleChassisNo,
      motorNo: saleMotorNo,
      batteryNo: saleBatteryNo,
      batteryWarranty: saleBatteryWarranty,
      batteryCapacity: saleBatteryCapacity,
      vehicleWarranty: saleVehicleWarranty,
      gstNo: saleGstNo,
      leadSource: saleLeadSource,
      splits: saleSplits.filter(s => s.amount > 0),
      displaySplitsInInvoice: saleDisplaySplits,
      date: saleInvoiceDate
    };

    if (editingSale) {
      const updatedSale: Sale = {
        ...editingSale,
        ...saleData,
        items: saleData.items
      };
      if (onEditSale) {
        onEditSale(updatedSale);
      }
    } else {
      onAddSale(saleData);
    }

    setIsAddSaleOpen(false);
    setEditingSale(null);

    // reset fields
    setSaleModelNo('');
    setSaleCustomerName('');
    setSaleContactNo('');
    setSaleLocation('');
    setSaleProductDesc('');
    setSaleHsnNo('871160');
    setSaleChassisNo('');
    setSaleMotorNo('');
    setSaleBatteryNo('');
    setSaleBatteryWarranty('36months or 30,000kms');
    setSaleBatteryCapacity('45V-30AH');
    setSaleVehicleWarranty('12 months');
    setSaleAmount(0);
    setSaleLeadSource('');
    setSaleDisplaySplits(false);
    setSaleSplits([{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
  };

  const filteredProjects = dealerSales.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.customerName.toLowerCase().includes(q) || 
           item.invoiceNo.toLowerCase().includes(q) ||
           item.items.some(x => x.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Upper header segment */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950 font-sans">Sales</h1>
        <p className="text-gray-500 text-xs mt-1">
          Create and manage EV bike sales entries, invoices, and retailer accounts.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveSubTab('projects')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
            activeSubTab === 'projects' 
              ? 'bg-emerald-700 text-white shadow' 
              : 'bg-gray-105 text-gray-500 hover:text-gray-800'
          }`}
        >
          Projects
        </button>
        <button
          onClick={() => setActiveSubTab('pipeline')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
            activeSubTab === 'pipeline' 
              ? 'bg-emerald-700 text-white shadow' 
              : 'bg-gray-105 text-gray-500 hover:text-gray-800'
          }`}
        >
          Sales Pipeline
        </button>
        <button
          onClick={() => setActiveSubTab('serviceInvoices')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
            activeSubTab === 'serviceInvoices' 
              ? 'bg-emerald-700 text-white shadow' 
              : 'bg-gray-105 text-gray-500 hover:text-gray-800'
          }`}
        >
          Service Invoices
        </button>
      </div>

      {activeSubTab === 'projects' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          
          {/* Top functional line */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search projects, buyers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-gray-805 text-xs py-2 px-3 pl-8 rounded-lg border border-gray-200 focus:outline-none focus:border-emerald-600"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => downloadCSV(filteredProjects, 'Retail_Sales_Ledger')}
                className="w-full sm:w-auto bg-white border border-gray-200 text-gray-750 font-bold py-2 px-4 rounded-lg text-xs tracking-wide hover:border-emerald-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Sales CSV</span>
              </button>
              
              <button
                id="projects-add-sale-btn"
                onClick={() => setIsAddSaleOpen(true)}
                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2 px-5 rounded-lg text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add sale</span>
              </button>
            </div>
          </div>

          {/* Projects List table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-gray-250 bg-gray-50 text-gray-405 font-mono text-[9px] uppercase font-bold text-center">
                    <th className="py-3 px-4 text-left font-bold">Model No</th>
                    <th className="py-3 px-4 text-left">Customer Name</th>
                    <th className="py-3 px-4">Contact No</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-left">Product Desc</th>
                    <th className="py-3 px-4 font-mono">Invoice Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-700 text-center">
                  {filteredProjects.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-55/35 transition-colors">
                      <td className="py-4 px-4 font-bold text-gray-950 text-left">
                        {sale.items[0]?.name.split(' - ')[0] || 'AX-120'}
                      </td>
                      <td className="py-4 px-4 text-left font-semibold text-emerald-800">
                        {sale.customerName}
                      </td>
                      <td className="py-4 px-4 font-mono">{sale.customerPhone || '99999 55555'}</td>
                      <td className="py-4 px-4 text-gray-500">Bangalore Central</td>
                      <td className="py-4 px-4 text-left max-w-[140px] truncate">
                        {sale.items[0]?.name.split(' - ')[1] || 'Carbon Steel Classic'}
                      </td>
                      <td className="py-4 px-4 font-mono text-gray-400">{sale.date}</td>
                      <td className="py-4 px-4 font-bold text-left font-mono text-right text-gray-950">
                        ₹{sale.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-650 font-bold text-[10px]">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingTaxInvoice({ type: 'sale', data: sale })}
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded text-[10px] font-bold tracking-wider cursor-pointer border border-emerald-105"
                          >
                            Invoice
                          </button>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingSale(sale);
                              setSaleModelNo(sale.modelNo || '');
                              setSaleCustomerName(sale.customerName);
                              setSaleContactNo(sale.customerPhone || '');
                              setSaleLocation(sale.location || '');
                              setSaleProductDesc(sale.productDesc || '');
                              setSaleHsnNo(sale.hsnNo || '871160');
                              setSaleChassisNo(sale.chassisNo || '');
                              setSaleMotorNo(sale.motorNo || '');
                              setSaleBatteryNo(sale.batteryNo || '');
                              setSaleBatteryWarranty(sale.batteryWarranty || '36months or 30,000kms');
                              setSaleBatteryCapacity(sale.batteryCapacity || '45V-30AH');
                              setSaleVehicleWarranty(sale.vehicleWarranty || '12 months');
                              setSaleInvoiceDate(sale.date);
                              setSaleAmount(sale.totalAmount);
                              setSalePaymentMode(sale.paymentMethod as any);
                              setSaleLeadSource(sale.leadSource || '');
                              setSaleGstNo(sale.gstNo || '');
                              setSaleDisplaySplits(sale.displaySplitsInInvoice !== false);
                              setSaleSplits(sale.splits || [{ amount: 0, paymentMethod: 'Cash', date: '2026-06-22' }]);
                              setIsAddSaleOpen(true);
                            }}
                            className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-[10px] font-bold cursor-pointer transition-colors"
                            title="Edit sale"
                          >
                            Edit
                          </a>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete sale"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        No projects or sales registered yet. Click "+ Add sale" to insert your first EV bike receipt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'pipeline' && (
        // pipeline sub-tab
        <div className="space-y-6 animate-in fade-in duration-100">
          
          {/* Import/Export block */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row items-center gap-3">
            <button
              onClick={() => downloadCSV(estimations, 'Pipeline_Estimations')}
              className="flex items-center gap-1.5 bg-white border text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold hover:border-emerald-600 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Estimations CSV</span>
            </button>
            <span className="text-[10px] text-gray-400 font-sans italic md:ml-auto">
              Pipeline estimations can be exported as standard XLSX sheets incorporating multi-payment splits records.
            </span>
          </div>

          {/* Add Estimation form layout of Image 2 */}
          <form onSubmit={handleSaveEstimation} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                {editingEstimation ? 'Edit Estimation' : 'Add Estimation'}
              </h2>
              {editingEstimation && (
                <button
                  type="button"
                  onClick={handleCancelEditEstimation}
                  className="text-xs font-bold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Estimation Slip No</label>
                <input
                  type="text"
                  required
                  value={estSlipNo}
                  onChange={(e) => setEstSlipNo(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Customer Name"
                  value={estCustomerName}
                  onChange={(e) => setEstCustomerName(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Contact No.</label>
                <input
                  type="text"
                  placeholder="Enter Contact No."
                  value={estContactNo}
                  onChange={(e) => setEstContactNo(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Address</label>
                <input
                  type="text"
                  placeholder="Enter Customer Address"
                  value={estAddress}
                  onChange={(e) => setEstAddress(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Date</label>
                <input
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Model</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Bike Model e.g. Carbon Gear"
                  value={estModel}
                  onChange={(e) => setEstModel(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Amount (Estimation Target)</label>
                <input
                  type="number"
                  required
                  value={estAmount}
                  onChange={(e) => setEstAmount(Number(e.target.value))}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Payment Method</label>
                <select
                  value={estPaymentMethod}
                  onChange={(e) => setEstPaymentMethod(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">Lead Source</label>
                <input
                  type="text"
                  placeholder="Lead Source e.g. Google Maps"
                  value={estLeadSource}
                  onChange={(e) => setEstLeadSource(e.target.value)}
                  className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
            </div>

            {/* PAYMENT BREAKDOWN BLOCK */}
            <div className="border border-gray-150 rounded-2xl p-4 md:p-6 bg-gray-50/50 space-y-4">
              <h3 className="text-xs font-bold text-gray-850 uppercase tracking-wide">Payment Breakdown (Split Payments)</h3>
              
              {/* Split payment metrics indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Invoice Amount</span>
                  <p className="text-sm font-bold text-gray-800 font-mono mt-1">₹{estAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 text-emerald-800">Total Paid</span>
                  <p className="text-sm font-bold text-emerald-600 font-mono mt-1">₹{totalPaidInSplits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border text-center relative overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Remaining</span>
                  <p className={`text-xs font-bold font-mono mt-1 ${remainingSplitAmount <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ₹{remainingSplitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  {remainingSplitAmount <= 0 && estAmount > 0 && (
                    <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                      <span className="bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded tracking-widest">PAYMENT COMPLETE!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Splits lines array */}
              <div className="space-y-2.5">
                {estSplits.map((spl, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl border">
                    <div className="w-full md:flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Amount (Rs) <span className="font-mono text-emerald-600">split #{idx + 1}</span></label>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={spl.amount}
                        onChange={(e) => handleSplitChange(idx, 'amount', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none"
                      />
                    </div>

                    <div className="w-full md:w-56 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Payment Method</label>
                      <select
                        value={spl.paymentMethod}
                        onChange={(e) => handleSplitChange(idx, 'paymentMethod', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div className="w-full md:w-44 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Date</label>
                      <input
                        type="date"
                        value={spl.date}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none font-mono"
                        onChange={(e) => handleSplitChange(idx, 'date', e.target.value)}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveSplit(idx)}
                        className="p-1 px-1.5 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSplit}
                className="text-[10px] font-bold uppercase tracking-wider text-gray-650 flex items-center justify-center gap-1 bg-white border border-dashed py-1.5 px-4 rounded-lg hover:border-emerald-600"
              >
                + Add Another Payment Method
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2.5 px-8 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
              >
                {editingEstimation ? 'Update Estimation' : 'Save Estimation'}
              </button>
              {editingEstimation && (
                <button
                  type="button"
                  onClick={handleCancelEditEstimation}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 px-8 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Estimations registry table list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-950 uppercase tracking-wide">Saved Pipeline Estimations</h2>
              <span className="text-[10px] font-mono text-gray-400">Total: {estimations.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-250 bg-gray-55 text-gray-400 font-mono text-[9px] uppercase font-bold text-center">
                    <th className="py-2.5 px-4 text-left">Slip #</th>
                    <th className="py-2.5 px-4 text-left">Customer Name</th>
                    <th className="py-2.5 px-4">Model Code</th>
                    <th className="py-2.5 px-4 text-right">Target Amount</th>
                    <th className="py-2.5 px-4">Lead Source</th>
                    <th className="py-2.5 px-4">Splits Done</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-700 text-center">
                  {estimations.map((est) => {
                    const splitSum = est.splits.reduce((s, x) => s + x.amount, 0);
                    return (
                      <tr key={est.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-950 text-left">{est.slipNo}</td>
                        <td className="py-3 px-4 text-left font-semibold text-emerald-800">{est.customerName}</td>
                        <td className="py-3 px-4">{est.model}</td>
                        <td className="py-3 px-4 font-bold font-mono text-right">₹{est.totalAmount.toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4"><span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">{est.leadSource}</span></td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full ${splitSum >= est.totalAmount ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {est.splits.length} split(s) (₹{splitSum.toLocaleString('en-IN')})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingTaxInvoice({ type: 'estimation', data: est })}
                              className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded text-[10px] font-bold tracking-wider cursor-pointer border border-emerald-105"
                            >
                              Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditEstimation(est)}
                              className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit estimation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEstimation(est.id)}
                              className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete estimation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeSubTab === 'serviceInvoices' && (
        <div className="space-y-6 animate-in fade-in duration-100 text-gray-800">
          
          {/* Header/Subtitle */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-gray-950">Service Invoices</h1>
            <p className="text-gray-500 text-xs">Create and manage service invoices with PDF generation and split metrics.</p>
          </div>

          {/* Import/Export block */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wide">Import/Export Service Invoices</h3>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <button
                type="button"
                onClick={() => alert('Service Invoice CSV template loaded')}
                className="flex items-center gap-1.5 bg-white border text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold hover:border-emerald-600 transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Import CSV/Excel</span>
              </button>
              <button
                type="button"
                onClick={() => downloadCSV(serviceInvoices, 'Service_Invoices_Report')}
                className="flex items-center gap-1.5 bg-white border text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold hover:border-emerald-600 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Service Invoices CSV</span>
              </button>
              <span className="text-[10px] text-gray-400 font-sans italic md:ml-auto">
                CSV/Excel files must have headers matching column names (e.g., serviceInvoiceNo, customerName, etc.)
              </span>
            </div>
          </div>

          {/* Form Block: Create New Service Invoice */}
          <form onSubmit={handleCreateServiceInvoiceSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6 text-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                {editingServiceInvoice ? 'Edit Service Invoice' : 'Create New Service Invoice'}
              </h2>
              {editingServiceInvoice && (
                <button
                  type="button"
                  onClick={handleCancelEditServiceInvoice}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Invoice No</label>
                <input
                  type="text"
                  required
                  disabled
                  value={srvInvoiceNo}
                  className="w-full bg-gray-50 text-gray-500 border border-gray-200 rounded-lg py-2 px-3 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Customer Name"
                  value={srvCustomerName}
                  onChange={(e) => setSrvCustomerName(e.target.value)}
                  className="w-full bg-white text-gray-805 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Contact No</label>
                <input
                  type="text"
                  placeholder="Contact No"
                  value={srvContactNo}
                  onChange={(e) => setSrvContactNo(e.target.value)}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Location</label>
                <input
                  type="text"
                  placeholder="Location"
                  value={srvLocation}
                  onChange={(e) => setSrvLocation(e.target.value)}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={srvInvoiceDate}
                  onChange={(e) => setSrvInvoiceDate(e.target.value)}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Labour Charges</label>
                <input
                  type="number"
                  placeholder="Labour Charges"
                  value={srvLabourCharges}
                  onChange={(e) => setSrvLabourCharges(Number(e.target.value))}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Mode of Payment</label>
                <select
                  value={srvPaymentMethod}
                  onChange={(e) => setSrvPaymentMethod(e.target.value)}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Lead Source</label>
                <input
                  type="text"
                  placeholder="e.g. Direct Walk-In, Referral"
                  value={srvLeadSource}
                  onChange={(e) => setSrvLeadSource(e.target.value)}
                  className="w-full bg-white text-gray-850 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pl-0.5">
              <input
                type="checkbox"
                id="srvEnableGst"
                checked={srvEnableGst}
                onChange={(e) => setSrvEnableGst(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="srvEnableGst" className="text-xs font-bold text-gray-700">Enable GST (5%)</label>
            </div>

            {/* Products Array Line Items matching Image 3 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-1">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider pl-0.5">Products</h3>
                <button
                  type="button"
                  onClick={handleAddSrvProduct}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-850 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="space-y-2">
                {srvProducts.map((p, idx) => (
                  <div key={p.id} className="flex flex-col md:flex-row items-center gap-3 bg-gray-55/40 p-3 rounded-xl border">
                    <div className="w-full md:flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Select Product</label>
                      <select
                        value={p.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          const preset = SERVICE_PRODUCTS_PRESETS.find(x => x.name === val);
                          handleSrvProductChange(idx, 'name', val);
                          if (preset) {
                            handleSrvProductChange(idx, 'price', preset.price);
                          }
                        }}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2 rounded focus:outline-none"
                      >
                        <option value="">-- Choose Spare/Service Product --</option>
                        {SERVICE_PRODUCTS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>{preset.name} (₹{preset.price})</option>
                        ))}
                        <option value="Custom Spare part">Custom Spare part (Manual entry)</option>
                      </select>
                      {p.name.includes("Custom") && (
                        <input
                          type="text"
                          placeholder="Type product name"
                          value={p.name === "Custom Spare part" ? "" : p.name}
                          onChange={(e) => handleSrvProductChange(idx, 'name', e.target.value)}
                          className="mt-1.5 w-full bg-white text-xs border border-gray-200 py-1 px-2.5 rounded"
                        />
                      )}
                    </div>

                    <div className="w-full md:w-36 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Price</label>
                      <input
                        type="number"
                        placeholder="Price"
                        value={p.price}
                        onChange={(e) => handleSrvProductChange(idx, 'price', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none font-mono"
                      />
                    </div>

                    <div className="w-full md:w-28 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Quantity</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={p.quantity}
                        onChange={(e) => handleSrvProductChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none font-mono"
                      />
                    </div>

                    <div className="w-full md:w-32 space-y-1">
                      <label className="text-[9px] font-bold text-[#A3ADB8] uppercase block">Amount</label>
                      <span className="inline-block py-1 px-2 font-mono font-bold text-gray-700">
                        ₹{(p.price * p.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveSrvProduct(idx)}
                        className="p-1 px-1.5 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Descriptions (comma-separated) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase pl-0.5">Product Descriptions (comma-separated)</label>
              <textarea
                placeholder="Add descriptions for products"
                value={srvProductDescription}
                onChange={(e) => setSrvProductDescription(e.target.value)}
                rows={2}
                className="w-full bg-white text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Calculations Total Summary matching Image 3 blue/gray layout */}
            <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 space-y-2 text-xs font-sans text-gray-700">
              <div className="flex justify-between">
                <span>Product Total:</span>
                <span className="font-mono">₹{srvProductTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Labour Charges:</span>
                <span className="font-mono">₹{srvLabourCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%):</span>
                <span className="font-mono">₹{srvGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg">
                <span>Invoice Total:</span>
                <span className="font-mono">₹{srvInvoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Split payments details block */}
            <div className="border border-gray-150 rounded-2xl p-4 md:p-6 bg-gray-50/50 space-y-4">
              <h3 className="text-xs font-bold text-gray-855 uppercase tracking-wide">Payment Details (Split Payments)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Invoice Amount</span>
                  <p className="text-sm font-bold text-gray-800 font-mono mt-1">₹{srvInvoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 text-emerald-800">Total Paid</span>
                  <p className="text-sm font-bold text-emerald-600 font-mono mt-1">₹{totalPaidInSrvSplits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border text-center relative overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Remaining</span>
                  <p className={`text-xs font-bold font-mono mt-1 ${remainingSrvSplitAmount <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ₹{remainingSrvSplitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  {remainingSrvSplitAmount <= 0 && srvInvoiceTotal > 0 && (
                    <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                      <span className="bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded tracking-widest">PAYMENT COMPLETE!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Splits lines array */}
              <div className="space-y-2.5">
                {srvSplits.map((spl, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl border">
                    <div className="w-full md:flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Amount (Rs) <span className="font-mono text-emerald-600">split #{idx + 1}</span></label>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={spl.amount}
                        onChange={(e) => handleSrvSplitChange(idx, 'amount', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none"
                      />
                    </div>

                    <div className="w-full md:w-56 space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Payment Method</label>
                      <select
                        value={spl.paymentMethod}
                        onChange={(e) => handleSrvSplitChange(idx, 'paymentMethod', e.target.value)}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div className="w-full md:w-44 space-y-1 font-bold">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Date</label>
                      <input
                        type="date"
                        value={spl.date}
                        className="w-full bg-white text-xs border border-gray-205 py-1 px-2.5 rounded focus:outline-none font-mono"
                        onChange={(e) => handleSrvSplitChange(idx, 'date', e.target.value)}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveSrvSplit(idx)}
                        className="p-1 px-1.5 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSrvSplit}
                className="text-[10px] font-bold uppercase tracking-wider text-gray-655 flex items-center justify-center gap-1 bg-white border border-dashed py-1.5 px-4 rounded-lg hover:border-emerald-600"
              >
                + Add Another Payment Method
              </button>

              <div className="flex items-center gap-2 pt-1 font-bold">
                <input
                  type="checkbox"
                  id="srvDisplaySplits"
                  checked={srvDisplaySplits}
                  onChange={(e) => setSrvDisplaySplits(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="srvDisplaySplits" className="text-xs font-semibold text-gray-600">
                  Display split payment details in invoice (e.g., "Cash: ₹30,000, UPI: ₹30,000")
                </label>
              </div>
            </div>

            <div className="flex pt-2 font-bold">
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2.5 px-8 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
              >
                Create Invoice
              </button>
            </div>
          </form>

          {/* Saved Service Invoices Table list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm animate-in fade-in">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center bg-semibold">
              <h2 className="text-xs font-bold text-gray-955 uppercase tracking-wide">Saved Technical Service Invoices</h2>
              <span className="text-[10px] font-mono text-gray-400 font-bold">Total: {serviceInvoices.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-250 bg-gray-55 text-gray-400 font-mono text-[9px] uppercase font-bold text-center">
                    <th className="py-2.5 px-4 text-left font-sans text-bold">Invoice No</th>
                    <th className="py-2.5 px-4 text-left font-sans text-bold">Customer Name</th>
                    <th className="py-2.5 px-4 font-sans text-center text-bold">Contact</th>
                    <th className="py-2.5 px-4 font-mono text-bold">Date</th>
                    <th className="py-2.5 px-4 text-right font-sans text-bold">Labour Charges</th>
                    <th className="py-2.5 px-4 text-right font-sans text-bold">Total Amount</th>
                    <th className="py-2.5 px-4 text-right font-sans text-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-750 text-center text-bold">
                  {serviceInvoices.map((srv) => (
                    <tr key={srv.id} className="hover:bg-gray-50 font-bold">
                      <td className="py-3 px-4 font-bold text-gray-950 text-left">{srv.invoiceNo}</td>
                      <td className="py-3 px-4 text-left font-semibold text-emerald-800">{srv.customerName}</td>
                      <td className="py-3 px-4 font-mono">{srv.customerPhone || 'N/A'}</td>
                      <td className="py-3 px-4 font-mono text-gray-400">{srv.date}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-650">₹{srv.labourCharges.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-bold font-mono text-right text-emerald-700">₹{srv.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingTaxInvoice({ type: 'service', data: srv })}
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded text-[10px] font-bold tracking-wider cursor-pointer border border-emerald-105"
                          >
                            Invoice
                          </button>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleEditServiceInvoice(srv);
                            }}
                            className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-[10px] font-bold cursor-pointer transition-colors"
                            title="Edit service invoice"
                          >
                            Edit
                          </a>
                          <button
                            onClick={() => handleDeleteServiceInvoice(srv.id)}
                            className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete service invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {serviceInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 font-bold">No service invoices issued yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD SALE OVERLAY MODAL MATCHING IMAGE 3 FIELDS --- */}
      {isAddSaleOpen && (
        <div className="fixed inset-0 bg-[#0A0B0D]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col text-gray-800 font-sans">
            <div className="bg-gray-50 border-b p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base text-gray-950 uppercase tracking-wide">
                  {editingSale ? 'Edit sales entry' : 'New sales entry'}
                </h3>
                <p className="text-gray-450 text-[10px] mt-0.5">
                  {editingSale ? 'Update motorcycle sale transaction' : 'Register direct retail motorcycle sale transactions'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddSaleOpen(false);
                  setEditingSale(null);
                }}
                className="p-1 px-1.5 hover:bg-gray-100 rounded text-gray-550"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSaleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Segment 1: Customer details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-emerald-800 border-b pb-1">1. Customer Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold text-gray-450 uppercase">Customer Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anand Kumar"
                      value={saleCustomerName}
                      onChange={(e) => setSaleCustomerName(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Contact No.</label>
                    <input
                      type="text"
                      placeholder="Contact details"
                      value={saleContactNo}
                      onChange={(e) => setSaleContactNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={saleLocation}
                      onChange={(e) => setSaleLocation(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Segment 2: Vehicle Specs */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-emerald-800 border-b pb-1">2. Vehicle Specifications</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-450 uppercase">Model No</label>
                    <input
                      type="text"
                      required
                      placeholder="Model"
                      value={saleModelNo}
                      onChange={(e) => setSaleModelNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-450 uppercase">Product Description</label>
                    <input
                      type="text"
                      placeholder="Bike details"
                      value={saleProductDesc}
                      onChange={(e) => setSaleProductDesc(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">HSN No.</label>
                    <input
                      type="text"
                      value={saleHsnNo}
                      placeholder="HSN code"
                      onChange={(e) => setSaleHsnNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-450 uppercase font-mono">Chassis No.</label>
                    <input
                      type="text"
                      required
                      placeholder="Chassis identification code"
                      value={saleChassisNo}
                      onChange={(e) => setSaleChassisNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1 font-mono">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Motor No.</label>
                    <input
                      type="text"
                      placeholder="Motor code"
                      value={saleMotorNo}
                      onChange={(e) => setSaleMotorNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 font-mono">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Battery No.</label>
                    <input
                      type="text"
                      placeholder="Battery serial"
                      value={saleBatteryNo}
                      onChange={(e) => setSaleBatteryNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Segment 3: Battery & Warranty specs */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-emerald-800 border-b pb-1">3. Power Source & Warranty Clauses</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Battery Warranty</label>
                    <input
                      type="text"
                      value={saleBatteryWarranty}
                      onChange={(e) => setSaleBatteryWarranty(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Battery Capacity</label>
                    <input
                      type="text"
                      value={saleBatteryCapacity}
                      onChange={(e) => setSaleBatteryCapacity(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Vehicle Warranty</label>
                    <input
                      type="text"
                      value={saleVehicleWarranty}
                      onChange={(e) => setSaleVehicleWarranty(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Segment 4: Financial audit trail */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-emerald-800 border-b pb-1">4. Payment & Invoice Settling</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Invoice Date</label>
                    <input
                      type="date"
                      value={saleInvoiceDate}
                      onChange={(e) => setSaleInvoiceDate(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-450 uppercase">Invoice Value (₹)</label>
                    <input
                      type="number"
                      required
                      value={saleAmount}
                      onChange={(e) => setSaleAmount(Number(e.target.value))}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Mode of Payment</label>
                    <select
                      value={salePaymentMode}
                      onChange={(e) => setSalePaymentMode(e.target.value as any)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">GST Number</label>
                    <input
                      type="text"
                      placeholder="GSTIN No"
                      value={saleGstNo}
                      onChange={(e) => setSaleGstNo(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-455 uppercase">Lead Source</label>
                    <input
                      type="text"
                      placeholder="e.g. Instagram Ad"
                      value={saleLeadSource}
                      onChange={(e) => setSaleLeadSource(e.target.value)}
                      className="w-full bg-white text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Direct Sales Split Payments */}
                <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/50 space-y-4">
                  <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Sales Split Payment Breakdown</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border text-center">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Total Purchase Amount</span>
                      <p className="text-sm font-bold text-gray-800 font-mono mt-1">₹{saleAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border text-center">
                      <span className="text-[9px] uppercase font-bold text-emerald-800">Total Registered Splits</span>
                      <p className="text-sm font-bold text-emerald-600 font-mono mt-1">₹{totalPaidInSaleSplits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border text-center relative overflow-hidden">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Underpaid/Overpaid Balance</span>
                      <p className={`text-xs font-bold font-mono mt-1 ${remainingSaleSplitAmount === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        ₹{remainingSaleSplitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      {remainingSaleSplitAmount === 0 && saleAmount > 0 && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                          <span className="bg-emerald-600 text-white font-bold text-[8px] px-2 py-0.5 rounded tracking-wider">BALANCE PERFECT</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {saleSplits.map((spl, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl border">
                        <div className="w-full md:flex-1 space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Amount (₹)</label>
                          <input
                            type="number"
                            value={spl.amount}
                            onChange={(e) => handleSaleSplitChange(idx, 'amount', e.target.value)}
                            className="w-full bg-white text-xs border border-gray-200 py-1.5 px-2.5 rounded focus:outline-none"
                          />
                        </div>

                        <div className="w-full md:w-56 space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Payment Method</label>
                          <select
                            value={spl.paymentMethod}
                            onChange={(e) => handleSaleSplitChange(idx, 'paymentMethod', e.target.value)}
                            className="w-full bg-white text-xs border border-gray-200 py-1.5 px-2.5 rounded focus:outline-none"
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>

                        <div className="w-full md:w-44 space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Date</label>
                          <input
                            type="date"
                            value={spl.date}
                            className="w-full bg-white text-xs border border-gray-200 py-1.5 px-2.5 rounded focus:outline-none font-mono"
                            onChange={(e) => handleSaleSplitChange(idx, 'date', e.target.value)}
                          />
                        </div>

                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={() => handleRemoveSaleSplit(idx)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSaleSplit}
                    className="text-[9px] font-bold uppercase tracking-wider text-gray-650 flex items-center justify-center gap-1 bg-white border border-dashed py-1.5 px-4 rounded-lg hover:border-emerald-600"
                  >
                    + Add Split payment row
                  </button>

                  <div className="flex items-center gap-2 pt-1 font-bold">
                    <input
                      type="checkbox"
                      id="saleDisplaySplits"
                      checked={saleDisplaySplits}
                      onChange={(e) => setSaleDisplaySplits(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="saleDisplaySplits" className="text-xs font-semibold text-gray-600">
                      Display split payment details in invoice (e.g., "Cash: ₹30,000, UPI: ₹30,000")
                    </label>
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="pt-4 flex border-t justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddSaleOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-650 rounded-lg text-xs font-bold transition-all cursor-pointer border"
                >
                  Discard Form
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2 px-6 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
                >
                  Save Entry
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- REUSABLE GST TAX INVOICE MODAL WINDOW (IMAGE 4 FORMAT) --- */}
      {viewingTaxInvoice && (
        <div className="invoice-print-modal-overlay fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="invoice-print-modal-content bg-white rounded-xl max-w-4xl w-full border border-gray-300 shadow-2xl relative flex flex-col text-gray-800 font-sans my-8">
            
            {/* Modal Controls (Sticky / non-printing) */}
            <div className="bg-gray-150 p-4 border-b flex justify-between items-center print:hidden rounded-t-xl">
              <span className="font-bold tracking-tight text-emerald-800 text-xs uppercase flex items-center gap-1.5 font-mono">
                <Printer className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>GST Tax Invoice Viewer (AXIGEAR-SYSTEM)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadInvoiceHTML(viewingTaxInvoice.data, viewingTaxInvoice.type)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Offline HTML</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-850 text-white font-bold rounded-lg text-xs tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setViewingTaxInvoice(null)}
                  className="p-1 px-3 bg-gray-100 hover:bg-gray-200 rounded border text-gray-550 cursor-pointer text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Invoice paper container */}
            <div className="p-6 md:p-8 space-y-6 font-sans text-[11px] leading-relaxed select-text" id="printable-gst-invoice-block">
              
              {/* Header Label bar */}
              <div className="text-center font-bold text-sm tracking-widest uppercase border border-gray-800 py-1 bg-gray-100/90 text-gray-900 border-b-2">
                {viewingTaxInvoice.type === 'estimation' ? 'PROFORMA TAX INVOICE / ESTIMATION SLIP' : 'TAX INVOICE'}
              </div>

              {/* Company & Dealer metadata details double column header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-400 pb-4">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-base tracking-tight text-gray-950">AXIGEAR LOUNGE LLP</h4>
                  <p className="text-gray-500 text-[10px]">
                    Registered Office: SY 02, PLOT NO.148, MYTHRI NAGAR, MADINAGUDA

                    HYDERABAD, TELANGANA, INDIA 500049<br />
                    
                    State:TELANGANA | Code: 36
                  </p>
                  <p className="font-mono text-[9px] font-bold bg-emerald-50 text-emerald-800 inline-block px-1.5 py-0.5 rounded border border-emerald-200">
                     GSTIN: 36ACJFA4386L1ZW
                  </p>
                </div>

                <div className="space-y-1 md:text-right border-t md:border-t-0 pt-4 md:pt-0">
                  <span className="text-emerald-800 text-[9px] font-bold uppercase tracking-wider block">RETAIL OUTLET / FRANCHISEE</span>
                  <h4 className="font-bold text-gray-900 text-xs">{currentDealer.name}</h4>
                  <p className="text-gray-500 text-[10px]">
                    Store Address: {currentDealer.location}<br />
                    Dealer License Ref No: {currentDealer.code}<br />
                    Authorized Billing Point | State: Telangana | Code: 36
                  </p>
                  <p className="font-mono font-bold text-[9.5px] text-gray-800">
                    FRANCHISE REGISTERED GSTIN: {(() => {
                      const dealerName = currentDealer.name?.toLowerCase() || '';
                      if (dealerName.includes('zen') || dealerName.includes('zenz')) {
                        return '36ABLFR7464F1ZR';
                      }
                      return viewingTaxInvoice.type === 'sale' && viewingTaxInvoice.data.gstNo ? viewingTaxInvoice.data.gstNo : '29AXGPI8174C3ZD';
                    })()}
                  </p>
                </div>
              </div>

              {/* Invoice Meta Grid block */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200/80">
                <div>
                  <span className="text-gray-400 text-[9px] font-bold uppercase block">Invoice Serial No #</span>
                  <p className="font-mono font-bold text-emerald-800 text-xs mt-0.5">
                    {viewingTaxInvoice.type === 'sale' ? viewingTaxInvoice.data.invoiceNo : 
                     viewingTaxInvoice.type === 'service' ? viewingTaxInvoice.data.invoiceNo : 
                     viewingTaxInvoice.data.slipNo}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-[9px] font-bold uppercase block">Billing Date</span>
                  <p className="font-semibold text-gray-750 font-mono mt-0.5">
                    {viewingTaxInvoice.type === 'sale' ? viewingTaxInvoice.data.date : 
                     viewingTaxInvoice.type === 'service' ? viewingTaxInvoice.data.date : 
                     viewingTaxInvoice.data.date}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-[9px] font-bold uppercase block">State of Supply</span>
                  <p className="font-semibold text-gray-700 mt-0.5">Telangana (Code: 36)</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[9px] font-bold uppercase block">Lead Attribution</span>
                  <p className="font-medium text-gray-705 italic mt-0.5">
                    {viewingTaxInvoice.data.leadSource || 'Walk-In'}
                  </p>
                </div>
              </div>

              {/* Buyer / Customer Info card */}
              <div className="border border-gray-250 p-4 rounded-lg bg-white shadow-xs space-y-1">
                <span className="text-emerald-800 uppercase tracking-widest text-[8.5px] font-extrabold block">BUYER / CONSIGNEE (BILL TO)</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-extrabold text-gray-900 text-xs">{viewingTaxInvoice.data.customerName}</p>
                    <p className="text-[10px] text-gray-555 font-mono italic">Mobile Phone: {viewingTaxInvoice.data.customerPhone || 'N/A'}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-gray-550 text-[10px]">Supply Address: {viewingTaxInvoice.data.location || viewingTaxInvoice.data.customerAddress || 'Direct Store Delivery'}</p>
                  </div>
                </div>
              </div>

              {/* Goods & Line services list breakdown */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-100 text-gray-600 font-mono text-[8px] uppercase font-bold text-center">
                      <th className="py-2 px-3 text-left w-10 font-bold">S.No</th>
                      <th className="py-2 px-3 text-left font-bold">Description of Goods / Services</th>
                      <th className="py-2 px-3 font-bold">HSN Code</th>
                      <th className="py-2 px-3 font-bold">Serial / Specifications</th>
                      <th className="py-2 px-3 text-right font-bold">Qty</th>
                      <th className="py-2 px-3 text-right font-bold">Rate</th>
                      <th className="py-2 px-3 text-right font-bold">SGST / CGST</th>
                      <th className="py-2 px-3 text-right font-bold">Taxable Settle Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-center font-sans text-gray-700">
                    
                    {/* Render corresponding items based on invoice type */}
                    {viewingTaxInvoice.type === 'sale' && (
                      <tr className="align-top">
                        <td className="py-3 px-3 text-left">01</td>
                        <td className="py-3 px-3 text-left">
                          <span className="font-bold text-gray-900 block">{viewingTaxInvoice.data.items[0]?.name.split(' - ')[0] || 'AX-120 EV Bike'}</span>
                          <span className="text-gray-500 text-[9px] block italic leading-snug">
                            {viewingTaxInvoice.data.items[0]?.name.split(' - ')[1] || 'Carbon Steel Premium'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">871160</td>
                        <td className="py-3 px-3 text-left space-y-0.5 text-[9px] leading-tight-more">
                          <p><span className="text-gray-400 font-mono">Chassis:</span> <span className="font-bold text-gray-800 font-mono">{viewingTaxInvoice.data.chassisNo || 'N/A'}</span></p>
                          <p><span className="text-gray-400 font-mono">Motor:</span> <span className="font-bold text-gray-800 font-mono">{viewingTaxInvoice.data.motorNo || 'N/A'}</span></p>
                          <p><span className="text-gray-400 font-mono">Battery:</span> <span className="font-bold text-gray-800 font-mono">{viewingTaxInvoice.data.batteryNo || 'N/A'} (Capacity: {viewingTaxInvoice.data.batteryCapacity || '45V-30AH'})</span></p>
                          <p><span className="text-gray-400">Warranty:</span> <span className="text-emerald-700 font-bold">{viewingTaxInvoice.data.batteryWarranty || '36 months'} (Vehicle: {viewingTaxInvoice.data.vehicleWarranty || '12 months'})</span></p>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">1 unit</td>
                        <td className="py-3 px-3 text-right font-mono">₹{(viewingTaxInvoice.data.totalAmount / 1.05).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-3 text-right font-mono text-[9px] text-gray-500">
                          CGST 2.5%<br />SGST 2.5%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">₹{viewingTaxInvoice.data.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )}

                    {viewingTaxInvoice.type === 'estimation' && (
                      <tr className="align-top">
                        <td className="py-3 px-3 text-left">01</td>
                        <td className="py-3 px-3 text-left">
                          <span className="font-bold text-gray-900 block">{viewingTaxInvoice.data.model || 'AX-120 EV Bike'}</span>
                          <span className="text-gray-500 text-[9px] block italic leading-snug">
                            Estimation proforma vehicle record
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">871160</td>
                        <td className="py-3 px-3 text-center text-gray-400 font-mono italic">
                          No Serial assigned (Estimation Stage)
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">1 unit</td>
                        <td className="py-3 px-3 text-right font-mono">₹{(viewingTaxInvoice.data.totalAmount / 1.05).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-3 text-right font-mono text-[9px] text-gray-500">
                          CGST 2.5%<br />SGST 2.5%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">₹{viewingTaxInvoice.data.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )}

                    {viewingTaxInvoice.type === 'service' && (
                      <>
                        {viewingTaxInvoice.data.products?.map((p: any, pIdx: number) => (
                          <tr key={p.id || pIdx} className="align-top">
                            <td className="py-2.5 px-3 text-left">{String(pIdx + 1).padStart(2, '0')}</td>
                            <td className="py-2.5 px-3 text-left">
                              <span className="font-bold text-gray-900">{p.name}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-center">870899</td>
                            <td className="py-2.5 px-3 text-center text-gray-400 font-mono italic">Technical spare part replacements</td>
                            <td className="py-2.5 px-3 text-right font-semibold">{p.quantity} unit(s)</td>
                            <td className="py-2.5 px-3 text-right font-mono">₹{p.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[9px] text-gray-500">
                              {viewingTaxInvoice.data.enableGst ? 'CGST 2.5%\nSGST 2.5%' : '0% Exempt'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                              ₹{(p.price * p.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {/* Labour Service Charge row */}
                        {viewingTaxInvoice.data.labourCharges > 0 && (
                          <tr className="align-top bg-gray-50/55 font-bold">
                            <td className="py-3 px-3 text-left">{String((viewingTaxInvoice.data.products?.length || 0) + 1).padStart(2, '0')}</td>
                            <td className="py-3 px-3 text-left">
                              <span className="font-bold text-emerald-800">Professional Labour & Diagnostic charges</span>
                            </td>
                            <td className="py-3 px-3 font-mono">998729</td>
                            <td className="py-3 px-3 text-center text-gray-400 italic">Technical support hours</td>
                            <td className="py-3 px-3 text-right font-semibold">1 unit</td>
                            <td className="py-3 px-3 text-right font-mono">₹{viewingTaxInvoice.data.labourCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 px-3 text-right font-mono text-[9px] text-gray-500">
                              {viewingTaxInvoice.data.enableGst ? 'CGST 2.5%\nSGST 2.5%' : '0% Exempt'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                              ₹{viewingTaxInvoice.data.labourCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                  </tbody>
                </table>
              </div>

              {/* Tax Calculations Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  
                  {/* Split payments list conditional display */}
                  {viewingTaxInvoice.data.splits && viewingTaxInvoice.data.splits.length > 0 && (
                    <div className="border border-emerald-250 bg-emerald-50/45 p-4 rounded-lg">
                      <h5 className="font-bold text-gray-800 uppercase tracking-widest text-[8.5px] mb-2 border-b border-emerald-200 pb-1 font-mono">REGISTERED SPLIT SETTLEMENT PAYMENTS</h5>
                      <div className="space-y-1 bg-white p-2 rounded border border-emerald-100">
                        {viewingTaxInvoice.data.splits.map((sp: any, spix: number) => (
                          <div key={spix} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="font-bold text-gray-700">{sp.paymentMethod} Payment:</span>
                            <span className="font-semibold text-emerald-800">₹{sp.amount.toLocaleString('en-IN')} (Done: {sp.date})</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold border-t pt-1 mt-1 text-[10px]">
                          <span>TOTAL SETTLED:</span>
                          <span className="text-emerald-955 font-mono font-bold">
                            ₹{viewingTaxInvoice.data.splits.reduce((sum: number, el: any) => sum + el.amount, 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-450 italic space-y-1 leading-snug">
                    <p><strong>Terms & Conditions of Supply:</strong></p>
                    <p>1. Goods once sold will not replace or exchanged back under any circumstances.</p>
                    <p>2. Subject to Uttar Pradesh state juridistic restrictions only.</p>
                    <p>3. Dynamic 5% local SGST + CGST applied on Electric bikes registered under national policy incentive guidelines.</p>
                  </div>
                </div>

                <div className="bg-gray-100/90 p-4 rounded-lg border border-gray-300 space-y-2.5 font-sans font-semibold">
                  
                  {/* Calculation logic */}
                  {(() => {
                    const grossValue = viewingTaxInvoice.data.totalAmount || 
                                       ((viewingTaxInvoice.data.products?.reduce((s: number, p: any) => s + (p.price * p.quantity), 0) || 0) + (viewingTaxInvoice.data.labourCharges || 0)) || 0;
                    
                    const isGstEnabled = viewingTaxInvoice.type === 'service' ? viewingTaxInvoice.data.enableGst : true;
                    const baseValue = isGstEnabled ? (grossValue / 1.05) : grossValue;
                    const cGst = isGstEnabled ? (baseValue * 0.025) : 0;
                    const sGst = isGstEnabled ? (baseValue * 0.025) : 0;

                    return (
                      <>
                        <div className="flex justify-between text-gray-650">
                          <span>Gross Value (Tax-Exclusive Total Price):</span>
                          <span className="font-mono bg-white px-2.5 rounded">₹{baseValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Central Excise Goods Tax (CGST 2.5%):</span>
                          <span className="font-mono">₹{cGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 border-b pb-2">
                          <span>State Services Goods Tax (SGST 2.5%):</span>
                          <span className="font-mono">₹{sGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-black text-gray-950 text-sm bg-gray-200/85 p-2.5 rounded-md">
                          <span>NET INVOICE VALUE (INCLUSIVE OF ALL TAXES):</span>
                          <span className="font-mono text-emerald-805 text-sm font-semibold">₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Company signature line bottom right */}
              <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-gray-400 hover:text-gray-500 font-bold self-end text-[9px] font-mono leading-none">
                  * Dynamic billing audit index: {viewingTaxInvoice.data.id} • Registered server secure point
                </div>
                <div className="text-right space-y-4">
                  <span className="text-gray-400 font-bold block text-[9px]">For AXIGEAR LOUNGE LLP</span>
                  <div className="h-6"></div>
                  <span className="border-t border-gray-400 pt-1 px-4 inline-block font-extrabold text-gray-900 text-[10px]">Authorized Signatory</span>
                </div>
              </div>

              <div className="border border-dashed p-3 text-center text-gray-450 italic text-[9.5px]">
                This is a computer generated digital Tax Invoice, and requires no physical ink signature. All warranty clauses are active.
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
