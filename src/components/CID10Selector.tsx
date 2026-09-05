import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, X, Check, Loader2, Plus, Trash2, Edit3, BookOpen, AlertCircle } from 'lucide-react';
import { CID10Record, CID10Snapshot } from '../types/cid10';
import { searchCID10, getCID10ByCode } from '../lib/cid10Store';

interface CID10SelectorProps {
  primaryCid?: string;
  primaryCidDescription?: string;
  secondaryCids?: CID10Snapshot[];
  onChange: (data: {
    cid: string; // Para compatibilidade reversa
    cidCode: string;
    cidDescription: string;
    cidFull: string;
    cidSource: string;
    cidVersion: string;
    secondaryCids: CID10Snapshot[];
    secondaryCid: string; // String concatenada para compatibilidade
  }) => void;
}

export const CID10Selector: React.FC<CID10SelectorProps> = ({
  primaryCid = '',
  primaryCidDescription = '',
  secondaryCids = [],
  onChange
}) => {
  const searchInputId = useId();
  // Estado do CID principal
  const [selectedPrimary, setSelectedPrimary] = useState<CID10Snapshot | null>(() => {
    if (primaryCid) {
      return {
        code: primaryCid,
        description: primaryCidDescription || '',
        source: 'CID-10 Brasil / DATASUS',
        version: '2008'
      };
    }
    return null;
  });

  // Lista de CIDs secundários
  const [selectedSecondaries, setSelectedSecondaries] = useState<CID10Snapshot[]>(secondaryCids);

  // Estados de busca do CID principal
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CID10Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [hasSearched, setHasSearched] = useState(false);

  // Estados para adição de CID secundário
  const [isAddingSecondary, setIsAddingSecondary] = useState(false);
  const [secQuery, setSecQuery] = useState('');
  const [secResults, setSecResults] = useState<CID10Record[]>([]);
  const [secLoading, setSecLoading] = useState(false);
  const [secIsOpen, setSecIsOpen] = useState(false);
  const [secSelectedIndex, setSecSelectedIndex] = useState<number>(-1);
  const [secHasSearched, setSecHasSearched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const secContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza se o prop mudar externamente (ex: duplicação de solicitação ou carga inicial)
  useEffect(() => {
    if (primaryCid && (!selectedPrimary || selectedPrimary.code !== primaryCid)) {
      if (primaryCidDescription) {
        setSelectedPrimary({
          code: primaryCid,
          description: primaryCidDescription,
          source: 'CID-10 Brasil / DATASUS',
          version: '2008'
        });
      } else {
        getCID10ByCode(primaryCid).then(rec => {
          setSelectedPrimary({
            code: primaryCid,
            description: rec ? rec.description : '',
            source: 'CID-10 Brasil / DATASUS',
            version: '2008'
          });
        });
      }
    } else if (!primaryCid && selectedPrimary) {
      setSelectedPrimary(null);
    }
  }, [primaryCid, primaryCidDescription]);

  useEffect(() => {
    setSelectedSecondaries(secondaryCids);
  }, [secondaryCids]);

  // Propagação de mudanças para o componente pai com snapshots completos
  const emitChanges = (prim: CID10Snapshot | null, secs: CID10Snapshot[]) => {
    const cidCode = prim ? prim.code : '';
    const cidDescription = prim ? prim.description : '';
    const cidFull = prim && prim.code && prim.description ? `${prim.code} - ${prim.description}` : cidCode;
    const cidSource = prim ? prim.source : 'CID-10 Brasil / DATASUS';
    const cidVersion = prim ? prim.version : '2008';
    const secondaryCid = secs.map(s => `${s.code} - ${s.description}`).join('; ');

    onChange({
      cid: cidCode,
      cidCode,
      cidDescription,
      cidFull,
      cidSource,
      cidVersion,
      secondaryCids: secs,
      secondaryCid
    });
  };

  // Busca do CID Principal com Debounce de 200ms
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const found = await searchCID10(trimmed, 15);
        setResults(found);
        setIsOpen(true);
        setSelectedIndex(-1);
        setHasSearched(true);
      } catch (err) {
        console.error('Erro na pesquisa CID-10:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  // Busca de CIDs Secundários com Debounce de 200ms
  useEffect(() => {
    if (secDebounceTimerRef.current) clearTimeout(secDebounceTimerRef.current);

    const trimmed = secQuery.trim();
    if (!trimmed) {
      setSecResults([]);
      setSecLoading(false);
      setSecIsOpen(false);
      setSecHasSearched(false);
      return;
    }

    setSecLoading(true);
    secDebounceTimerRef.current = setTimeout(async () => {
      try {
        const found = await searchCID10(trimmed, 15);
        setSecResults(found);
        setSecIsOpen(true);
        setSecSelectedIndex(-1);
        setSecHasSearched(true);
      } catch (err) {
        console.error('Erro na pesquisa CID secundário:', err);
        setSecResults([]);
      } finally {
        setSecLoading(false);
      }
    }, 200);

    return () => {
      if (secDebounceTimerRef.current) clearTimeout(secDebounceTimerRef.current);
    };
  }, [secQuery]);

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (secContainerRef.current && !secContainerRef.current.contains(e.target as Node)) {
        setSecIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPrimary = (record: CID10Record) => {
    const snapshot: CID10Snapshot = {
      code: record.code,
      description: record.description,
      source: record.source || 'CID-10 Brasil / DATASUS',
      version: record.version || '2008'
    };
    setSelectedPrimary(snapshot);
    setQuery('');
    setIsOpen(false);
    emitChanges(snapshot, selectedSecondaries);
  };

  const handleClearPrimary = () => {
    setSelectedPrimary(null);
    setQuery('');
    emitChanges(null, selectedSecondaries);
  };

  const handleAddSecondary = (record: CID10Record) => {
    if (selectedSecondaries.some(s => s.code === record.code)) {
      setIsAddingSecondary(false);
      setSecQuery('');
      setSecIsOpen(false);
      return;
    }

    const snapshot: CID10Snapshot = {
      code: record.code,
      description: record.description,
      source: record.source || 'CID-10 Brasil / DATASUS',
      version: record.version || '2008'
    };

    const nextSecs = [...selectedSecondaries, snapshot];
    setSelectedSecondaries(nextSecs);
    setIsAddingSecondary(false);
    setSecQuery('');
    setSecIsOpen(false);
    emitChanges(selectedPrimary, nextSecs);
  };

  const handleRemoveSecondary = (code: string) => {
    const nextSecs = selectedSecondaries.filter(s => s.code !== code);
    setSelectedSecondaries(nextSecs);
    emitChanges(selectedPrimary, nextSecs);
  };

  // Teclado no input principal
  const handleKeyDownPrimary = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectPrimary(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectPrimary(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Teclado no input secundário
  const handleKeyDownSecondary = (e: React.KeyboardEvent) => {
    if (!secIsOpen || secResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSecSelectedIndex(prev => (prev < secResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSecSelectedIndex(prev => (prev > 0 ? prev - 1 : secResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (secSelectedIndex >= 0 && secSelectedIndex < secResults.length) {
        handleAddSecondary(secResults[secSelectedIndex]);
      } else if (secResults.length > 0) {
        handleAddSecondary(secResults[0]);
      }
    } else if (e.key === 'Escape') {
      setSecIsOpen(false);
      setIsAddingSecondary(false);
    }
  };

  return (
    <div className="space-y-4" id="cid10-selector-container">
      {/* SEÇÃO CID PRINCIPAL */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={searchInputId} className="block text-[12px] font-semibold text-[#475569] flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#1E5FA6]" />
            CID-10 Principal <span className="text-[#DC2626]">*</span>
          </label>
          <span className="text-[11px] text-[#94A3B8] font-medium">Base Oficial DATASUS</span>
        </div>

        {selectedPrimary ? (
          // CARD DO CID PRINCIPAL SELECIONADO
          <div
            id="cid10-primary-selected-card"
            className="p-3 bg-[#EFF6FF]/70 border border-[#BFDBFE] rounded-[8px] flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono font-bold text-[12px] bg-[#1E5FA6] text-white tracking-wide">
                  {selectedPrimary.code}
                </span>
                <span className="text-[11px] font-medium text-[#1E5FA6] bg-[#EFF6FF] border border-[#BFDBFE]/60 px-1.5 py-0.5 rounded-[4px]">
                  {selectedPrimary.source} ({selectedPrimary.version})
                </span>
              </div>
              <p className="text-[13px] font-semibold text-[#0F172A] leading-snug break-words">
                {selectedPrimary.description}
              </p>
            </div>
            <button
              type="button"
              id="cid10-primary-edit-btn"
              onClick={handleClearPrimary}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-[#1E5FA6] hover:bg-white rounded-[6px] transition-colors shrink-0 border border-[#BFDBFE]/60"
              title="Alterar CID Principal"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Alterar
            </button>
          </div>
        ) : (
          // CAMPO DE BUSCA AUTOCOMPLETE DO CID PRINCIPAL
          <div ref={containerRef} className="relative">
            <div className="relative">
              <input
                id={searchInputId}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => {
                  if (results.length > 0) setIsOpen(true);
                }}
                onKeyDown={handleKeyDownPrimary}
                placeholder="Pesquisar código ou diagnóstico (ex: M17.1, gonartrose, hérnia)..."
                autoComplete="off"
                className="w-full h-[38px] pl-9 pr-9 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] bg-white border border-[#E2E8F0] rounded-[8px] focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none transition-all"
              />
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
              {loading && (
                <Loader2 className="w-4 h-4 text-[#1E5FA6] animate-spin absolute right-3 top-2.5" />
              )}
              {!loading && query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#475569]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* LISTA SUSPENSA DE RESULTADOS */}
            {isOpen && (
              <div
                id="cid10-search-results-dropdown"
                className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-[#E2E8F0] rounded-[8px] shadow-[0_4px_12px_rgba(15,23,42,0.08)] divide-y divide-[#E2E8F0]/60 p-1"
              >
                {results.length > 0 ? (
                  results.map((record, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={record.code}
                        id={`cid10-result-${record.code.replace('.', '_')}`}
                        onClick={() => handleSelectPrimary(record)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`p-2.5 cursor-pointer rounded-[6px] transition-colors text-left ${
                          isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`font-mono font-bold text-[13px] ${isSelected ? 'text-[#1E5FA6]' : 'text-[#0F172A]'}`}>
                            {record.code}
                          </span>
                          {record.abbreviation && (
                            <span className="text-[11px] text-[#94A3B8] font-mono">
                              {record.abbreviation}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#475569] leading-snug">
                          {record.description}
                        </p>
                      </div>
                    );
                  })
                ) : hasSearched && !loading ? (
                  <div className="p-4 text-center text-[13px] text-[#475569] flex flex-col items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-[#94A3B8]" />
                    <span>Nenhum CID encontrado para o termo pesquisado.</span>
                    <span className="text-[11px] text-[#94A3B8]">Tente código como M17 ou descrição clínica.</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEÇÃO CIDS SECUNDÁRIOS */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[12px] font-semibold text-[#475569]">
            CIDs Secundários (Opcional)
          </label>
          {!isAddingSecondary && (
            <button
              type="button"
              id="cid10-add-secondary-btn"
              onClick={() => {
                setIsAddingSecondary(true);
                setSecQuery('');
              }}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1E5FA6] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar CID Secundário
            </button>
          )}
        </div>

        {/* LISTA DE CIDS SECUNDÁRIOS SELECIONADOS */}
        {selectedSecondaries.length > 0 && (
          <div className="space-y-1.5 mb-2" id="cid10-secondaries-list">
            {selectedSecondaries.map((sec, idx) => (
              <div
                key={sec.code}
                id={`cid10-secondary-item-${sec.code.replace('.', '_')}`}
                className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex items-center justify-between gap-3 text-[12px]"
              >
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <span className="font-mono font-bold text-[12px] text-[#0F172A] bg-[#F1F5F9] px-1.5 py-0.5 rounded-[4px] shrink-0">
                    {sec.code}
                  </span>
                  <span className="text-[#475569] truncate">
                    {sec.description}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSecondary(idx)}
                  className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded-[4px] hover:bg-[#FEE2E2]/50 transition-colors"
                  title="Remover CID Secundário"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* FORMULÁRIO DE ADIÇÃO DE CID SECUNDÁRIO */}
        {isAddingSecondary && (
          <div ref={secContainerRef} className="relative mt-2">
            <div className="relative">
              <input
                type="text"
                value={secQuery}
                onChange={e => setSecQuery(e.target.value)}
                onKeyDown={handleKeyDownSecondary}
                placeholder="Pesquisar CID secundário por código ou descrição..."
                autoComplete="off"
                autoFocus
                className="w-full h-[38px] pl-9 pr-16 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] bg-white border border-[#E2E8F0] rounded-[8px] focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none"
              />
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
              <div className="absolute right-2 top-1.5 flex items-center gap-1">
                {secLoading && (
                  <Loader2 className="w-4 h-4 text-[#1E5FA6] animate-spin mr-1" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSecondary(false);
                    setSecQuery('');
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9] rounded-[4px]"
                >
                  Cancelar
                </button>
              </div>
            </div>

            {/* DROPDOWN SECUNDÁRIO */}
            {secIsOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#E2E8F0] rounded-[8px] shadow-[0_4px_12px_rgba(15,23,42,0.08)] divide-y divide-[#E2E8F0]/60 p-1">
                {secResults.length > 0 ? (
                  secResults.map((record, idx) => {
                    const isSelected = idx === secSelectedIndex;
                    return (
                      <div
                        key={record.code}
                        onClick={() => handleAddSecondary(record)}
                        onMouseEnter={() => setSecSelectedIndex(idx)}
                        className={`p-2 cursor-pointer rounded-[6px] transition-colors text-left ${
                          isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`font-mono font-bold text-[12px] ${isSelected ? 'text-[#1E5FA6]' : 'text-[#0F172A]'}`}>
                            {record.code}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#475569] leading-snug">
                          {record.description}
                        </p>
                      </div>
                    );
                  })
                ) : secHasSearched && !secLoading ? (
                  <div className="p-3 text-center text-[12px] text-[#94A3B8]">
                    Nenhum resultado encontrado.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
