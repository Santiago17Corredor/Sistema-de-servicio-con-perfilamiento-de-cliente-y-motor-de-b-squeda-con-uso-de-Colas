/**
 * pagerank.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Implementación del algoritmo PageRank según la tesis:
 *
 *   "Cadenas de Markov aplicadas al ordenamiento de páginas web"
 *   Torres González, María Guadalupe (BUAP, 2016)
 *   Director: Dr. Vázquez Guevara Víctor Hugo
 *
 * Este archivo contiene ÚNICAMENTE la lógica matemática del algoritmo,
 * aislada del resto del sistema. Cada función se corresponde con un paso
 * del Capítulo 3 ("PageRank y Cadenas de Markov") y del Apéndice A
 * ("Cálculo del vector PageRank") de la tesis.
 *
 * Notación preservada del PDF:
 *   A  : matriz de conectividad (binaria)
 *   P̄  : matriz de transición estocástica (P_barra)
 *   E  : matriz de perturbación, E = v · eᵀ
 *   Q  : matriz de Google,       Q = α·P̄ + (1−α)·E
 *   v  : vector de personalización (distribución de probabilidad)
 *   e  : vector fila de unos
 *   π  : vector PageRank (distribución estacionaria)
 *   α  : factor de amortiguamiento (damping factor)
 *   N  : número de páginas (orden de las matrices)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type Matrix = number[][];
export type Vector = number[];


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES POR DEFECTO (Capítulo 3, pág. 30)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factor de amortiguamiento α = 0.85, valor original de Brin y Page.
 * Citado textualmente en la tesis (Cap. 3, pág. 30):
 *   "se suele tomar α = 0.85, ya que fue el que usaron originalmente
 *    Brin y Page".
 */
const ALPHA_DEFAULT = 0.85;

/** Tolerancia de convergencia del método de potencias. */
const EPSILON_DEFAULT = 1e-9;

/** Número máximo de iteraciones del método de potencias. */
const MAX_ITER_DEFAULT = 1000;


// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — MATRIZ DE CONECTIVIDAD  A
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye la matriz de conectividad A de orden N.
 *
 * Definición (Cap. 3, pág. 28):
 *
 *     A[i][j] = 1   si hay enlace de la página i a la página j,  con i ≠ j
 *     A[i][j] = 0   en otro caso
 *
 * @param N         Número de páginas (orden de la matriz).
 * @param hayEnlace Predicado (i, j) → boolean que define el grafo dirigido.
 * @returns         Matriz A de tamaño N × N con entradas en {0, 1}.
 */
export function construirMatrizConectividad(
    N: number,
    hayEnlace: (i: number, j: number) => boolean,
): Matrix {
    const A: Matrix = Array.from({ length: N }, () => Array(N).fill(0));

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (i !== j && hayEnlace(i, j)) {
                A[i][j] = 1;
            }
        }
    }

    return A;
}


/**
 * Construye una matriz de conectividad A ponderada de orden N.
 *
 * A diferencia de `construirMatrizConectividad` (binaria), aquí
 * A[i][j] puede tomar cualquier valor real ≥ 0, representando el
 * peso o frecuencia de la transición de i a j.
 *
 * La diagonal siempre se fuerza a 0 (no hay auto-enlaces).
 *
 * Nota: `hacerEstocastica` normaliza cada fila dividiendo por la
 * suma O_i, de modo que pesos mayores se traducen en probabilidades
 * de transición proporcionalmente mayores.
 *
 * @param N     Número de nodos.
 * @param pesos Matriz N × N de pesos (frecuencias de transición).
 * @returns     Matriz A ponderada de tamaño N × N.
 */
export function construirMatrizConectividadPonderada(
    N: number,
    pesos: number[][],
): Matrix {
    const A: Matrix = Array.from({ length: N }, () => Array(N).fill(0));

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (i !== j) {
                A[i][j] = pesos[i][j];
            }
        }
    }

    return A;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — MATRIZ ESTOCÁSTICA  P̄  (manejo de nodos colgantes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte la matriz de conectividad A en la matriz estocástica P̄.
 *
 * Procedimiento (Cap. 3, pág. 29):
 *
 *   1. Si la fila i tiene suma O_i ≠ 0, se divide cada entrada por O_i:
 *
 *         P̄[i][j] = A[i][j] / O_i
 *
 *   2. Si la fila i es nula (nodo colgante, O_i = 0), se reemplaza por
 *      el vector uniforme e/N:
 *
 *         P̄[i][j] = 1/N    para todo j
 *
 * Cita textual (pág. 29):
 *   "se sustituyen dichas filas con e/n, donde e es un vector fila de
 *    unos y n es el orden de P."
 *
 * Resultado: P̄ es estocástica por filas (cada fila suma 1).
 *
 * @param A Matriz de conectividad binaria.
 * @param N Orden de la matriz.
 * @returns Matriz estocástica P̄.
 */
export function hacerEstocastica(A: Matrix, N: number): Matrix {
    const P_barra: Matrix = Array.from({ length: N }, () => Array(N).fill(0));

    for (let i = 0; i < N; i++) {
        // O_i = suma de la fila i
        let O_i = 0;
        for (let j = 0; j < N; j++) O_i += A[i][j];

        if (O_i === 0) {
            // Nodo colgante: reemplazar fila por e/N
            for (let j = 0; j < N; j++) P_barra[i][j] = 1 / N;
        } else {
            // Fila normal: dividir entre la suma
            for (let j = 0; j < N; j++) P_barra[i][j] = A[i][j] / O_i;
        }
    }

    return P_barra;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — MATRIZ DE GOOGLE  Q
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye la matriz de Google Q como combinación lineal convexa
 * de la matriz estocástica P̄ y la matriz de perturbación E = v·eᵀ.
 *
 * Fórmula 3.1 (Cap. 3, pág. 30):
 *
 *     Q = α·P̄ + (1 − α)·E,        con   E = v·eᵀ,   0 ≤ α ≤ 1
 *
 * Donde:
 *   - v es el vector de personalización (distribución de probabilidad).
 *   - e es el vector fila de unos.
 *   - El producto v·eᵀ es una matriz de N × N cuya fila i tiene el
 *     valor v[i] repetido en todas las columnas... NO. Atención:
 *
 *     En la tesis, v es un vector fila y eᵀ es columna, por lo que
 *     v·eᵀ es un escalar (producto interno). Sin embargo, en el
 *     contexto en que la tesis lo usa (pág. 30), E debe ser una
 *     matriz N × N estocástica cuyas filas son todas iguales a v.
 *     Es decir, en la práctica E[i][j] = v[j], independiente de i.
 *
 *     Caso uniforme (Apéndice A): v = e/N  ⇒  E[i][j] = 1/N.
 *
 * Por convexidad, Q es estocástica (sus filas suman 1) y, si v tiene
 * todas sus entradas positivas, Q es irreducible y aperiódica, lo que
 * por el Teorema de Perron–Frobenius garantiza la existencia y unicidad
 * del vector estacionario π (Cap. 3, pág. 33).
 *
 * @param P_barra Matriz estocástica.
 * @param v       Vector de personalización (debe sumar 1).
 * @param alpha   Factor de amortiguamiento (por defecto 0.85).
 * @param N       Orden de la matriz.
 * @returns       Matriz de Google Q.
 */
export function construirMatrizGoogle(
    P_barra: Matrix,
    v: Vector,
    alpha: number,
    N: number,
): Matrix {
    const Q: Matrix = Array.from({ length: N }, () => Array(N).fill(0));

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            // E[i][j] = v[j]   (todas las filas de E son iguales a v)
            const E_ij = v[j];
            Q[i][j] = alpha * P_barra[i][j] + (1 - alpha) * E_ij;
        }
    }

    return Q;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — MÉTODO DE POTENCIAS  π
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el vector PageRank π mediante el método de potencias.
 *
 * Fundamento (Cap. 1, fórmula 1.5; Cap. 3, pág. 33; Apéndice A):
 *
 *     π_{k+1} = π_k · Q
 *
 * Por el Teorema 1.3 (cadena irreducible, recurrente positiva y
 * aperiódica), la sucesión {π_k} converge a la única distribución
 * estacionaria π* que satisface:
 *
 *     π* · Q = π*       y       Σ π*[i] = 1
 *
 * El algoritmo se detiene cuando ‖π_{k+1} − π_k‖_∞ < ε.
 *
 * Inicialización: π_0 = e/N (distribución uniforme), que es la elección
 * estándar y la usada por la tesis en su simulación (Apéndice A, donde
 * se toma una potencia grande de la matriz, equivalente a iterar desde
 * cualquier distribución inicial).
 *
 * @param Q        Matriz de Google.
 * @param N        Orden de la matriz.
 * @param epsilon  Tolerancia de convergencia.
 * @param maxIter  Número máximo de iteraciones.
 * @returns        Vector PageRank π (distribución estacionaria).
 */
export function metodoDePotencias(
    Q: Matrix,
    N: number,
    epsilon: number = EPSILON_DEFAULT,
    maxIter: number = MAX_ITER_DEFAULT,
): Vector {
    // π_0 = e/N  (distribución uniforme inicial)
    let pi: Vector = Array(N).fill(1 / N);

    for (let k = 0; k < maxIter; k++) {
        // π_{k+1} = π_k · Q   (multiplicación vector fila por matriz)
        const pi_next: Vector = Array(N).fill(0);
        for (let j = 0; j < N; j++) {
            let suma = 0;
            for (let i = 0; i < N; i++) suma += pi[i] * Q[i][j];
            pi_next[j] = suma;
        }

        // Criterio de convergencia: ‖π_{k+1} − π_k‖_∞ < ε
        let diff = 0;
        for (let i = 0; i < N; i++) {
            const d = Math.abs(pi_next[i] - pi[i]);
            if (d > diff) diff = d;
        }

        pi = pi_next;
        if (diff < epsilon) break;
    }

    return pi;
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — orquesta los 4 pasos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el vector PageRank π para un grafo dirigido de N nodos.
 *
 * Encadena los cuatro pasos del algoritmo según el PDF:
 *
 *     A  →  P̄  →  Q  →  π
 *
 * Si no se proporciona el vector v, se usa v = e/N (caso uniforme,
 * Apéndice A). Si se proporciona un v personalizado, se obtiene el
 * "PageRank personalizado" mencionado en el Cap. 3, pág. 30, donde
 * la tesis llama a v explícitamente "vector de personalización o
 * de teleportación".
 *
 * @param N         Número de nodos.
 * @param hayEnlace Predicado (i, j) → boolean del grafo dirigido.
 * @param v         Vector de personalización (opcional, por defecto e/N).
 * @param alpha     Factor de amortiguamiento (opcional, por defecto 0.85).
 * @returns         Vector PageRank π.
 */
export function calcularPageRank(
    N: number,
    hayEnlace: (i: number, j: number) => boolean,
    v?: Vector,
    alpha: number = ALPHA_DEFAULT,
): Vector {
    // Vector de personalización por defecto: v = e/N
    const v_efectivo: Vector = v ?? Array(N).fill(1 / N);

    const A = construirMatrizConectividad(N, hayEnlace);
    const P_barra = hacerEstocastica(A, N);
    const Q = construirMatrizGoogle(P_barra, v_efectivo, alpha, N);
    const pi = metodoDePotencias(Q, N);

    return pi;
}


/**
 * Calcula el vector PageRank π usando una matriz de conectividad ponderada.
 *
 * Variante de `calcularPageRank` que acepta directamente una matriz de
 * pesos (frecuencias de transición) en lugar de un predicado booleano.
 * La cadena es:
 *
 *     pesos  →  A (ponderada)  →  P̄  →  Q  →  π
 *
 * Esto permite que las probabilidades de transición reflejen la
 * frecuencia real de navegación del usuario (ej. si el usuario pasó
 * de A→B tres veces, esa transición tiene triple peso vs. una de
 * una sola vez).
 *
 * @param N     Número de nodos.
 * @param pesos Matriz N × N de pesos (frecuencias de transición).
 * @param v     Vector de personalización (opcional, por defecto e/N).
 * @param alpha Factor de amortiguamiento (opcional, por defecto 0.85).
 * @returns     Vector PageRank π.
 */
export function calcularPageRankPonderado(
    N: number,
    pesos: number[][],
    v?: Vector,
    alpha: number = ALPHA_DEFAULT,
): Vector {
    // Vector de personalización por defecto: v = e/N
    const v_efectivo: Vector = v ?? Array(N).fill(1 / N);

    const A = construirMatrizConectividadPonderada(N, pesos);
    const P_barra = hacerEstocastica(A, N);
    const Q = construirMatrizGoogle(P_barra, v_efectivo, alpha, N);
    const pi = metodoDePotencias(Q, N);

    return pi;
}