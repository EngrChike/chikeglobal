import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Pencil, Search, Folder, FolderOpen, Calendar, Clock, User, ChevronDown, ChevronRight, UserCheck, XCircle } from 'lucide-react';

export default function SalesLedger({ products, customers, fetchProducts, fetchCustomers, supabase, currentUser }) {
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

  // Active Sale Being Edited (null = New Sale Mode)
  const [editingSale, setEditingSale] = useState(null);

  // Adding Item State
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');

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

  // State for collapsible month folders (Current month expanded by default)
  const [expandedMonths, setExpandedMonths] = useState({ [currentMonthKey]: true });

  // Fetch sales directly from customer_history table (Filtered by Role)
  const fetchSalesHistory = async () => {
    try {
      let query = supabase
        .from('customer_history')
        .select('*')
        .order('id', { ascending: false });

      // If the current user is NOT an admin, restrict fetch to their own sales only
      if (currentUser?.role !== 'admin') {
        query = query.eq('staff_id', currentUser?.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setSalesHistory(data);
      }
    } catch (err) {
      console.error('Error fetching sales history:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSalesHistory();
    }
  }, [currentUser]);

  // Sync cart to local storage (only when not editing)
  useEffect(() => {
    if (!editingSale) {
      localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
    }
  }, [cartItems, editingSale]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

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

  // Activate In-Place Edit Mode
  const handleEditSale = (sale) => {
    if (!sale.items || sale.items.length === 0) {
      alert("Impossible de modifier : le détail des articles n'est pas disponible pour cette ancienne transaction.");
      return;
    }

    setEditingSale(sale);
    setCartItems(sale.items);
    setLedgerForm({
      customerId: sale.customer_id ? String(sale.customer_id) : 'walkin',
      newName: '',
      newPhone: '',
      initialPaid: sale.paid !== undefined ? sale.paid.toString() : ''
    });
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    setCartItems([]);
    setLedgerForm({ customerId: 'walkin', newName: '', newPhone: '', initialPaid: '' });
    localStorage.removeItem('akuDonCart');
  };

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Veuillez ajouter au moins un article au panier d'accumulation.");
      return;
    }

    const isEditing = !!editingSale;
    const confirmMessage = isEditing 
      ? `Confirmez-vous la modification de la vente de ${editingSale.staff_name || 'ce vendeur'} ?\nLes stocks et le bilan client seront réajustés sans changer le vendeur d'origine.`
      : "Confirmez-vous l'enregistrement de cette vente ? \nSi 'OK', la vente sera validée et les stocks déduits.";

    if (!window.confirm(confirmMessage)) return;

    try {
      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch}) @ ${item.price} FCFA`).join(', ');
      
      const now = new Date();
      const currentDate = now.toLocaleDateString('fr-FR');
      const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      let targetCustomerId = null;
      let customerDisplayName = 'Client de Passage';

      // Customer selection/creation handling
      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim() || 'Client de Passage',
          phone: ledgerForm.newPhone.trim() || '',
          total_debt: 0
        }]).select().single();

        if (custErr) throw custErr;
        targetCustomerId = newCustData.id;
        customerDisplayName = newCustData.name;
      } else if (ledgerForm.customerId !== 'walkin') {
        targetCustomerId = ledgerForm.customerId;
        const existingCust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
        if (existingCust) {
          customerDisplayName = existingCust.name;
        }
      }

      if (isEditing) {
        // --- IN-PLACE UPDATE MODE ---
        
        // 1. Revert original stock deducted during initial sale
        if (editingSale.items && Array.isArray(editingSale.items)) {
          for (const item of editingSale.items) {
            if (item.productId) {
              const { data: prodData } = await supabase.from('products').select('quantity').eq('id', item.productId).single();
              if (prodData) {
                await supabase.from('products').update({
                  quantity: prodData.quantity + item.qty,
                  stock_status: true
                }).eq('id', item.productId);
              }
            }
          }
        }

        // 2. Revert previous customer debt addition
        if (editingSale.customer_id) {
          const previousDebt = (editingSale.total || 0) - (editingSale.paid || 0);
          if (previousDebt > 0) {
            const { data: oldCust } = await supabase.from('customers').select('total_debt').eq('id', editingSale.customer_id).single();
            if (oldCust) {
              const adjustedDebt = Math.max(0, (parseFloat(oldCust.total_debt) || 0) - previousDebt);
              await supabase.from('customers').update({ total_debt: adjustedDebt }).eq('id', editingSale.customer_id);
            }
          }
        }

        // 3. Apply new debt to target customer
        if (targetCustomerId && balance > 0) {
          const { data: currentCust } = await supabase.from('customers').select('total_debt').eq('id', targetCustomerId).single();
          if (currentCust) {
            const newDebtTotal = (parseFloat(currentCust.total_debt) || 0) + balance;
            await supabase.from('customers').update({ total_debt: newDebtTotal }).eq('id', targetCustomerId);
          }
        }

        // 4. Update EXISTING sale record in DB while PRESERVING ORIGINAL SELLER
        const updatePayload = {
          customer_id: targetCustomerId,
          customer_name: customerDisplayName,
          goods: goodsDescription,
          batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
          product_id: cartItems.length === 1 ? cartItems[0].productId : null,
          qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
          total: cartTotal,
          paid: paidAmount,
          items: cartItems,
          // PRESERVE ORIGINAL SELLER CREDENTIALS
          staff_id: editingSale.staff_id,
          staff_name: editingSale.staff_name || 'Vendeur'
        };

        const { error: updateErr } = await supabase
          .from('customer_history')
          .update(updatePayload)
          .eq('id', editingSale.id);

        if (updateErr) throw updateErr;

      } else {
        // --- NEW SALE MODE ---
        if (targetCustomerId && balance > 0) {
          const existingCust = customers.find(c => String(c.id) === String(targetCustomerId));
          const currentDebt = existingCust ? (parseFloat(existingCust.totalDebt) || 0) : 0;
          await supabase.from('customers').update({ total_debt: currentDebt + balance }).eq('id', targetCustomerId);
        }

        const salePayload = {
          customer_id: targetCustomerId,
          staff_id: currentUser?.id,
          staff_name: currentUser?.name || currentUser?.full_name || currentUser?.email || 'Vendeur',
          date: currentDate,
          goods: goodsDescription,
          batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
          product_id: cartItems.length === 1 ? cartItems[0].productId : null,
          qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
          total: cartTotal,
          paid: paidAmount,
          type: 'Sale',
          items: cartItems,
          customer_name: customerDisplayName,
          time: currentTime,
          month_key: monthKey,
          month_label: monthLabel
        };

        const { error: histErr } = await supabase.from('customer_history').insert([salePayload]);
        if (histErr) throw histErr;
      }

      // Deduct stock for new/updated cart items
      for (const item of cartItems) {
        if (item.productId) {
          const { data: latestProd } = await supabase.from('products').select('quantity').eq('id', item.productId).single();
          if (latestProd) {
            const newStock = Math.max(0, latestProd.quantity - item.qty);
            await supabase.from('products').update({ 
              quantity: newStock, 
              stock_status: newStock > 0 
            }).eq('id', item.productId);
          }
        }
      }

      setEditingSale(null);
      setLedgerForm({ customerId: 'walkin', newName: '', newPhone: '', initialPaid: '' });
      setCartItems([]);
      localStorage.removeItem('akuDonCart');
      
      await fetchProducts();
      await fetchCustomers();
      await fetchSalesHistory();
      alert(isEditing ? 'Modifications enregistrées avec succès !' : 'Vente enregistrée avec succès !');
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    }
  };

  // Admin Delete Sale (Restores stocks and customer debt)
  const handleDeleteSale = async (sale) => {
    if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment SUPPRIMER cette vente ?\n\nLes articles seront remis en stock et la dette du client sera ajustée.")) return;
    try {
      // 1. Restore Stock
      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (item.productId) {
            const { data: prodData } = await supabase.from('products').select('quantity').eq('id', item.productId).single();
            if (prodData) {
              await supabase.from('products').update({ 
                quantity: prodData.quantity + item.qty, 
                stock_status: true 
              }).eq('id', item.productId);
            }
          }
        }
      }

      // 2. Revert Customer Debt
      if (sale.customer_id) {
        const debtReduction = (sale.total || 0) - (sale.paid || 0);
        if (debtReduction > 0) {
          const { data: custData } = await supabase.from('customers').select('total_debt').eq('id', sale.customer_id).single();
          if (custData) {
            const newDebt = Math.max(0, (parseFloat(custData.total_debt) || 0) - debtReduction);
            await supabase.from('customers').update({ total_debt: newDebt }).eq('id', sale.customer_id);
          }
        }
      }

      // 3. Delete from database
      const { error: delErr } = await supabase.from('customer_history').delete().eq('id', sale.id);
      if (delErr) throw delErr;

      alert("Vente supprimée et stocks restaurés avec succès.");
      await fetchProducts();
      await fetchCustomers();
      await fetchSalesHistory();
    } catch (err) {
      alert(`Erreur lors de la suppression : ${err.message}`);
    }
  };

  // Helper to resolve Month Key & Label dynamically
  const getMonthGroup = (item) => {
    if (item.month_key && item.month_label) {
      return { key: item.month_key, label: item.month_label };
    }
    
    let dateObj = new Date(item.created_at || item.date);
    if (isNaN(dateObj.getTime()) && typeof item.date === 'string') {
      const parts = item.date.split(/[\/\-]/);
      if (parts.length === 3 && parts[2].length === 4) {
        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }

    if (!isNaN(dateObj.getTime())) {
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const label = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { key, label };
    }

    return { key: currentMonthKey, label: 'Mois En Cours' };
  };

  // Process & Filter Sales History
  const filteredSales = useMemo(() => {
    return salesHistory.map(item => {
      const cust = customers.find(c => String(c.id) === String(item.customer_id));
      return {
        ...item,
        displayCustomer: item.customer_name || (cust ? cust.name : 'Client de Passage')
      };
    }).filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.goods && item.goods.toLowerCase().includes(term)) ||
        (item.displayCustomer && item.displayCustomer.toLowerCase().includes(term)) ||
        (item.batch && item.batch.toLowerCase().includes(term)) ||
        (item.date && item.date.includes(term)) ||
        (item.time && item.time.includes(term)) ||
        (item.staff_name && item.staff_name.toLowerCase().includes(term))
      );
    });
  }, [salesHistory, customers, searchTerm]);

  // Group History items into Folders by Month
  const groupedSalesByMonth = useMemo(() => {
    const groups = {};
    filteredSales.forEach(item => {
      const { key, label } = getMonthGroup(item);

      if (!groups[key]) {
        groups[key] = {
          label: label,
          items: [],
          totalSales: 0,
          totalPaid: 0
        };
      }
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
        <div className="flex justify-between items-center pb-2 border-b">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
            {editingSale ? '✏️ Modification de Vente' : 'Caisse & Enregistrement Ventes'}
          </h3>
          {editingSale && (
            <button 
              onClick={handleCancelEdit} 
              className="text-xs text-red-600 hover:text-red-800 flex items-center font-bold"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Annuler
            </button>
          )}
        </div>

        {/* Editing Banner */}
        {editingSale && (
          <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs text-blue-900 space-y-0.5">
            <p className="font-bold">Vous modifiez la vente #{editingSale.id}</p>
            <p className="text-[10px]">
              Vendeur conservé: <strong>{editingSale.staff_name || 'Vendeur'}</strong>
            </p>
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
            className={`w-full ${editingSale ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-gray-800'} disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider transition-colors`}
          >
            {editingSale ? 'Enregistrer les Modifications' : 'Valider et Enregistrer Vente'}
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

                    {isOpen && (
                      <div className="p-3 bg-white space-y-2 max-h-96 overflow-y-auto">
                        {group.items.map((sale, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-orange-200 transition-all text-xs space-y-1.5">
                            
                            <div className="flex justify-between items-center text-gray-500 text-[10px]">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="flex items-center font-bold text-gray-700">
                                  <Calendar className="w-3 h-3 mr-1 text-orange-500" />
                                  {sale.date || 'N/A'}
                                </span>
                                <span className="flex items-center font-bold text-gray-700">
                                  <Clock className="w-3 h-3 mr-1 text-orange-500" />
                                  {sale.time || sale.created_at?.slice(11, 16) || '--:--'}
                                </span>
                                {/* Display Original Staff Name */}
                                <span className="flex items-center font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded">
                                  <UserCheck className="w-3 h-3 mr-1 text-blue-600" />
                                  {sale.staff_name || 'Vendeur Inconnu'}
                                </span>
                              </div>
                              <span className="flex items-center font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded">
                                <User className="w-3 h-3 mr-1" />
                                {sale.displayCustomer}
                              </span>
                            </div>

                            <div className="font-semibold text-gray-800 pl-1">
                              {sale.goods}
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-[11px]">
                              <span className="text-gray-400 text-[10px]">
                                Lot: <strong className="text-gray-600">{sale.batch || 'N/A'}</strong>
                              </span>
                              
                              <div className="flex items-center space-x-3">
                                <span>Total: <strong>{sale.total?.toLocaleString()} FCFA</strong></span>
                                <span className="text-green-600 font-bold">Payé: {sale.paid?.toLocaleString()} FCFA</span>
                                
                                {/* Admin Only Edit & Delete Controls */}
                                {currentUser?.role === 'admin' && (
                                  <div className="flex items-center space-x-1 pl-2 border-l border-gray-300">
                                    <button 
                                      onClick={() => handleEditSale(sale)} 
                                      className="p-1 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                      title="Modifier cette vente"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteSale(sale)} 
                                      className="p-1 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                      title="Supprimer (Restaure les stocks)"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
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