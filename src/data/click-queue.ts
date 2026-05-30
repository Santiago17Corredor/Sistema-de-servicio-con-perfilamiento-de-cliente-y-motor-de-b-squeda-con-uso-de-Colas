/**
 * click-queue.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cola FIFO de historial de clics por usuario.
 *
 * Cada usuario en sesión acumula cronológicamente los IDs de los productos
 * en los que hace clic. La cola tiene un tamaño máximo (MAX_QUEUE_SIZE);
 * cuando se excede, se descarta el clic más antiguo (FIFO).
 *
 * A partir de la cola se construyen:
 *   1. La matriz de transiciones ponderada (frecuencia de pares consecutivos).
 *   2. El predicado hayEnlace(i, j) compatible con pagerank.ts.
 *   3. El vector de personalización v basado en la frecuencia de visita.
 *
 * Persistencia: localStorage bajo la clave `click_queue_<userId>`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/** Número máximo de clics almacenados en la cola por usuario. */
export const MAX_QUEUE_SIZE = 20;

/** Prefijo de la clave de localStorage. */
const STORAGE_KEY_PREFIX = "click_queue_";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Entrada individual en la cola: ID del producto y marca temporal. */
export type ClickEntry = {
  productId: string;
  timestamp: number;
};

/**
 * Mapa de transiciones ponderado.
 *
 * La clave es `"<índiceOrigen>→<índiceDestino>"` y el valor es la
 * frecuencia con la que se observó esa transición en la cola.
 */
export type TransitionMap = Map<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA
// ─────────────────────────────────────────────────────────────────────────────

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Lee la cola de clics del usuario desde localStorage.
 * Retorna un arreglo vacío si no existe o el JSON está corrupto.
 */
export function obtenerCola(userId: string): ClickEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persiste la cola del usuario en localStorage.
 */
function guardarCola(userId: string, cola: ClickEntry[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(cola));
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES SOBRE LA COLA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra un clic en la cola del usuario.
 *
 * - Añade la entrada al final (orden cronológico).
 * - Si la cola excede `MAX_QUEUE_SIZE`, descarta el más antiguo (FIFO).
 * - Persiste inmediatamente en localStorage.
 *
 * @returns La cola actualizada (para posible uso inmediato).
 */
export function registrarClic(userId: string, productId: string): ClickEntry[] {
  const cola = obtenerCola(userId);

  cola.push({ productId, timestamp: Date.now() });

  // FIFO: si excede el tamaño máximo, eliminar el más antiguo
  while (cola.length > MAX_QUEUE_SIZE) {
    cola.shift();
  }

  guardarCola(userId, cola);
  return cola;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL GRAFO DE TRANSICIONES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye un mapa de transiciones ponderado a partir de la cola de clics.
 *
 * Recorre pares consecutivos (cola[k] → cola[k+1]) y acumula la frecuencia
 * de cada arista dirigida. Los índices se resuelven contra `productIds`.
 *
 * @param cola       Cola de clics del usuario.
 * @param productIds Arreglo ordenado de IDs de producto (define el mapeo
 *                   productId → índice de nodo).
 * @returns          Mapa donde la clave es "i→j" y el valor es la frecuencia.
 */
export function construirMapaTransiciones(
  cola: ClickEntry[],
  productIds: string[],
): TransitionMap {
  const transiciones: TransitionMap = new Map();

  // Construir índice inverso: productId → índice numérico
  const idToIndex = new Map<string, number>();
  for (let idx = 0; idx < productIds.length; idx++) {
    idToIndex.set(productIds[idx], idx);
  }

  // Recorrer pares consecutivos
  for (let k = 0; k < cola.length - 1; k++) {
    const iOrigen = idToIndex.get(cola[k].productId);
    const iDestino = idToIndex.get(cola[k + 1].productId);

    // Ignorar si alguno de los productos no está en el catálogo actual
    if (iOrigen === undefined || iDestino === undefined) continue;
    // Ignorar auto-transiciones (clic repetido inmediato en el mismo producto)
    if (iOrigen === iDestino) continue;

    const key = `${iOrigen}→${iDestino}`;
    transiciones.set(key, (transiciones.get(key) ?? 0) + 1);
  }

  return transiciones;
}

/**
 * Construye la matriz de pesos N × N a partir del mapa de transiciones.
 *
 * Cada `pesos[i][j]` contiene la frecuencia de la transición i → j.
 * Si no hay transición, el valor es 0.
 *
 * Esta matriz se pasará a `construirMatrizConectividadPonderada` en
 * pagerank.ts para generar la matriz A ponderada.
 */
export function construirMatrizPesos(
  transiciones: TransitionMap,
  N: number,
): number[][] {
  const pesos: number[][] = Array.from({ length: N }, () => Array(N).fill(0));

  for (const [key, freq] of transiciones) {
    const [iStr, jStr] = key.split("→");
    const i = parseInt(iStr, 10);
    const j = parseInt(jStr, 10);
    pesos[i][j] = freq;
  }

  return pesos;
}

/**
 * Construye el vector de personalización v basado en la frecuencia de
 * visita de cada producto en la cola.
 *
 * v[i] = (veces que aparece el producto i en la cola) / (total de entradas).
 * Se normaliza para que Σ v[i] = 1.
 *
 * Si la cola está vacía, retorna null (pagerank.ts usará v = e/N).
 */
export function construirVectorPersonalizacionDesdeCola(
  cola: ClickEntry[],
  productIds: string[],
): number[] | null {
  if (cola.length === 0) return null;

  const N = productIds.length;
  const v: number[] = new Array(N).fill(0);

  // Construir índice inverso
  const idToIndex = new Map<string, number>();
  for (let idx = 0; idx < productIds.length; idx++) {
    idToIndex.set(productIds[idx], idx);
  }

  // Contar frecuencia de cada producto en la cola
  let totalContadas = 0;
  for (const entry of cola) {
    const idx = idToIndex.get(entry.productId);
    if (idx !== undefined) {
      v[idx] += 1;
      totalContadas++;
    }
  }

  if (totalContadas === 0) return null;

  // Normalizar: Σ v[i] = 1
  for (let i = 0; i < N; i++) {
    v[i] /= totalContadas;
  }

  return v;
}
