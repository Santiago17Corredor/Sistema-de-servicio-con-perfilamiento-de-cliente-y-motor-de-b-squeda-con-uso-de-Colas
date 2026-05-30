import { useEffect, useRef, useState, useCallback } from "react";
import type { SearchResult } from "../../data/search-service";
import { buscar } from "../../data/search-service";
import { registrarClic } from "../../data/click-queue";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Retardo del debounce en milisegundos. */
const DEBOUNCE_MS = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useDebounce
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el valor con un retardo de `delay` ms.
 * Mientras el usuario siga tecleando, el valor "rebota" sin emitirse.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function SearchBar({
  userId,
  onSuggestionClick,
}: {
  /** ID del usuario activo en sesión. */
  userId: string;
  /**
   * Callback invocado cuando el usuario hace clic en una sugerencia.
   * Recibe el ID del producto seleccionado. El componente padre puede
   * usarlo para forzar un recálculo del ranking.
   */
  onSuggestionClick?: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce: solo buscar cuando el usuario deja de teclear por 300ms
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // ── Llamar al servicio de búsqueda cuando cambia el query debounced ────
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Simula la llamada a GET /api/buscar?q=...&userId=...
    const resultados = buscar(debouncedQuery, userId);
    setResults(resultados);
    setIsOpen(resultados.length > 0);
    setActiveIndex(-1);
  }, [debouncedQuery, userId]);

  // ── Cerrar dropdown al hacer clic fuera ─────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Selección de sugerencia ─────────────────────────────────────────────
  const handleSelect = useCallback(
    (result: SearchResult) => {
      // 1. Registrar el clic en la Cola de historial del usuario (enqueue)
      registrarClic(userId, result.product.id);

      // 2. Notificar al padre (para recálculo de ranking si aplica)
      onSuggestionClick?.(result.product.id);

      // 3. Colocar el nombre en el input y cerrar el dropdown
      setQuery(result.product.name);
      setIsOpen(false);
    },
    [userId, onSuggestionClick],
  );

  // ── Navegación con teclado ──────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            handleSelect(results[activeIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, results, activeIndex, handleSelect],
  );

  // ── Formatear el score para mostrar al usuario ──────────────────────────
  const formatScore = (score: number): string => {
    // Mostrar como porcentaje con 1 decimal
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* ── Input de búsqueda ──────────────────────────────────────────── */}
      <div className="relative">
        {/* Ícono de lupa */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          id="search-input"
          type="text"
          placeholder="Buscar productos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full h-10 pl-10 pr-4 bg-[#f4f4f4] rounded-lg border border-transparent 
                     focus:border-black focus:bg-white outline-none text-black text-sm
                     placeholder:text-[#999] transition-all duration-200"
        />
        {/* Botón para limpiar */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center
                       text-[#999] hover:text-black transition-colors bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Dropdown de sugerencias ────────────────────────────────────── */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e5e5e5] 
                     rounded-lg shadow-lg z-50 overflow-hidden"
          role="listbox"
          id="search-results"
        >
          {/* Encabezado */}
          <div className="px-4 py-2 text-[10px] tracking-widest text-[#999] uppercase border-b border-[#f0f0f0]">
            Recomendaciones para ti — Top {results.length}
          </div>

          {results.map((result, idx) => (
            <button
              key={result.product.id}
              id={`search-result-${result.product.id}`}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3
                         border-b border-[#f0f0f0] last:border-b-0 transition-colors duration-100
                         cursor-pointer bg-transparent border-none
                         ${idx === activeIndex
                           ? "bg-[#f4f4f4]"
                           : "hover:bg-[#fafafa]"
                         }`}
            >
              {/* Miniatura del producto */}
              <div className="w-10 h-10 rounded bg-[#f4f4f4] overflow-hidden flex-shrink-0">
                <img
                  src={result.product.image}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Info del producto */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-black truncate">
                  {result.product.name}
                </div>
                <div className="text-xs text-[#888] truncate">
                  ${result.product.price.toLocaleString()}
                  <span className="ml-2 text-[#bbb]">
                    {result.product.category}
                  </span>
                </div>
              </div>

              {/* Badge de score PageRank */}
              <div
                className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono
                           bg-[#f0f0f0] text-[#666]"
                title="Score de PageRank (relevancia personalizada)"
              >
                π {formatScore(result.score)}
              </div>
            </button>
          ))}

          {/* Footer informativo */}
          <div className="px-4 py-2 text-[10px] text-[#bbb] border-t border-[#f0f0f0] text-center">
            Ordenado por PageRank · Basado en tu historial
          </div>
        </div>
      )}
    </div>
  );
}
