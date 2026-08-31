import React, { useState, useEffect } from 'react';
import { Package, Users, Eye, Pencil, Archive, RotateCcw, X, Layers } from 'lucide-react';
import SalesLedger from './SalesLedger';

export default function AdminApp({ currentUser, supabase }) {
  // Determine role access
  const isAdmin = currentUser?.role === 'admin';
  
  // Default to inventory for Admin, but force Sales Ledger for Staff
  const [activeTab, setActiveTab] = useState(isAdmin ? 'inventory' : 'customers'); 

  // Data states
  const [products, setProducts] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [customers, setCustomers] = useState([]);

  // Inventory forms states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomersFromSupabase();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Erreur produits: ", err);
    }
  };

  const fetchCustomersFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, customer_history(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const formatted = data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          totalDebt: c.total_debt || 0,
          history: c.customer_history ? c.customer_history.sort((a, b) => b.id - a.id) : []
        }));
        setCustomers(formatted);
      }
    } catch (err) {
      console.error("Erreur chargement clients Supabase:", err.message);
    }
  };

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
    if (!name || !price || quantity === '' || !batch) return;
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
      const parsedInitQty = initialQuantity !== '' ? parseInt(initialQuantity) : (editingProduct ? editingProduct.initial_quantity : parsedQty);

      const payload = { 
        name: name.trim(), 
        description: description.trim(), 
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 0,
        image_url, 
        quantity: parsedQty, 
        initial_quantity: parsedInitQty || parsedQty,
        stock_status: parsedQty > 0, 
        batch_reference: batch.trim().toUpperCase(),
        is_archived: false
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
    setInitialQuantity(p.initial_quantity !== undefined && p.initial_quantity !== null ? p.initial_quantity : p.quantity);
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
    if (!error) setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
  };

  const handleArchiveProduct = async (id, archiveState = true) => {
    const confirmMsg = archiveState 
      ? 'Voulez-vous archiver ce produit ? Il conservera ses données financières mais ne sera plus actif.' 
      : 'Voulez-vous restaurer ce produit dans le catalogue actif ?';
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase.from('products').update({ is_archived: archiveState }).eq('id', id);
    if (!error) {
      setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, is_archived: archiveState } : p));
    } else {
      alert(`Erreur d'archivage: ${error.message}`);
    }
  };

  const getProductSoldQty = (productId) => {
    return customers.reduce((acc, c) => {
      return acc + (c.history || []).reduce((hAcc, h) => {
        if (h.items && Array.isArray(h.items)) {
          const item = h.items.find(i => String(i.productId) === String(productId));
          return hAcc + (item ? (parseInt(item.qty) || 0) : 0);
        } else {
          if (String(h.productId) === String(productId)) {
            return hAcc + (parseInt(h.qty) || 1);
          }
        }
        return hAcc;
      }, 0);
    }, 0);
  };

  const getTrueInitialQty = (p) => {
    if (p.initial_quantity !== undefined && p.initial_quantity !== null && p.initial_quantity !== '') {
      return parseInt(p.initial_quantity);
    }
    const soldQty = getProductSoldQty(p.id);
    return (parseInt(p.quantity) || 0) + soldQty;
  };

  // Financial Metrics Variables
  const totalInventoryCost = products.reduce((acc, p) => acc + ((parseFloat(p.cost_price) || 0) * getTrueInitialQty(p)), 0);
  const totalExpectedRevenue = products.reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * getTrueInitialQty(p)), 0);
  const totalPotentialRetail = products.filter(p => !p.is_archived).reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);
  const totalGoodsSoldCost = products.reduce((acc, p) => acc + ((parseFloat(p.cost_price) || 0) * getProductSoldQty(p.id)), 0);
  const totalSalesRevenue = customers.reduce((acc, c) => acc + (c.history || []).reduce((hAcc, h) => hAcc + (parseFloat(h.total) || 0), 0), 0);
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + (parseFloat(c.totalDebt) || 0), 0);

  const uniqueBatches = ['ALL', ...new Set(products.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = products.filter(p => {
    const matchesBatch = selectedBatchFilter === 'ALL' || p.batch_reference === selectedBatchFilter;
    const matchesArchiveState = showArchived ? p.is_archived : !p.is_archived;
    return matchesBatch && matchesArchiveState;
  });

  const frontPageProducts = products.filter(p => {
    const qty = parseInt(p.quantity);
    return !p.is_archived && !isNaN(qty) && qty >= 1;
  });

  return (
    <div className="bg-[#f5f5f7] text-gray-900 font-sans p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER - Only show if Admin, otherwise just display a title for staff */}
        {isAdmin ? (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button onClick={() => setActiveTab('inventory')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'inventory' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Package className="w-4 h-4" /> <span>Inventory & Batches</span>
              </button>
              <button onClick={() => setActiveTab('customers')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'customers' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Users className="w-4 h-4" /> <span>Sales Ledger & Cart</span>
              </button>
              <button onClick={() => setActiveTab('storefront')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'storefront' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Eye className="w-4 h-4" /> <span>Front-Page Preview</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#f68b1e]" /> 
              Interface de Vente - {currentUser.full_name}
            </h2>
          </div>
        )}

        {/* FINANCIAL METRICS - Restricted to Admin Only */}
        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Achat Initial</p>
              <p className="text-sm sm:text-lg font-black text-gray-900 mt-1">{totalInventoryCost.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Vente Initiale</p>
              <p className="text-sm sm:text-lg font-black text-indigo-600 mt-1">{totalExpectedRevenue.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Valeur Stock Actuel</p>
              <p className="text-sm sm:text-lg font-black text-orange-600 mt-1">{totalPotentialRetail.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Coût Marchandises Vendues</p>
              <p className="text-sm sm:text-lg font-black text-purple-600 mt-1">{totalGoodsSoldCost.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Ventes (Revenue)</p>
              <p className="text-sm sm:text-lg font-black text-blue-600 mt-1">{totalSalesRevenue.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <p className="text-[10px] font-extrabold uppercase text-gray-400">Dettes Clients Restantes</p>
              <p className="text-sm sm:text-lg font-black text-red-600 mt-1">{totalOutstandingDebt.toLocaleString()} FCFA</p>
            </div>
          </div>
        )}

        {/* TAB 1: INVENTORY MANAGEMENT - Admin Only */}
        {isAdmin && activeTab === 'inventory' && (
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
                  <Layers className="w-4 h-4 mr-1.5 text-orange-600" /> Catalogue des Produits
                </h3>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowArchived(!showArchived)} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${showArchived ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{showArchived ? 'Voir Actifs' : 'Voir Archivés'}</span>
                  </button>
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
                      <tr key={p.id} className={`hover:bg-gray-50/50 ${p.is_archived ? 'opacity-60 bg-gray-50' : ''}`}>
                        <td className="p-2.5">
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border" />
                        </td>
                        <td className="p-2.5 font-extrabold">
                          {p.name}
                          {p.is_archived && <span className="ml-2 text-[9px] bg-gray-200 text-gray-700 font-bold px-1.5 py-0.5 rounded">Archivé</span>}
                        </td>
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
                          {p.is_archived ? (
                            <button onClick={() => handleArchiveProduct(p.id, false)} className="text-green-600 hover:text-green-800" title="Restaurer">
                              <RotateCcw className="w-4 h-4 inline" />
                            </button>
                          ) : (
                            <button onClick={() => handleArchiveProduct(p.id, true)} className="text-purple-600 hover:text-purple-800" title="Archiver (Soft Delete)">
                              <Archive className="w-4 h-4 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-gray-400 text-xs">
                          {showArchived ? 'Aucun produit archivé.' : 'Aucun produit actif disponible.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEPARATED SALES LEDGER & CART COMPONENT (Visible to both Admin and Staff) */}
        {activeTab === 'customers' && (
          <SalesLedger 
            products={products}
            customers={customers}
            fetchProducts={fetchProducts}
            fetchCustomers={fetchCustomersFromSupabase}
            supabase={supabase}
            currentUser={currentUser} /* Passed down for saving staff_id */
          />
        )}

        {/* TAB 3: STOREFRONT PREVIEW - Admin Only */}
        {isAdmin && activeTab === 'storefront' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b gap-2">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide text-gray-900">Aperçu Front-Page (Catalogue Public)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Seuls les articles non-archivés avec au moins 1 produit en stock (quantité &gt;= 1) sont affichés ici.</p>
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
                  Aucun produit actif en stock pour le moment.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}