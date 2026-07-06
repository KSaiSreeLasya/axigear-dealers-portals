/**
 * Utility to convert an array of objects to a CSV string and trigger a browser download.
 * Handles nested objects/arrays, escaping, special characters, and Indian Rupee symbols gracefully.
 */
export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add UTF-8 Byte Order Mark (BOM) to support Hindi/INR/other characters in Excel
  const BOM = "\uFEFF";

  // Add header row
  csvRows.push(headers.map(header => `"${header.replace(/"/g, '""')}"`).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header];
      if (val === undefined || val === null) {
        return '""';
      }
      if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = BOM + csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Utility to generate a beautiful, responsive, and A4 print-optimized standalone HTML invoice.
 * It downloads the file directly to the client's browser.
 */
export function downloadInvoiceHTML(invoice: any, type: 'sale' | 'estimation' | 'service' | 'dealer_invoice') {
  if (!invoice) {
    alert("No invoice data specified.");
    return;
  }

  // Harmonize different invoice data models
  let invoiceNo = '';
  let customerName = '';
  let customerPhone = '';
  let address = '';
  let date = '';
  let paymentMethod = '';
  let totalAmount = 0;
  let itemsHtml = '';
  let subtitle = '';
  let detailsHtml = '';

  const formatCurrency = (val: number) => {
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (type === 'dealer_invoice') {
    invoiceNo = invoice.invoiceNumber || 'N/A';
    customerName = invoice.dealerName || 'N/A';
    customerPhone = invoice.contactNo || 'N/A';
    address = invoice.location || 'N/A';
    date = invoice.invoiceDate || 'N/A';
    paymentMethod = invoice.paymentMode || 'N/A';
    totalAmount = invoice.totalAmount || 0;
    subtitle = "DEALER INVENTORY SUPPLY RECEIPT";

    detailsHtml = `
      <tr><td><strong>Due Date:</strong></td><td>${invoice.dueDate || 'N/A'}</td></tr>
      <tr><td><strong>PO Number:</strong></td><td>${invoice.poNumber || 'N/A'}</td></tr>
      <tr><td><strong>Ship To:</strong></td><td>${invoice.shipTo || 'N/A'}</td></tr>
    `;

    (invoice.items || []).forEach((it: any, i: number) => {
      const taxable = it.amount || 0;
      const gst = (it.gstRate || 18);
      const gstAmt = Math.round(taxable * (gst / 100) * 100) / 100;
      const total = taxable + gstAmt;
      itemsHtml += `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td><strong>${it.product}</strong><br><small style="color: #666;">${it.description || ''}</small></td>
          <td style="text-align: center;">8711</td>
          <td style="text-align: center;">${it.unit || 1}</td>
          <td style="text-align: right;">${formatCurrency(taxable)}</td>
          <td style="text-align: center;">${gst}%</td>
          <td style="text-align: right;">${formatCurrency(gstAmt)}</td>
          <td style="text-align: right;">${formatCurrency(total * (it.unit || 1))}</td>
        </tr>
      `;
    });
  } else if (type === 'sale') {
    invoiceNo = invoice.invoiceNo || 'AXI/SALE/' + invoice.id?.substring(0,6).toUpperCase();
    customerName = invoice.customerName || 'N/A';
    customerPhone = invoice.customerPhone || 'N/A';
    address = invoice.location || 'N/A';
    date = invoice.date || 'N/A';
    paymentMethod = invoice.paymentMethod || 'N/A';
    totalAmount = invoice.totalAmount || 0;
    subtitle = "RETAIL MOTORCYCLE SALES RECEIPT";

    detailsHtml = `
      <tr><td><strong>Model No:</strong></td><td>${invoice.modelNo || 'N/A'}</td></tr>
      <tr><td><strong>Chassis No:</strong></td><td>${invoice.chassisNo || 'N/A'}</td></tr>
      <tr><td><strong>Motor No:</strong></td><td>${invoice.motorNo || 'N/A'}</td></tr>
      <tr><td><strong>Battery No:</strong></td><td>${invoice.batteryNo || 'N/A'}</td></tr>
      <tr><td><strong>Battery Capacity:</strong></td><td>${invoice.batteryCapacity || 'N/A'}</td></tr>
      <tr><td><strong>Battery Warranty:</strong></td><td>${invoice.batteryWarranty || 'N/A'}</td></tr>
      <tr><td><strong>Vehicle Warranty:</strong></td><td>${invoice.vehicleWarranty || 'N/A'}</td></tr>
    `;

    (invoice.items || []).forEach((it: any, i: number) => {
      const qty = it.quantity || 1;
      const itemPrice = it.pricePerUnit || 0;
      const gstRate = 18;
      const itemTaxable = Math.round((itemPrice / 1.18) * 100) / 100;
      const itemGst = itemPrice - itemTaxable;

      itemsHtml += `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td><strong>${it.name || 'Electric Vehicle'}</strong></td>
          <td style="text-align: center;">871160</td>
          <td style="text-align: center;">${qty}</td>
          <td style="text-align: right;">${formatCurrency(itemTaxable)}</td>
          <td style="text-align: center;">${gstRate}%</td>
          <td style="text-align: right;">${formatCurrency(itemGst)}</td>
          <td style="text-align: right;">${formatCurrency(itemPrice * qty)}</td>
        </tr>
      `;
    });
  } else if (type === 'service') {
    invoiceNo = invoice.invoiceNo || 'N/A';
    customerName = invoice.customerName || 'N/A';
    customerPhone = invoice.customerPhone || 'N/A';
    address = invoice.location || 'N/A';
    date = invoice.date || 'N/A';
    paymentMethod = invoice.paymentMethod || 'N/A';
    totalAmount = invoice.totalAmount || 0;
    subtitle = "TECHNICAL WORKSHOP SERVICE INVOICE";

    detailsHtml = `
      <tr><td><strong>Workshop Job Card:</strong></td><td>${invoice.invoiceNo || 'N/A'}</td></tr>
      <tr><td><strong>Labour Charges:</strong></td><td>${formatCurrency(invoice.labourCharges || 0)}</td></tr>
      <tr><td><strong>Job Summary:</strong></td><td>${invoice.productDescription || 'General servicing'}</td></tr>
    `;

    // Labour item row
    itemsHtml += `
      <tr>
        <td style="text-align: center;">1</td>
        <td><strong>Technical Labour Charges</strong><br><small style="color: #666;">Service and diagnostic labour fee</small></td>
        <td style="text-align: center;">9987</td>
        <td style="text-align: center;">1</td>
        <td style="text-align: right;">${formatCurrency(invoice.labourCharges || 0)}</td>
        <td style="text-align: center;">5%</td>
        <td style="text-align: right;">${formatCurrency((invoice.labourCharges || 0) * 0.05)}</td>
        <td style="text-align: right;">${formatCurrency((invoice.labourCharges || 0) * 1.05)}</td>
      </tr>
    `;

    (invoice.products || []).forEach((it: any, i: number) => {
      const price = it.price || 0;
      const qty = it.quantity || 1;
      const total = price * qty;
      const gstAmt = invoice.enableGst ? Math.round(total * 0.05 * 100) / 100 : 0;
      itemsHtml += `
        <tr>
          <td style="text-align: center;">${i + 2}</td>
          <td><strong>${it.name}</strong></td>
          <td style="text-align: center;">8714</td>
          <td style="text-align: center;">${qty}</td>
          <td style="text-align: right;">${formatCurrency(price)}</td>
          <td style="text-align: center;">${invoice.enableGst ? '5%' : '0%'}</td>
          <td style="text-align: right;">${formatCurrency(gstAmt)}</td>
          <td style="text-align: right;">${formatCurrency(total + gstAmt)}</td>
        </tr>
      `;
    });
  } else if (type === 'estimation') {
    invoiceNo = invoice.slipNo || 'N/A';
    customerName = invoice.customerName || 'N/A';
    customerPhone = invoice.contactNo || 'N/A';
    address = invoice.address || 'N/A';
    date = invoice.date || 'N/A';
    paymentMethod = invoice.paymentMethod || 'N/A';
    totalAmount = invoice.totalAmount || 0;
    subtitle = "PROFORMA SALES ESTIMATION SLIP";

    detailsHtml = `
      <tr><td><strong>Vehicle Model Preference:</strong></td><td>${invoice.model || 'N/A'}</td></tr>
      <tr><td><strong>Lead Source Channel:</strong></td><td>${invoice.leadSource || 'Walk In'}</td></tr>
    `;

    itemsHtml += `
      <tr>
        <td style="text-align: center;">1</td>
        <td><strong>${invoice.model || 'Electric Motorcycle'}</strong><br><small style="color: #666;">Proforma booking estimation</small></td>
        <td style="text-align: center;">8711</td>
        <td style="text-align: center;">1</td>
        <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
        <td style="text-align: center;">0%</td>
        <td style="text-align: right;">₹0.00</td>
        <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
      </tr>
    `;
  }

  // Generate splits payment block if available
  let splitsHtml = '';
  if (invoice.splits && invoice.splits.length > 0) {
    splitsHtml = `
      <div style="margin-top: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 6px; background-color: #fcfcfc;">
        <h4 style="margin: 0 0 8px 0; color: #111; font-size: 11px; text-transform: uppercase; font-family: monospace;">Multi-Split Payments Received</h4>
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="border-b: 1px solid #ddd; background-color: #eee; text-align: left;">
              <th style="padding: 4px;">Method</th>
              <th style="padding: 4px; text-align: right;">Amount</th>
              <th style="padding: 4px; text-align: center;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.splits.map((s: any) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 4px;"><strong>${s.paymentMethod}</strong></td>
                <td style="padding: 4px; text-align: right; font-family: monospace;">${formatCurrency(s.amount)}</td>
                <td style="padding: 4px; text-align: center; color: #555;">${s.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
    
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      background-color: #f3f4f6;
      margin: 0;
      padding: 40px 20px;
      -webkit-font-smoothing: antialiased;
    }

    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .logo-container {
      width: 50%;
    }

    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #15803D;
      letter-spacing: -0.025em;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 10px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 4px;
    }

    .invoice-meta-container {
      width: 50%;
      text-align: right;
    }

    .invoice-badge {
      display: inline-block;
      padding: 6px 14px;
      background: #DCFCE7;
      color: #166534;
      font-size: 11px;
      font-weight: 700;
      border-radius: 99px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .invoice-title {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .invoice-subtitle {
      font-size: 9px;
      font-weight: 700;
      color: #15803D;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    .billing-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .billing-col {
      width: 50%;
      vertical-align: top;
      padding-right: 20px;
    }

    .billing-title {
      font-size: 10px;
      font-weight: 700;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 4px;
    }

    .address-box {
      font-size: 11px;
      line-height: 1.6;
      color: #374151;
    }

    .meta-box-table {
      font-size: 11px;
      width: 100%;
    }

    .meta-box-table td {
      padding: 3px 0;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 30px;
    }

    .items-table th {
      background-color: #F9FAFB;
      color: #374151;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      padding: 10px 12px;
      border-bottom: 2px solid #E5E7EB;
    }

    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
      vertical-align: top;
    }

    .summary-table {
      width: 320px;
      margin-left: auto;
      border-collapse: collapse;
      font-size: 11px;
    }

    .summary-table td {
      padding: 6px 12px;
    }

    .summary-table .total-row {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
      border-top: 2px solid #E5E7EB;
      padding-top: 10px;
    }

    .footer-note {
      margin-top: 50px;
      font-size: 10px;
      color: #6B7280;
      text-align: center;
      line-height: 1.5;
      border-t: 1px solid #f3f4f6;
      padding-top: 20px;
    }

    .no-print-bar {
      max-width: 800px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111827;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
    }

    .print-btn {
      background: #15803D;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }

    .print-btn:hover {
      background: #166534;
    }

    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .invoice-card {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div style="font-size: 12px; font-weight: 600;">📄 Tax Invoice Prepared & Ready for Offline Saving</div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td class="logo-container">
          <h1 class="brand-title">AXIGEAR</h1>
          <div class="brand-subtitle">Central EV Headquarters &amp; Distribution</div>
        </td>
        <td class="invoice-meta-container">
          <div class="invoice-badge">GST Registered</div>
          <h2 class="invoice-title">TAX INVOICE</h2>
          <div class="invoice-subtitle">${subtitle}</div>
        </td>
      </tr>
    </table>

    <table class="billing-grid">
      <tr>
        <td class="billing-col">
          <div class="billing-title">Consignor (Issuer)</div>
          <div class="address-box">
            <strong>AXIGEAR PRIVATE LIMITED</strong><br>
            Corporate HQ, Phase-2 Tech Depot<br>
            Hyderabad, Telangana, 500081<br>
            GSTIN: 36ABLFR7464F1ZR<br>
            Contact: support@axigear.com
          </div>
        </td>
        <td class="billing-col">
          <div class="billing-title">Consignee (Recipient)</div>
          <div class="address-box">
            <strong>${customerName}</strong><br>
            Location/Branch: ${address}<br>
            Contact Phone: ${customerPhone}<br>
            GST Status: CGST/SGST Applicable
          </div>
        </td>
      </tr>
    </table>

    <table class="billing-grid" style="margin-bottom: 15px;">
      <tr>
        <td class="billing-col">
          <div class="billing-title">Invoice Metadata</div>
          <table class="meta-box-table">
            <tr><td style="width: 120px;"><strong>Invoice No:</strong></td><td>${invoiceNo}</td></tr>
            <tr><td><strong>Issue Date:</strong></td><td>${date}</td></tr>
            <tr><td><strong>Payment Mode:</strong></td><td><span style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${paymentMethod}</span></td></tr>
          </table>
        </td>
        <td class="billing-col">
          <div class="billing-title">Secondary Parameters</div>
          <table class="meta-box-table">
            ${detailsHtml}
          </table>
        </td>
      </tr>
    </table>

    ${splitsHtml}

    <div style="margin-top: 30px;">
      <div class="billing-title" style="margin-bottom: 12px;">CONSOLIDATED LINE ITEMS</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">Sl.No</th>
            <th style="text-align: left;">Product/Service Description</th>
            <th style="width: 70px; text-align: center;">HSN Code</th>
            <th style="width: 50px; text-align: center;">Qty</th>
            <th style="width: 100px; text-align: right;">Unit Taxable</th>
            <th style="width: 60px; text-align: center;">GST Rate</th>
            <th style="width: 80px; text-align: right;">GST Amount</th>
            <th style="width: 110px; text-align: right;">Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <table class="summary-table">
      <tr>
        <td style="text-align: right; color: #6B7280;">Subtotal (Taxable):</td>
        <td style="text-align: right; font-weight: 600; width: 140px;">${formatCurrency(type === 'dealer_invoice' ? invoice.taxableValue : totalAmount / 1.18)}</td>
      </tr>
      <tr>
        <td style="text-align: right; color: #6B7280;">Consolidated GST:</td>
        <td style="text-align: right; font-weight: 600;">${formatCurrency(type === 'dealer_invoice' ? invoice.gstAmount : totalAmount - (totalAmount / 1.18))}</td>
      </tr>
      <tr class="total-row">
        <td style="text-align: right;">GRAND TOTAL:</td>
        <td style="text-align: right; color: #15803D;">${formatCurrency(totalAmount)}</td>
      </tr>
    </table>

    <div class="footer-note">
      This is a digitally generated Tax Invoice compiled under the Indian Central Goods and Services Tax (CGST) regulations.<br>
      Thank you for choosing Axigear EV. For active support, please write to billing@axigear.com.
    </div>
  </div>

</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `TaxInvoice_${invoiceNo.replace(/\//g, '-')}.html`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
