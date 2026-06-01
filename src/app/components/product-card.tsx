import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  esAd: boolean;
};

export function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  // Algorithm integration point: called when user selects a product
  onClick?: (product: Product) => void;
}) {
  const [pulse, setPulse] = useState(false);

  const handleClick = () => {
    if (pulse) return;

    // Dispara la lógica inmediatamente para mejor respuesta
    onClick?.(product);

    // Activa el efecto visual
    setPulse(true);
    setTimeout(() => {
      setPulse(false);
    }, 400); // 400ms permite que la transición termine suavemente
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex flex-col gap-3 rounded-xl cursor-pointer bg-white relative
        transition-all duration-300 ease-out border
        ${product.esAd
          ? "border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)] bg-gradient-to-b from-amber-500/[0.015] to-white hover:border-amber-500/80 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)]"
          : "border-transparent shadow-sm hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]"
        }
        ${pulse
          ? "scale-[0.999999999] shadow-[0_0_20px_15px rgba(0,0,0,0.12)]" // Efecto "boom": se encoge y la sombra se expande desvaneciéndose
          : "scale-100 hover:scale-[1.03]"
        }
      `}
    >
      <div className="aspect-square w-full bg-[#f4f4f4] overflow-hidden rounded-t-xl relative">
        {product.esAd && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white rounded text-[9px] font-bold tracking-wider uppercase shadow-sm select-none">
            Patrocinado
          </div>
        )}
        <ImageWithFallback
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex flex-col gap-1 px-3 pb-3">
        <div className="font-bold text-black">{product.name}</div>
        <div className="text-[#888] text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
          {product.description}
        </div>
        <div className="text-black mt-1 font-semibold">${product.price.toLocaleString()}</div>

        {/* Botón decorativo de compra — solo visual, sin lógica real */}
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5
                     bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white text-sm font-medium
                     rounded-lg border-none cursor-pointer
                     transition-all duration-200 ease-out
                     hover:from-[#0f3460] hover:to-[#533483]
                     hover:scale-[1.03] hover:shadow-[0_4px_15px_rgba(83,52,131,0.4)]
                     active:scale-[0.97]"
        >
          {/* Icono de carrito SVG */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          Añadir al carrito
        </button>
      </div>
    </div>
  );
}
