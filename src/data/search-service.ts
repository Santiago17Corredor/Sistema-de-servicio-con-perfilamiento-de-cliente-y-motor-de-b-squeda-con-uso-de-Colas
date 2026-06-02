/**
 * search-service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de servicio / controlador de búsqueda.
 *
 * Simula el endpoint  GET /api/buscar?q=...&userId=...
 * en una arquitectura SPA sin servidor. Encapsula toda la lógica de negocio:
 *
 *   1. Filtrar productos por coincidencia parcial del texto `q` en el nombre
 *      (case-insensitive).
 *   2. Obtener el vector PageRank π del usuario activo (calculado a partir
 *      de su Cola de clics).
 *   3. Mapear los scores de PageRank a los productos filtrados.
 *   4. Ordenar por score descendente y devolver los primeros `limit` resultados.
 *
 * pagerank.ts NO se modifica: se consume vía `calcularPageRankPonderado`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Product } from "../app/components/product-card";
import { calcularPageRankPonderado, type Vector } from "./pagerank";
import {
  obtenerCola,
  construirMapaTransiciones,
  construirMatrizPesos,
  construirVectorPersonalizacionDesdeCola,
} from "./click-queue";
import { PRODUCTS } from "./products";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE RESPUESTA
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado individual de búsqueda con su score de PageRank. */
export type SearchResult = {
  product: Product;
  /** Score normalizado de PageRank (π[i]) para este producto. */
  score: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/** Número máximo de resultados a devolver. */
const DEFAULT_LIMIT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// CACHÉ del vector PageRank para evitar recálculos innecesarios durante
// la misma ráfaga de tipeo (el debounce del frontend ya limita las llamadas,
// pero esto añade una capa extra de eficiencia).
// ─────────────────────────────────────────────────────────────────────────────

let cachedUserId: string | null = null;
let cachedPi: Vector | null = null;
let cachedColaLength = -1;
let cachedLastTimestamp = 0;

/**
 * Obtiene (o recalcula si es necesario) el vector PageRank del usuario.
 * Se invalida la caché cuando cambia el userId, la longitud de la cola o
 * el timestamp del último clic (lo que indica nuevos clics incluso si
 * la cola FIFO ya está llena en su capacidad máxima).
 */
function obtenerPageRankUsuario(userId: string): Vector {
  const cola = obtenerCola(userId);
  const colaLen = cola.length;
  const lastTimestamp = colaLen > 0 ? cola[colaLen - 1].timestamp : 0;

  // Usar caché si es válida
  if (
    cachedPi &&
    cachedUserId === userId &&
    cachedColaLength === colaLen &&
    cachedLastTimestamp === lastTimestamp
  ) {
    return cachedPi;
  }

  const N = PRODUCTS.length;
  const productIds = PRODUCTS.map((p) => p.id);

  // Construir la matriz de transiciones ponderada
  const transiciones = construirMapaTransiciones(cola, productIds);
  const pesos = construirMatrizPesos(transiciones, N);

  // Vector de personalización basado en frecuencia de visita
  const v: Vector | null = construirVectorPersonalizacionDesdeCola(
    cola,
    productIds,
  );

  // Calcular PageRank (si v es null, pagerank.ts usa v = e/N)
  const pi = calcularPageRankPonderado(N, pesos, v ?? undefined);

  // Actualizar caché
  cachedUserId = userId;
  cachedPi = pi;
  cachedColaLength = colaLen;
  cachedLastTimestamp = lastTimestamp;

  return pi;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT PRINCIPAL — GET /api/buscar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca productos por coincidencia parcial en el nombre, ordena los
 * resultados por su score de PageRank del usuario activo, y devuelve
 * los `limit` primeros.
 *
 * Equivale al controlador:
 *   GET /api/buscar?q=<texto>&userId=<userId>&limit=5
 *
 * @param q      Texto de búsqueda (se busca coincidencia parcial,
 *               case-insensitive, en el nombre del producto).
 * @param userId ID del usuario en sesión.
 * @param limit  Número máximo de resultados (por defecto 5).
 * @returns      Array de SearchResult ordenado por score descendente.
 */
export function buscar(
  q: string,
  userId: string,
  limit: number = DEFAULT_LIMIT,
): SearchResult[] {
  const query = q.trim().toLowerCase();

  // Sin texto → sin resultados (no mostrar sugerencias vacías)
  if (!query) return [];

  // 1. Filtrar por coincidencia parcial en el nombre (case-insensitive)
  const filtrados: { product: Product; index: number }[] = [];
  for (let i = 0; i < PRODUCTS.length; i++) {
    if (PRODUCTS[i].name.toLowerCase().includes(query)) {
      filtrados.push({ product: PRODUCTS[i], index: i });
    }
  }

  // Sin coincidencias → resultado vacío
  if (filtrados.length === 0) return [];

  // 2. Obtener el vector PageRank del usuario
  const pi = obtenerPageRankUsuario(userId);

  // 3. Mapear scores de PageRank a los productos filtrados
  const resultados: SearchResult[] = filtrados.map(({ product, index }) => ({
    product,
    score: pi[index],
  }));

  // 4. Ordenar por score descendente (mayor relevancia primero)
  resultados.sort((a, b) => b.score - a.score);

  // 5. Devolver los primeros `limit`
  return resultados.slice(0, limit);
}
