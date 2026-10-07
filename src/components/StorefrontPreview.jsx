import React from 'react';
import { Store as StoreIcon, Store, X, Check, Globe } from 'lucide-react';

export default function StorefrontPreview({
  branches = [],
  storefrontBranch,
  setStorefrontBranch,
  storefrontModalOpen,
  setStorefrontModalOpen,
  storefrontFilteredProducts = [],
  liveStoreBranch,         // Live store state (Can be Name or ID)
  handleUpdateLiveBranch   // Live store update handler
}) {
  // Safe display name for the live store indicator
  const currentLiveName = (() => {
    if (!liveStoreBranch || liveStoreBranch === 'Siège Principal') return 'Siège Principal';
    const match = branches.find(b => String(b.id) === String(liveStoreBranch) || b.name === liveStoreBranch);
    return match ? match.name : liveStoreBranch;
  })();

  const isHQActive = !liveStoreBranch || liveStoreBranch === 'Siège Principal' || liveStoreBranch === '';

  const isBranchActive = (branch) => {
    if (!liveStoreBranch) return false;
    return String(liveStoreBranch) === String(branch.id) || liveStoreBranch === branch.name;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
        <div>
          <h3 className="font-bold text-sm uppercase text-gray-800 flex items-center space-x-2">
            <StoreIcon className="w-4 h-4 text-indigo-600" />
            <span>Storefront Display Catalogue</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Affichage actuel en direct (Public) : <span className="font-bold text-emerald-600">{currentLiveName}</span>
          </p>
        </div>

        <button 
          onClick={() => setStorefrontModalOpen(true)}
          className="bg-zinc-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
        >
          <Store className="w-4 h-4 text-indigo-400" />
          <span>Changer la Succursale Publique</span>
        </button>
      </div>

      {/* PRODUCTS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
        {(!storefrontFilteredProducts || storefrontFilteredProducts.length === 0) ? (
          <div className="col-span-full py-16 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-400 text-xs font-semibold">Aucun produit disponible dans cette succursale pour le moment.</p>
          </div>
        ) : (
          storefrontFilteredProducts.map(p => {
            const assignedBranch = branches.find(b => String(b.id) === String(p.branch_id));
            const branchLabel = assignedBranch ? assignedBranch.name : 'Siège Principal';

            return (
              <div key={p.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2.5 py-1 rounded-full mb-3 block w-fit">
                  {branchLabel}
                </span>
                <img src={p.image_url || 'https://via.placeholder.com/150'} alt={p.name} className="w-full h-40 object-cover rounded-lg mb-4 bg-gray-50" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</h4>
                </div>
                <div className="mt-4 flex justify-between items-end border-t border-gray-100 pt-3">
                  <span className="font-bold text-emerald-600 text-sm">{(p.price || 0).toLocaleString()} FCFA</span>
                  <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md">
                    Qty: {p.quantity ?? 0}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STOREFRONT BRANCH SELECTOR MODAL */}
      {storefrontModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center space-x-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Sélectionner la Succursale Publique</span>
              </h3>
              <button 
                onClick={() => setStorefrontModalOpen(false)} 
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">
                Choisissez quelle succursale ou le siège principal sera affiché en temps réel sur la vitrine publique de vos clients.
              </p>

              {/* Headquarter Option */}
              <div 
                onClick={() => {
                  setStorefrontBranch('');
                  handleUpdateLiveBranch(null, 'Siège Principal');
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  isHQActive ? 'border-emerald-600 bg-emerald-50/40 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div>
                  <h4 className="text-xs font-extrabold text-black uppercase">Siège Principal (HQ Main Stock)</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Par défaut (Stock principal du QG)</p>
                </div>
                {isHQActive && <Check className="w-5 h-5 text-emerald-600" />}
              </div>

              {/* Branch Options */}
              {branches.map(b => {
                const active = isBranchActive(b);

                return (
                  <div 
                    key={b.id}
                    onClick={() => {
                      setStorefrontBranch(b.id);
                      handleUpdateLiveBranch(b.id, b.name);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      active ? 'border-emerald-600 bg-emerald-50/40 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-extrabold text-black uppercase">{b.name}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">{b.location || 'Succursale'}</p>
                    </div>
                    {active && <Check className="w-5 h-5 text-emerald-600" />}
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setStorefrontModalOpen(false)}
                className="bg-black hover:bg-zinc-800 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}