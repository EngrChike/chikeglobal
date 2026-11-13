import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Pencil, Search, Folder, FolderOpen, Calendar, Clock, User, ChevronDown, ChevronRight, UserCheck, X, Image as ImageIcon, Key, ShieldAlert, Printer } from 'lucide-react';

export default function SalesLedger({ products, customers, fetchProducts, fetchCustomers, supabase, currentUser, activeBranchId }) {
  // Staging / Accumulator Cart State
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('akuDonCart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      return [];
    }
  });

  // Independent Sales History State
  const [salesHistory, setSalesHistory] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Editing Sale State
  const [editingSale, setEditingSale] = useState(null);

  // Customer Management Modal/Form States for Editing & Deleting Customers
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerFormName, setCustomerFormName] = useState('');
  const [customerFormPhone, setCustomerFormPhone] = useState('');

  // Adding Item State
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  
  const dropdownRef = useRef(null);

  // Form State
  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: 'walkin', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });

  // Search & History Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Invoice Modal State
  const [activeInvoiceSale, setActiveInvoiceSale] = useState(null);
  
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [expandedMonths, setExpandedMonths] = useState({ [currentMonthKey]: true });

  // --- ADMIN PIN SECURITY MODAL STATES ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDropdownProducts = useMemo(() => {
    const activeProducts = products.filter(p => !p.is_archived);
    if (!productSearchTerm) return activeProducts.slice(0, 50);
    
    const lowercasedTerm = productSearchTerm.toLowerCase();
    return activeProducts
      .filter(p => p.name.toLowerCase().includes(lowercasedTerm) || (p.batch_reference && p.batch_reference.toLowerCase().includes(lowercasedTerm)))
      .slice(0, 50);
  }, [products, productSearchTerm]);

  const fetchStaffList = async () => {
    try {
      const { data, error } = await supabase.from('staff').select('*');
      if (!error && data) setStaffList(data);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  const fetchSalesHistory = async () => {
    try {
      let query = supabase
        .from('customer_history')
        .select('*')
        .order('id', { ascending: false });

      if (currentUser?.role !== 'admin') {
        if (currentUser?.id) {
          query = query.or(`staff_id.eq.${currentUser.id},staff_name.eq.${currentUser.full_name || currentUser.name}`);
        }
      }

      if (activeBranchId && activeBranchId !== 'ALL') {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setSalesHistory(data);
    } catch (err) {
      console.error('Error fetching sales history:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSalesHistory();
      fetchStaffList();
    }
  }, [currentUser, activeBranchId]);

  useEffect(() => {
    localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
  }, [cartItems]);

  // 🔒 Admin Validation Trigger
  const requestAdminAuth = (actionCallback) => {
    setAdminPinInput('');
    setPinError('');
    setPendingAction(() => actionCallback);
    setIsPinModalOpen(true);
  };

  // 🔒 PIN Submission and Verification inside Modal
  const handleVerifyAdminPin = (e) => {
    e.preventDefault();
    const verifyingAdmin = staffList.find(s => s.pin_code === adminPinInput.trim() && s.role === 'admin' && s.is_active);

    if (!verifyingAdmin) {
      setPinError("❌ Incorrect or unauthorized administrator PIN code.");
      return;
    }

    setIsPinModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // --- CUSTOMER EDIT & DELETE HANDLERS ---
  const handleOpenEditCustomer = (cust) => {
    setEditingCustomer(cust);
    setCustomerFormName(cust.name || '');
    setCustomerFormPhone(cust.phone || '');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomerChanges = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      const { error } = await supabase
        .from('customers')
        .update({ name: customerFormName.trim(), phone: customerFormPhone.trim() })
        .eq('id', editingCustomer.id);
      
      if (error) throw error;
      alert("Customer details updated successfully!");
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      if (fetchCustomers) fetchCustomers();
    } catch (err) {
      alert(`Error updating customer: ${err.message}`);
    }
  };

  const handleDeleteCustomerRecord = (cust) => {
    requestAdminAuth(async () => {
      try {
        const { error } = await supabase.from('customers').delete().eq('id', cust.id);
        if (error) throw error;
        alert("Customer record deleted successfully!");
        if (fetchCustomers) fetchCustomers();
      } catch (err) {
        alert(`Error deleting customer: ${err.message}`);
      }
    });
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const selectProductForCart = (prod) => {
    setCartProductId(prod.id);
    setCustomPrice(prod.price.toString());
    setProductSearchTerm(prod.name);
    setIsDropdownOpen(false);
  };

  const handleAddToCart = () => {
    if (!cartProductId) return;
    const prod = products.find(p => String(p.id) === String(cartProductId));
    if (!prod || prod.is_archived) return;

    const qty = parseInt(cartQty) || 1;
    const priceToUse = parseFloat(customPrice) >= 0 ? parseFloat(customPrice) : prod.price;

    if (qty > prod.quantity && !editingSale) {
      alert(`Selected quantity exceeds available stock (${prod.quantity}).`);
      return;
    }

    const existingIndex = cartItems.findIndex(item => String(item.productId) === String(prod.id));
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].qty += qty;
      updated[existingIndex].price = priceToUse;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        productId: prod.id,
        name: prod.name,
        batch: prod.batch_reference || 'N/A',
        price: priceToUse,
        qty: qty,
        image_url: prod.image_url
      }]);
    }

    setCartProductId('');
    setCartQty('1');
    setCustomPrice('');
    setProductSearchTerm('');
  };

  const handleRemoveFromCart = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const handleUpdateCartItemQty = (index, newQty) => {
    const qty = parseInt(newQty) || 0;
    const updated = [...cartItems];
    updated[index].qty = qty;
    setCartItems(updated);
  };

  const handleUpdateCartItemPrice = (index, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    const updated = [...cartItems];
    updated[index].price = price;
    setCartItems(updated);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paidAmount = ledgerForm.initialPaid !== '' ? parseFloat(ledgerForm.initialPaid) : cartTotal;
  const remainingDebt = Math.max(0, cartTotal - paidAmount);

  const revertSaleStockAndDebt = async (sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        if (item.productId || item.product_id) {
          const prodId = item.productId || item.product_id;
          const { data: prodData, error: fetchErr } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', prodId)
            .maybeSingle();

          if (!fetchErr && prodData) {
            const restoredQty = (prodData.quantity || 0) + item.qty;
            await supabase
              .from('products')
              .update({ quantity: restoredQty, stock_status: restoredQty > 0 })
              .eq('id', prodId);
          }
        }
      }
    }

    if (sale.customer_id) {
      const debtReduction = (sale.total || 0) - (sale.paid || 0);
      if (debtReduction > 0) {
        const { data: custData } = await supabase
          .from('customers')
          .select('total_debt')
          .eq('id', sale.customer_id)
          .maybeSingle();

        if (custData) {
          const newDebt = Math.max(0, (parseFloat(custData.total_debt) || 0) - debtReduction);
          await supabase
            .from('customers')
            .update({ total_debt: newDebt })
            .eq('id', sale.customer_id);
        }
      }
    }
  };

  const deductStockForCart = async (items) => {
    for (const item of items) {
      const prodId = item.productId || item.product_id;
      if (prodId) {
        const { data: freshProd, error: fetchErr } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', prodId)
          .maybeSingle();

        if (fetchErr || !freshProd) {
          console.error(`Error fetching stock for product ${prodId}:`, fetchErr);
          continue;
        }

        const currentStock = freshProd.quantity || 0;
        const newStock = Math.max(0, currentStock - item.qty);

        const { error: updateErr } = await supabase
          .from('products')
          .update({ 
            quantity: newStock, 
            stock_status: newStock > 0 
          })
          .eq('id', prodId);

        if (updateErr) {
          console.error(`Error deducting stock for product ${prodId}:`, updateErr);
        }
      }
    }
  };

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Please add at least one item to the cart.");
      return;
    }

    const actionText = editingSale ? "updating this sale" : "saving this sale";
    const confirmSale = window.confirm(`Do you confirm ${actionText}?`);
    if (!confirmSale) return;

    try {
      if (editingSale) await revertSaleStockAndDebt(editingSale);

      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch}) @ CFA ${item.price}`).join(', ');
      
      const now = new Date();
      const currentDate = now.toLocaleDateString();
      const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const targetBranchId = (!activeBranchId || activeBranchId === 'ALL') ? (currentUser?.branch_id || null) : activeBranchId;

      let targetCustomerId = null;
      let customerDisplayName = 'Walk-in Customer';

      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim() || 'Walk-in Customer',
          phone: ledgerForm.newPhone.trim() || '',
          total_debt: balance,
          branch_id: targetBranchId
        }]).select().single();

        if (custErr) throw custErr;
        targetCustomerId = newCustData.id;
        customerDisplayName = newCustData.name;
      } else if (ledgerForm.customerId !== 'walkin') {
        targetCustomerId = ledgerForm.customerId;
        const existingCust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
        if (existingCust) {
          customerDisplayName = existingCust.name;
          const currentDebt = parseFloat(existingCust.totalDebt) || 0;
          const newTotalDebt = currentDebt + balance;
          
          await supabase.from('customers').update({ total_debt: newTotalDebt }).eq('id', targetCustomerId);
        }
      }

      const staffId = editingSale ? (editingSale.staff_id || currentUser?.id) : currentUser?.id;
      const staffName = editingSale ? (editingSale.staff_name || 'Staff') : (currentUser?.full_name || currentUser?.name || 'Staff');

      const salePayload = {
        customer_id: targetCustomerId,
        staff_id: staffId,
        staff_name: staffName,
        goods: goodsDescription,
        batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
        product_id: cartItems.length === 1 ? (cartItems[0].productId || cartItems[0].product_id) : null,
        qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
        total: cartTotal,
        paid: paidAmount,
        type: 'Sale',
        items: cartItems,
        branch_id: targetBranchId,
        customer_name: customerDisplayName,
        date: editingSale ? (editingSale.date || currentDate) : currentDate,
        time: editingSale ? (editingSale.time || currentTime) : currentTime,
        month_key: editingSale ? (editingSale.month_key || monthKey) : monthKey,
        month_label: editingSale ? (editingSale.month_label || monthLabel) : monthLabel
      };

      if (editingSale) {
        await supabase.from('customer_history').update(salePayload).eq('id', editingSale.id);
      } else {
        await supabase.from('customer_history').insert([salePayload]);
      }

      await deductStockForCart(cartItems);

      setLedgerForm({ customerId: 'walkin', newName: '', newPhone: '', initialPaid: '' });
      setCartItems([]);
      setEditingSale(null);
      localStorage.removeItem('akuDonCart');
      
      if (fetchProducts) await fetchProducts();
      if (fetchCustomers) await fetchCustomers();
      await fetchSalesHistory();
      
      alert(editingSale ? 'Sale updated successfully!' : 'Sale saved successfully!');
    } catch (err) {
      alert(`Error saving sale: ${err.message}`);
    }
  };

  // 🔒 Protected Delete with Admin PIN
  const handleDeleteSale = (sale) => {
    requestAdminAuth(async () => {
      try {
        await revertSaleStockAndDebt(sale);
        const { error } = await supabase.from('customer_history').delete().eq('id', sale.id);
        
        if (error) {
          throw error;
        }

        alert("Sale deleted successfully and stock restored!");
        if (fetchProducts) await fetchProducts();
        if (fetchCustomers) await fetchCustomers();
        await fetchSalesHistory();
      } catch (err) {
        alert(`Error deleting sale: ${err.message}`);
      }
    });
  };

  // 🔒 Protected Edit with Admin PIN
  const handleEditSale = (sale) => {
    if (!sale.items || sale.items.length === 0) {
      alert("Cannot edit: item details are not available for this legacy transaction.");
      return;
    }
    requestAdminAuth(() => {
      setEditingSale(sale);
      setCartItems(sale.items);
      setLedgerForm({
        customerId: sale.customer_id ? String(sale.customer_id) : 'walkin',
        newName: '',
        newPhone: '',
        initialPaid: sale.paid?.toString() || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    setCartItems([]);
    setLedgerForm({ customerId: 'walkin', newName: '', newPhone: '', initialPaid: '' });
    localStorage.removeItem('akuDonCart');
  };

  const getMonthGroup = (item) => {
    if (item.month_key && item.month_label) return { key: item.month_key, label: item.month_label };
    let dateObj = new Date(item.created_at || item.date);
    if (isNaN(dateObj.getTime()) && typeof item.date === 'string') {
      const parts = item.date.split(/[\/\-]/);
      if (parts.length === 3 && parts[2].length === 4) {
        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    if (!isNaN(dateObj.getTime())) {
      return { 
        key: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`, 
        label: dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) 
      };
    }
    return { key: currentMonthKey, label: 'Current Month' };
  };

  const filteredSales = useMemo(() => {
    return salesHistory.map(item => {
      const cust = customers.find(c => String(c.id) === String(item.customer_id));
      return { 
        ...item, 
        displayCustomer: item.customer_name || (cust ? cust.name : 'Walk-in Customer'),
        displayPhone: cust ? cust.phone : 'N/A'
      };
    }).filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.goods && item.goods.toLowerCase().includes(term)) ||
        (item.displayCustomer && item.displayCustomer.toLowerCase().includes(term)) ||
        (item.batch && item.batch.toLowerCase().includes(term)) ||
        (item.staff_name && item.staff_name.toLowerCase().includes(term))
      );
    });
  }, [salesHistory, customers, searchTerm]);

  // --- TODAY'S STATS & MONTHLY ARCHIVES LOGIC ---
  const { todayStats, monthlyArchives } = useMemo(() => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (now.getHours() < 6) shiftStart.setDate(shiftStart.getDate() - 1); 
    shiftStart.setHours(6, 0, 0, 0);

    const todayData = {};
    const archives = {};

    salesHistory.forEach(sale => {
      const saleDate = new Date(sale.created_at || sale.date);
      const staffName = sale.staff_name || 'Staff';
      const total = sale.total || 0;

      // Today's Sales since 06:00 AM check
      if (saleDate >= shiftStart) {
        if (!todayData[staffName]) todayData[staffName] = { count: 0, total: 0 };
        todayData[staffName].count += 1;
        todayData[staffName].total += total;
      }

      // Monthly Archives Logic
      const { key: monthKey, label: monthLabel } = getMonthGroup(sale);
      if (!archives[monthKey]) archives[monthKey] = { label: monthLabel, staffData: {} };
      if (!archives[monthKey].staffData[staffName]) archives[monthKey].staffData[staffName] = { count: 0, total: 0 };
      
      archives[monthKey].staffData[staffName].count += 1;
      archives[monthKey].staffData[staffName].total += total;
    });

    return { todayStats: todayData, monthlyArchives: archives };
  }, [salesHistory]);

  const groupedSalesByMonth = useMemo(() => {
    const groups = {};
    filteredSales.forEach(item => {
      const { key, label } = getMonthGroup(item);
      if (!groups[key]) groups[key] = { label, items: [], totalSales: 0, totalPaid: 0 };
      groups[key].items.push(item);
      groups[key].totalSales += item.total || 0;
      groups[key].totalPaid += item.paid || 0;
    });
    return groups;
  }, [filteredSales]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Dynamic PRINT CSS to isolate only the active invoice on 1 clean page */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice-modal,
          #printable-invoice-modal * {
            visibility: visible !important;
          }
          #printable-invoice-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      {/* LEFT COLUMN: ACCUMULATION & SALE FORM */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4 no-print">
        <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b flex justify-between items-center">
          <span>POS & Sale Checkout</span>
          {editingSale && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Editing Mode</span>
          )}
        </h3>

        {editingSale && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-center justify-between text-amber-900 text-xs">
            <div>
              <p className="font-bold">✏️ Editing Sale #{editingSale.id}</p>
              <p className="text-[10px] text-amber-700">Original Staff: <strong>{editingSale.staff_name || 'Unknown'}</strong></p>
            </div>
            <button type="button" onClick={handleCancelEdit} className="p-1 text-amber-800 hover:bg-amber-200 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleFinalizeSale} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] text-gray-400 font-bold uppercase">Customer Type</label>
              {ledgerForm.customerId !== 'walkin' && ledgerForm.customerId !== 'new' && (
                <div className="space-x-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      const cust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
                      if (cust) handleOpenEditCustomer(cust);
                    }} 
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    Edit Customer
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const cust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
                      if (cust) handleDeleteCustomerRecord(cust);
                    }} 
                    className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                  >
                    Delete Customer
                  </button>
                </div>
              )}
            </div>
            <select 
              value={ledgerForm.customerId} 
              onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} 
              className="w-full border p-2.5 text-xs rounded-lg font-medium bg-white" 
            >
              <option value="walkin">🛒 Walk-in Customer (Cash Sale)</option>
              <option value="new">+ Register New Customer (Credit/Debt Account)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  👤 {c.name} {c.phone ? `(${c.phone})` : ''} - Debt: CFA {c.totalDebt?.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          
          {ledgerForm.customerId === 'new' && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              <input type="text" placeholder="Customer Name" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" />
              <input type="text" placeholder="Phone Number" value={ledgerForm.newPhone} onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" />
            </div>
          )}

          <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase block">
              Search & Add Items
            </label>
            
            <div className="space-y-2">
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  placeholder="Type to search product..."
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                    setCartProductId('');
                    setCustomPrice('');
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full border p-2 text-xs rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                
                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredDropdownProducts.length > 0 ? (
                      filteredDropdownProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => selectProductForCart(p)}
                          className="p-2 hover:bg-orange-50 cursor-pointer flex items-center border-b border-gray-50 last:border-0 transition-colors"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-md object-cover border border-gray-200 mr-2.5 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 mr-2.5 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-gray-800 truncate">{p.name}</div>
                            <div className="text-[9px] text-gray-500">[{p.batch_reference || 'N/A'}] - <span className="font-semibold text-emerald-600">CFA {p.price?.toLocaleString()}</span> (Stock: {p.quantity})</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-400 text-center">No products found...</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 font-bold block mb-0.5">Quantity</label>
                  <input type="number" min="1" placeholder="Qty" value={cartQty} onChange={e => setCartQty(e.target.value)} className="w-full border p-2 text-xs rounded-lg bg-white text-center font-bold" />
                </div>
                <div>
                  <label className="text-[9px] text-orange-600 font-bold block mb-0.5">Unit Price (CFA)</label>
                  <input type="number" placeholder="Price" value={customPrice} onChange={e => setCustomPrice(e.target.value)} className="w-full border border-orange-300 p-2 text-xs rounded-lg bg-white text-right font-bold text-orange-700" />
                </div>
              </div>

              <button type="button" onClick={handleAddToCart} disabled={!cartProductId} className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider transition-colors cursor-pointer">
                + Add to Cart
              </button>
            </div>

            {cartItems.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Cart Items:</p>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                      <tr>
                        <th className="p-2 w-1/2">Item</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cartItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2">
                            <div className="flex items-center space-x-2">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                              <div className="font-bold text-gray-800 leading-tight">
                                {item.name} <span className="text-[9px] text-orange-600 block font-normal">({item.batch})</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <input type="number" min="1" value={item.qty} onChange={(e) => handleUpdateCartItemQty(index, e.target.value)} className="w-10 border text-center p-1 rounded font-bold text-xs" />
                          </td>
                          <td className="p-2 text-right">
                            <input type="number" value={item.price} onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} className="w-20 border border-orange-300 text-right p-1 rounded font-bold text-xs text-orange-700" />
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center text-[11px] text-gray-400 italic py-2">Cart is empty</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Cash Amount Paid (CFA)</label>
            <input type="number" placeholder={cartTotal > 0 ? `Total: CFA ${cartTotal}` : "Amount received"} value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg font-bold text-green-700" />
          </div>

          {cartItems.length > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Total Cumulative:</span>
                <span className="font-bold">CFA {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Amount Received:</span>
                <span className="font-bold text-green-600">CFA {paidAmount.toLocaleString()}</span>
              </div>
              {remainingDebt > 0 && (
                <div className="flex justify-between border-t border-orange-200 pt-1 text-red-600 font-extrabold">
                  <span>Balance Due (Debt):</span>
                  <span>CFA {remainingDebt.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          
          <button type="submit" disabled={cartItems.length === 0} className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer">
            {editingSale ? 'Update Sale' : 'Confirm & Save Sale'}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: MONTHLY FOLDERS & SALES SEARCH */}
      <div className="lg:col-span-2 space-y-4 no-print">
        
        {/* TODAY'S SALES & MONTHLY ARCHIVES PREVIEW SUMMARY */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-xs uppercase text-gray-700 pb-2 border-b flex items-center">
            <Clock className="w-4 h-4 mr-2 text-orange-500" /> 
            Today's Sales (Since 06:00 AM)
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.keys(todayStats).length > 0 ? Object.entries(todayStats).map(([name, data]) => (
              <div key={name} className="p-3 border rounded-xl bg-orange-50/50 border-orange-100 text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase">{name}</p>
                <p className="text-base font-black text-gray-800">CFA {data.total.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">{data.count} transaction(s)</p>
              </div>
            )) : (
              <p className="text-xs text-gray-400 italic col-span-full bg-gray-50 p-3 rounded-lg border border-dashed">No sales recorded since 6:00 AM today.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b">
            <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-orange-600" /> Sales History & Monthly Archives (PIN Required for Edits/Deletes)
            </h3>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search (item, date, staff, batch...)" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-9 pr-3 py-1.5 border text-xs rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {Object.keys(groupedSalesByMonth).length > 0 ? (
              Object.keys(groupedSalesByMonth).map(monthKey => {
                const group = groupedSalesByMonth[monthKey];
                const isOpen = !!expandedMonths[monthKey];

                return (
                  <div key={monthKey} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <button 
                      type="button" 
                      onClick={() => toggleMonth(monthKey)}
                      className={`w-full flex items-center justify-between p-3.5 text-left transition-colors cursor-pointer ${isOpen ? 'bg-orange-50/60 border-b' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {isOpen ? <FolderOpen className="w-5 h-5 text-orange-600" /> : <Folder className="w-5 h-5 text-gray-400" />}
                        <div>
                          <span className="font-black text-xs uppercase text-gray-800 block">Sales Folder: {group.label}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{group.items.length} transaction(s)</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-700 block">CFA {group.totalSales.toLocaleString()}</span>
                          <span className="text-[9px] text-green-600 font-bold block">Collected: CFA {group.totalPaid.toLocaleString()}</span>
                        </div>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="p-3 bg-white space-y-2 max-h-[30rem] overflow-y-auto">
                        {group.items.map((sale, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-orange-200 transition-all text-xs space-y-2">
                            
                            <div className="flex justify-between items-center text-gray-500 text-[10px] pb-1 border-b border-gray-100">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="flex items-center font-bold text-gray-700"><Calendar className="w-3 h-3 mr-1 text-orange-500" />{sale.date || 'N/A'}</span>
                                <span className="flex items-center font-bold text-gray-700"><Clock className="w-3 h-3 mr-1 text-orange-500" />{sale.time || sale.created_at?.slice(11, 16) || '--:--'}</span>
                                <span className="flex items-center font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded"><UserCheck className="w-3 h-3 mr-1 text-blue-600" />{sale.staff_name || 'Staff'}</span>
                              </div>
                              <span className="flex items-center font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded"><User className="w-3 h-3 mr-1" />{sale.displayCustomer}</span>
                            </div>

                            <div className="pt-1">
                              {sale.items && sale.items.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2">
                                  {sale.items.map((item, iIdx) => (
                                    <div key={iIdx} className="flex items-center space-x-2.5 bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0" />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                          <ImageIcon className="w-3 h-3 text-gray-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-gray-800 truncate">{item.qty}x {item.name}</div>
                                        <div className="text-[10px] text-gray-500">Batch: {item.batch} • @ CFA {item.price?.toLocaleString()}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="font-semibold text-gray-800 pl-1">{sale.goods}</div>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 text-[11px]">
                              <button 
                                type="button" 
                                onClick={() => setActiveInvoiceSale(sale)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-md flex items-center space-x-1 transition-colors cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Print Invoice</span>
                              </button>
                              
                              <div className="flex items-center space-x-3">
                                <span>Invoice: <strong>CFA {sale.total?.toLocaleString()}</strong></span>
                                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">Paid: CFA {sale.paid?.toLocaleString()}</span>
                                
                                {currentUser?.role === 'admin' && (
                                  <div className="flex items-center space-x-1 pl-2 border-l border-gray-300">
                                    <button type="button" onClick={() => handleEditSale(sale)} className="p-1.5 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer" title="Edit sale (Admin PIN required)"><Pencil className="w-3 h-3" /></button>
                                    <button type="button" onClick={() => handleDeleteSale(sale)} className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors cursor-pointer" title="Delete sale (Admin PIN required)"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed no-print">
                {searchTerm ? 'No sales match your search.' : 'No sales recorded in ledger.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- INVOICE PRINTING MODAL --- */}
      {activeInvoiceSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-6 max-h-[95vh] overflow-y-auto">
            
            {/* INVOICE PREVIEW CONTAINER - PERFECT COPY OF Provided DESIGN */}
            <div id="printable-invoice-modal" className="bg-white p-6 rounded-2xl border-2 border-gray-200 space-y-6 text-[#202737]">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-wider uppercase leading-tight">CHIKE GLOBAL</h1>
                  <p className="text-[11px] font-semibold mt-1 leading-tight text-gray-600">COCOVICO MARCHE ANGRE COCODY ABIDJAN</p>
                  <p className="text-[11px] font-semibold leading-tight text-gray-600">WhatsApp: +2250100130109</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  {/* "CG" LOGO BLOCK */}
                  <div className="w-12 h-12 flex items-center justify-center bg-[#202737] rounded-xl text-white font-black text-xl mb-3">
                    CG
                  </div>
                  <span className="bg-[#202737] text-white font-bold text-xs px-3 py-1 rounded uppercase tracking-wider">INVOICE</span>
                  <p className="text-[11px] font-mono font-bold mt-2 text-gray-600">Ref: #{activeInvoiceSale.id}</p>
                  <p className="text-[10px] text-gray-400">{activeInvoiceSale.date} | {activeInvoiceSale.time || 'N/A'}</p>
                </div>
              </div>

              {/* Client Details */}
              <div className="bg-[#f2f4f7] p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Customer Name</p>
                  <p className="font-bold text-lg mt-0.5">{activeInvoiceSale.displayCustomer}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Phone Number</p>
                  <p className="font-bold text-lg mt-0.5">{activeInvoiceSale.displayPhone || 'N/A'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-600 font-bold border-b border-gray-200">
                      <th className="py-2.5 px-2">S/N</th>
                      <th className="py-2.5 px-2">Item Description</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Price (CFA)</th>
                      <th className="py-2.5 px-2 text-right">Amount (CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeInvoiceSale.items && activeInvoiceSale.items.length > 0 ? (
                      activeInvoiceSale.items.map((item, i) => (
                        <tr key={i} className="hover:bg-[#fcfdfe]">
                          <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                          <td className="py-2.5 px-2 font-medium">
                            {item.name} {item.batch && item.batch !== 'N/A' && <span className="text-[10px] text-orange-600 block">Batch: {item.batch}</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-lg">{item.qty}</td>
                          <td className="py-2.5 px-2 text-right">CFA {item.price?.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-lg">CFA {(item.price * item.qty).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-3 px-2 text-center text-gray-500">{activeInvoiceSale.goods}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-gray-200 pt-5 space-y-2 text-xs flex flex-col items-end">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-gray-700 font-semibold">
                    <span>Total Amount:</span>
                    <span className="font-bold text-lg">CFA {(activeInvoiceSale.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#148359] font-semibold">
                    <span>Amount Paid:</span>
                    <span className="font-bold text-lg">CFA {(activeInvoiceSale.paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#ed3745] font-extrabold border-t border-gray-100 pt-1.5 text-xl">
                    <span>Balance Due:</span>
                    <span>CFA {Math.max(0, (activeInvoiceSale.total || 0) - (activeInvoiceSale.paid || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-4 border-t border-gray-200 text-[11px] text-gray-500 font-medium">
                Thank you for your business! • CHIKE GLOBAL
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-1 no-print">
              <button
                type="button"
                onClick={() => setActiveInvoiceSale(null)}
                className="w-1/2 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl uppercase transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-1/2 py-2.5 bg-[#202737] text-white hover:bg-slate-800 text-xs font-bold rounded-xl uppercase transition-colors flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- CUSTOMER EDIT MODAL --- */}
      {isCustomerModalOpen && editingCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-800 border-b pb-2">Edit Customer Details</h3>
            <form onSubmit={handleSaveCustomerChanges} className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Customer Name</label>
                <input 
                  type="text" 
                  value={customerFormName} 
                  onChange={(e) => setCustomerFormName(e.target.value)} 
                  className="w-full border p-2 text-xs rounded-lg" 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={customerFormPhone} 
                  onChange={(e) => setCustomerFormPhone(e.target.value)} 
                  className="w-full border p-2 text-xs rounded-lg" 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCustomerModalOpen(false)} 
                  className="w-1/2 bg-gray-100 py-2 text-xs font-bold rounded-lg uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-black text-white py-2 text-xs font-bold rounded-lg uppercase cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔒 ADMIN PIN SECURITY MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase text-gray-800">Administrator Security</h3>
                <p className="text-[11px] text-gray-500">Admin PIN required to edit/delete sale</p>
              </div>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full border p-3 text-center text-lg tracking-[0.3em] font-mono rounded-lg outline-none focus:ring-2 focus:ring-slate-800 bg-gray-50 focus:bg-white transition-all"
                />
                {pinError && (
                  <p className="text-red-500 text-[11px] mt-2 font-medium text-center">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="w-1/2 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold rounded-lg uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#0f172a] text-white hover:bg-slate-800 text-xs font-bold rounded-lg uppercase transition-colors shadow-sm cursor-pointer"
                >
                  Validate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}