import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { ShieldCheck, Trash2, Pencil, LogOut, Users, Package, Phone, CheckCircle, X, DollarSign, TrendingUp, Layers, Eye } from 'lucide-react';

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'customers', or 'storefront'
  const [products, setProducts] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');

  // Inventory states
  const [name, setName] = useState('');
  const [price, setPrice] = useState(''); // Selling Price
  const [costPrice, setCostPrice] = useState(''); // Cost Price
  const [quantity, setQuantity] = useState(''); // Current Stock
  const [initialQuantity, setInitialQuantity] = useState(''); // Constant Initial Purchase Qty
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Customer Ledger & Multi-Item Cart states
  const [customers, setCustomers] = useState([]);
  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: '', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });
  
  // Cart Holder States
  const [cartItems, setCartItems] = useState([]);
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');

  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    fetchProducts();
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Erreur: ", err);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (error) setAuthError(error.message);
      else { setAdminEmail(''); setAdminPassword(''); }
    } catch (err) {
      setAuthError('Erreur inattendue.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => await supabase.auth.signOut();

  // IMAGE COMPRESSOR FUNCTION
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } }
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            else reject(new Error('Compression failed'));
          }, 'image/jpeg', quality);
        }; img.onerror = (err) => reject(err);
      }; reader.onerror = (err) => reject(err);
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || !quantity || !batch) return;
    setUploading(true);
    let image_url = editingProduct ? editingProduct.image_url : 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80';
    try {
      if (imageFile) {
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, fileToUpload, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          if (data?.publicUrl) image_url = data.publicUrl;
        }
      }
      const parsedQty = parseInt(quantity) || 0;
      const parsedInitQty = initialQuantity ? parseInt(initialQuantity) : (editingProduct ? editingProduct.initial_quantity : parsedQty);

      const payload = { 
        name: name.trim(), 
        description: description.trim(), 
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 0,
        image_url, 
        quantity: parsedQty, 
        initial_quantity: parsedInitQty || parsedQty,
        stock_status: parsedQty > 0, 
        batch_reference: batch.trim().toUpperCase()
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        alert('Produit mis à jour avec succès !');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        alert('Produit publié avec succès !');
      }

      setName(''); setPrice(''); setCostPrice(''); setQuantity(''); setInitialQuantity(''); setDescription(''); setBatch(''); setImageFile(null); setEditingProduct(null);
      await fetchProducts();
    } catch (err) { alert(`Erreur: ${err.message}`); }
    finally { setUploading(false); }
  };

  const handleStartEditProduct = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setPrice(p.price);
    setCostPrice(p.cost_price || '');
    setQuantity(p.quantity);
    setInitialQuantity(p.initial_quantity || p.quantity);
    setDescription(p.description || '');
    setBatch(p.batch_reference || '');
  };

  const handleCancelEditProduct = () => {
    setEditingProduct(null);
    setName(''); setPrice(''); setCostPrice(''); setQuantity(''); setInitialQuantity(''); setDescription(''); setBatch(''); setImageFile(null);
  };

  const handleUpdateStockVolume = async (id, newVolume) => {
    const parsedVolume = parseInt(newVolume) || 0;
    const { error } = await supabase.from('products').update({ quantity: parsedVolume, stock_status: parsedVolume > 0 }).eq('id', id);
    if (!error) setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet article de la liste ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) setProducts(prev => prev.filter(p => p.id !== id));
  };

  // --- CART / HOLDER FUNCTIONS ---
  const handleAddToCart = () => {
    if (!cartProductId) return;
    const prod = products.find(p => p.id === parseInt(cartProductId) || p.id === cartProductId);
    if (!prod) return;
    const qty = parseInt(cartQty) || 1;

    const existingIndex = cartItems.findIndex(item => item.productId === prod.id);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].qty += qty;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        productId: prod.id,
        name: prod.name,
        batch: prod.batch_reference || 'N/A',
        price: prod.price,
        qty: qty
      }]);
    }
    setCartProductId('');
    setCartQty('1');
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

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Veuillez ajouter au moins un article au panier.");
      return;
    }
    if (!ledgerForm.customerId) {
      alert("Veuillez sélectionner un client.");
      return;
    }

    const iPaid = parseFloat(ledgerForm.initialPaid) || 0;
    const balance = cartTotal - iPaid;
    const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch})`).join(', ');

    const newTransaction = {
      date: new Date().toISOString().split('T')[0],
      batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
      productId: cartItems.length === 1 ? cartItems[0].productId : null,
      qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
      goods: goodsDescription,
      total: cartTotal,
      paid: iPaid,
      items: cartItems
    };

    // Deduct current stock automatically from Supabase for all items in cart
    for (const item of cartItems) {
      if (item.productId) {
        const selectedProd = products.find(p => p.id === item.productId);
        if (selectedProd) {
          const newStock = Math.max(0, selectedProd.quantity - item.qty);
          await handleUpdateStockVolume(selectedProd.id, newStock);
        }
      }
    }

    if (ledgerForm.customerId === 'new') {
      const newCustomer = {
        id: Date.now(),
        name: ledgerForm.newName,
        phone: ledgerForm.newPhone,
        totalDebt: balance,
        history: [newTransaction]
      };
      setCustomers([...customers, newCustomer]);
    } else {
      setCustomers(customers.map(c => 
        c.id === parseInt(ledgerForm.customerId) 
        ? { ...c, totalDebt: c.totalDebt + balance, history: [...c.history, newTransaction] } 
        : c
      ));
    }

    setLedgerForm({ customerId: '', newName: '', newPhone: '', initialPaid: '' });
    setCartItems([]);
    alert('Vente enregistrée avec succès, calcul effectué et stocks réduits !');
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    setCustomers(customers.map(c => 
      c.id === paymentForm.customerId 
      ? { 
          ...c, 
          totalDebt: c.totalDebt - payAmt, 
          history: [...c.history, { date: new Date().toLocaleString(), type: 'Payment', paid: payAmt, goods: 'Debt Reconciliation', total: 0 }]
        } 
      : c
    ));
    setPaymentForm({ amount: '', customerId: null });
    alert('Paiement enregistré avec succès !');
  };

  const handleSaveCustomerEdit = (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, name: editingCustomer.name, phone: editingCustomer.phone } : c));
    setEditingCustomer(null);
    alert('Informations client mises à jour !');
  };

  const getProductSoldQty = (productId, productName) => {
    return customers.reduce((acc, c) => {
      return acc + c.history.reduce((hAcc, h) => {
        const matchesId = h.productId && h.productId === productId;
        const matchesName = h.goods && h.goods.toLowerCase().includes(productName?.toLowerCase());
        if (matchesId || matchesName) {
          return hAcc + (h.qty || 1);
        }
        return hAcc;
      }, 0);
    }, 0);
  };

  // --- DASHBOARD FINANCIAL CALCULATIONS ---
  
  // 1. Total Capital Investi (Achats) -> Constant based on initial purchase volume
  const totalInventoryCost = products.reduce((acc, p) => {
    const initialQty = p.initial_quantity !== undefined && p.initial_quantity !== null ? p.initial_quantity : p.quantity;
    return acc + ((parseFloat(p.cost_price) || 0) * (parseInt(initialQty) || 0));
  }, 0);

  // 2. Valeur Potentielle Stock
  const totalPotentialRetail = products.reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);

  // 3. Coût Marchandises Vendues (COGS)
  const totalGoodsSoldCost = products.reduce((acc, p) => {
    const soldQty = getProductSoldQty(p.id, p.name);
    return acc + ((parseFloat(p.cost_price) || 0) * soldQty);
  }, 0);

  // 4. Total Ventes (Revenue) -> Scans and accumulates all customer purchase totals (`h.total`)
  const totalSalesRevenue = customers.reduce((acc, c) => {
    return acc + c.history.reduce((hAcc, h) => hAcc + (h.total || 0), 0);
  }, 0);

  // 5. Total Dettes Clients
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + (c.totalDebt || 0), 0);

  const uniqueBatches = ['ALL', ...new Set(products.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = selectedBatchFilter === 'ALL' 
    ? products 
    : products.filter(p => p.batch_reference === selectedBatchFilter);

  const frontPageProducts = products.filter(p => (p.quantity || 0) >= 1);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-gray-900">Connexion Admin</h2>
            <p className="text-xs text-gray-500 mt-1">AkuDon Cosmetics Ventures - Admin Portal</p>
            {authError && <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded-lg">{authError}</p>} 
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Adresse Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Mot de passe</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl uppercase tracking-wider">{authLoading ? 'Connexion...' : 'Se connecter'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ADMIN HEADER & NAVIGATION */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setActiveTab('inventory')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'inventory' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Package className="w-4 h-4" /> <span>Inventory & Batches</span>
            </button>
            <button onClick={() => setActiveTab('customers')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'customers' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Users className="w-4 h-4" /> <span>Customer Ledger & Cart</span>
            </button>
            <button onClick={() => setActiveTab('storefront')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'storefront' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Eye className="w-4 h-4" /> <span>Front-Page Preview (Stock &gt;= 1)</span>
            </button>
          </div>
          <button onClick={handleAdminLogout} className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center space-x-1.5">
            <LogOut className="w-3.5 h-3.5" /> <span>Déconnexion</span>
          </button>
        </div>

        {/* FINANCIAL METRICS DASHBOARD OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Capital Investi (Achats)</p>
            <p className="text-base sm:text-xl font-black text-gray-900 mt-1">{totalInventoryCost.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Valeur Potentielle Stock</p>
            <p className="text-base sm:text-xl font-black text-orange-600 mt-1">{totalPotentialRetail.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Coût Marchandises Vendues</p>
            <p className="text-base sm:text-xl font-black text-purple-600 mt-1">{totalGoodsSoldCost.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Ventes (Revenue)</p>
            <p className="text-base sm:text-xl font-black text-blue-600 mt-1">{totalSalesRevenue.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs col-span-2 lg:col-span-1">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Dettes Clients Restantes</p>
            <p className="text-base sm:text-xl font-black text-red-600 mt-1">{totalOutstandingDebt.toLocaleString()} FCFA</p>
          </div>
        </div>

        {/* TAB 1: INVENTORY & BATCHES */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
                  {editingProduct ? 'Modifier le produit' : 'Ajouter un produit (Batch)'}
                </h3>
                {editingProduct && (
                  <button onClick={handleCancelEditProduct} className="text-gray-400 hover:text-red-500 text-xs flex items-center">
                    <X className="w-3.5 h-3.5 mr-1" /> Annuler
                  </button>
                )}
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-3.5">
                <input type="text" placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                <input type="text" placeholder="Batch Reference (e.g., BATCH-A)" value={batch} onChange={e => setBatch(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg uppercase" required />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Prix Achat (Cost)</label>
                    <input type="number" placeholder="Cost Price" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Prix Vente (Retail)</label>
                    <input type="number" placeholder="Selling Price" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Qté Initiale Achetée</label>
                    <input type="number" placeholder="Total Acheté" value={initialQuantity} onChange={e => setInitialQuantity(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Qté Actuelle Stock</label>
                    <input type="number" placeholder="Stock Restant" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                </div>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg h-16" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full text-xs text-gray-500" />
                <button type="submit" disabled={uploading} className="w-full bg-[#f68b1e] text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider">
                  {uploading ? 'Traitement...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b gap-3">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-orange-600" /> Gestionnaire de Catalogue par Batch
                </h3>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Filtrer Batch:</span>
                  <select value={selectedBatchFilter} onChange={e => setSelectedBatchFilter(e.target.value)} className="border p-1.5 text-xs rounded-lg bg-gray-50 font-bold">
                    {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 font-bold border-b">
                      <th className="p-2.5">Image</th>
                      <th className="p-2.5">Article</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5">Achat (Cost)</th>
                      <th className="p-2.5">Vente (Price)</th>
                      <th className="p-2.5 text-center">Stock Actuel</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="p-2.5">
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border" />
                        </td>
                        <td className="p-2.5 font-extrabold">{p.name}</td>
                        <td className="p-2.5">
                          <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px]">
                            {p.batch_reference || 'N/A'}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-500">{p.cost_price?.toLocaleString()} FCFA</td>
                        <td className="p-2.5 font-semibold text-orange-600">{p.price?.toLocaleString()} FCFA</td>
                        <td className="p-2.5 text-center">
                          <input type="number" value={p.quantity !== null ? p.quantity : 0} onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} className="w-16 border text-center p-1 rounded font-bold" />
                        </td>
                        <td className="p-2.5 text-center space-x-2">
                          <button onClick={() => handleStartEditProduct(p)} className="text-blue-500 hover:text-blue-700" title="Modifier">
                            <Pencil className="w-4 h-4 inline" />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600" title="Supprimer">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-gray-400 text-xs">Aucun produit trouvé pour ce batch.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMER LEDGER WITH MULTI-ITEM CART */}
        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b">Enregistrer une Vente (Panier Multi-Articles)</h3>
              
              <form onSubmit={handleFinalizeSale} className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">Sélectionner le Client</label>
                  <select value={ledgerForm.customerId} onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg" required>
                    <option value="">-- Choisir un Client --</option>
                    <option value="new">+ Enregistrer un Nouveau Client</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'Pas de téléphone'})</option>)}
                  </select>
                </div>
                
                {ledgerForm.customerId === 'new' && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <input type="text" placeholder="Nom du Client" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                    <input type="text" placeholder="Numéro de Téléphone (+225...)" value={ledgerForm.newPhone} onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                  </div>
                )}

                <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block">Ajouter des articles au panier</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select value={cartProductId} onChange={e => setCartProductId(e.target.value)} className="w-full border p-2 text-xs rounded-lg bg-white">
                      <option value="">-- Choisir un produit de l'inventaire --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.batch_reference || 'N/A'}] {p.name} - {p.price?.toLocaleString()} FCFA (Stock: {p.quantity})
                        </option>
                      ))}
                    </select>
                    <div className="flex space-x-2">
                      <input type="number" min="1" placeholder="Qté" value={cartQty} onChange={e => setCartQty(e.target.value)} className="w-20 border p-2 text-xs rounded-lg bg-white text-center font-bold" />
                      <button type="button" onClick={handleAddToCart} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider">
                        + Ajouter au panier
                      </button>
                    </div>
                  </div>

                  {cartItems.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="bg-white rounded-lg border overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                            <tr>
                              <th className="p-2">Article</th>
                              <th className="p-2 text-center">Qté</th>
                              <th className="p-2 text-right">Prix Unitaire</th>
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
                                  <input type="number" min="1" value={item.qty} onChange={(e) => handleUpdateCartItemQty(index, e.target.value)} className="w-14 border text-center p-1 rounded font-bold text-xs" />
                                </td>
                                <td className="p-2 text-right">
                                  <input type="number" value={item.price} onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} className="w-24 border text-right p-1 rounded font-bold text-xs" />
                                </td>
                                <td className="p-2 text-center">
                                  <button type="button" onClick={() => handleRemoveFromCart(index)} className="text-red-500 hover:text-red-700 p-1" title="Supprimer">
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
                    <p className="text-center text-[11px] text-gray-400 italic py-2">Le panier est actuellement vide.</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">Montant Payé Initial (FCFA)</label>
                  <input type="number" placeholder="Payé mtn" value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg" required />
                </div>

                {cartItems.length > 0 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Total Panier:</span>
                      <span className="font-bold">{cartTotal.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Montant Payé:</span>
                      <span className="font-bold text-green-600">{(parseFloat(ledgerForm.initialPaid) || 0).toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between border-t border-orange-200 pt-1 text-orange-900 font-extrabold">
                      <span>Ajouté à la Dette:</span>
                      <span>{Math.max(0, cartTotal - (parseFloat(ledgerForm.initialPaid) || 0)).toLocaleString()} FCFA</span>
                    </div>
                  </div>
                )}
                
                <button type="submit" disabled={cartItems.length === 0} className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider">
                  Terminer & Enregistrer la Vente
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Balances Clients & Historique des Achats</h3>
                
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
                            <button onClick={() => setEditingCustomer(c)} className="text-gray-400 hover:text-blue-600 text-xs" title="Modifier">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${c.totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              Dette: {c.totalDebt.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>
                        
                        {c.totalDebt > 0 && (
                          <form onSubmit={handleRecordPayment} className="mt-3 flex space-x-2">
                            <input type="number" placeholder="Montant du paiement" value={paymentForm.customerId === c.id ? paymentForm.amount : ''} onChange={e => setPaymentForm({ amount: e.target.value, customerId: c.id })} className="w-full border p-1.5 text-xs rounded bg-white" required />
                            <button type="submit" className="bg-green-600 text-white text-[10px] px-3 rounded font-bold whitespace-nowrap">Régler Dette</button>
                          </form>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">HISTORIQUE DES TRANSACTIONS:</p>
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
                      Aucun client enregistré pour le moment.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: STOREFRONT PREVIEW */}
        {activeTab === 'storefront' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b gap-2">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide text-gray-900">Aperçu Front-Page (Catalogue Public)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Seuls les articles avec au moins 1 produit en stock (quantité &gt;= 1) sont affichés ici.</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                {frontPageProducts.length} articles visibles sur la boutique
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {frontPageProducts.map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                  <div>
                    <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover rounded-lg border mb-3" />
                    <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] inline-block mb-1">
                      {p.batch_reference || 'BATCH'}
                    </span>
                    <h4 className="font-black text-sm text-gray-900 leading-tight">{p.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || 'Aucune description disponible.'}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="font-black text-orange-600 text-sm">{p.price?.toLocaleString()} FCFA</span>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                      Stock: {p.quantity} pcs
                    </span>
                  </div>
                </div>
              ))}
              {frontPageProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 text-xs">
                  Aucun produit en stock pour le moment.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}