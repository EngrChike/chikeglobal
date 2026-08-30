import React, { useState, useEffect } from 'react';
import { Trash2, Pencil, Phone } from 'lucide-react';

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

  // Form State
  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: '', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });
  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Sync cart to local storage
  useEffect(() => {
    localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
  }, [cartItems]);

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
      updated[existingIndex].price = priceToUse; // Update with latest specified price
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

    // Reset selection input
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
  const paidAmount = parseFloat(ledgerForm.initialPaid) || 0;
  const remainingDebt = Math.max(0, cartTotal - paidAmount);

  // Finalize Sales & Save to Database
  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Veuillez ajouter au moins un article au panier d'accumulation.");
      return;
    }
    if (!ledgerForm.customerId) {
      alert("Veuillez sélectionner un client.");
      return;
    }

    try {
      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch}) @ ${item.price} FCFA`).join(', ');
      const currentDate = new Date().toISOString().split('T')[0];

      let targetCustomerId = ledgerForm.customerId;

      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim(),
          phone: ledgerForm.newPhone.trim(),
          total_debt: balance
        }]).select().single();

        if (custErr) throw custErr;
        targetCustomerId = newCustData.id;
      } else {
        const existingCust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
        const currentDebt = existingCust ? parseFloat(existingCust.totalDebt) || 0 : 0;
        const newTotalDebt = currentDebt + balance;
        
        const { error: updateErr } = await supabase.from('customers').update({
          total_debt: newTotalDebt
        }).eq('id', targetCustomerId);

        if (updateErr) throw updateErr;
      }

      const { error: histErr } = await supabase.from('customer_history').insert([{
        customer_id: targetCustomerId,
        date: currentDate,
        batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
        product_id: cartItems.length === 1 ? cartItems[0].productId : null,
        qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
        goods: goodsDescription,
        total: cartTotal,
        paid: paidAmount,
        type: 'Sale',
        items: cartItems
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

      setLedgerForm({ customerId: '', newName: '', newPhone: '', initialPaid: '' });
      setCartItems([]);
      localStorage.removeItem('akuDonCart');
      
      await fetchProducts();
      await fetchCustomers();
      alert('Vente enregistrée avec succès !');
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    }
  };

  const handleRecordPayment = async (e, customerId, currentDebt) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    if (payAmt <= 0) return;

    try {
      const newDebt = Math.max(0, currentDebt - payAmt);

      const { error: updateErr } = await supabase.from('customers').update({
        total_debt: newDebt
      }).eq('id', customerId);

      if (updateErr) throw updateErr;

      const { error: histErr } = await supabase.from('customer_history').insert([{
        customer_id: customerId,
        date: new Date().toLocaleString(),
        type: 'Payment',
        paid: payAmt,
        goods: 'Debt Reconciliation',
        total: 0,
        qty: 0,
        items: []
      }]);

      if (histErr) throw histErr;

      setPaymentForm({ amount: '', customerId: null });
      await fetchCustomers();
      alert('Paiement enregistré !');
    } catch (err) {
      alert(`Erreur de paiement: ${err.message}`);
    }
  };

  const handleSaveCustomerEdit = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      const { error } = await supabase.from('customers').update({
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim()
      }).eq('id', editingCustomer.id);

      if (error) throw error;

      setEditingCustomer(null);
      await fetchCustomers();
      alert('Informations client mises à jour !');
    } catch (err) {
      alert(`Erreur mise à jour client: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN: ACCUMULATION & SALE FORM */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b">
          Sales Ledger & Accumulator
        </h3>
        
        <form onSubmit={handleFinalizeSale} className="space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Sélectionner le Client</label>
            <select 
              value={ledgerForm.customerId} 
              onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} 
              className="w-full border p-2.5 text-xs rounded-lg" 
              required
            >
              <option value="">-- Choisir un Client --</option>
              <option value="new">+ Enregistrer un Nouveau Client</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone || 'Pas de téléphone'})
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
                required 
              />
              <input 
                type="text" 
                placeholder="Numéro de Téléphone (+225...)" 
                value={ledgerForm.newPhone} 
                onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} 
                className="w-full border p-2 text-xs rounded-lg bg-white" 
                required 
              />
            </div>
          )}

          {/* Product Staging Accumulator Box */}
          <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase block">
              Ajouter des articles à accumuler
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
                    [{p.batch_reference || 'N/A'}] {p.name} - Prix Orig: {p.price?.toLocaleString()} FCFA (Stock: {p.quantity})
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
                  <label className="text-[9px] text-orange-600 font-bold block mb-0.5">Prix de Vente Unitaire (FCFA)</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 2000" 
                    value={customPrice} 
                    onChange={e => setCustomPrice(e.target.value)} 
                    className="w-full border border-orange-300 p-2 text-xs rounded-lg bg-white text-right font-bold text-orange-700" 
                  />
                </div>
              </div>

              <button 
                type="button" 
                onClick={handleAddToCart} 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider"
              >
                + Accumuler l'article
              </button>
            </div>

            {/* Accumulated Items Table */}
            {cartItems.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Articles en attente d'enregistrement:</p>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                      <tr>
                        <th className="p-2">Article</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2 text-right">Prix (FCFA)</th>
                        <th className="p-2 text-center">Action</th>
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
                              className="w-12 border text-center p-1 rounded font-bold text-xs" 
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input 
                              type="number" 
                              value={item.price} 
                              onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} 
                              className="w-20 border border-orange-300 text-right p-1 rounded font-bold text-xs text-orange-700" 
                              title="Modifier le prix de vente si négocié"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center text-[11px] text-gray-400 italic py-2">Aucun article accumulé pour le moment.</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Montant Payé Cash (FCFA)</label>
            <input 
              type="number" 
              placeholder="Montant payé par le client" 
              value={ledgerForm.initialPaid} 
              onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} 
              className="w-full border p-2.5 text-xs rounded-lg" 
              required 
            />
          </div>

          {cartItems.length > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Total Cumulé:</span>
                <span className="font-bold">{cartTotal.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Espèces Reçues:</span>
                <span className="font-bold text-green-600">{paidAmount.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-1 text-orange-900 font-extrabold">
                <span>Solde / Reste à Payé:</span>
                <span>{remainingDebt.toLocaleString()} FCFA</span>
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={cartItems.length === 0} 
            className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider"
          >
            Enregistrer la Vente Totale
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: CUSTOMER BALANCES & HISTORY */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">
            Balances Clients & Historique
          </h3>
          
          {editingCustomer && (
            <form onSubmit={handleSaveCustomerEdit} className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-blue-900 uppercase">Modifier Client</h4>
                <button type="button" onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-red-500 text-xs">Annuler</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Nom" />
                <input type="text" value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Téléphone" />
              </div>
              <button type="submit" className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded font-bold">Mettre à jour</button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customers.map(c => (
              <div key={c.id} className="border rounded-xl p-4 bg-gray-50 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-black text-sm">{c.name}</h4>
                      <p className="text-[11px] text-gray-500 flex items-center mt-0.5"><Phone className="w-3 h-3 mr-1" /> {c.phone || 'Pas de téléphone'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => setEditingCustomer(c)} className="text-gray-400 hover:text-blue-600 text-xs">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${c.totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        Dette: {c.totalDebt.toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                  
                  {c.totalDebt > 0 && (
                    <form onSubmit={(e) => handleRecordPayment(e, c.id, c.totalDebt)} className="mt-3 flex space-x-2">
                      <input type="number" placeholder="Montant du paiement" value={paymentForm.customerId === c.id ? paymentForm.amount : ''} onChange={e => setPaymentForm({ amount: e.target.value, customerId: c.id })} className="w-full border p-1.5 text-xs rounded bg-white" required />
                      <button type="submit" className="bg-green-600 text-white text-[10px] px-3 rounded font-bold whitespace-nowrap">Régler Dette</button>
                    </form>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">HISTORIQUE SUPABASE:</p>
                  <ul className="text-[10px] space-y-1.5 text-gray-600 max-h-32 overflow-y-auto">
                    {c.history.map((h, i) => (
                      <li key={i} className="bg-white p-2 rounded border border-gray-100 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-700">{h.date}</span>: {h.goods} <span className="text-orange-600 font-bold">({h.batch || h.type})</span>
                        </div>
                        <div className="text-right whitespace-nowrap ml-2">
                          <span>Total: {h.total?.toLocaleString()}</span> | Paid: <span className="text-green-600 font-bold">{h.paid?.toLocaleString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Aucun client enregistré dans Supabase pour le moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}