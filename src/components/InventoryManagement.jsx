import React from 'react';
import { Layers, ArrowRightLeft, X, Pencil, Archive, ReceiptText } from 'lucide-react';

export default function InventoryManagement({
  branches = [],
  productBranch,
  setProductBranch,
  name,
  setName,
  batch,
  setBatch,
  costPrice,
  setCostPrice,
  price,
  setPrice,
  initialQuantity,
  setInitialQuantity,
  quantity,
  setQuantity,
  setImageFile,
  handleSaveProduct,
  uploading,
  editingProduct,
  handleCancelEditProduct,
  handleOpenBatchTransfer,
  handleOpenTransferHistory,
  showArchived,
  setShowArchived,
  selectedBatchFilter,
  setSelectedBatchFilter,
  uniqueBatches = [],
  filteredProducts = [],
  handleUpdateStockVolume,
  handleStartEditProduct,
  handleArchiveProduct
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      
      {/* INVENTORY FORM (CENTRAL HQ INTAKE) */}
      <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
        <div className="flex justify-between items-center mb-5 pb-3 border-b">
          <div>
            <h3 className="font-bold text-sm uppercase text-gray-800">
              {editingProduct ? 'Modifier le Produit' : 'Entrée en Stock (QG Principal)'}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {editingProduct ? 'Mettre à jour la fiche produit' : 'Saisir du stock central à distribuer'}
            </p>
          </div>
          {editingProduct && (
            <button onClick={handleCancelEditProduct} className="text-gray-400 hover:text-red-500 text-xs flex font-medium">
              <X className="w-4 h-4 mr-1" /> Annuler
            </button>
          )}
        </div>

        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Espace d'Affectation</label>
            <select 
              value={productBranch || ''} 
              onChange={e => setProductBranch(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg bg-gray-50 font-bold text-gray-900 focus:ring-2 focus:ring-[#0f172a] outline-none" 
            >
              <option value="">🏢 QG Stock Principal (Dépôt Central)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>🏪 {b.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-indigo-600 mt-1 font-medium">
              * Sélectionner QG pour la gestion comptable centralisée.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nom du Produit</label>
            <input 
              type="text" 
              placeholder="Ex: Crème Hydratante Gold" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
              required 
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Référence Lot / Batch</label>
            <input 
              type="text" 
              placeholder="Ex: LOT-2026-001" 
              value={batch} 
              onChange={e => setBatch(e.target.value)} 
              className="w-full border border-gray-300 p-3 text-sm rounded-lg uppercase focus:ring-2 focus:ring-[#0f172a] outline-none font-medium" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Prix d'Achat (Cout)</label>
              <input 
                type="number" 
                placeholder="0"
                value={costPrice} 
                onChange={e => setCostPrice(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Prix de Vente (Retail)</label>
              <input 
                type="number" 
                placeholder="0"
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Quantité Initiale</label>
              <input 
                type="number" 
                placeholder="0"
                value={initialQuantity} 
                onChange={e => setInitialQuantity(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Stock Actuel</label>
              <input 
                type="number" 
                placeholder="0"
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                className="w-full border border-gray-300 p-3 text-sm rounded-lg focus:ring-2 focus:ring-[#0f172a] outline-none font-bold" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Image du Produit</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => setImageFile(e.target.files[0])} 
              className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" 
            />
          </div>

          <button 
            type="submit" 
            disabled={uploading} 
            className="w-full bg-[#0f172a] hover:bg-gray-800 disabled:opacity-50 text-white text-sm py-3 rounded-lg font-bold transition-colors shadow-sm"
          >
            {uploading ? 'Enregistrement...' : editingProduct ? 'Mettre à jour le Produit' : 'Enregistrer dans le Stock QG'}
          </button>
        </form>
      </div>

      {/* INVENTORY CATALOGUE TABLE */}
      <div className="xl:col-span-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between pb-4 border-b gap-4 lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-bold text-sm uppercase text-gray-800 flex items-center mr-2">
              <Layers className="w-5 h-5 mr-2 text-indigo-600" /> Catalogue des Stocks
            </h3>

            {/* BATCH TRANSFER BUTTON */}
            <button 
              onClick={handleOpenBatchTransfer}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfert Groupé (QG → Succursales)</span>
            </button>

            {/* TRANSFER HISTORY & RECEIPTS BUTTON */}
            {handleOpenTransferHistory && (
              <button 
                onClick={handleOpenTransferHistory}
                className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all"
              >
                <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
                <span>Reçus & Historique</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowArchived(!showArchived)} 
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              {showArchived ? 'Voir Actifs' : 'Voir Archivés'}
            </button>
            <select 
              value={selectedBatchFilter} 
              onChange={e => setSelectedBatchFilter(e.target.value)} 
              className="border border-gray-300 px-3 py-2 text-xs rounded-lg bg-white font-semibold focus:ring-2 focus:ring-[#0f172a] outline-none"
            >
              {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3.5 font-bold text-gray-600 text-xs uppercase tracking-wider">Espace / Emplacement</th>
                <th className="p-3.5 font-bold text-gray-600 text-xs uppercase tracking-wider">Produit & Lot</th>
                <th className="p-3.5 font-bold text-gray-600 text-xs uppercase tracking-wider">Prix Achat / Vente</th>
                <th className="p-3.5 font-bold text-center text-gray-600 text-xs uppercase tracking-wider">Stock Dispo</th>
                <th className="p-3.5 font-bold text-center text-gray-600 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-400 font-medium">
                    Aucun produit trouvé dans cet emplacement.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isHQ = !p.branch_id;
                  const branchObj = branches.find(b => b.id === p.branch_id);

                  return (
                    <tr key={p.id} className={`${p.is_archived ? 'opacity-50 bg-gray-50' : 'bg-white hover:bg-gray-50/80'} transition-colors`}>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${isHQ ? 'bg-slate-900 text-white' : 'bg-blue-100 text-blue-800'}`}>
                          {isHQ ? '🏢 QG Main Stock' : `🏪 ${branchObj?.name || 'Succursale'}`}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-gray-900 flex items-center gap-3">
                        <img src={p.image_url || '/placeholder.png'} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shadow-2xs shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900 text-xs">{p.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-semibold">Lot: {p.batch_reference || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-gray-500">Achat: {p.cost_price?.toLocaleString()} FCFA</span>
                          <span className="font-bold text-emerald-600 text-xs">Vente: {p.price?.toLocaleString()} FCFA</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <input 
                          type="number" 
                          value={p.quantity} 
                          onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} 
                          className="w-16 border border-gray-300 text-center p-1.5 rounded-lg font-black text-gray-900 focus:ring-2 focus:ring-indigo-600 outline-none" 
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <button title="Modifier Produit" onClick={() => handleStartEditProduct(p)} className="text-blue-600 hover:text-blue-800 transition-colors p-1">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            title={p.is_archived ? "Restaurer" : "Archiver"} 
                            onClick={() => handleArchiveProduct(p.id, !p.is_archived)} 
                            className={`${p.is_archived ? "text-emerald-600 hover:text-emerald-800" : "text-gray-400 hover:text-red-600"} transition-colors p-1`}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}