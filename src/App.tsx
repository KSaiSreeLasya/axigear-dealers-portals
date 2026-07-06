import React, { useState, useEffect } from 'react';
import { Dealer, InventoryItem, Employee, AttendanceRecord, Sale, ServiceTicket, ServiceMessage } from './types';
import { 
  INITIAL_DEALERS, 
  INITIAL_INVENTORY, 
  INITIAL_EMPLOYEES, 
  INITIAL_ATTENDANCE, 
  INITIAL_SALES, 
  INITIAL_TICKETS, 
  INITIAL_MESSAGES 
} from './data/mockData';

import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import DashboardOverview from './components/DashboardOverview';
import InventoryManager from './components/InventoryManager';
import SalesManager from './components/SalesManager';
import EmployeeManager from './components/EmployeeManager';
import AttendanceTracker from './components/AttendanceTracker';
import ServiceCenter from './components/ServiceCenter';
import DealerProfile from './components/DealerProfile';
import CrmAdminPortal from './components/CrmAdminPortal';

import { ShieldCheck, LogOut, CheckCircle, HelpCircle, AlertTriangle, Database } from 'lucide-react';

import {
  supabase,
  pullDatabase,
  pushDatabaseBulk,
  saveDealerToDb,
  saveInventoryItemToDb,
  deleteInventoryItemFromDb,
  saveEmployeeToDb,
  saveAttendanceRecordToDb,
  saveSaleToDb,
  deleteSaleFromDb,
  saveServiceTicketToDb,
  saveServiceMessageToDb,
  testConnection,
} from './lib/supabase';

export default function App() {
  
  // --- Persistent Storage State Synced Loops ---
  const [dealers, setDealers] = useState<Dealer[]>(() => {
    const disk = localStorage.getItem('axigear_dealers');
    return disk ? JSON.parse(disk) : INITIAL_DEALERS;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const disk = localStorage.getItem('axigear_inventory');
    return disk ? JSON.parse(disk) : INITIAL_INVENTORY;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const disk = localStorage.getItem('axigear_sales');
    return disk ? JSON.parse(disk) : INITIAL_SALES;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const disk = localStorage.getItem('axigear_employees');
    return disk ? JSON.parse(disk) : INITIAL_EMPLOYEES;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const disk = localStorage.getItem('axigear_attendance');
    return disk ? JSON.parse(disk) : INITIAL_ATTENDANCE;
  });

  const [tickets, setTickets] = useState<ServiceTicket[]>(() => {
    const disk = localStorage.getItem('axigear_tickets');
    return disk ? JSON.parse(disk) : INITIAL_TICKETS;
  });

  const [messages, setMessages] = useState<ServiceMessage[]>(() => {
    const disk = localStorage.getItem('axigear_messages');
    return disk ? JSON.parse(disk) : INITIAL_MESSAGES;
  });

  // --- Supabase Synchronization States & Handlers ---
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncLog, setSyncLog] = useState<string>('');
  const [dbTablesExist, setDbTablesExist] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkDb() {
      try {
        const connected = await testConnection();
        setDbTablesExist(connected);

        // Auto-align active session dealer with the correct database ID on mount
        const disk = sessionStorage.getItem('axigear_active_dealer');
        if (connected && disk) {
          const active = JSON.parse(disk) as Dealer;
          const { data } = await supabase
            .from('dms_dealers')
            .select('*')
            .or(`code.eq.${active.code},email.eq.${active.email}`)
            .limit(1);

          if (data && data.length > 0) {
            const dbD = data[0];
            const aligned: Dealer = {
              ...active,
              id: dbD.id,
              name: dbD.name,
              code: dbD.code,
              location: dbD.location,
              email: dbD.email,
              phone: dbD.phone,
              managerName: dbD.manager_name,
              logoUrl: dbD.logo_url || active.logoUrl,
              companyName: dbD.company_name || active.companyName,
              incorporationNo: dbD.incorporation_no || active.incorporationNo,
              dbaName: dbD.dba_name || active.dbaName,
              legalStructure: dbD.legal_structure || active.legalStructure,
              ownershipDetails: dbD.ownership_details || active.ownershipDetails,
              registeredAddress: dbD.registered_address || active.registeredAddress,
              documentPan: dbD.document_pan || active.documentPan,
              documentGst: dbD.document_gst || active.documentGst,
              documentShopLicense: dbD.document_shop_license || active.documentShopLicense,
              documentTradeLicense: dbD.document_trade_license || active.documentTradeLicense
            };
            setCurrentDealer(aligned);
            sessionStorage.setItem('axigear_active_dealer', JSON.stringify(aligned));
            console.log(`[Startup Alignment] Aligned active session dealer ID to database ID: ${aligned.id}`);
          }
        }
      } catch (err) {
        setDbTablesExist(false);
      }
    }
    checkDb();
  }, []);

  const handlePullDatabase = async () => {
    setSyncStatus('loading');
    setSyncLog('Initiating data handshake with cloud clusters...\n[SYNC] Querying master catalog entries...');
    try {
      const data = await pullDatabase();
      
      // Update local React states
      if (data.dealers.length > 0) setDealers(data.dealers);
      if (data.inventory.length > 0) setInventory(data.inventory);
      if (data.employees.length > 0) setEmployees(data.employees);
      if (data.attendance.length > 0) setAttendance(data.attendance);
      if (data.sales.length > 0) setSales(data.sales);
      if (data.tickets.length > 0) setTickets(data.tickets);
      if (data.messages.length > 0) setMessages(data.messages);
      
      if (data.serviceInvoices && data.serviceInvoices.length > 0) {
        localStorage.setItem('axigear_service_invoices', JSON.stringify(data.serviceInvoices));
      }

      setSyncStatus('success');
      setSyncLog(`✅ Cloud pulling cycle completed successfully!
- Fetched and mapped ${data.dealers.length} Franchises
- Fetched ${data.inventory.length} Stock lines
- Fetched ${data.employees.length} Employee rosters
- Fetched ${data.sales.length} Sales ledger files
- Fetched ${data.attendance.length} Attendance records
- Fetched ${data.tickets.length} Active service registers
- Fetched ${data.messages.length} Correspondence log elements.
- Fetched ${data.serviceInvoices ? data.serviceInvoices.length : 0} Workshop service invoices.`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncLog(`❌ Pull Interrupted: ${err?.message || err || 'Unknown Supabase connection error.'}\n\nPlease check your internet parameters and confirm that your tables exist on Supabase with prefix 'dms_'.`);
    }
  };

  const handlePushDatabase = async () => {
    setSyncStatus('loading');
    setSyncLog('Initiating secure bulk backup transaction...\nProcessing batch writes for all structures...');
    try {
      const serviceInvoicesStr = localStorage.getItem('axigear_service_invoices');
      const serviceInvoicesObj = serviceInvoicesStr ? JSON.parse(serviceInvoicesStr) : [];

      await pushDatabaseBulk(
        dealers,
        inventory,
        employees,
        attendance,
        sales,
        tickets,
        messages,
        serviceInvoicesObj
      );

      setSyncStatus('success');
      setSyncLog(`✅ Bulk write and seed phase dispatched securely!
- All local records (including service invoices) are fully backed up to Supabase.
- Active tables populated without naming conflicts.`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncLog(`❌ Push Failed: ${err?.message || err || 'Supabase API exception.'}\n\nMake sure the table constraints allow these keys. If you haven't executed the SQL script, click 'Copy SQL Script' and paste it in your Supabase SQL Editor.`);
    }
  };

  // Current session dealer identity
  const [currentDealer, setCurrentDealer] = useState<Dealer | null>(() => {
    const disk = sessionStorage.getItem('axigear_active_dealer');
    return disk ? JSON.parse(disk) : null;
  });

  // Active view tab state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<'audit' | 'create' | 'supabase'>('audit');

  // Sync state modifications out to LocalStorage
  useEffect(() => {
    localStorage.setItem('axigear_dealers', JSON.stringify(dealers));
  }, [dealers]);

  useEffect(() => {
    localStorage.setItem('axigear_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('axigear_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('axigear_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('axigear_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('axigear_tickets', JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    localStorage.setItem('axigear_messages', JSON.stringify(messages));
  }, [messages]);

  // Handle successful login
  const handleLoginSuccess = async (dealer: Dealer) => {
    let resolvedDealer = dealer;
    try {
      const { data } = await supabase
        .from('dms_dealers')
        .select('*')
        .or(`code.eq.${dealer.code},email.eq.${dealer.email}`)
        .limit(1);

      if (data && data.length > 0) {
        const dbD = data[0];
        resolvedDealer = {
          ...dealer,
          id: dbD.id,
          name: dbD.name,
          code: dbD.code,
          location: dbD.location,
          email: dbD.email,
          phone: dbD.phone,
          managerName: dbD.manager_name,
          logoUrl: dbD.logo_url || dealer.logoUrl,
          companyName: dbD.company_name || dealer.companyName,
          incorporationNo: dbD.incorporation_no || dealer.incorporationNo,
          dbaName: dbD.dba_name || dealer.dbaName,
          legalStructure: dbD.legal_structure || dealer.legalStructure,
          ownershipDetails: dbD.ownership_details || dealer.ownershipDetails,
          registeredAddress: dbD.registered_address || dealer.registeredAddress,
          documentPan: dbD.document_pan || dealer.documentPan,
          documentGst: dbD.document_gst || dealer.documentGst,
          documentShopLicense: dbD.document_shop_license || dealer.documentShopLicense,
          documentTradeLicense: dbD.document_trade_license || dealer.documentTradeLicense
        };
        console.log(`[Login] Aligned active session dealer ID to database ID: ${resolvedDealer.id}`);
      }
    } catch (e) {
      console.warn("Failed to database-align logged-in dealer:", e);
    }

    setCurrentDealer(resolvedDealer);
    sessionStorage.setItem('axigear_active_dealer', JSON.stringify(resolvedDealer));
    
    // Auto-update or add this dealer to the local lists
    setDealers(prev => {
      const exists = prev.some(d => d.id === resolvedDealer.id || d.email.toLowerCase() === resolvedDealer.email.toLowerCase());
      if (!exists) {
        return [...prev, resolvedDealer];
      }
      return prev.map(d => (d.id === resolvedDealer.id || d.email.toLowerCase() === resolvedDealer.email.toLowerCase()) ? resolvedDealer : d);
    });

    setActiveTab('dashboard'); // reset to landing overview
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentDealer(null);
    sessionStorage.removeItem('axigear_active_dealer');
  };

  // Registering brand new dealer branch
  const handleRegisterDealer = (newDealer: Dealer) => {
    setDealers(prev => [...prev, newDealer]);
    saveDealerToDb(newDealer).catch(console.error);
  };

  // Upgrading registered dealer parameters and corporate documents
  const handleUpdateDealer = (updated: Dealer) => {
    setDealers(prev => prev.map(dl => dl.id === updated.id ? updated : dl));
    if (currentDealer && currentDealer.id === updated.id) {
      setCurrentDealer(updated);
      sessionStorage.setItem('axigear_active_dealer', JSON.stringify(updated));
    }
    saveDealerToDb(updated).catch(console.error);
  };

  const handleSimulateLoginFromAdmin = async (dealer: Dealer) => {
    let resolvedDealer = dealer;
    try {
      const { data } = await supabase
        .from('dms_dealers')
        .select('*')
        .or(`code.eq.${dealer.code},email.eq.${dealer.email}`)
        .limit(1);

      if (data && data.length > 0) {
        const dbD = data[0];
        resolvedDealer = {
          ...dealer,
          id: dbD.id,
          name: dbD.name,
          code: dbD.code,
          location: dbD.location,
          email: dbD.email,
          phone: dbD.phone,
          managerName: dbD.manager_name,
          logoUrl: dbD.logo_url || dealer.logoUrl,
          companyName: dbD.company_name || dealer.companyName,
          incorporationNo: dbD.incorporation_no || dealer.incorporationNo,
          dbaName: dbD.dba_name || dealer.dbaName,
          legalStructure: dbD.legal_structure || dealer.legalStructure,
          ownershipDetails: dbD.ownership_details || dealer.ownershipDetails,
          registeredAddress: dbD.registered_address || dealer.registeredAddress,
          documentPan: dbD.document_pan || dealer.documentPan,
          documentGst: dbD.document_gst || dealer.documentGst,
          documentShopLicense: dbD.document_shop_license || dealer.documentShopLicense,
          documentTradeLicense: dbD.document_trade_license || dealer.documentTradeLicense
        };
        console.log(`[Admin Simulation] Aligned simulated dealer ID to database ID: ${resolvedDealer.id}`);
      }
    } catch (e) {
      console.warn("Failed to database-align simulated dealer:", e);
    }

    setCurrentDealer(resolvedDealer);
    sessionStorage.setItem('axigear_active_dealer', JSON.stringify(resolvedDealer));
    setActiveTab('dashboard'); // route back to overview
  };

  // --- Dynamic Inventory Manipulations ---
  const handleAddInventory = (item: Omit<InventoryItem, 'id' | 'dealerId'>) => {
    if (!currentDealer) return;
    const newItem: InventoryItem = {
      ...item,
      id: `inv-brand-${Math.floor(1000 + Math.random() * 9000)}`,
      dealerId: currentDealer.id
    };
    setInventory(prev => [newItem, ...prev]);
    saveInventoryItemToDb(newItem).catch(console.error);
  };

  const handleUpdateInventory = (updated: InventoryItem) => {
    setInventory(prev => prev.map(item => item.id === updated.id ? updated : item));
    saveInventoryItemToDb(updated).catch(console.error);
  };

  const handleDeleteInventory = (itemId: string) => {
    setInventory(prev => prev.filter(item => item.id !== itemId));
    deleteInventoryItemFromDb(itemId).catch(console.error);
  };

  const handleDeductInventoryStock = (itemId: string, quantity: number) => {
    setInventory(prev => prev.map(item => {
      if (item.id === itemId) {
        const nextQty = Math.max(0, item.quantity - quantity);
        const updated = {
          ...item,
          quantity: nextQty,
          lastUpdated: new Date().toISOString().split('T')[0]
        };
        saveInventoryItemToDb(updated).catch(console.error);
        return updated;
      }
      return item;
    }));
  };

  // --- Dynamic Sales Invoicing ---
  const handleAddSale = (saleData: Omit<Sale, 'id' | 'dealerId' | 'invoiceNo' | 'date'> & { date?: string; invoiceNo?: string }) => {
    if (!currentDealer) return;

    const dealerSalesCount = sales.filter(s => s.dealerId === currentDealer.id).length + 1;
    const invoiceNo = saleData.invoiceNo || `AAV-RRE-ZEN-Z-${String(dealerSalesCount).padStart(3, '0')}`;

    const newSale: Sale = {
      ...saleData,
      id: `sale-brand-${Math.floor(100000 + Math.random() * 900000)}`,
      dealerId: currentDealer.id,
      invoiceNo,
      date: saleData.date || new Date().toISOString().split('T')[0]
    } as Sale;

    setSales(prev => [newSale, ...prev]);
    saveSaleToDb(newSale).catch(console.error);
  };

  const handleDeleteSale = (id: string) => {
    setSales(prev => prev.filter(s => s.id !== id));
    deleteSaleFromDb(id).catch(console.error);
  };

  const handleEditSale = (sale: Sale) => {
    setSales(prev => prev.map(s => s.id === sale.id ? sale : s));
    saveSaleToDb(sale).catch(console.error);
  };

  // --- Employee Directory ---
  const handleAddEmployee = (empData: Omit<Employee, 'id' | 'dealerId'>) => {
    if (!currentDealer) return;
    const newEmp: Employee = {
      ...empData,
      id: `emp-brand-${Math.floor(10000 + Math.random() * 90000)}`,
      dealerId: currentDealer.id
    };
    setEmployees(prev => [...prev, newEmp]);
    saveEmployeeToDb(newEmp).catch(console.error);
  };

  const handleUpdateEmployee = (updated: Employee) => {
    setEmployees(prev => prev.map(emp => emp.id === updated.id ? updated : emp));
    saveEmployeeToDb(updated).catch(console.error);
  };

  // --- Attendance roll-call batch update ---
  const handleSaveAttendanceBatch = (batch: AttendanceRecord[]) => {
    setAttendance(prev => {
      // Filter out existing records for this dealer and date
      const batchIdsToReplace = batch.map(b => b.id);
      const filteredPrev = prev.filter(item => !batchIdsToReplace.includes(item.id));
      return [...filteredPrev, ...batch];
    });
    // Record attendance on Supabase asynchronously in batch
    Promise.all(batch.map(item => saveAttendanceRecordToDb(item))).catch(console.error);
  };

  // --- Service Center tickets & claims ---
  const handleAddTicket = (tktData: Omit<ServiceTicket, 'id' | 'dealerId' | 'createdAt' | 'lastUpdated'>) => {
    if (!currentDealer) return;

    const ticketId = `TKT-${Math.floor(100 + Math.random() * 900)}`;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTicket: ServiceTicket = {
      ...tktData,
      id: ticketId,
      dealerId: currentDealer.id,
      createdAt: timestampStr,
      lastUpdated: timestampStr,
      unreadCount: 0
    };

    // Auto append initial dealer question as message history
    const initialMsg: ServiceMessage = {
      id: `msg-brand-${Math.floor(1000 + Math.random() * 9000)}`,
      ticketId,
      sender: 'dealer',
      senderName: currentDealer.managerName,
      content: tktData.description,
      timestamp: timestampStr
    };

    setTickets(prev => [newTicket, ...prev]);
    setMessages(prev => [...prev, initialMsg]);

    saveServiceTicketToDb(newTicket).catch(console.error);
    saveServiceMessageToDb(initialMsg).catch(console.error);
  };

  const handleSendMessage = (ticketId: string, content: string, sender: 'dealer' | 'service_center') => {
    if (!currentDealer) return;

    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    const newMsg: ServiceMessage = {
      id: `msg-brand-${Math.floor(10000 + Math.random() * 90000)}`,
      ticketId,
      sender,
      senderName: sender === 'dealer' ? `${currentDealer.managerName} (${currentDealer.name})` : 'Axigear Service Support',
      content,
      timestamp: timestampStr
    };

    setMessages(prev => [...prev, newMsg]);
    saveServiceMessageToDb(newMsg).catch(console.error);

    // Update ticket state timestamps and metrics
    setTickets(prev => {
      return prev.map(tkt => {
        if (tkt.id === ticketId) {
          const updatedTkt = {
            ...tkt,
            lastUpdated: timestampStr,
            status: (sender === 'dealer' ? 'In Progress' : 'Resolved') as any
          };
          saveServiceTicketToDb(updatedTkt).catch(console.error);
          return updatedTkt;
        }
        return tkt;
      });
    });
  };

  // Helper active count of unread tickets for layout highlight badges
  const unreadCount = currentDealer 
    ? tickets.filter(t => t.dealerId === currentDealer.id && (t.unreadCount || 0) > 0).length 
    : 0;

  // Render sub page depending on navigated tab
  const renderTabContent = () => {
    if (!currentDealer) return null;

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardOverview 
            currentDealer={currentDealer}
            inventory={inventory}
            sales={sales}
            employees={employees}
            attendance={attendance}
            tickets={tickets}
            setActiveTab={setActiveTab}
            onQuickAction={(action) => {
              if (action === 'sale') {
                setActiveTab('sales');
              } else if (action === 'ticket') {
                setActiveTab('service');
              }
            }}
          />
        );
      case 'inventory':
        return (
          <InventoryManager 
            currentDealer={currentDealer}
            inventory={inventory}
            onAddInventory={handleAddInventory}
            onUpdateInventory={handleUpdateInventory}
            onDeleteInventory={handleDeleteInventory}
          />
        );
      case 'sales':
        return (
          <SalesManager
            currentDealer={currentDealer}
            inventory={inventory}
            sales={sales}
            employees={employees}
            onAddSale={handleAddSale}
            onDeleteSale={handleDeleteSale}
            onEditSale={handleEditSale}
            onDeductInventoryStock={handleDeductInventoryStock}
          />
        );
      case 'employees':
        return (
          <EmployeeManager 
            currentDealer={currentDealer}
            employees={employees}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
          />
        );
      case 'attendance':
        return (
          <AttendanceTracker 
            currentDealer={currentDealer}
            employees={employees}
            attendance={attendance}
            onSaveAttendanceBatch={handleSaveAttendanceBatch}
          />
        );
      case 'service':
        return (
          <ServiceCenter 
            currentDealer={currentDealer}
            tickets={tickets}
            messages={messages}
            onSubmitTicket={handleAddTicket}
            onSendMessage={handleSendMessage}
          />
        );
      case 'profile':
        return (
          <DealerProfile 
            currentDealer={currentDealer}
            onUpdateDealer={handleUpdateDealer}
          />
        );
      case 'crmadmin':
        return (
          <CrmAdminPortal 
            dealers={dealers}
            onRegisterDealer={handleRegisterDealer}
            onSimulateLogin={handleSimulateLoginFromAdmin}
            onPullDatabase={handlePullDatabase}
            onPushDatabase={handlePushDatabase}
            syncStatus={syncStatus}
            syncLog={syncLog}
            initialSubTab={adminSubTab}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  // If session not logged in: display onboarding login portals
  if (!currentDealer) {
    return (
      <AuthPage 
        dealers={dealers}
        onLoginSuccess={handleLoginSuccess}
        onRegisterDealer={handleRegisterDealer}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800">
      
      {/* Sidebar - Fix position to left rail */}
      <Sidebar 
        currentDealer={currentDealer}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        unreadTicketsCount={unreadCount}
      />

      {/* Main Content Workspace viewport */}
      <main className="flex-1 min-w-0 pl-0 md:pl-64 min-h-screen flex flex-col justify-between bg-gray-50 text-gray-800">
        
        {/* Top Header navbar of action terminal */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-700 rounded-full animate-none"></span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-sans">
              Franchise Portal — Active Session
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-bold font-mono">Terminal:</span>
              <strong className="text-emerald-800 font-mono font-black uppercase">{currentDealer.code}</strong>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="Return to gateway login"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </header>

        {/* Dynamic Inner Tab View */}
        <div className="p-6 flex-1 overflow-x-hidden">
          {dbTablesExist === false && (
            <div className="mb-6 bg-amber-50 border-l-4 border-amber-600 p-4 rounded-r-xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-[11px] sm:text-xs uppercase tracking-wide">
                    Durable Database Setup Sequence Preemption
                  </h4>
                  <p className="text-gray-600 text-[11px] mt-1 leading-normal max-w-4xl">
                    Our system has detected query responses returned <strong className="text-amber-800">404 (relations do not exist)</strong>, meaning your Supabase tables haven't been setup yet! Don't worry—local changes persist offline in your browser, but to activate cloud syncing, please paste our schema code inside your Supabase dashboard.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAdminSubTab('supabase');
                  setActiveTab('crmadmin');
                }}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black uppercase rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-emerald-600 self-start md:self-center"
              >
                <Database className="w-4 h-4 text-emerald-100" />
                <span>Configure Supabase Tables</span>
              </button>
            </div>
          )}
          {renderTabContent()}
        </div>

        {/* Global Footer metadata branding */}
        <footer className="h-12 shrink-0 border-t border-gray-200 bg-white flex items-center justify-between px-6 text-[10px] text-gray-450 font-sans">
          <span>Axigear Syndicate Operations Platform — {currentDealer.code}</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>Online connection secure</span>
          </span>
        </footer>

      </main>

    </div>
  );
}
