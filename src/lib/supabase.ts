import { createClient } from '@supabase/supabase-js';
import { Dealer, InventoryItem, Employee, AttendanceRecord, Sale, ServiceTicket, ServiceMessage, ServiceInvoice } from '../types';

const SUPABASE_URL = 'https://pevjxmhzulmmdidvlbsu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmp4bWh6dWxtbWRpZHZsYnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDE4MDEsImV4cCI6MjA5MzcxNzgwMX0.fpE9TEkC6XQgGpr-bJgnEhrQB0CwNoiQ4yfs79zPSPA';

// Initialize live Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to check if tables exist before loading to avoid app crash
async function safeGetTable(tableName: string) {
  try {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.warn(`Table ${tableName} was query-checked but returned error (may not be created yet):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Check connection to project
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('dms_dealers').select('id').limit(1);
    if (error && error.code === 'PGRST116') {
      // Table exists but is empty, connection is valid
      return true;
    }
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

// Helper to pre-emptively ensure a dealer exists, preventing foreign key violations
async function ensureDealerExistsInDb(dealerId: string): Promise<string> {
  try {
    const { data, error } = await supabase.from('dms_dealers').select('id').eq('id', dealerId).limit(1);
    if (!error && data && data.length > 0) {
      return dealerId; // Already exists
    }
    
    // Attempt to hydrate from local storage
    const localDealersStr = localStorage.getItem('axigear_dealers');
    let searchCode = dealerId;
    let searchEmail = `${dealerId}@axigear.com`;
    let localMatched: Dealer | undefined;

    if (localDealersStr) {
      const localDealers: Dealer[] = JSON.parse(localDealersStr);
      localMatched = localDealers.find(d => d.id === dealerId);
      if (localMatched) {
        searchCode = localMatched.code;
        searchEmail = localMatched.email;
      }
    }

    // Check if a dealer with the same code or email already exists in the database
    const { data: dbMatched, error: dbMatchedErr } = await supabase
      .from('dms_dealers')
      .select('id')
      .or(`code.eq.${searchCode},email.eq.${searchEmail}`)
      .limit(1);

    if (!dbMatchedErr && dbMatched && dbMatched.length > 0) {
      console.log(`Dealer match found in db with ID: ${dbMatched[0].id}. Aligning local operations.`);
      return dbMatched[0].id;
    }

    if (localMatched) {
      const res = await saveDealerToDb(localMatched);
      if (res && res.error) {
        console.error(`[ensureDealerExistsInDb] Failed to save local matched dealer ${dealerId} (code: ${searchCode}, email: ${searchEmail}):`, res.error.message, res.error.details, res.error.hint, res.error.code);
      } else {
        console.log(`Auto-seeded missing dealer ${dealerId} to prevent foreign key mismatch`);
      }
      return dealerId;
    }

    // Shell fallback
    const resInsert = await supabase.from('dms_dealers').insert({
      id: dealerId,
      name: `Dealer ${dealerId}`,
      code: searchCode,
      location: 'Default Location',
      email: searchEmail,
      phone: '+91 99999 99999',
      manager_name: 'Branch Manager'
    });
    if (resInsert && resInsert.error) {
      console.error(`[ensureDealerExistsInDb] Failed shell fallback insert for ${dealerId} (code: ${searchCode}, email: ${searchEmail}):`, resInsert.error.message, resInsert.error.details, resInsert.error.hint, resInsert.error.code);
    }
    return dealerId;
  } catch (err) {
    console.warn(`Error in ensureDealerExistsInDb for ${dealerId}:`, err);
    return dealerId;
  }
}

// Helper to pre-emptively ensure a ticket exists, preventing message foreign key violations
async function ensureTicketExistsInDb(ticketId: string) {
  try {
    const { data, error } = await supabase.from('dms_service_tickets').select('id').eq('id', ticketId).limit(1);
    if (!error && data && data.length > 0) {
      return; // Ticket exists
    }

    // Attempt to hydrate from local storage
    const localTicketsStr = localStorage.getItem('axigear_tickets');
    if (localTicketsStr) {
      const localTickets: ServiceTicket[] = JSON.parse(localTicketsStr);
      const matched = localTickets.find(t => t.id === ticketId);
      if (matched) {
        await saveServiceTicketToDb(matched);
        return;
      }
    }
  } catch (err) {
    console.warn(`Error in ensureTicketExistsInDb for ${ticketId}:`, err);
  }
}

// --- PULL (FETCH) SYSTEM FROM SUPABASE ---
export async function pullDatabase() {
  const result = {
    dealers: [] as Dealer[],
    inventory: [] as InventoryItem[],
    employees: [] as Employee[],
    attendance: [] as AttendanceRecord[],
    sales: [] as Sale[],
    tickets: [] as ServiceTicket[],
    messages: [] as ServiceMessage[],
    serviceInvoices: [] as ServiceInvoice[]
  };

  try {
    // 1. Dealers
    if (await safeGetTable('dms_dealers')) {
      const { data } = await supabase.from('dms_dealers').select('*');
      if (data) {
        result.dealers = data.map(d => ({
          id: d.id,
          name: d.name,
          code: d.code,
          location: d.location,
          email: d.email,
          password: d.password,
          phone: d.phone,
          managerName: d.manager_name,
          logoUrl: d.logo_url,
          
          companyName: d.company_name,
          incorporationNo: d.incorporation_no,
          dbaName: d.dba_name,
          legalStructure: d.legal_structure,
          ownershipDetails: d.ownership_details,
          registeredAddress: d.registered_address,
          documentPan: d.document_pan,
          documentGst: d.document_gst,
          documentShopLicense: d.document_shop_license,
          documentTradeLicense: d.document_trade_license
        }));
      }
    }

    // 2. Inventory Items
    if (await safeGetTable('dms_inventory_items')) {
      const { data } = await supabase.from('dms_inventory_items').select('*');
      if (data) {
        result.inventory = data.map(i => ({
          id: i.id,
          dealerId: i.dealer_id,
          name: i.name,
          sku: i.sku,
          category: i.category,
          quantity: Number(i.quantity),
          minThreshold: Number(i.min_threshold),
          price: Number(i.price),
          location: i.location,
          imageUrl: i.image_url,
          lastUpdated: i.last_updated
        }));
      }
    }

    // 3. Employees
    if (await safeGetTable('dms_employees')) {
      const { data } = await supabase.from('dms_employees').select('*');
      if (data) {
        result.employees = data.map(e => ({
          id: e.id,
          dealerId: e.dealer_id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          role: e.role,
          status: e.status,
          hireDate: e.hire_date
        }));
      }
    }

    // 4. Attendance
    if (await safeGetTable('dms_attendance_records')) {
      const { data } = await supabase.from('dms_attendance_records').select('*');
      if (data) {
        result.attendance = data.map(a => ({
          id: a.id,
          dealerId: a.dealer_id,
          employeeId: a.employee_id,
          employeeName: a.employee_name,
          date: a.date,
          status: a.status,
          clockIn: a.clock_in,
          clockOut: a.clock_out,
          notes: a.notes
        }));
      }
    }

    // 5. Sales & Sale line items
    if (await safeGetTable('dms_sales') && await safeGetTable('dms_sale_items')) {
      const { data: salesData } = await supabase.from('dms_sales').select('*');
      const { data: itemsData } = await supabase.from('dms_sale_items').select('*');

      if (salesData) {
        result.sales = salesData.map(s => {
          const matchingItems = itemsData 
            ? itemsData.filter(i => i.sale_id === s.id).map(mi => ({
                itemId: mi.item_id,
                name: mi.name,
                quantity: Number(mi.quantity),
                pricePerUnit: Number(mi.price_per_unit)
              }))
            : [];
          return {
            id: s.id,
            dealerId: s.dealer_id,
            invoiceNo: s.invoice_no,
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            items: matchingItems,
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
            displaySplitsInInvoice: s.display_splits_in_invoice !== false
          };
        });
      }
    }

    // 6. Tickets
    if (await safeGetTable('dms_service_tickets')) {
      const { data } = await supabase.from('dms_service_tickets').select('*');
      if (data) {
        result.tickets = data.map(t => ({
          id: t.id,
          dealerId: t.dealer_id,
          subject: t.subject,
          category: t.category,
          priority: t.priority,
          status: t.status,
          description: t.description,
          createdAt: t.created_at,
          lastUpdated: t.last_updated,
          unreadCount: 0
        }));
      }
    }

    // 7. Service Messages
    if (await safeGetTable('dms_service_messages')) {
      const { data } = await supabase.from('dms_service_messages').select('*');
      if (data) {
        result.messages = data.map(m => ({
          id: m.id,
          ticketId: m.ticket_id,
          sender: m.sender,
          senderName: m.sender_name,
          content: m.content,
          timestamp: m.timestamp
        }));
      }
    }

    // 8. Service Invoices
    if (await safeGetTable('dms_service_invoices') && await safeGetTable('dms_service_invoice_items')) {
      const { data: srvInvoicesData } = await supabase.from('dms_service_invoices').select('*');
      const { data: srvItemsData } = await supabase.from('dms_service_invoice_items').select('*');
      const { data: srvSplitsData } = await safeGetTable('dms_service_invoice_splits') 
        ? await supabase.from('dms_service_invoice_splits').select('*')
        : { data: null };

      if (srvInvoicesData) {
        result.serviceInvoices = srvInvoicesData.map(sv => {
          const matchingItems = srvItemsData
            ? srvItemsData.filter(i => i.service_invoice_id === sv.id).map(mi => ({
                id: mi.id,
                name: mi.name,
                price: Number(mi.price),
                quantity: Number(mi.quantity)
              }))
            : [];
          
          const matchingSplits = srvSplitsData
            ? srvSplitsData.filter(sp => sp.service_invoice_id === sv.id).map(msp => ({
                amount: Number(msp.amount),
                paymentMethod: msp.payment_method,
                date: msp.date
              }))
            : [{ amount: Number(sv.total_amount), paymentMethod: sv.payment_method, date: sv.date }];

          return {
            id: sv.id,
            dealerId: sv.dealer_id,
            invoiceNo: sv.invoice_no,
            customerName: sv.customer_name,
            customerPhone: sv.customer_phone,
            location: sv.location,
            date: sv.date,
            labourCharges: Number(sv.labour_charges),
            paymentMethod: sv.payment_method,
            leadSource: sv.lead_source,
            enableGst: sv.enable_gst !== false,
            products: matchingItems,
            productDescription: sv.product_description,
            totalAmount: Number(sv.total_amount),
            splits: matchingSplits,
            displaySplitsInInvoice: sv.display_splits_in_invoice !== false
          };
        });
      }
    }
  } catch (error) {
    console.error('Error executing pull database query operations:', error);
  }

  return result;
}

// --- PUSH ALL (BULK SPREAD / SYNC BACKUP) ---
export async function pushDatabaseBulk(
  dealers: Dealer[],
  inventory: InventoryItem[],
  employees: Employee[],
  attendance: AttendanceRecord[],
  sales: Sale[],
  tickets: ServiceTicket[],
  messages: ServiceMessage[],
  serviceInvoices?: ServiceInvoice[]
) {
  const reports: string[] = [];

  // 1. Reset & Upsert Dealers
  if (dealers.length > 0) {
    let dbDealers = dealers.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      location: d.location,
      email: d.email,
      password: d.password || 'dealer123',
      phone: d.phone,
      manager_name: d.managerName,
      logo_url: d.logoUrl || null,
      
      company_name: d.companyName || null,
      incorporation_no: d.incorporationNo || null,
      dba_name: d.dbaName || null,
      legal_structure: d.legalStructure || '',
      ownership_details: d.ownershipDetails || null,
      registered_address: d.registeredAddress || null,
      document_pan: d.documentPan || null,
      document_gst: d.documentGst || null,
      document_shop_license: d.documentShopLicense || null,
      document_trade_license: d.documentTradeLicense || null
    }));

    let attempts = 0;
    const maxAttempts = 15;
    let success = false;
    let finalError = null;

    while (attempts < maxAttempts) {
      const { error } = await supabase.from('dms_dealers').upsert(dbDealers);
      if (!error) {
        success = true;
        break;
      }

      finalError = error;
      const isColumnError = error.code === '42703' || error.message?.includes('column') || error.message?.includes('attribute');
      if (isColumnError) {
        const match = error.message.match(/column\s+"([^"]+)"/) || error.message.match(/column\s+'([^']+)'/) || error.message.match(/attribute\s+"([^"]+)"/);
        if (match && match[1]) {
          const missingColumn = match[1];
          console.warn(`[pushDatabaseBulk] Column "${missingColumn}" does not exist in dms_dealers table. Pruning from bulk payload and retrying...`);
          dbDealers = dbDealers.map(item => {
            const copy = { ...item };
            delete (copy as any)[missingColumn];
            return copy;
          });
          attempts++;
          continue;
        } else {
          // If we can't parse, do progressive fallback
          const firstItem = dbDealers[0] as any;
          if (firstItem && (firstItem.document_pan || firstItem.document_gst || firstItem.document_shop_license || firstItem.document_trade_license)) {
            console.warn(`[pushDatabaseBulk] Column error with unparseable message. Falling back by pruning document columns...`);
            dbDealers = dbDealers.map(item => {
              const copy = { ...item };
              delete (copy as any).document_pan;
              delete (copy as any).document_gst;
              delete (copy as any).document_shop_license;
              delete (copy as any).document_trade_license;
              return copy;
            });
            attempts++;
            continue;
          }
          if (firstItem && (firstItem.company_name || firstItem.incorporation_no || firstItem.dba_name || firstItem.legal_structure || firstItem.ownership_details || firstItem.registered_address)) {
            console.warn(`[pushDatabaseBulk] Column error with unparseable message. Falling back by pruning compliance columns...`);
            dbDealers = dbDealers.map(item => {
              const copy = { ...item };
              delete (copy as any).company_name;
              delete (copy as any).incorporation_no;
              delete (copy as any).dba_name;
              delete (copy as any).legal_structure;
              delete (copy as any).ownership_details;
              delete (copy as any).registered_address;
              return copy;
            });
            attempts++;
            continue;
          }
        }
      }
      break;
    }

    if (!success && finalError) {
      console.warn(`[pushDatabaseBulk] Falling back to absolute basic dealer schema...`);
      const basicDealers = dealers.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        location: d.location,
        email: d.email,
        password: d.password || 'dealer123',
        phone: d.phone,
        manager_name: d.managerName,
        logo_url: d.logoUrl || null
      }));
      const resFallback = await supabase.from('dms_dealers').upsert(basicDealers);
      if (resFallback.error) {
        throw new Error(`[Dealers Sync Fail]: ${resFallback.error.message} (Is 'dms_dealers' created in Supabase?)`);
      }
    }
    reports.push(`Synced ${dealers.length} dealers successfully`);
  }

  // 2. Reset & Upsert Employees (must be done before attendance referencing)
  if (employees.length > 0) {
    const dbEmployees = employees.map(e => ({
      id: e.id,
      dealer_id: e.dealerId,
      name: e.name,
      email: e.email,
      phone: e.phone,
      role: e.role,
      status: e.status,
      hire_date: e.hireDate
    }));
    const { error } = await supabase.from('dms_employees').upsert(dbEmployees);
    if (error) {
      throw new Error(`[Employees Sync Fail]: ${error.message}`);
    }
    reports.push(`Synced ${employees.length} employees successfully`);
  }

  // 3. Reset & Upsert Inventory items
  if (inventory.length > 0) {
    const dbInventory = inventory.map(i => ({
      id: i.id,
      dealer_id: i.dealerId,
      name: i.name,
      sku: i.sku,
      category: i.category,
      quantity: i.quantity,
      min_threshold: i.minThreshold,
      price: i.price,
      location: i.location,
      image_url: i.imageUrl || null,
      last_updated: i.lastUpdated
    }));
    const { error } = await supabase.from('dms_inventory_items').upsert(dbInventory);
    if (error) {
      throw new Error(`[Inventory Sync Fail]: ${error.message}`);
    }
    reports.push(`Synced ${inventory.length} inventory lines successfully`);
  }

  // 4. Reset & Upsert Attendance records
  if (attendance.length > 0) {
    const dbAttendance = attendance.map(a => ({
      id: a.id,
      dealer_id: a.dealerId,
      employee_id: a.employeeId,
      employee_name: a.employeeName,
      date: a.date,
      status: a.status,
      clock_in: a.clockIn || null,
      clock_out: a.clockOut || null,
      notes: a.notes || null
    }));
    const { error } = await supabase.from('dms_attendance_records').upsert(dbAttendance);
    if (error) {
      throw new Error(`[Attendance Sync Fail]: ${error.message}`);
    }
    reports.push(`Synced ${attendance.length} attendance registers successfully`);
  }

  // 5. Reset & Upsert Sales
  if (sales.length > 0) {
    const dbSales = sales.map(s => ({
      id: s.id,
      dealer_id: s.dealerId,
      invoice_no: s.invoiceNo,
      customer_name: s.customerName,
      customer_phone: s.customerPhone || null,
      total_amount: s.totalAmount,
      payment_method: s.paymentMethod,
      date: s.date,
      salesperson_id: s.salespersonId,
      salesperson_name: s.salespersonName,
      model_no: s.modelNo || null,
      location: s.location || null,
      product_desc: s.productDesc || null,
      hsn_no: s.hsnNo || null,
      chassis_no: s.chassisNo || null,
      motor_no: s.motorNo || null,
      battery_no: s.batteryNo || null,
      battery_warranty: s.batteryWarranty || null,
      battery_capacity: s.batteryCapacity || null,
      vehicle_warranty: s.vehicleWarranty || null,
      gst_no: s.gstNo || null,
      lead_source: s.leadSource || null,
      display_splits_in_invoice: s.displaySplitsInInvoice !== false
    }));
    let { error: salesErr } = await supabase.from('dms_sales').upsert(dbSales);
    if (salesErr && (salesErr.code === '42703' || salesErr.message?.includes('column'))) {
      console.warn(`[pushDatabaseBulk] Undefined column error in sales upsert, falling back to basic sale payload...`);
      const basicSales = sales.map(s => ({
        id: s.id,
        dealer_id: s.dealerId,
        invoice_no: s.invoiceNo,
        customer_name: s.customerName,
        customer_phone: s.customerPhone || null,
        total_amount: s.totalAmount,
        payment_method: s.paymentMethod,
        date: s.date,
        salesperson_id: s.salespersonId,
        salesperson_name: s.salespersonName
      }));
      const resFallback = await supabase.from('dms_sales').upsert(basicSales);
      salesErr = resFallback.error;
    }
    if (salesErr) {
      throw new Error(`[Sales Sync Fail]: ${salesErr.message}`);
    }
    
    // Upsert sale line items
    const saleLineItems: any[] = [];
    sales.forEach(s => {
      s.items.forEach(li => {
        saleLineItems.push({
          sale_id: s.id,
          item_id: li.itemId || null,
          name: li.name,
          quantity: li.quantity,
          price_per_unit: li.pricePerUnit
        });
      });
    });

    if (saleLineItems.length > 0) {
      await supabase.from('dms_sale_items').delete().in('sale_id', sales.map(s => s.id));
      const { error: itemsErr } = await supabase.from('dms_sale_items').insert(saleLineItems);
      if (itemsErr) {
        throw new Error(`[Sale Items Sync Fail]: ${itemsErr.message}`);
      }
      reports.push(`Synced ${sales.length} customer sales bills with ${saleLineItems.length} specification lines`);
    } else {
      reports.push(`Synced ${sales.length} sales bills successfully`);
    }
  }

  // 6. Reset & Upsert Tickets
  if (tickets.length > 0) {
    const dbTickets = tickets.map(t => ({
      id: t.id,
      dealer_id: t.dealerId,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      description: t.description,
      created_at: t.createdAt,
      last_updated: t.lastUpdated
    }));
    const { error } = await supabase.from('dms_service_tickets').upsert(dbTickets);
    if (error) {
      throw new Error(`[Service Tickets Sync Fail]: ${error.message}`);
    }
    reports.push(`Synced ${tickets.length} tickets successfully`);
  }

  // 7. Reset & Upsert Service messages
  if (messages.length > 0) {
    const dbMessages = messages.map(m => ({
      id: m.id,
      ticket_id: m.ticketId,
      sender: m.sender,
      sender_name: m.senderName,
      content: m.content,
      timestamp: m.timestamp
    }));
    const { error } = await supabase.from('dms_service_messages').upsert(dbMessages);
    if (error) {
      throw new Error(`[Service Messages Sync Fail]: ${error.message}`);
    }
    reports.push(`Synced ${messages.length} collaboration messages`);
  }

  // 8. Reset & Upsert Service Invoices (if provided via localStorage pull block)
  const currentServiceInvoices = serviceInvoices || (() => {
    try {
      const disk = localStorage.getItem('axigear_service_invoices');
      return disk ? JSON.parse(disk) as ServiceInvoice[] : [];
    } catch {
      return [];
    }
  })();

  if (currentServiceInvoices.length > 0) {
    const dbSrvInvoices = currentServiceInvoices.map(sv => ({
      id: sv.id,
      dealer_id: sv.dealerId,
      invoice_no: sv.invoiceNo,
      customer_name: sv.customerName,
      customer_phone: sv.customerPhone || null,
      location: sv.location || null,
      date: sv.date,
      labour_charges: sv.labourCharges,
      payment_method: sv.paymentMethod,
      lead_source: sv.leadSource || null,
      enable_gst: sv.enableGst,
      product_description: sv.productDescription || null,
      total_amount: sv.totalAmount,
      display_splits_in_invoice: sv.displaySplitsInInvoice !== false
    }));

    const { error: srvErr } = await supabase.from('dms_service_invoices').upsert(dbSrvInvoices);
    if (srvErr) {
      throw new Error(`[Service Invoices Sync Fail]: ${srvErr.message}`);
    }

    const srvLineItems: any[] = [];
    currentServiceInvoices.forEach(sv => {
      if (sv.products) {
        sv.products.forEach(p => {
          srvLineItems.push({
            id: p.id || `srv-item-uuid-${Math.floor(100000 + Math.random() * 900000)}`,
            service_invoice_id: sv.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity
          });
        });
      }
    });

    if (srvLineItems.length > 0) {
      await supabase.from('dms_service_invoice_items').delete().in('service_invoice_id', currentServiceInvoices.map(sv => sv.id));
      const { error: sItemErr } = await supabase.from('dms_service_invoice_items').insert(srvLineItems);
      if (sItemErr) {
        throw new Error(`[Service Invoice Items Sync Fail]: ${sItemErr.message}`);
      }
    }

    reports.push(`Synced ${currentServiceInvoices.length} service invoices with ${srvLineItems.length} spare parts lists successfully`);
  }

  return reports;
}

// --- ON-DEEP SINGLE RECORD UPSERT FOR REALTIME SYNC CHANGES ---
export async function saveDealerToDb(d: Dealer) {
  const payload: any = {
    id: d.id,
    name: d.name,
    code: d.code,
    location: d.location,
    email: d.email,
    password: d.password || 'dealer123',
    phone: d.phone,
    manager_name: d.managerName,
    logo_url: d.logoUrl || null,
    
    company_name: d.companyName || null,
    incorporation_no: d.incorporationNo || null,
    dba_name: d.dbaName || null,
    legal_structure: d.legalStructure || '',
    ownership_details: d.ownershipDetails || null,
    registered_address: d.registeredAddress || null,
    document_pan: d.documentPan || null,
    document_gst: d.documentGst || null,
    document_shop_license: d.documentShopLicense || null,
    document_trade_license: d.documentTradeLicense || null
  };

  let currentPayload = { ...payload };
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    const res = await supabase.from('dms_dealers').upsert(currentPayload);
    if (!res.error) {
      return res;
    }

    const isColumnError = res.error.code === '42703' || res.error.message?.includes('column') || res.error.message?.includes('attribute');
    if (isColumnError) {
      const match = res.error.message.match(/column\s+"([^"]+)"/) || res.error.message.match(/column\s+'([^']+)'/) || res.error.message.match(/attribute\s+"([^"]+)"/);
      if (match && match[1]) {
        const missingColumn = match[1];
        console.warn(`[saveDealerToDb] Column "${missingColumn}" does not exist in dms_dealers table. Pruning from payload and retrying...`);
        delete currentPayload[missingColumn];
        attempts++;
        continue;
      } else {
        // If we can't parse, do progressive fallback
        if (currentPayload.document_pan || currentPayload.document_gst || currentPayload.document_shop_license || currentPayload.document_trade_license) {
          console.warn(`[saveDealerToDb] Column error with unparseable message. Falling back by pruning document columns...`);
          delete currentPayload.document_pan;
          delete currentPayload.document_gst;
          delete currentPayload.document_shop_license;
          delete currentPayload.document_trade_license;
          attempts++;
          continue;
        }
        if (currentPayload.company_name || currentPayload.incorporation_no || currentPayload.dba_name || currentPayload.legal_structure || currentPayload.ownership_details || currentPayload.registered_address) {
          console.warn(`[saveDealerToDb] Column error with unparseable message. Falling back by pruning compliance columns...`);
          delete currentPayload.company_name;
          delete currentPayload.incorporation_no;
          delete currentPayload.dba_name;
          delete currentPayload.legal_structure;
          delete currentPayload.ownership_details;
          delete currentPayload.registered_address;
          attempts++;
          continue;
        }
      }
    }
    return res;
  }

  // Final absolute basic fallback
  const fallbackPayload = {
    id: d.id,
    name: d.name,
    code: d.code,
    location: d.location,
    email: d.email,
    password: d.password || 'dealer123',
    phone: d.phone,
    manager_name: d.managerName,
    logo_url: d.logoUrl || null
  };
  return supabase.from('dms_dealers').upsert(fallbackPayload);
}

export async function saveInventoryItemToDb(i: InventoryItem) {
  const resolvedDealerId = await ensureDealerExistsInDb(i.dealerId);
  return supabase.from('dms_inventory_items').upsert({
    id: i.id,
    dealer_id: resolvedDealerId,
    name: i.name,
    sku: i.sku,
    category: i.category,
    quantity: i.quantity,
    min_threshold: i.minThreshold,
    price: i.price,
    location: i.location,
    image_url: i.imageUrl || null,
    last_updated: i.lastUpdated
  });
}

export async function deleteInventoryItemFromDb(id: string) {
  return supabase.from('dms_inventory_items').delete().eq('id', id);
}

export async function saveEmployeeToDb(e: Employee) {
  const resolvedDealerId = await ensureDealerExistsInDb(e.dealerId);
  return supabase.from('dms_employees').upsert({
    id: e.id,
    dealer_id: resolvedDealerId,
    name: e.name,
    email: e.email,
    phone: e.phone,
    role: e.role,
    status: e.status,
    hire_date: e.hireDate
  });
}

export async function saveAttendanceRecordToDb(a: AttendanceRecord) {
  const resolvedDealerId = await ensureDealerExistsInDb(a.dealerId);
  return supabase.from('dms_attendance_records').upsert({
    id: a.id,
    dealer_id: resolvedDealerId,
    employee_id: a.employeeId,
    employee_name: a.employeeName,
    date: a.date,
    status: a.status,
    clock_in: a.clockIn || null,
    clock_out: a.clockOut || null,
    notes: a.notes || null
  });
}

export async function saveSaleToDb(s: Sale) {
  const resolvedDealerId = await ensureDealerExistsInDb(s.dealerId);

  const payload = {
    id: s.id,
    dealer_id: resolvedDealerId,
    invoice_no: s.invoiceNo,
    customer_name: s.customerName,
    customer_phone: s.customerPhone || null,
    total_amount: s.totalAmount,
    payment_method: s.paymentMethod,
    date: s.date,
    salesperson_id: s.salespersonId,
    salesperson_name: s.salespersonName,
    model_no: s.modelNo || null,
    location: s.location || null,
    product_desc: s.productDesc || null,
    hsn_no: s.hsnNo || null,
    chassis_no: s.chassisNo || null,
    motor_no: s.motorNo || null,
    battery_no: s.batteryNo || null,
    battery_warranty: s.batteryWarranty || null,
    battery_capacity: s.batteryCapacity || null,
    vehicle_warranty: s.vehicleWarranty || null,
    gst_no: s.gstNo || null,
    lead_source: s.leadSource || null,
    display_splits_in_invoice: s.displaySplitsInInvoice !== false
  };

  let { error: sErr } = await supabase.from('dms_sales').upsert(payload);

  if (sErr && (sErr.code === '42703' || sErr.message?.includes('column'))) {
    console.warn(`[saveSaleToDb] Undefined column error detected, retrying with basic sale schema fallback...`);
    const fallbackPayload = {
      id: s.id,
      dealer_id: resolvedDealerId,
      invoice_no: s.invoiceNo,
      customer_name: s.customerName,
      customer_phone: s.customerPhone || null,
      total_amount: s.totalAmount,
      payment_method: s.paymentMethod,
      date: s.date,
      salesperson_id: s.salespersonId,
      salesperson_name: s.salespersonName
    };
    const fallbackRes = await supabase.from('dms_sales').upsert(fallbackPayload);
    sErr = fallbackRes.error;
  }

  if (sErr) {
    console.error(`[saveSaleToDb] Failed to upsert sale ${s.id} (invoice: ${s.invoiceNo}, dealer: ${resolvedDealerId}):`, sErr.message, sErr.details, sErr.hint, sErr.code);
    return { error: sErr };
  }

  // Insert lines
  const lines = s.items.map(li => ({
    sale_id: s.id,
    item_id: li.itemId || null,
    name: li.name,
    quantity: li.quantity,
    price_per_unit: li.pricePerUnit
  }));

  await supabase.from('dms_sale_items').delete().eq('sale_id', s.id);
  const { error: lineErr } = await supabase.from('dms_sale_items').insert(lines);
  if (lineErr) {
    console.error(`[saveSaleToDb] Failed to insert sale items for sale ${s.id}:`, lineErr.message, lineErr.details, lineErr.hint, lineErr.code);
  }
  return { error: lineErr };
}

export async function deleteSaleFromDb(saleId: string) {
  await supabase.from('dms_sale_items').delete().eq('sale_id', saleId);
  return supabase.from('dms_sales').delete().eq('id', saleId);
}

export async function saveServiceTicketToDb(t: ServiceTicket) {
  const resolvedDealerId = await ensureDealerExistsInDb(t.dealerId);
  return supabase.from('dms_service_tickets').upsert({
    id: t.id,
    dealer_id: resolvedDealerId,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    description: t.description,
    created_at: t.createdAt,
    last_updated: t.lastUpdated
  });
}

export async function saveServiceMessageToDb(m: ServiceMessage) {
  await ensureTicketExistsInDb(m.ticketId);
  return supabase.from('dms_service_messages').upsert({
    id: m.id,
    ticket_id: m.ticketId,
    sender: m.sender,
    sender_name: m.senderName,
    content: m.content,
    timestamp: m.timestamp
  });
}

// Realtime service invoice upsert
export async function saveServiceInvoiceToDb(s: ServiceInvoice) {
  const resolvedDealerId = await ensureDealerExistsInDb(s.dealerId);

  const { error: sErr } = await supabase.from('dms_service_invoices').upsert({
    id: s.id,
    dealer_id: resolvedDealerId,
    invoice_no: s.invoiceNo,
    customer_name: s.customerName,
    customer_phone: s.customerPhone || null,
    location: s.location || null,
    date: s.date,
    labour_charges: s.labourCharges,
    payment_method: s.paymentMethod,
    lead_source: s.leadSource || null,
    enable_gst: s.enableGst,
    product_description: s.productDescription || null,
    total_amount: s.totalAmount,
    display_splits_in_invoice: s.displaySplitsInInvoice !== false
  });

  if (sErr) return { error: sErr };

  const lines = s.products.map(p => ({
    id: p.id || `srv-item-uuid-${Math.floor(100000 + Math.random() * 900000)}`,
    service_invoice_id: s.id,
    name: p.name,
    price: p.price,
    quantity: p.quantity
  }));

  await supabase.from('dms_service_invoice_items').delete().eq('service_invoice_id', s.id);
  const { error: linesErr } = await supabase.from('dms_service_invoice_items').insert(lines);
  if (linesErr) return { error: linesErr };

  if (s.splits && s.splits.length > 0) {
    const srvSplits = s.splits.map(sp => ({
      service_invoice_id: s.id,
      amount: sp.amount,
      payment_method: sp.paymentMethod,
      date: sp.date
    }));

    await supabase.from('dms_service_invoice_splits').delete().eq('service_invoice_id', s.id);
    await supabase.from('dms_service_invoice_splits').insert(srvSplits);
  }

  return { error: null };
}
