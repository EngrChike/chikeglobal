import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Pencil, Search, Folder, FolderOpen, Calendar, Clock, User, ChevronDown, ChevronRight, UserCheck, X, Image as ImageIcon } from 'lucide-react';

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

  // Editing Sale State
  const [editingSale, setEditingSale] = useState(null);

  // Adding Item State (with new Search functionality)
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  
  const dropdownRef = useRef(null); // Ref for closing dropdown on outside click

  // Form State
  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: 'walkin', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });

  // Search & History Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Current Month Key format: "YYYY-MM"
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // State for collapsible month folders
  const [expandedMonths, setExpandedMonths] = useState({ [currentMonthKey]: true });

  // Handle clicking outside of the searchable dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Optimized Search Filter (Limits to 50 results for massive 100k+ catalogs)
  const filteredDropdownProducts = useMemo(() => {
    const activeProducts = products.filter(p => !p.is_archived);
    if (!productSearchTerm) return activeProducts.slice(0, 50);
    
    const lowercasedTerm = productSearchTerm.toLowerCase();
    return activeProducts
      .filter(p => p.name.toLowerCase().includes(lowercasedTerm) || (p.batch_reference && p.batch_reference.toLowerCase().includes(lowercasedTerm)))
      .slice(0, 50); // Important: Prevents DOM freezing with huge inventories
  }, [products, productSearchTerm]);

  // Fetch sales history
  const fetchSalesHistory = async () => {
    try {
      let query = supabase
        .from('customer_history')
        .select('*')
        .order('id', { ascending: false });

      if (currentUser?.role !== 'admin') {
        query = query.eq('staff_id', currentUser?.id);
      }

      if (activeBranchId && activeBranchId !== 'ALL') {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query;
      if (!error && data) setSalesHistory(data);
    } catch (err) {
      console.error('Error fetching sales history:', err);
    }
  };

  useEffect(() => {
    if (currentUser) fetchSalesHistory();
  }, [currentUser, activeBranchId]);

  // Sync cart to local storage
  useEffect(() => {
    localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
  }, [cartItems]);

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
        qty: qty,
        image_url: prod.image_url // Saves the thumbnail image URL
      }]);
    }

    setCartProductId('');
    setCartQty('1');
    setCustomPrice('');
    setProductSearchTerm(''); // Reset search input for the next item
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
        if (item.productId) {
          const { data: prodData, error: fetchErr } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.productId)
            .single();

          if (!fetchErr && prodData) {
            const restoredQty = (prodData.quantity || 0) + item.qty;
            await supabase
              .from('products')
              .update({ quantity: restoredQty, stock_status: restoredQty > 0 })
              .eq('id', item.productId);
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
          .single();

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
      if (item.productId) {
        const { data: freshProd, error: fetchErr } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.productId)
          .single();

        if (fetchErr) continue;
        const currentQty = freshProd ? freshProd.quantity : 0;
        const newStock = Math.max(0, currentQty - item.qty);

        await supabase
          .from('products')
          .update({ quantity: newStock, stock_status: newStock > 0 })
          .eq('id', item.productId);
      }
    }
  };

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Veuillez ajouter au moins un article au panier d'accumulation.");
      return;
    }

    const actionText = editingSale ? "la modification de cette vente" : "l'enregistrement de cette vente";
    const confirmSale = window.confirm(`Confirmez-vous ${actionText} ?`);
    if (!confirmSale) return;

    try {
      if (editingSale) await revertSaleStockAndDebt(editingSale);

      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch}) @ ${item.price} FCFA`).join(', ');
      
      const now = new Date();
      const currentDate = now.toLocaleDateString('fr-FR');
      const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const targetBranchId = (!activeBranchId || activeBranchId === 'ALL') ? null : activeBranchId;

      let targetCustomerId = null;
      let customerDisplayName = 'Client de Passage';

      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim() || 'Client de Passage',
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
      const staffName = editingSale ? (editingSale.staff_name || 'Vendeur') : (currentUser?.name || currentUser?.full_name || currentUser?.email || 'Vendeur');

      const salePayload = {
        customer_id: targetCustomerId,
        staff_id: staffId,
        staff_name: staffName,
        goods: goodsDescription,
        batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
        product_id: cartItems.length === 1 ? cartItems[0].productId : null,
        qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
        total: cartTotal,
        paid: paidAmount,
        type: 'Sale',
        items: cartItems, // Save the items including image_url
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
      
      await fetchProducts();
      await fetchCustomers();
      await fetchSalesHistory();
      alert(editingSale ? 'Vente modifiée avec succès !' : 'Vente enregistrée avec succès !');
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    }
  };

  const handleDeleteSale = async (sale) => {
    const confirmDelete = window.confirm(`⚠️ ATTENTION : Voulez-vous vraiment SUPPRIMER la vente de ${sale.goods} ?\n\n- Les articles seront remis en stock.`);
    if (!confirmDelete) return;

    try {
      await revertSaleStockAndDebt(sale);
      await supabase.from('customer_history').delete().eq('id', sale.id);
      alert("Vente supprimée avec succès !");
      await fetchProducts();
      await fetchCustomers();
      await fetchSalesHistory();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleEditSale = (sale) => {
    if (!sale.items || sale.items.length === 0) {
      alert("Impossible de modifier : le détail n'est pas disponible pour cette ancienne transaction.");
      return;
    }
    setEditingSale(sale);
    setCartItems(sale.items);
    setLedgerForm({
      customerId: sale.customer_id ? String(sale.customer_id) : 'walkin',
      newName: '',
      newPhone: '',
      initialPaid: sale.paid?.toString() || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        label: dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) 
      };
    }
    return { key: currentMonthKey, label: 'Mois En Cours' };
  };

  const filteredSales = useMemo(() => {
    return salesHistory.map(item => {
      const cust = customers.find(c => String(c.id) === String(item.customer_id));
      return { ...item, displayCustomer: item.customer_name || (cust ? cust.name : 'Client de Passage') };
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN: ACCUMULATION & SALE FORM */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b flex justify-between items-center">
          <span>Caisse & Enregistrement Ventes</span>
          {editingSale && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Mode Édition</span>
          )}
        </h3>

        {editingSale && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-center justify-between text-amber-900 text-xs">
            <div>
              <p className="font-bold">✏️ Modification de la vente #{editingSale.id}</p>
              <p className="text-[10px] text-amber-700">Vendeur d'origine : <strong>{editingSale.staff_name || 'Inconnu'}</strong></p>
            </div>
            <button type="button" onClick={handleCancelEdit} className="p-1 text-amber-800 hover:bg-amber-200 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleFinalizeSale} className="space-y-4">
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
              <input type="text" placeholder="Nom du Client" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" />
              <input type="text" placeholder="Numéro de Téléphone (+225...)" value={ledgerForm.newPhone} onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" />
            </div>
          )}

          <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase block">
              Rechercher & Ajouter des Articles
            </label>
            
            <div className="space-y-2">
              {/* SEARCHABLE CUSTOM DROPDOWN (100K+ Optimized) */}
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  placeholder="Tapez pour rechercher un produit..."
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                    setCartProductId(''); // Clear selected ID if user starts typing again
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
                            <div className="text-[9px] text-gray-500">[{p.batch_reference || 'N/A'}] - <span className="font-semibold text-emerald-600">{p.price?.toLocaleString()} FCFA</span> (Stock: {p.quantity})</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-400 text-center">Aucun produit trouvé...</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 font-bold block mb-0.5">Quantité</label>
                  <input type="number" min="1" placeholder="Qté" value={cartQty} onChange={e => setCartQty(e.target.value)} className="w-full border p-2 text-xs rounded-lg bg-white text-center font-bold" />
                </div>
                <div>
                  <label className="text-[9px] text-orange-600 font-bold block mb-0.5">Prix Unitaire (FCFA)</label>
                  <input type="number" placeholder="Prix" value={customPrice} onChange={e => setCustomPrice(e.target.value)} className="w-full border border-orange-300 p-2 text-xs rounded-lg bg-white text-right font-bold text-orange-700" />
                </div>
              </div>

              <button type="button" onClick={handleAddToCart} disabled={!cartProductId} className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider transition-colors">
                + Ajouter au Panier
              </button>
            </div>

            {cartItems.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Articles du Panier:</p>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                      <tr>
                        <th className="p-2 w-1/2">Article</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2 text-right">Prix</th>
                        <th className="p-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cartItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {/* UPDATED: Displays thumbnail directly inside the Cart */}
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
                            <input type="number" value={item.price} onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} className="w-16 border border-orange-300 text-right p-1 rounded font-bold text-xs text-orange-700" />
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
            <input type="number" placeholder={cartTotal > 0 ? `Total: ${cartTotal} FCFA` : "Montant reçu"} value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg font-bold text-green-700" />
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
          
          <button type="submit" disabled={cartItems.length === 0} className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider transition-colors">
            {editingSale ? 'Mettre à Jour la Vente' : 'Valider et Enregistrer Vente'}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: MONTHLY FOLDERS & SALES SEARCH */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b">
            <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
              Historique des Ventes {currentUser?.role !== 'admin' ? '(Vos Ventes)' : 'Global'}
            </h3>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher (article, date, vendeur, lot...)" 
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
                      className={`w-full flex items-center justify-between p-3.5 text-left transition-colors ${isOpen ? 'bg-orange-50/60 border-b' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {isOpen ? <FolderOpen className="w-5 h-5 text-orange-600" /> : <Folder className="w-5 h-5 text-gray-400" />}
                        <div>
                          <span className="font-black text-xs uppercase text-gray-800 block">Dossier Ventes : {group.label}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{group.items.length} transaction(s)</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-700 block">{group.totalSales.toLocaleString()} FCFA</span>
                          <span className="text-[9px] text-green-600 font-bold block">Encaissement: {group.totalPaid.toLocaleString()} FCFA</span>
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
                                <span className="flex items-center font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded"><UserCheck className="w-3 h-3 mr-1 text-blue-600" />{sale.staff_name || 'Vendeur'}</span>
                              </div>
                              <span className="flex items-center font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded"><User className="w-3 h-3 mr-1" />{sale.displayCustomer}</span>
                            </div>

                            {/* UPDATED: Itemized Breakdown with Thumbnails in History */}
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
                                        <div className="text-[10px] text-gray-500">Lot: {item.batch} • @ {item.price?.toLocaleString()} FCFA</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="font-semibold text-gray-800 pl-1">{sale.goods}</div>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 text-[11px]">
                              <span className="text-gray-400 text-[10px]">Total Articles: <strong className="text-gray-600">{sale.qty || '-'}</strong></span>
                              
                              <div className="flex items-center space-x-3">
                                <span>Facture: <strong>{sale.total?.toLocaleString()} FCFA</strong></span>
                                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">Payé: {sale.paid?.toLocaleString()} FCFA</span>
                                
                                {currentUser?.role === 'admin' && (
                                  <div className="flex items-center space-x-1 pl-2 border-l border-gray-300">
                                    <button onClick={() => handleEditSale(sale)} className="p-1.5 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors" title="Modifier la vente"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => handleDeleteSale(sale)} className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors" title="Supprimer la vente (restaure le stock)"><Trash2 className="w-3 h-3" /></button>
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