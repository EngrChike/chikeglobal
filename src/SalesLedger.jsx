import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Pencil, Phone, Search, Folder, FolderOpen, Calendar, Clock, User, ChevronDown, ChevronRight } from 'lucide-react';

export default function SalesLedger({ products, customers, fetchProducts, fetchCustomers, supabase }) {
  // Staging / Accumulator Cart State
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('akuDonCart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      return [];
    }
  });

  // Adding Item State
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');

  // Form State - Default customer set to 'walkin' (Client de passage)
  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: 'walkin', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });
  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Search & History Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Current Month Key format: "YYYY-MM"
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // State for collapsible month folders (Current month expanded by default)
  const [expandedMonths, setExpandedMonths] = useState({ [currentMonthKey]: true });

  // Sync cart to local storage
  useEffect(() => {
    localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // Update default custom price field when product selection changes
  const handleProductSelect = (e) => {
    const prodId = e.target.value;
    setCartProductId(prodId);
    if (prodId) {
      const selectedProd = products.find(p => String(p.id) === String(prodId));
      if (selectedProd) {
        setCustomPrice(selectedProd.price.toString());
      }
    } else {
      setCustomPrice('');
    }
  };

  // Add Item to Staging Accumulator
  const handleAddToCart = () => {
    if (!cartProductId) return;
    const prod = products.find(p => String(p.id) === String(cartProductId));
    if (!prod || prod.is_archived) return;

    const qty = parseInt(cartQty) || 1;
    const priceToUse = parseFloat(customPrice) >= 0 ? parseFloat(customPrice) : prod.price;

    if (qty > prod.quantity) {
      alert(`Quantité sélectionnée supérieure au stock disponible (${prod.quantity}).`);
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
        qty: qty
      }]);
    }

    setCartProductId('');
    setCartQty('1');
    setCustomPrice('');
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

  // Finalize Sales & Save to Database
  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Veuillez ajouter au moins un article au panier d'accumulation.");
      return;
    }

    try {
      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch}) @ ${item.price} FCFA`).join(', ');
      
      // Capture Exact Date, Time and Month Key
      const now = new Date();
      const currentDate = now.toLocaleDateString('fr-FR'); // Ex: 30/08/2026
      const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); // Ex: 14:35
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); // Ex: août 2026

      let targetCustomerId = null;
      let customerDisplayName = 'Client de Passage';

      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim() || 'Client de Passage',
          phone: ledgerForm.newPhone.trim() || '',
          total_debt: balance
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
          
          const { error: updateErr } = await supabase.from('customers').update({
            total_debt: newTotalDebt
          }).eq('id', targetCustomerId);

          if (updateErr) throw updateErr;
        }
      }

      // Record History Entry with Time and Month grouping tags
      const { error: histErr } = await supabase.from('customer_history').insert([{
        customer_id: targetCustomerId,
        customer_name: customerDisplayName,
        date: currentDate,
        time: currentTime,
        month_key: monthKey,
        month_label: monthLabel,
        batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
        product_id: cartItems.length === 1 ? cartItems[0].productId : null,
        qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
        goods: goodsDescription,
        total: cartTotal,
        paid: paidAmount,
        type: 'Sale',
        items: cartItems,
        created_at: now.toISOString()
      }]);

      if (histErr) throw histErr;

      // Update Stock Levels
      for (const item of cartItems) {
        if (item.productId) {
          const selectedProd = products.find(p => String(p.id) === String(item.productId));
          if (selectedProd) {
            const newStock = Math.max(0, selectedProd.quantity - item.qty);
            await supabase.from('products').update({ 
              quantity: newStock, 
              stock_status: newStock > 0 
            }).eq('id', selectedProd.id);
          }
        }
      }

      setLedgerForm({ customerId: 'walkin', newName: '', newPhone: '', initialPaid: '' });
      setCartItems([]);
      localStorage.removeItem('akuDonCart');
      
      await fetchProducts();
      await fetchCustomers();
      alert('Vente enregistrée avec succès !');
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    }
  };

  // Consolidate All Sales History from Customers & Walk-ins
  const allSalesHistory = useMemo(() => {
    const list = [];
    customers.forEach(c => {
      (c.history || []).forEach(h => {
        list.push({
          ...h,
          customerName: c.name || 'Client de Passage',
          customerId: c.id
        });
      });
    });

    // Filter by Search Term
    return list.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.goods && item.goods.toLowerCase().includes(term)) ||
        (item.customerName && item.customerName.toLowerCase().includes(term)) ||
        (item.batch && item.batch.toLowerCase().includes(term)) ||
        (item.date && item.date.includes(term)) ||
        (item.time && item.time.includes(term))
      );
    }).sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  }, [customers, searchTerm]);

  // Group History items into Monthly Folders
  const groupedSalesByMonth = useMemo(() => {
    const groups = {};
    allSalesHistory.forEach(item => {
      // Fallback month key from date if month_key is not set
      let mKey = item.month_key;
      let mLabel = item.month_label;

      if (!mKey) {
        const itemDate = new Date(item.created_at || item.date);
        if (!isNaN(itemDate)) {
          mKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
          mLabel = itemDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else {
          mKey = 'Anciennes-Ventes';
          mLabel = 'Archives Ventes';
        }
      }

      if (!groups[mKey]) {
        groups[mKey] = {
          label: mLabel || mKey,
          items: [],
          totalSales: 0,
          totalPaid: 0
        };
      }
      groups[mKey].items.push(item);
      groups[mKey].totalSales += item.total || 0;
      groups[mKey].totalPaid += item.paid || 0;
    });

    return groups;
  }, [allSalesHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN: ACCUMULATION & SALE FORM */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b">
          Caisse & Enregistrement Ventes
        </h3>
        
        <form onSubmit={handleFinalizeSale} className="space-y-4">
          {/* Customer Selection - Defaulted to Walk-in */}
          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Type de Client</label>
            <select 
              value={ledgerForm.customerId} 
              onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} 
              className="w-full border p-2.5 text-xs rounded-lg font-medium bg-white" 
            >
              <option value="walkin">🛒 Client de Passage (Vente Cash Comptant)</option>
              <option value="new">+ Enregistrer un Nouveau Client (Compte/Dette)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  👤 {c.name} {c.phone ? `(${c.phone})` : ''} - Dette: {c.totalDebt?.toLocaleString()} FCFA
                </option>
              ))}
            </select>
          </div>
          
          {ledgerForm.customerId === 'new' && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
              <input 
                type="text" 
                placeholder="Nom du Client" 
                value={ledgerForm.newName} 
                onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} 
                className="w-full border p-2 text-xs rounded-lg bg-white" 
              />
              <input 
                type="text" 
                placeholder="Numéro de Téléphone (+225...)" 
                value={ledgerForm.newPhone} 
                onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} 
                className="w-full border p-2 text-xs rounded-lg bg-white" 
              />
            </div>
          )}

          {/* Product Staging Accumulator Box */}
          <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase block">
              Sélectionner les articles à ajouter
            </label>
            
            <div className="space-y-2">
              <select 
                value={cartProductId} 
                onChange={handleProductSelect} 
                className="w-full border p-2 text-xs rounded-lg bg-white"
              >
                <option value="">-- Choisir un produit actif --</option>
                {products.filter(p => !p.is_archived).map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.batch_reference || 'N/A'}] {p.name} - {p.price?.toLocaleString()} FCFA (Stock: {p.quantity})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 font-bold block mb-0.5">Quantité</label>
                  <input 
                    type="number" 
                    min="1" 
                    placeholder="Qté" 
                    value={cartQty} 
                    onChange={e => setCartQty(e.target.value)} 
                    className="w-full border p-2 text-xs rounded-lg bg-white text-center font-bold" 
                  />
                </div>
                <div>
                  <label className="text-[9px] text-orange-600 font-bold block mb-0.5">Prix Unitaire (FCFA)</label>
                  <input 
                    type="number" 
                    placeholder="Prix" 
                    value={customPrice} 
                    onChange={e => setCustomPrice(e.target.value)} 
                    className="w-full border border-orange-300 p-2 text-xs rounded-lg bg-white text-right font-bold text-orange-700" 
                  />
                </div>
              </div>

              <button 
                type="button" 
                onClick={handleAddToCart} 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider transition-colors"
              >
                + Ajouter au Panier
              </button>
            </div>

            {/* Accumulated Items Table */}
            {cartItems.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Articles du Panier:</p>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                      <tr>
                        <th className="p-2">Article</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2 text-right">Prix</th>
                        <th className="p-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cartItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 font-bold">
                            {item.name} <span className="text-[9px] text-orange-600 block">({item.batch})</span>
                          </td>
                          <td className="p-2 text-center">
                            <input 
                              type="number" 
                              min="1" 
                              value={item.qty} 
                              onChange={(e) => handleUpdateCartItemQty(index, e.target.value)} 
                              className="w-10 border text-center p-1 rounded font-bold text-xs" 
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input 
                              type="number" 
                              value={item.price} 
                              onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} 
                              className="w-16 border border-orange-300 text-right p-1 rounded font-bold text-xs text-orange-700" 
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-red-500 hover:text-red-700 p-1">
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
              <p className="text-center text-[11px] text-gray-400 italic py-2">Panier vide</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Montant Payé Cash (FCFA)</label>
            <input 
              type="number" 
              placeholder={cartTotal > 0 ? `Total: ${cartTotal} FCFA` : "Montant reçu"} 
              value={ledgerForm.initialPaid} 
              onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} 
              className="w-full border p-2.5 text-xs rounded-lg font-bold text-green-700" 
            />
          </div>

          {cartItems.length > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Total Cumulé:</span>
                <span className="font-bold">{cartTotal.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Montant Reçu:</span>
                <span className="font-bold text-green-600">{paidAmount.toLocaleString()} FCFA</span>
              </div>
              {remainingDebt > 0 && (
                <div className="flex justify-between border-t border-orange-200 pt-1 text-red-600 font-extrabold">
                  <span>Reste à Payer (Dette):</span>
                  <span>{remainingDebt.toLocaleString()} FCFA</span>
                </div>
              )}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={cartItems.length === 0} 
            className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider transition-colors"
          >
            Valider et Enregistrer Vente
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: MONTHLY FOLDERS & SALES SEARCH */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          
          {/* Header & Hierarchy Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b">
            <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
              Historique des Ventes par Mois
            </h3>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher (article, date, heure, lot...)" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-9 pr-3 py-1.5 border text-xs rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Monthly Folders Container */}
          <div className="space-y-3">
            {Object.keys(groupedSalesByMonth).length > 0 ? (
              Object.keys(groupedSalesByMonth).map(monthKey => {
                const group = groupedSalesByMonth[monthKey];
                const isOpen = !!expandedMonths[monthKey];

                return (
                  <div key={monthKey} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    
                    {/* Monthly Folder Accordion Header */}
                    <button 
                      type="button" 
                      onClick={() => toggleMonth(monthKey)}
                      className={`w-full flex items-center justify-between p-3.5 text-left transition-colors ${isOpen ? 'bg-orange-50/60 border-b' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {isOpen ? (
                          <FolderOpen className="w-5 h-5 text-orange-600" />
                        ) : (
                          <Folder className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <span className="font-black text-xs uppercase text-gray-800 block">
                            Dossier Ventes : {group.label}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {group.items.length} transaction(s) enregistrée(s)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-700 block">
                            {group.totalSales.toLocaleString()} FCFA
                          </span>
                          <span className="text-[9px] text-green-600 font-bold block">
                            Encaissement: {group.totalPaid.toLocaleString()} FCFA
                          </span>
                        </div>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Folder Content: Sales Items List */}
                    {isOpen && (
                      <div className="p-3 bg-white space-y-2 max-h-96 overflow-y-auto">
                        {group.items.map((sale, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-orange-200 transition-all text-xs space-y-1.5">
                            
                            {/* Line 1: Date, Time & Customer */}
                            <div className="flex justify-between items-center text-gray-500 text-[10px]">
                              <div className="flex items-center space-x-3">
                                <span className="flex items-center font-bold text-gray-700">
                                  <Calendar className="w-3 h-3 mr-1 text-orange-500" />
                                  {sale.date || 'N/A'}
                                </span>
                                <span className="flex items-center font-bold text-gray-700">
                                  <Clock className="w-3 h-3 mr-1 text-orange-500" />
                                  {sale.time || sale.created_at?.slice(11, 16) || '--:--'}
                                </span>
                              </div>
                              <span className="flex items-center font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded">
                                <User className="w-3 h-3 mr-1" />
                                {sale.customerName || sale.customer_name || 'Client de Passage'}
                              </span>
                            </div>

                            {/* Line 2: Goods & Batch Details */}
                            <div className="font-semibold text-gray-800 pl-1">
                              {sale.goods}
                            </div>

                            {/* Line 3: Financial Summary */}
                            <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-[11px]">
                              <span className="text-gray-400 text-[10px]">
                                Lot: <strong className="text-gray-600">{sale.batch || 'N/A'}</strong>
                              </span>
                              <div className="space-x-2">
                                <span>Total: <strong>{sale.total?.toLocaleString()} FCFA</strong></span>
                                <span className="text-green-600 font-bold">Payé: {sale.paid?.toLocaleString()} FCFA</span>
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
              <div className="text-center py-12 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed">
                {searchTerm ? 'Aucune vente ne correspond à votre recherche.' : 'Aucune vente enregistrée dans le journal.'}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}