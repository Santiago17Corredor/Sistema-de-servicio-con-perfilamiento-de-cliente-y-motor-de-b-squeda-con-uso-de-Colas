import { useMemo, useState, useCallback, useRef } from "react";
import { ProductCard } from "./product-card";
import type { Product } from "./product-card";
import { SearchBar } from "./search-bar";
import { getRecommendations } from "../../data/recommendation";
import { registrarClic } from "../../data/click-queue";
import { PRODUCTS } from "../../data/products";

/** Recalcular el ranking cada N clics (no en cada uno). */
const RECALC_EVERY = 3;

export function Home({ userId, onLogout }: { userId: string; onLogout: () => void }) {
  // ── Contador de clics para forzar recálculo ────────────────────────────
  const [clickVersion, setClickVersion] = useState(0);
  const clicksSinceRecalc = useRef(0);

  /** Incrementa el contador de clics y recalcula cada RECALC_EVERY. */
  const bumpRecalc = useCallback(() => {
    clicksSinceRecalc.current += 1;
    if (clicksSinceRecalc.current >= RECALC_EVERY) {
      clicksSinceRecalc.current = 0;
      setClickVersion((v) => v + 1);
    }
  }, []);

  // ── Cálculo de PageRank ──────────────────────────────────────────────────
  // Se recalcula cuando cambia userId o cada RECALC_EVERY clics.
  const recommended = useMemo<Product[]>(() => {
    return getRecommendations(PRODUCTS, userId);
  }, [userId, clickVersion]);

  // ── Handler de clic en ProductCard ─────────────────────────────────────
  // Registra SIEMPRE en la Cola, pero solo recalcula el ranking cada
  // RECALC_EVERY clics para que el reordenamiento se sienta natural.
  const onProductClick = useCallback(
    (product: Product) => {
      registrarClic(userId, product.id);
      bumpRecalc();
    },
    [userId, bumpRecalc],
  );

  // ── Handler de clic en sugerencia de búsqueda ──────────────────────────
  // La SearchBar ya registra el clic en la Cola internamente; aquí solo
  // necesitamos contabilizarlo para el recálculo del grid.
  const onSuggestionClick = useCallback(
    (_productId: string) => {
      bumpRecalc();
    },
    [bumpRecalc],
  );

  return (
    <div className="min-h-screen w-full bg-white">
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#e5e5e5] z-40 flex items-center justify-between px-8">
        <div className="tracking-widest text-black">BRAND</div>
        <SearchBar userId={userId} onSuggestionClick={onSuggestionClick} />
        <button
          onClick={onLogout}
          className="tracking-widest text-black bg-transparent border-none cursor-pointer text-sm hover:opacity-60 transition-opacity"
        >
          SIGN OUT
        </button>
      </nav>

      <main className="pt-24 pb-16 px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {recommended.map((p) => (
            <ProductCard key={p.id} product={p} onClick={onProductClick} />
          ))}
        </div>
      </main>
    </div>
  );
}