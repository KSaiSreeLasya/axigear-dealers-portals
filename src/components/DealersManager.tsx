import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Download, Eye, FileText, Search, ShieldCheck } from 'lucide-react';
import { Dealer } from '../types';
import { downloadInvoiceHTML } from '../utils/csvHelper';

export interface DealerProduct {
  id: string;
  modelNo: string;
  dealerId: string;
  dealerName: string;
  dealerCode: string;
  contactNo: string;
  location: string;
  productDesc: string;
  hsnNo: string;
  noOfVehicles: number;
  chassisNo: string;
  motorNo: string;
  batteryNo: string;
  batterySpecs: string;
  batteryWarranty: string;
  batteryCapacity: string;
  vehicleWarranty: string;
  invoiceDate: string;
  amount: number;
  paymentMode: string;
}

interface DealersManagerProps {
  dealers: Dealer[];
  onAddDealer: (dealer: Omit<Dealer, 'id' | 'code'>) => void;
  onDeleteDealer: (id: string) => void;
}

export default function DealersManager({
  dealers,
  onAddDealer,
  onDeleteDealer
}: DealersManagerProps) {
  
  const [activeSubTab, setActiveSubTab] = useState<'dealers' | 'products'>('dealers');
  
  // Dealers Form State
  const [dealerName, setDealerName] = useState('');
  const [dealerContact, setDealerContact] = useState('');
  const [dealerAddress, setDealerAddress] = useState('');

  // Products State synced locally
  const [products, setProducts] = useState<DealerProduct[]>(() => {
    const disk = localStorage.getItem('axigear_dealer_products');
    if (disk) return JSON.parse(disk);
    
    // Seed an initial product to match image 8's row
    return [
      {
        id: 'prod-1',
        modelNo: '1234',
        dealerId: dealers[0]?.id || 'dealer-1',
        dealerName: 'demo',
        dealerCode: '123',
        contactNo: '1234567890',
        location: 'dfghjk',
        productDesc: 'hyster zl9',
        hsnNo: '345678',
        noOfVehicles: 0,
        chassisNo: '123456789',
        motorNo: '456789',
        batteryNo: '234567890',
        batterySpecs: 'Lead acid',
        batteryWarranty: '12 months',
        batteryCapacity: '48V 24AH',
        vehicleWarranty: '12 months',
        invoiceDate: '2026-06-11',
        amount: 50000,
        paymentMode: 'Cheque'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('axigear_dealer_products', JSON.stringify(products));
  }, [products]);

  // Product Form State inline
  const [prodModel, setProdModel] = useState('');
  const [prodDealerId, setProdDealerId] = useState('');
  const [prodDealerCode, setProdDealerCode] = useState('');
  const [prodContact, setProdContact] = useState('');
  const [prodLocation, setProdLocation] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodHsn, setProdHsn] = useState('');
  const [prodCount, setProdCount] = useState(0);

  const [prodChassis, setProdChassis] = useState('');
  const [prodMotor, setProdMotor] = useState('');
  const [prodBattery, setProdBattery] = useState('');

  const [prodBatterySpecs, setProdBatterySpecs] = useState('');
  const [prodBatteryWarranty, setProdBatteryWarranty] = useState('');
  const [prodBatteryCapacity, setProdBatteryCapacity] = useState('');
  const [prodVehicleWarranty, setProdVehicleWarranty] = useState('');

  const [prodInvoiceDate, setProdInvoiceDate] = useState('');
  const [prodAmount, setProdAmount] = useState(0);
  const [prodPaymentMode, setProdPaymentMode] = useState('');

  // Handle auto filling dealer details on dropdown selection
  useEffect(() => {
    const selected = dealers.find(d => d.id === prodDealerId);
    if (selected) {
      setProdDealerCode(selected.code.split('-')[1] || selected.code);
      setProdContact(selected.phone);
      setProdLocation(selected.location);
    }
  }, [prodDealerId, dealers]);

  const handleAddDealerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerName || !dealerContact || !dealerAddress) {
      alert('All fields are required.');
      return;
    }
    
    onAddDealer({
      name: dealerName,
      phone: dealerContact,
      location: dealerAddress,
      email: `${dealerName.toLowerCase().replace(/\s+/g, '')}@axigear.com`,
      managerName: 'Station Head'
    });

    setDealerName('');
    setDealerContact('');
    setDealerAddress('');
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodModel || !prodDealerId) {
      alert('Model No and Dealer are mandatory fields.');
      return;
    }

    const selectedDealer = dealers.find(d => d.id === prodDealerId);
    const dName = selectedDealer ? selectedDealer.name : 'Unknown';

    const newProd: DealerProduct = {
      id: `prod-${Math.floor(1000 + Math.random() * 9000)}`,
      modelNo: prodModel,
      dealerId: prodDealerId,
      dealerName: dName,
      dealerCode: prodDealerCode,
      contactNo: prodContact,
      location: prodLocation,
      productDesc: prodDesc,
      hsnNo: prodHsn,
      noOfVehicles: Number(prodCount),
      chassisNo: prodChassis,
      motorNo: prodMotor,
      batteryNo: prodBattery,
      batterySpecs: prodBatterySpecs,
      batteryWarranty: prodBatteryWarranty,
      batteryCapacity: prodBatteryCapacity,
      vehicleWarranty: prodVehicleWarranty,
      invoiceDate: prodInvoiceDate,
      amount: Number(prodAmount),
      paymentMode: prodPaymentMode || 'Cash'
    };

    setProducts([newProd, ...products]);

    // Reset clean
    setProdModel('');
    setProdDealerId('');
    setProdDealerCode('');
    setProdContact('');
    setProdLocation('');
    setProdDesc('');
    setProdHsn('');
    setProdCount(0);
    setProdChassis('');
    setProdMotor('');
    setProdBattery('');
    setProdBatterySpecs('');
    setProdBatteryWarranty('');
    setProdBatteryCapacity('');
    setProdVehicleWarranty('');
    setProdInvoiceDate('');
    setProdAmount(0);
    setProdPaymentMode('');
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950 font-sans">Dealers</h1>
        <p className="text-gray-500 text-xs mt-1">Manage dealers and their products.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveSubTab('dealers')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
            activeSubTab === 'dealers' 
              ? 'bg-emerald-700 text-white shadow' 
              : 'bg-gray-105 text-gray-500 hover:text-gray-800'
          }`}
        >
          Dealers
        </button>
        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
            activeSubTab === 'products' 
              ? 'bg-emerald-700 text-white shadow' 
              : 'bg-gray-105 text-gray-500 hover:text-gray-800'
          }`}
        >
          Products
        </button>
      </div>

      {activeSubTab === 'dealers' ? (
        <div className="space-y-6">
          {/* Add Dealer Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wide">Add New Dealer</h2>
            <form onSubmit={handleAddDealerSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">Dealer Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter dealer name"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  className="w-full bg-white text-gray-800 text-xs border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">Contact No.</label>
                <input
                  type="text"
                  required
                  placeholder="Enter contact number"
                  value={dealerContact}
                  onChange={(e) => setDealerContact(e.target.value)}
                  className="w-full bg-white text-gray-800 text-xs border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">Address</label>
                <input
                  type="text"
                  required
                  placeholder="Enter address"
                  value={dealerAddress}
                  onChange={(e) => setDealerAddress(e.target.value)}
                  className="w-full bg-white text-gray-800 text-xs border border-gray-200 rounded-lg py-2.5 px-3 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-650"
                />
              </div>

              <div className="md:col-span-3 flex justify-start pt-2">
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2 px-5 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
                >
                  Add Dealer
                </button>
              </div>
            </form>
          </div>

          {/* Dealers List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-950 uppercase tracking-wide">Dealers List</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-250 bg-gray-55 text-gray-400 font-mono text-[10px] uppercase font-bold">
                    <th className="py-3 px-4 font-semibold">Dealer Name</th>
                    <th className="py-3 px-4 font-semibold">Contact No.</th>
                    <th className="py-3 px-4 font-semibold">Address</th>
                    <th className="py-3 px-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-xs text-gray-800">
                  {dealers.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3.5 px-4 font-semibold text-gray-950">{d.name}</td>
                      <td className="py-3.5 px-3.5 font-mono">{d.phone || '+91 99999 99999'}</td>
                      <td className="py-3.5 px-4 text-gray-500">{d.location}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onDeleteDealer(d.id)}
                          className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Dealer Location"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dealers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">No dealers configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add New Product Form following exact layout and categories in image 8 */}
          <form onSubmit={handleAddProductSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wide">Add New Product</h2>
            
            {/* Row 1: Basic Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-800 border-b pb-1">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Model No</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter model number"
                    value={prodModel}
                    onChange={(e) => setProdModel(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Dealer Name</label>
                  <select
                    required
                    value={prodDealerId}
                    onChange={(e) => setProdDealerId(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-205 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Select Dealer</option>
                    {dealers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Dealer Code</label>
                  <input
                    type="text"
                    placeholder="Enter dealer code"
                    value={prodDealerCode}
                    onChange={(e) => setProdDealerCode(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Contact No</label>
                  <input
                    type="text"
                    placeholder="Enter contact number"
                    value={prodContact}
                    onChange={(e) => setProdContact(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Location</label>
                  <input
                    type="text"
                    placeholder="Enter location"
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Product Description</label>
                  <input
                    type="text"
                    placeholder="Enter product description"
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">HSN No</label>
                  <input
                    type="text"
                    placeholder="Enter HSN number"
                    value={prodHsn}
                    onChange={(e) => setProdHsn(e.target.value)}
                    className="w-full bg-white text-gray-855 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">No. of Vehicles</label>
                  <input
                    type="number"
                    value={prodCount}
                    onChange={(e) => setProdCount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Vehicle Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-800 border-b pb-1">Vehicle Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Chassis No</label>
                  <input
                    type="text"
                    placeholder="Enter chassis number"
                    value={prodChassis}
                    onChange={(e) => setProdChassis(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Motor No</label>
                  <input
                    type="text"
                    placeholder="Enter motor number"
                    value={prodMotor}
                    onChange={(e) => setProdMotor(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Battery No</label>
                  <input
                    type="text"
                    placeholder="Enter battery number"
                    value={prodBattery}
                    onChange={(e) => setProdBattery(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Battery & Warranty */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-800 border-b pb-1">Battery & Warranty</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Battery & Vehicle Specifications</label>
                  <input
                    type="text"
                    placeholder="Enter specifications"
                    value={prodBatterySpecs}
                    onChange={(e) => setProdBatterySpecs(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Battery Warranty</label>
                  <input
                    type="text"
                    placeholder="Enter battery warranty"
                    value={prodBatteryWarranty}
                    onChange={(e) => setProdBatteryWarranty(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Battery Capacity</label>
                  <input
                    type="text"
                    placeholder="Enter battery capacity"
                    value={prodBatteryCapacity}
                    onChange={(e) => setProdBatteryCapacity(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Vehicle Warranty</label>
                  <input
                    type="text"
                    placeholder="Enter vehicle warranty"
                    value={prodVehicleWarranty}
                    onChange={(e) => setProdVehicleWarranty(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Invoice & Payment */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-800 border-b pb-1">Invoice & Payment</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Invoice Date</label>
                  <input
                    type="date"
                    value={prodInvoiceDate}
                    onChange={(e) => setProdInvoiceDate(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Amount</label>
                  <input
                    type="number"
                    value={prodAmount}
                    onChange={(e) => setProdAmount(Number(e.target.value))}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Mode of Payment</label>
                  <select
                    value={prodPaymentMode}
                    onChange={(e) => setProdPaymentMode(e.target.value)}
                    className="w-full bg-white text-gray-850 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none"
                  >
                    <option value="">Select Payment Mode</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-850 text-white font-bold py-2 px-6 rounded-lg text-xs tracking-wider transition-all cursor-pointer"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => {
                  setProdModel('');
                  setProdDealerId('');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-650 font-bold py-2 px-6 rounded-lg text-xs tracking-wider transition-all cursor-pointer border"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Products List Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-950 uppercase tracking-wide">Products List</h2>
              <span className="text-[10px] font-mono text-gray-400">Total Rows: {products.length}</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-250 bg-gray-55 text-gray-400 font-mono text-[9px] uppercase font-bold text-center">
                    <th className="py-2.5 px-2 text-left font-semibold">Model No</th>
                    <th className="py-2.5 px-2 text-left font-semibold">Dealer Name</th>
                    <th className="py-2.5 px-2 font-semibold">Dealer Code</th>
                    <th className="py-2.5 px-2 font-semibold">Contact</th>
                    <th className="py-2.5 px-2 font-semibold">Location</th>
                    <th className="py-2.5 px-2 text-left font-semibold">Product Desc</th>
                    <th className="py-2.5 px-2 font-semibold">HSN No</th>
                    <th className="py-2.5 px-2 font-semibold">Vehicles</th>
                    <th className="py-2.5 px-2 font-semibold">Chassis No</th>
                    <th className="py-2.5 px-2 font-semibold">Motor No</th>
                    <th className="py-2.5 px-2 font-semibold">Battery No</th>
                    <th className="py-2.5 px-2 font-semibold">Invoice Date</th>
                    <th className="py-2.5 px-2 font-semibold">Amount</th>
                    <th className="py-2.5 px-2 font-semibold">Payment Mode</th>
                    <th className="py-2.5 px-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-700 text-center">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-3.5 px-2 text-left font-bold text-gray-950">{p.modelNo}</td>
                      <td className="py-3.5 px-2 text-left font-semibold text-emerald-800">{p.dealerName}</td>
                      <td className="py-3.5 px-2 font-mono">{p.dealerCode}</td>
                      <td className="py-3.5 px-2 text-gray-500 font-mono text-[10px]">{p.contactNo}</td>
                      <td className="py-3.5 px-2 text-gray-550 max-w-[80px] truncate">{p.location}</td>
                      <td className="py-3.5 px-2 text-left truncate max-w-[100px]">{p.productDesc}</td>
                      <td className="py-3.5 px-2 font-mono text-[10px]">{p.hsnNo}</td>
                      <td className="py-3.5 px-2 font-bold">{p.noOfVehicles}</td>
                      <td className="py-3.5 px-2 font-mono text-gray-500">{p.chassisNo}</td>
                      <td className="py-3.5 px-2 font-mono text-gray-500">{p.motorNo}</td>
                      <td className="py-3.5 px-2 font-mono text-gray-500">{p.batteryNo}</td>
                      <td className="py-3.5 px-2 font-mono">{p.invoiceDate}</td>
                      <td className="py-3.5 px-2 font-bold font-mono">₹{p.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-2">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-semibold">{p.paymentMode}</span>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              const inv = {
                                id: p.id,
                                type: 'product',
                                invoiceNumber: `INV-${p.modelNo}-${p.chassisNo.slice(-4) || 'DLR'}`,
                                dealerName: p.dealerName,
                                contactNo: p.contactNo,
                                location: p.location,
                                invoiceDate: p.invoiceDate,
                                dueDate: p.invoiceDate,
                                poNumber: `PO-${p.dealerCode}`,
                                sentTo: p.dealerName,
                                shipTo: p.location,
                                paymentMode: p.paymentMode,
                                items: [
                                  {
                                    product: `${p.modelNo} (${p.productDesc})`,
                                    description: `Chassis: ${p.chassisNo} | Motor: ${p.motorNo} | Battery: ${p.batteryNo}`,
                                    unit: p.noOfVehicles,
                                    amount: p.amount / p.noOfVehicles,
                                    gstRate: 18
                                  }
                                ],
                                taxableValue: Math.round((p.amount / 1.18) * 100) / 100,
                                gstAmount: Math.round((p.amount - (p.amount / 1.18)) * 100) / 100,
                                totalAmount: p.amount
                              };
                              downloadInvoiceHTML(inv, 'dealer_invoice');
                            }}
                            className="text-gray-400 hover:text-emerald-700 cursor-pointer" 
                            title="Preview Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => {
                              const inv = {
                                id: p.id,
                                type: 'product',
                                invoiceNumber: `INV-${p.modelNo}-${p.chassisNo.slice(-4) || 'DLR'}`,
                                dealerName: p.dealerName,
                                contactNo: p.contactNo,
                                location: p.location,
                                invoiceDate: p.invoiceDate,
                                dueDate: p.invoiceDate,
                                poNumber: `PO-${p.dealerCode}`,
                                sentTo: p.dealerName,
                                shipTo: p.location,
                                paymentMode: p.paymentMode,
                                items: [
                                  {
                                    product: `${p.modelNo} (${p.productDesc})`,
                                    description: `Chassis: ${p.chassisNo} | Motor: ${p.motorNo} | Battery: ${p.batteryNo}`,
                                    unit: p.noOfVehicles,
                                    amount: p.amount / p.noOfVehicles,
                                    gstRate: 18
                                  }
                                ],
                                taxableValue: Math.round((p.amount / 1.18) * 100) / 100,
                                gstAmount: Math.round((p.amount - (p.amount / 1.18)) * 100) / 100,
                                totalAmount: p.amount
                              };
                              downloadInvoiceHTML(inv, 'dealer_invoice');
                            }}
                            className="text-gray-400 hover:text-emerald-700 cursor-pointer" 
                            title="Export PDF Invoice"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-800" title="Quick edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500 hover:text-rose-800" title="Delete product item">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-gray-400">No products configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
