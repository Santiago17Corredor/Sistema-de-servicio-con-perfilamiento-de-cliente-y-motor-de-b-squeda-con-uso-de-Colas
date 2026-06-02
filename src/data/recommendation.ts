/// <reference types="vite/client" />
import { Product } from "../app/components/product-card";
import { calcularPageRankPonderado, Vector } from "./pagerank";
import {
  obtenerCola,
  construirMapaTransiciones,
  construirMatrizPesos,
  construirVectorPersonalizacionDesdeCola,
} from "./click-queue";

// ─────────────────────────────────────────────────────────────────────────────
// Adaptador: traduce el dominio "productos + historial de clics del usuario"
// al lenguaje del PDF (N nodos, matriz de pesos, vector de personalización v)
// y delega todo el cálculo matemático a pagerank.ts.
//
// Este módulo construye el grafo de transiciones a partir de la Cola de clics
// del usuario activo (click-queue.ts). Las aristas representan transiciones
// secuenciales reales del usuario, y sus pesos reflejan la frecuencia de
// repetición de cada transición.
//
// Home.tsx interactúa con él a través de una única función:
//
//   - getRecommendations(products, userId): calcula el orden actual
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Devuelve los productos ordenados según el vector PageRank, calculado
 * a partir del historial de clics (Cola FIFO) del usuario en sesión.
 *
 * Modelado del problema:
 *
 *   - Cada producto es un nodo del grafo (N nodos).
 *   - Las aristas dirigidas se generan a partir de la Cola de clics:
 *     si el usuario pasó del Producto A al Producto B (clic consecutivo),
 *     se crea una arista dirigida A → B.
 *   - El peso de cada arista es la frecuencia de esa transición dentro
 *     de la Cola (si A → B ocurrió 3 veces, el peso es 3).
 *   - El vector de personalización v se construye a partir de la frecuencia
 *     de visita de cada producto en la Cola (cuántas veces aparece →
 *     proporción normalizada para Σ v[i] = 1).
 *
 * Si la Cola está vacía (usuario nuevo sin historial), el PageRank se
 * calcula con v = e/N (distribución uniforme) y sin aristas, lo que
 * produce un ranking uniforme (todos los productos con la misma
 * probabilidad), equivalente al comportamiento por defecto del PDF.
 *
 * El cálculo del PageRank se delega completamente a pagerank.ts mediante
 * la función `calcularPageRankPonderado`.
 *
 * @param products Lista completa de productos del catálogo.
 * @param userId   ID del usuario actualmente en sesión.
 * @returns        Productos ordenados por π descendente.
 */
export function getRecommendations(
  products: Product[],
  userId: string,
): {
  productosVenta: Product[];
  anuncios: Product[];
} {
  const N = products.length;

  // Obtener la cola de clics del usuario
  const cola = obtenerCola(userId);

  // IDs de productos en el orden del catálogo (define el mapeo índice ↔ nodo)
  const productIds = products.map((p) => p.id);

  // Construir la matriz de pesos a partir de las transiciones de la cola
  const transiciones = construirMapaTransiciones(cola, productIds);
  const pesos = construirMatrizPesos(transiciones, N);

  // Vector de personalización basado en frecuencia de visita en la cola
  const v: Vector | null = construirVectorPersonalizacionDesdeCola(
    cola,
    productIds,
  );

  // Cálculo del PageRank ponderado (si v es null, usa v = e/N)
  const pi = calcularPageRankPonderado(N, pesos, v ?? undefined);

  // Ordenar productos por π descendente
  const indices = products.map((_, i) => i);
  indices.sort((a, b) => pi[b] - pi[a]);

  const sortedProducts = indices.map((i) => products[i]);

  // Filtrar en dos listas distintas manteniendo el orden de relevancia
  const productosVenta = sortedProducts.filter((p) => !p.esAd);
  const anuncios = sortedProducts.filter((p) => p.esAd);

  return { productosVenta, anuncios };
}