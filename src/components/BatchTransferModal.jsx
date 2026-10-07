import React from 'react';
import { X, ArrowRightLeft, CheckCircle2, AlertCircle, ArrowRight, PackageCheck, Building2 } from 'lucide-react';

export default function BatchTransferModal({
  batchTransferOpen,
  setBatchTransferOpen,
  batchTransferStep,
  setBatchTransferStep,
  batchTransferError,
  hqProductsForTransfer = [],
  selectedBatchItems = {},
  handleToggleBatchItemSelect,
  handleUpdateBatchItemDetail,
  branches = [],
  activeSelectedArray = [],
  handleProceedToBatchReview,
  handleConfirmBatchTransfer,
  batchTransferLoading
}) {
  if (!batchTransferOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col justify-between space-y-4">
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase">
                {batchTransferStep === 'select' ? '1. Sélection du Stock QG à Transférer' : '2. Validation & Dispatching des Reçus'}
              </h3>
              <p className="text-xs text-gray-500">
                {batchTransferStep === 'select' 
                  ? 'Cochez les articles du dépôt central et indiquez leurs destinations' 
                  : 'Vérifiez les volumes attribués à chaque succursale avant exécution'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setBatchTransferOpen(false)}
            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR BANNER */}
        {batchTransferError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{batchTransferError}</span>
          </div>
        )}

        {/* STEP 1: ITEM SELECTION & BRANCH ASSIGNMENT */}
        {batchTransferStep === 'select' && (
          <div className="overflow-y-auto flex-1 pr-1 space-y-3">
            {hqProductsForTransfer.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-bold text-sm">Aucun stock disponible au QG Principal</p>
                <p className="text-xs text-gray-400 mt-1">Saisissez d'abord du stock central avant de procéder à un transfert.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {hqProductsForTransfer.map(prod => {
                  const itemState = selectedBatchItems[prod.id] || {};
                  const isSelected = !!itemState.selected;

                  return (
                    <div 
                      key={prod.id} 
                      className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${isSelected ? 'bg-indigo-50/40' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={() => handleToggleBatchItemSelect(prod)}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => {}} 
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <img src={prod.image_url || '/placeholder.png'} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                        <div>
                          <p className="font-bold text-xs text-gray-900">{prod.name}</p>
                          <span className="text-[10px] text-gray-500 font-mono uppercase">Lot: {prod.batch_reference || 'N/A'} | Dispo QG: <strong className="text-indigo-700">{prod.quantity}</strong></span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Quantité</span>
                            <input 
                              type="number" 
                              min="1" 
                              max={prod.quantity}
                              value={itemState.qty || 1}
                              onChange={(e) => handleUpdateBatchItemDetail(prod.id, 'qty', parseInt(e.target.value) || 1)}
                              className="w-16 border border-gray-300 rounded p-1 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Succursale Destination</span>
                            <select 
                              value={itemState.targetBranch || ''}
                              onChange={(e) => handleUpdateBatchItemDetail(prod.id, 'targetBranch', e.target.value)}
                              className="border border-gray-300 rounded p-1 text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="" disabled>Sélectionner...</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: REVIEW & CONFIRMATION */}
        {batchTransferStep === 'review' && (
          <div className="overflow-y-auto flex-1 pr-1 space-y-3">
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-900 font-medium">
              Veuillez valider le récapitulatif ci-dessous. Le stock central du QG sera débité immédiatement et crédité sur les comptes succursales cibles.
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Produit</th>
                    <th className="p-3">Lot</th>
                    <th className="p-3 text-center">Quantité Transférée</th>
                    <th className="p-3">Succursale Cible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSelectedArray.map(({ product, qty, targetBranch }) => {
                    const branchObj = branches.find(b => b.id === targetBranch);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-900">{product.name}</td>
                        <td className="p-3 font-mono text-gray-500 uppercase">{product.batch_reference || 'N/A'}</td>
                        <td className="p-3 text-center font-black text-indigo-600">{qty} unit(s)</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            🏪 {branchObj?.name || 'Succursale Cible'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500">
            {activeSelectedArray.length} article(s) sélectionné(s)
          </span>

          <div className="flex gap-2">
            {batchTransferStep === 'review' && (
              <button 
                onClick={() => setBatchTransferStep('select')}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Retour
              </button>
            )}

            {batchTransferStep === 'select' ? (
              <button 
                onClick={handleProceedToBatchReview}
                disabled={activeSelectedArray.length === 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all"
              >
                <span>Vérifier le Transfert</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={handleConfirmBatchTransfer}
                disabled={batchTransferLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{batchTransferLoading ? 'Mise à jour en cours...' : 'Confirmer & Exécuter'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}