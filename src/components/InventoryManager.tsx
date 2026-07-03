import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle,
  Info,
  TrendingUp,
  FileSpreadsheet,
  Package,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { InventoryItem, Dealer } from '../types';
import { supabase } from '../lib/supabase';
import { downloadCSV } from '../utils/csvHelper';

interface InventoryManagerProps {
  currentDealer: Dealer;
  inventory: InventoryItem[];
  onAddInventory: (item: Omit<InventoryItem, 'id' | 'dealerId'>) => void;
  onUpdateInventory: (item: InventoryItem) => void;
  onDeleteInventory: (itemId: string) => void;
}

export interface VehicleInventoryRow {
  id: string;
  slNo: number;
  modelNo: string;
  brand: string;
  vehicleModel: string;
  hsnNo: string;
  vehicleCount: number;
  chassisNo: string;
  motorNo: string;
  batteryNo: string;
  manufactInvNo: string;
  batteryModel: string;
  batteryCount: number;
  salesCount: number;
}

export interface SpareItemRow {
  id: string;
  slNo: number;
  partName: string;
  price: number;
  quantity: number;
}

export default function InventoryManager({
  currentDealer,
  inventory,
  onAddInventory,
  onUpdateInventory,
  onDeleteInventory
}: InventoryManagerProps) {
  
  const [activeTab, setActiveTab] = useState<'vehicles' | 'spares' | 'transfers'>('vehicles');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI toggles
  const [showSimPanel, setShowSimPanel] = useState(false);

  // Helper to synchronize local storage changes with the database (Supabase) dms_inventory_items
  const syncLocalChangeToDb = (
    sku: string,
    name: string,
    category: string,
    quantityChange: number,
    price: number = 0,
    location: string = 'HQ Warehouse'
  ) => {
    const dbCategory = (category.toLowerCase() === 'vehicles' || category === 'Vehicles') ? 'Vehicles' : 'Spare Parts';
    const cleanSku = (sku || '').trim().toLowerCase();
    const cleanName = (name || '').trim().toLowerCase();

    const existingDbItem = inventory.find(
      i => {
        const iSku = (i.sku || '').trim().toLowerCase();
        const iName = (i.name || '').trim().toLowerCase();
        return (cleanSku && iSku === cleanSku) || iName === cleanName;
      }
    );

    if (existingDbItem) {
      const nextQty = Math.max(0, existingDbItem.quantity + quantityChange);
      onUpdateInventory({
        ...existingDbItem,
        quantity: nextQty,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    } else {
      if (quantityChange > 0) {
        onAddInventory({
          sku: sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          name: name,
          category: dbCategory,
          quantity: quantityChange,
          minThreshold: dbCategory === 'Vehicles' ? 3 : 8,
          price: price || (dbCategory === 'Vehicles' ? 125000 : 1500),
          location: location,
          lastUpdated: new Date().toISOString().split('T')[0]
        });
      }
    }
  };

  // --- Inventory Pipeline & Transfers synced to localStorage ---
  const [transfers, setTransfers] = useState<any[]>(() => {
    const disk = localStorage.getItem('axigear_inventory_transfers');
    if (disk) return JSON.parse(disk);
    
    return [
      {
        id: 'TRSF-8801',
        sku: 'AX-EV-PRO-100',
        category: 'vehicles',
        name: 'Carbon Sprint V1',
        quantity: 5,
        sender: 'Central HQ (crm.axigearelectric.com)',
        receiver: currentDealer.name,
        status: 'Accepted',
        date: '2026-06-18',
        chassisNo: 'ME3F6CH123XY101',
        motorNo: 'MOT8841923'
      },
      {
        id: 'TRSF-9912',
        sku: 'AX-EV-THOR-300',
        category: 'vehicles',
        name: 'Thor EV-Type S',
        quantity: 8,
        sender: 'Central HQ (crm.axigearelectric.com)',
        receiver: currentDealer.name,
        status: 'Pending Acceptance',
        date: '2026-06-22',
        chassisNo: 'ME3F6CH123XY303',
        motorNo: 'MOT9921045'
      },
      {
        id: 'TRSF-9913',
        sku: 's-2',
        category: 'spares',
        name: 'Axigear Throttle grip assembly',
        quantity: 20,
        sender: 'Central HQ (crm.axigearelectric.com)',
        receiver: currentDealer.name,
        status: 'Pending Acceptance',
        date: '2026-06-22'
      }
    ];
  });

  const [isFetchingTransfers, setIsFetchingTransfers] = useState(false);

  const fetchLiveTransfers = async () => {
    if (!currentDealer?.id) return;
    setIsFetchingTransfers(true);
    try {
      const { data, error } = await supabase
        .from('dms_inventory_transfers')
        .select('*')
        .or(`receiver_id.eq.${currentDealer.id},sender.eq.${currentDealer.name}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[fetchLiveTransfers] Error fetching transfers:', error.message);
      } else if (data) {
        const mapped = data.map((t: any) => ({
          id: t.id,
          sku: t.sku,
          category: t.category,
          name: t.name,
          quantity: t.quantity,
          sender: t.sender,
          receiver: t.status === 'Returned to HQ' ? 'Central HQ (crm.axigearelectric.com)' : currentDealer.name,
          status: t.status,
          date: t.date || (t.created_at ? t.created_at.split('T')[0] : ''),
          chassisNo: t.chassis_no,
          motorNo: t.motor_no,
          batteryNo: t.battery_no
        }));
        setTransfers(mapped);
      }
    } catch (err) {
      console.warn('[fetchLiveTransfers] Exception fetching transfers:', err);
    } finally {
      setIsFetchingTransfers(false);
    }
  };

  useEffect(() => {
    fetchLiveTransfers();
    const interval = setInterval(fetchLiveTransfers, 12000);
    return () => clearInterval(interval);
  }, [currentDealer?.id]);

  useEffect(() => {
    localStorage.setItem('axigear_inventory_transfers', JSON.stringify(transfers));
  }, [transfers]);

  // Simulated CRM Catalog choices
  const simCatalog = [
    { sku: 'AX-EV-PRO-100', name: 'Carbon Sprint V1', category: 'vehicles' },
    { sku: 'AX-EV-THOR-300', name: 'Thor EV-Type S', category: 'vehicles' },
    { sku: 'AX-EV-HELIOS-50', name: 'Helios Commuter V1', category: 'vehicles' },
    { sku: 's-1', name: 'Ceramic Brake Shoe V2', category: 'spares' },
    { sku: 's-2', name: 'Axigear Throttle grip assembly', category: 'spares' },
    { sku: 's-3', name: 'LED Headlamp Bulbs matrix', category: 'spares' }
  ];

  const [simSelectedSku, setSimSelectedSku] = useState(simCatalog[0].sku);
  const [simQty, setSimQty] = useState(5);
  const [simSyncStatus, setSimSyncStatus] = useState<'idle' | 'syncing' | 'completed'>('idle');

  // Outbound Return Forms State
  const [retType, setRetType] = useState<'vehicles' | 'spares'>('vehicles');
  const [retItemId, setRetItemId] = useState('');
  const [retQty, setRetQty] = useState(1);

  // Simulated dispatch carrier trigger from HQ (for local demoing)
  const handleSimDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemInfo = simCatalog.find(c => c.sku === simSelectedSku);
    if (!itemInfo) return;

    setSimSyncStatus('syncing');

    const trId = `TRSF-${Math.floor(1000 + Math.random() * 9000)}`;
    const chassis = itemInfo.category === 'vehicles' ? `SIMCHASSI-${Math.floor(10000 + Math.random() * 90000)}` : null;
    const motor = itemInfo.category === 'vehicles' ? `SIMMOT-${Math.floor(10000 + Math.random() * 90000)}` : null;
    const battery = itemInfo.category === 'vehicles' ? `SIMBAT-${Math.floor(10000 + Math.random() * 90000)}` : null;

    const newTr = {
      id: trId,
      sku: itemInfo.sku,
      category: itemInfo.category,
      name: itemInfo.name,
      quantity: Number(simQty),
      sender: 'Central HQ (crm.axigearelectric.com)',
      receiver_id: currentDealer.id,
      status: 'Pending Acceptance',
      date: new Date().toISOString().split('T')[0],
      chassis_no: chassis,
      motor_no: motor,
      battery_no: battery
    };

    try {
      const { error } = await supabase.from('dms_inventory_transfers').insert(newTr);
      if (error) {
        console.error('[handleSimDispatch] Supabase insert error:', error.message);
      }
    } catch (err) {
      console.warn('[handleSimDispatch] Supabase offline fallback:', err);
    }

    // Append locally too
    setTransfers(prev => [{
      id: trId,
      sku: itemInfo.sku,
      category: itemInfo.category,
      name: itemInfo.name,
      quantity: Number(simQty),
      sender: 'Central HQ (crm.axigearelectric.com)',
      receiver: currentDealer.name,
      status: 'Pending Acceptance',
      date: new Date().toISOString().split('T')[0],
      chassisNo: chassis,
      motorNo: motor
    }, ...prev]);

    setSimSyncStatus('completed');
    alert(`HQ Dispatch Simulated! Dispatched ${simQty} units of "${itemInfo.name}" to your terminal. Check and Accept this under the "HQ Shipments & Returns" tab.`);
    setTimeout(() => setSimSyncStatus('idle'), 3000);
    fetchLiveTransfers();
  };

  // Integrating the transfer acknowledgment increment into stock
  const handleAcceptTransfer = async (transferId: string) => {
    const tr = transfers.find(t => t.id === transferId);
    if (!tr || tr.status !== 'Pending Acceptance') return;

    try {
      const { error } = await supabase
        .from('dms_inventory_transfers')
        .update({ status: 'Accepted' })
        .eq('id', transferId);

      if (error) {
        console.error('[handleAcceptTransfer] Update error:', error.message);
        alert(`Failed to sync acceptance status to CRM database: ${error.message}`);
        return;
      }
    } catch (err) {
      console.warn('[handleAcceptTransfer] Supabase update offline fallback:', err);
    }

    if (tr.category === 'vehicles' || tr.category === 'Vehicles') {
      const existing = vehicles.find(v => v.modelNo.toLowerCase() === tr.sku.toLowerCase() || v.vehicleModel.toLowerCase() === tr.name.toLowerCase());
      if (existing) {
        setVehicles(prev => prev.map(v => 
          v.id === existing.id ? { ...v, vehicleCount: v.vehicleCount + tr.quantity } : v
        ));
      } else {
        const newVehicle: VehicleInventoryRow = {
          id: `v-row-${Math.floor(1000 + Math.random() * 9000)}`,
          slNo: vehicles.length + 1,
          modelNo: tr.sku,
          brand: 'Axigear',
          vehicleModel: tr.name,
          hsnNo: '87116010',
          vehicleCount: tr.quantity,
          chassisNo: tr.chassisNo || `AXGV-${Math.floor(10000 + Math.random() * 90000)}`,
          motorNo: tr.motorNo || `MTR-${Math.floor(10000 + Math.random() * 90000)}`,
          batteryNo: tr.batteryNo || `BAT-${Math.floor(10000 + Math.random() * 90000)}`,
          manufactInvNo: `INV/MFR/${Math.floor(1000 + Math.random() * 9000)}`,
          batteryModel: 'Lithium Ion 60V',
          batteryCount: tr.quantity,
          salesCount: 0
        };
        setVehicles(prev => [...prev, newVehicle]);
      }
    } else {
      const existing = spares.find(s => s.partName.toLowerCase() === tr.name.toLowerCase());
      if (existing) {
        setSpares(prev => prev.map(s => 
          s.id === existing.id ? { ...s, quantity: s.quantity + tr.quantity } : s
        ));
      } else {
        const newSpare: SpareItemRow = {
          id: `s-row-${Math.floor(1000 + Math.random() * 9000)}`,
          slNo: spares.length + 1,
          partName: tr.name,
          price: 1500,
          quantity: tr.quantity
        };
        setSpares(prev => [...prev, newSpare]);
      }
    }

    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: 'Accepted' } : t
    ));

    // Sync state into global dms_inventory_items db
    syncLocalChangeToDb(tr.sku, tr.name, tr.category, tr.quantity, tr.category === 'vehicles' ? 125000 : 1500);

    alert(`Handshake Complete! ${tr.quantity} units of "${tr.name}" accepted and added into your terminal inventory.`);
  };

  const handleRejectTransfer = async (transferId: string) => {
    const tr = transfers.find(t => t.id === transferId);
    if (!tr || tr.status !== 'Pending Acceptance') return;

    if (!confirm(`Are you sure you want to reject this incoming shipment of ${tr.quantity} units of "${tr.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('dms_inventory_transfers')
        .update({ status: 'Rejected' })
        .eq('id', transferId);

      if (error) {
        console.error('[handleRejectTransfer] Update error:', error.message);
        alert(`Failed to sync rejection status to CRM database: ${error.message}`);
        return;
      }
    } catch (err) {
      console.warn('[handleRejectTransfer] Supabase update offline fallback:', err);
    }

    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: 'Rejected' } : t
    ));

    alert(`Shipment rejected. CRM server has been updated.`);
  };

  // Dispatch return back to HQ
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retItemId) {
      alert('Please select a stock item to return.');
      return;
    }

    if (retType === 'vehicles') {
      const item = vehicles.find(v => v.id === retItemId);
      if (!item) return;

      if (item.vehicleCount < retQty) {
        alert(`Cannot return ${retQty} units. Only ${item.vehicleCount} available in stock.`);
        return;
      }

      setVehicles(prev => prev.map(v => 
        v.id === retItemId ? { ...v, vehicleCount: v.vehicleCount - retQty } : v
      ));

      const newTrDb = {
        id: `TRSF-${Math.floor(1000 + Math.random() * 9000)}`,
        sku: item.modelNo,
        category: 'vehicles',
        name: item.vehicleModel,
        quantity: Number(retQty),
        sender: currentDealer.name,
        receiver_id: null,
        status: 'Returned to HQ',
        date: new Date().toISOString().split('T')[0],
        chassis_no: item.chassisNo || null,
        motor_no: item.motorNo || null,
        battery_no: item.batteryNo || null
      };

      try {
        const { error } = await supabase.from('dms_inventory_transfers').insert(newTrDb);
        if (error) {
          console.error('[handleReturnSubmit] Supabase return insert error:', error.message);
          alert(`Failed to store return record in database: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('[handleReturnSubmit] Supabase return sync failed:', err);
      }

      const newTr = {
        id: newTrDb.id,
        sku: newTrDb.sku,
        category: newTrDb.category,
        name: newTrDb.name,
        quantity: newTrDb.quantity,
        sender: newTrDb.sender,
        receiver: 'Central HQ (crm.axigearelectric.com)',
        status: newTrDb.status,
        date: newTrDb.date,
        chassisNo: newTrDb.chassis_no,
        motorNo: newTrDb.motor_no
      };

      setTransfers(prev => [newTr, ...prev]);
      syncLocalChangeToDb(newTr.sku, item.vehicleModel, 'vehicles', -Number(retQty));
      alert(`Success: Returned ${retQty} units of "${item.vehicleModel}" to Central HQ.`);
    } else {
      const item = spares.find(s => s.id === retItemId);
      if (!item) return;

      if (item.quantity < retQty) {
        alert(`Cannot return ${retQty} units. Only ${item.quantity} available.`);
        return;
      }

      setSpares(prev => prev.map(s => 
        s.id === retItemId ? { ...s, quantity: s.quantity - retQty } : s
      ));

      const newTrDb = {
        id: `TRSF-${Math.floor(1000 + Math.random() * 9000)}`,
        sku: `SPARE-${Math.floor(100 + Math.random() * 900)}`,
        category: 'spares',
        name: item.partName,
        quantity: Number(retQty),
        sender: currentDealer.name,
        receiver_id: null,
        status: 'Returned to HQ',
        date: new Date().toISOString().split('T')[0],
        chassis_no: null,
        motor_no: null,
        battery_no: null
      };

      try {
        const { error } = await supabase.from('dms_inventory_transfers').insert(newTrDb);
        if (error) {
          console.error('[handleReturnSubmit] Supabase return insert error:', error.message);
          alert(`Failed to store return record in database: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('[handleReturnSubmit] Supabase return sync failed:', err);
      }

      const newTr = {
        id: newTrDb.id,
        sku: newTrDb.sku,
        category: newTrDb.category,
        name: newTrDb.name,
        quantity: newTrDb.quantity,
        sender: newTrDb.sender,
        receiver: 'Central HQ (crm.axigearelectric.com)',
        status: newTrDb.status,
        date: newTrDb.date,
        chassisNo: null,
        motorNo: null
      };

      setTransfers(prev => [newTr, ...prev]);
      syncLocalChangeToDb(newTr.sku, item.partName, 'spares', -Number(retQty));
      alert(`Success: Returned ${retQty} parts of "${item.partName}" to Central HQ.`);
    }

    setRetItemId('');
    setRetQty(1);
  };

  // --- Vehicles Inventory state ---
  const [vehicles, setVehicles] = useState<VehicleInventoryRow[]>(() => {
    const disk = localStorage.getItem('axigear_vehicles_inventory');
    if (disk) return JSON.parse(disk);
    
    return [
      {
        id: 'v-1',
        slNo: 1,
        modelNo: 'AX-EV-PRO-100',
        brand: 'Axigear',
        vehicleModel: 'Carbon Sprint V1',
        hsnNo: '87116010',
        vehicleCount: 15,
        chassisNo: 'ME3F6CH123XY456',
        motorNo: 'MOT987654321',
        batteryNo: 'BAT1122334455',
        manufactInvNo: 'INV/MFR/0944',
        batteryModel: 'Lithium Ion 60V',
        batteryCount: 15,
        salesCount: 0
      }
    ];
  });

  // --- Spares Inventory state ---
  const [spares, setSpares] = useState<SpareItemRow[]>(() => {
    const disk = localStorage.getItem('axigear_spares_inventory');
    if (disk) return JSON.parse(disk);

    return [
      { id: 's-1', slNo: 1, partName: 'Ceramic Brake Shoe V2', price: 850, quantity: 120 },
      { id: 's-2', slNo: 2, partName: 'Axigear Throttle grip assembly', price: 1250, quantity: 45 },
      { id: 's-3', slNo: 3, partName: 'LED Headlamp Bulbs matrix', price: 1620, quantity: 80 }
    ];
  });

  useEffect(() => {
    localStorage.setItem('axigear_vehicles_inventory', JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem('axigear_spares_inventory', JSON.stringify(spares));
  }, [spares]);

  const handleDeleteVehicle = (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle inventory record?')) {
      const v = vehicles.find(x => x.id === id);
      if (v) {
        const cleanSku = (v.modelNo || '').trim().toLowerCase();
        const cleanName = (v.vehicleModel || '').trim().toLowerCase();
        const existingDbItem = inventory.find(i => {
          const iSku = (i.sku || '').trim().toLowerCase();
          const iName = (i.name || '').trim().toLowerCase();
          return (cleanSku && iSku === cleanSku) || iName === cleanName;
        });
        if (existingDbItem) {
          onDeleteInventory(existingDbItem.id);
        }
      }
      setVehicles(vehicles.filter(x => x.id !== id));
    }
  };

  const handleDeleteSpare = (id: string) => {
    if (confirm('Are you sure you want to delete this spare part record?')) {
      const s = spares.find(x => x.id === id);
      if (s) {
        const cleanName = (s.partName || '').trim().toLowerCase();
        const existingDbItem = inventory.find(i => {
          const iName = (i.name || '').trim().toLowerCase();
          return iName === cleanName;
        });
        if (existingDbItem) {
          onDeleteInventory(existingDbItem.id);
        }
      }
      setSpares(spares.filter(x => x.id !== id));
    }
  };

  // Filter lists based on search
  const filteredVehicles = vehicles.filter(v => 
    v.vehicleModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.modelNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.chassisNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSpares = spares.filter(s =>
    s.partName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = transfers.filter(t => t.status === 'Pending Acceptance').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans">
      
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            FRANCHISEE PORTAL &bull; {currentDealer.name} ({currentDealer.code})
          </p>
        </div>
        
        {/* Simple Professional Stats */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm min-w-[140px]">
            <Package className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Vehicles</p>
              <p className="text-lg font-extrabold text-gray-900">
                {vehicles.reduce((sum, v) => sum + v.vehicleCount, 0)}
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm min-w-[140px]">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Spares Stock</p>
              <p className="text-lg font-extrabold text-gray-900">
                {spares.reduce((sum, s) => sum + s.quantity, 0)} <span className="text-xs font-normal text-gray-400">units</span>
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm animate-pulse min-w-[140px]">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-[10px] text-orange-600 font-black uppercase tracking-wider">Awaiting HQ</p>
                <p className="text-lg font-extrabold text-orange-700">{pendingCount} Shipments</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Alert Box replacing clumsy long explanations */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 text-xs text-emerald-850 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Franchisee Inventory Guidelines</p>
          <p className="text-gray-600 mt-0.5 leading-relaxed">
            As a franchisee dealer, you <strong>cannot manually create or register new vehicles or spares</strong> on your own. 
            All stocks are dispatched centrally from HQ. You can only <strong>accept incoming transports</strong> to add items to your active count, or <strong>return unsold items</strong> back to Central HQ.
          </p>
        </div>
      </div>

      {/* Tab bar and search row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => { setActiveTab('vehicles'); setSearchQuery(''); }}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'vehicles' 
                ? 'bg-emerald-700 text-white shadow' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>Vehicles Inventory</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${activeTab === 'vehicles' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {vehicles.length} types
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('spares'); setSearchQuery(''); }}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'spares' 
                ? 'bg-emerald-700 text-white shadow' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>Spares Inventory</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${activeTab === 'spares' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {spares.length} parts
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('transfers'); setSearchQuery(''); }}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-2 relative ${
              activeTab === 'transfers' 
                ? 'bg-emerald-700 text-white shadow' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>HQ Shipments &amp; Returns</span>
            {pendingCount > 0 ? (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono animate-bounce shrink-0">
                {pendingCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            )}
          </button>
        </div>

        {activeTab !== 'transfers' && (
          <div className="relative flex-1 max-w-xs self-end sm:self-auto">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'vehicles' ? 'vehicles' : 'spares'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-800 text-xs border border-gray-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-600 shadow-inner"
            />
          </div>
        )}
      </div>

      {/* Active Tab View Content */}
      
      {/* 1. VEHICLES TAB */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-gray-700">Currently Stocked Vehicles at Franchise Depot</span>
            </div>
            
            <button
              onClick={() => downloadCSV(vehicles, 'Vehicles_Inventory')}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-bold hover:border-emerald-600 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Vehicles CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-[11px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 font-mono text-[9px] uppercase font-bold">
                    <th className="py-3 px-4 border-r text-center w-12">Sl.No</th>
                    <th className="py-3 px-4">Model No</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Vehicle Model</th>
                    <th className="py-3 px-4 text-center">HSN No</th>
                    <th className="py-3 px-4 text-center text-gray-900 font-black">Available Count</th>
                    <th className="py-3 px-4 font-mono">Chassis No</th>
                    <th className="py-3 px-4 font-mono">Motor No</th>
                    <th className="py-3 px-4 font-mono">Battery Serial</th>
                    <th className="py-3 px-4">Battery Model</th>
                    <th className="py-3 px-4 text-center text-emerald-700 font-bold">Sales Count</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {filteredVehicles.map((v, idx) => {
                    const isLowStock = v.vehicleCount <= 3;
                    return (
                      <tr key={v.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-center border-r font-mono text-gray-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 font-mono">{v.modelNo}</td>
                        <td className="py-3 px-4 text-gray-500">{v.brand}</td>
                        <td className="py-3 px-4 font-bold text-emerald-900">{v.vehicleModel}</td>
                        <td className="py-3 px-4 text-center font-mono text-gray-400">{v.hsnNo}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className={`px-2 py-1 rounded-full font-black text-xs ${
                            isLowStock ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800'
                          }`}>
                            {v.vehicleCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500 text-[10px] max-w-[120px] truncate" title={v.chassisNo}>{v.chassisNo}</td>
                        <td className="py-3 px-4 font-mono text-gray-500 text-[10px] max-w-[110px] truncate" title={v.motorNo}>{v.motorNo}</td>
                        <td className="py-3 px-4 font-mono text-gray-500 text-[10px] max-w-[110px] truncate" title={v.batteryNo}>{v.batteryNo}</td>
                        <td className="py-3 px-4 text-gray-600 truncate max-w-[110px]" title={v.batteryModel}>{v.batteryModel}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-750">{v.salesCount}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={async () => {
                                if (v.vehicleCount <= 0) {
                                  alert('Insufficient stock. Count is 0.');
                                  return;
                                }
                                if (confirm(`Return 1 unit of "${v.vehicleModel}" to Central HQ?`)) {
                                  setVehicles(prev => prev.map(item => 
                                    item.id === v.id ? { ...item, vehicleCount: item.vehicleCount - 1 } : item
                                  ));
                                  const trId = `TRSF-${Math.floor(1000 + Math.random() * 9000)}`;
                                  const newTrDb = {
                                    id: trId,
                                    sku: v.modelNo,
                                    category: 'vehicles',
                                    name: v.vehicleModel,
                                    quantity: 1,
                                    sender: currentDealer.name,
                                    receiver_id: null,
                                    status: 'Returned to HQ',
                                    date: new Date().toISOString().split('T')[0],
                                    chassis_no: v.chassisNo || null,
                                    motor_no: v.motorNo || null,
                                    battery_no: v.batteryNo || null
                                  };
                                  try {
                                    const { error } = await supabase.from('dms_inventory_transfers').insert(newTrDb);
                                    if (error) {
                                      console.error('[QuickReturn] Supabase return insert error:', error.message);
                                      alert(`Failed to store return record in database: ${error.message}`);
                                      return;
                                    }
                                  } catch (err) {
                                    console.warn('[QuickReturn] Supabase return sync failed:', err);
                                  }
                                  const newTr = {
                                    id: newTrDb.id,
                                    sku: newTrDb.sku,
                                    category: newTrDb.category,
                                    name: newTrDb.name,
                                    quantity: newTrDb.quantity,
                                    sender: newTrDb.sender,
                                    receiver: 'Central HQ (crm.axigearelectric.com)',
                                    status: newTrDb.status,
                                    date: newTrDb.date,
                                    chassisNo: newTrDb.chassis_no,
                                    motorNo: newTrDb.motor_no
                                  };
                                  setTransfers(prev => [newTr, ...prev]);
                                  syncLocalChangeToDb(v.modelNo, v.vehicleModel, 'vehicles', -1);
                                  alert(`Successfully returned 1 unit of "${v.vehicleModel}" back to Central HQ.`);
                                }
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-100 rounded flex items-center gap-0.5 whitespace-nowrap"
                              title="Return 1 vehicle to HQ"
                            >
                              <ArrowUpRight className="w-3 h-3 text-blue-600" />
                              <span>Return HQ</span>
                            </button>
                            <button
                              onClick={() => handleDeleteVehicle(v.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVehicles.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-gray-400">
                        No vehicles found matching search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. SPARES TAB */}
      {activeTab === 'spares' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span className="text-xs font-semibold text-gray-700">Currently Stocked Spare Parts &amp; Accessories</span>
            </div>
            
            <button
              onClick={() => downloadCSV(spares, 'Spares_Inventory')}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-bold hover:border-emerald-600 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Spares CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 font-mono text-[9px] uppercase font-bold">
                    <th className="py-3 px-4 border-r text-center w-12">Sl.No</th>
                    <th className="py-3 px-4">Spare Part Name</th>
                    <th className="py-3 px-4 text-right">Price per unit</th>
                    <th className="py-3 px-4 text-center text-gray-900 font-black">Available Stock</th>
                    <th className="py-3 px-4 text-right">Consolidated Total Value</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {filteredSpares.map((sp, idx) => (
                    <tr key={sp.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-center border-r font-mono text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{sp.partName}</td>
                      <td className="py-3 px-4 font-mono text-right text-gray-600">₹{sp.price.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          sp.quantity <= 10 ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-800'
                        }`}>
                          {sp.quantity} units
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-emerald-800 font-extrabold">
                        ₹{(sp.price * sp.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={async () => {
                              if (sp.quantity <= 0) {
                                alert('Insufficient stock to return.');
                                return;
                              }
                              if (confirm(`Return 1 unit of "${sp.partName}" to Central HQ?`)) {
                                setSpares(prev => prev.map(item => 
                                  item.id === sp.id ? { ...item, quantity: item.quantity - 1 } : item
                                ));
                                const trId = `TRSF-${Math.floor(1000 + Math.random() * 9000)}`;
                                const newTrDb = {
                                  id: trId,
                                  sku: `SPARE-${Math.floor(100 + Math.random() * 900)}`,
                                  category: 'spares',
                                  name: sp.partName,
                                  quantity: 1,
                                  sender: currentDealer.name,
                                  receiver_id: null,
                                  status: 'Returned to HQ',
                                  date: new Date().toISOString().split('T')[0],
                                  chassis_no: null,
                                  motor_no: null,
                                  battery_no: null
                                };
                                try {
                                  const { error } = await supabase.from('dms_inventory_transfers').insert(newTrDb);
                                  if (error) {
                                    console.error('[QuickReturnSpare] Supabase return insert error:', error.message);
                                    alert(`Failed to store return record in database: ${error.message}`);
                                    return;
                                  }
                                } catch (err) {
                                  console.warn('[QuickReturnSpare] Supabase return sync failed:', err);
                                }
                                const newTr = {
                                  id: newTrDb.id,
                                  sku: newTrDb.sku,
                                  category: newTrDb.category,
                                  name: newTrDb.name,
                                  quantity: newTrDb.quantity,
                                  sender: newTrDb.sender,
                                  receiver: 'Central HQ (crm.axigearelectric.com)',
                                  status: newTrDb.status,
                                  date: newTrDb.date,
                                  chassisNo: null,
                                  motorNo: null
                                };
                                setTransfers(prev => [newTr, ...prev]);
                                syncLocalChangeToDb(newTr.sku, sp.partName, 'spares', -1);
                                alert(`Successfully returned 1 part of "${sp.partName}" back to Central HQ.`);
                              }
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-100 rounded flex items-center gap-0.5 whitespace-nowrap"
                            title="Return 1 part to HQ"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                            <span>Return HQ</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSpare(sp.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                            title="Delete Spare"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSpares.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No spare parts found matching search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TRANSFERS & RETURNS TAB */}
      {activeTab === 'transfers' && (
        <div className="space-y-6 animate-in fade-in duration-100 text-xs">
          
          {/* DEMO SANDBOX CRM CONTROL (Clean, collapsible helper section instead of giant browser block) */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowSimPanel(!showSimPanel)}
              className="w-full bg-gray-50 px-5 py-3.5 flex items-center justify-between border-b border-gray-100 text-left cursor-pointer hover:bg-gray-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="font-extrabold text-gray-800 tracking-wide uppercase text-[10px]">
                  CRM HQ Dispatch Simulator (Testing &amp; Demo Sandbox)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-[10px] font-medium font-sans">
                  {showSimPanel ? 'Hide Simulator Panel' : 'Show Simulator Panel'}
                </span>
                {showSimPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showSimPanel && (
              <div className="p-5 bg-slate-50/50 space-y-4">
                <p className="text-[11px] text-gray-500 leading-relaxed max-w-3xl">
                  Since you cannot add inventory on your own as a dealer, you can use this simulation tool to trigger an 
                  outgoing shipment dispatched from <strong>Central HQ (crm.axigearelectric.com)</strong>. Once dispatched, 
                  it will arrive in your "Incoming HQ Shipments" below for you to Accept or Reject.
                </p>

                <form onSubmit={handleSimDispatch} className="bg-white border border-gray-200 p-4 rounded-lg flex flex-col sm:flex-row items-end gap-3.5 max-w-4xl">
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400">Select HQ Catalog Item</label>
                    <select
                      value={simSelectedSku}
                      onChange={(e) => setSimSelectedSku(e.target.value)}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-2.5 focus:outline-none focus:border-emerald-600 text-xs"
                    >
                      {simCatalog.map(c => (
                        <option key={c.sku} value={c.sku}>
                          [{c.category === 'vehicles' ? 'Vehicle' : 'Spare'}] {c.name} ({c.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-32 space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400">Quantity to Send</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={simQty}
                      onChange={(e) => setSimQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-2.5 focus:outline-none focus:border-emerald-600 font-mono text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={simSyncStatus === 'syncing'}
                    className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-2 px-5 rounded-lg text-xs tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {simSyncStatus === 'syncing' ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Simulate HQ Dispatch</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Incoming shipments awaiting handshakes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-orange-600 shrink-0" />
                <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider font-sans">
                  Incoming HQ Shipments Pending Acceptance
                </h3>
                <button
                  type="button"
                  onClick={fetchLiveTransfers}
                  disabled={isFetchingTransfers}
                  className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-emerald-700"
                  title="Force Sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTransfers ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {isFetchingTransfers && (
                  <span className="text-[10px] text-emerald-700 font-bold animate-pulse">Syncing...</span>
                )}
                <span className="text-[9px] uppercase font-mono font-black text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-0.5 shrink-0">
                  {transfers.filter(t => t.status === 'Pending Acceptance').length} Shipments Awaiting
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/20 text-gray-400 font-mono text-[9px] uppercase font-bold text-center">
                    <th className="py-2.5 px-4 text-left">Transfer ID</th>
                    <th className="py-2.5 px-4 text-left">Product Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 font-mono">SKU Code</th>
                    <th className="py-2.5 px-4 text-center">Transport Volume</th>
                    <th className="py-2.5 px-4 text-left font-mono">Chassis &amp; Motor Serials</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-center text-xs">
                  {transfers.filter(t => t.status === 'Pending Acceptance').map((tr) => (
                    <tr key={tr.id} className="hover:bg-orange-50/10 transition-colors">
                      <td className="py-3 px-4 text-left font-mono font-bold text-gray-900">{tr.id}</td>
                      <td className="py-3 px-4 text-left font-bold text-emerald-950">{tr.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                          tr.category === 'vehicles' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {tr.category === 'vehicles' ? 'Vehicle' : 'Spare'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500 font-bold">{tr.sku}</td>
                      <td className="py-3 px-4 text-center font-bold text-gray-900">{tr.quantity} units</td>
                      <td className="py-3 px-4 font-mono text-gray-400 text-[10px] text-left">
                        {tr.chassisNo ? (
                          <div className="space-y-0.5 max-w-[200px] truncate">
                            <p className="truncate"><span className="text-gray-500 font-sans">Chassis:</span> {tr.chassisNo}</p>
                            <p className="truncate"><span className="text-gray-500 font-sans">Motor:</span> {tr.motorNo}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Bulk spares package</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAcceptTransfer(tr.id)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] tracking-wider transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                            title="Accept and unload stock to inventory"
                          >
                            <Check className="w-3 h-3 text-white" />
                            <span>Accept &amp; Load</span>
                          </button>
                          <button
                            onClick={() => handleRejectTransfer(tr.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] tracking-wider transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                            title="Reject shipment and notify HQ"
                          >
                            <X className="w-3 h-3 text-white" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transfers.filter(t => t.status === 'Pending Acceptance').length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 bg-white">
                        All incoming shipments have been processed. Open the simulation panel above to dispatch a demo stock transport!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outbound Return Form & Ledger History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Returns Form */}
            <form onSubmit={handleReturnSubmit} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="font-extrabold text-xs text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-blue-800" />
                  <span>HQ Return Logistics Terminal</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Return unsold, slow-moving, or damaged stock back to Central HQ. This automatically deducts the items from your active stock logs.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Item Category</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setRetType('vehicles'); setRetItemId(''); }}
                      className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-md uppercase transition-all ${
                        retType === 'vehicles' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      Vehicles
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRetType('spares'); setRetItemId(''); }}
                      className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-md uppercase transition-all ${
                        retType === 'spares' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      Spares
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Select Stock Item</label>
                  <select
                    value={retItemId}
                    onChange={(e) => setRetItemId(e.target.value)}
                    required
                    className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 text-xs"
                  >
                    <option value="">-- Choose Stock Item --</option>
                    {retType === 'vehicles' ? (
                      vehicles.map(v => (
                        <option key={v.id} value={v.id} disabled={v.vehicleCount <= 0}>
                          {v.vehicleModel} ({v.modelNo}) — In Stock: {v.vehicleCount}
                        </option>
                      ))
                    ) : (
                      spares.map(s => (
                        <option key={s.id} value={s.id} disabled={s.quantity <= 0}>
                          {s.partName} — Available: {s.quantity}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-[9px] font-bold text-gray-400 uppercase font-sans">Return Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={retQty}
                    onChange={(e) => setRetQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white text-gray-800 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-600 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
              >
                Dispatch Return Carrier &rarr;
              </button>
            </form>

            {/* Historical Shipments Ledger */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  Complete Logistics Shipment Ledger Summary
                </h4>
              </div>

              <div className="overflow-x-auto text-[11px] h-[250px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-400 font-mono text-[9px] uppercase font-bold sticky top-0 bg-white">
                      <th className="py-2.5 px-4 text-left">Transfer ID</th>
                      <th className="py-2.5 px-4 text-left">Logistics Item Details</th>
                      <th className="py-2.5 px-4 text-center">Volume</th>
                      <th className="py-2.5 px-4 text-center">Route direction</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700 text-xs">
                    {transfers.map((tr) => (
                      <tr key={tr.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-4 text-left font-mono text-gray-400 font-bold">{tr.id}</td>
                        <td className="py-2.5 px-4 text-left">
                          <strong className="text-gray-900 font-bold block">{tr.name}</strong>
                          <span className="text-[9px] text-gray-400 font-mono block">{tr.sku}</span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-black">{tr.quantity} units</td>
                        <td className="py-2.5 px-4 text-center text-[10px] text-gray-500 font-semibold uppercase">
                          {tr.status === 'Returned to HQ' ? (
                            <span>{currentDealer.name.split(' ')[0]} &rarr; HQ</span>
                          ) : (
                            <span>HQ &rarr; {currentDealer.name.split(' ')[0]}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                            tr.status === 'Accepted' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                              : tr.status === 'Pending Acceptance'
                              ? 'bg-orange-50 text-orange-700 border border-orange-150 animate-pulse'
                              : tr.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-150'
                              : 'bg-blue-50 text-blue-700 border border-blue-150'
                          }`}>
                            {tr.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-gray-400">{tr.date}</td>
                      </tr>
                    ))}
                    {transfers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          No logistics history has been recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
