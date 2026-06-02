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
        let O_i = 0;
        for (let j = 0; j < N; j++) O_i += A[i][j];

        if (O_i === 0) {
            for (let j = 0; j < N; j++) P_barra[i][j] = 1 / N;
        } else {
            for (let j = 0; j < N; j++) P_barra[i][j] = A[i][j] / O_i;
        }
    }
    return P_barra;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — MATRIZ ESTOCÁSTICA POR COLUMNAS  H
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transpone la matriz estocástica por filas P̄ para obtener la matriz H,
 * la cual es estocástica por columnas.
 *
 * Esto permite que la multiplicación H * r_n sea matemáticamente correcta
 * en la formulación de vectores columna.
 *
 * @param P_barra Matriz estocástica por filas.
 * @param N       Orden de la matriz.
 * @returns       Matriz H estocástica por columnas (H = P_barraᵀ).
 */
export function obtenerMatrizColumnas(P_barra: Matrix, N: number): Matrix {
    const H: Matrix = Array.from({ length: N }, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            H[i][j] = P_barra[j][i];
        }
    }
    return H;
}


// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — MÉTODO DE LAS POTENCIAS ITERATIVO (r_{n+1} = d * H * r_n + (1 - d) * r_0)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el vector PageRank r_{n+1} de manera explícita paso a paso mediante el Método de las Potencias,
 * aplicando exactamente la ecuación: r_{n+1} = d * H * r_n + (1 - d) * r_0.
 *
 * @param H        Matriz estocástica por columnas.
 * @param r_0      Vector inicial o de personalización (distribución uniforme e/N por defecto).
 * @param d        Factor de amortiguamiento (damping factor).
 * @param N        Número de nodos (orden de la matriz).
 * @param epsilon  Tolerancia de convergencia.
 * @param maxIter  Número máximo de iteraciones.
 * @returns        Vector PageRank final estacionario (r_n).
 */
export function metodoDePotencias(
    H: Matrix,
    r_0: Vector,
    d: number,
    N: number,
    epsilon: number = EPSILON_DEFAULT,
    maxIter: number = MAX_ITER_DEFAULT,
): Vector {
    // r_n inicializada con la distribución uniforme r_0 (o el vector de personalización)
    let r_n: Vector = [...r_0];

    for (let k = 0; k < maxIter; k++) {
        const r_next: Vector = Array(N).fill(0);

        // PASO A: Multiplicar la matriz H por el vector r_n (H * r_n)
        const tempA: Vector = Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            let suma = 0;
            for (let j = 0; j < N; j++) {
                suma += H[i][j] * r_n[j];
            }
            tempA[i] = suma;
        }

        // PASO B: Multiplicar ese resultado por el escalar d (d * H * r_n)
        const tempB: Vector = Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            tempB[i] = d * tempA[i];
        }

        // PASO C: Multiplicar el vector r_0 por el escalar (1 - d) -> ((1 - d) * r_0)
        const tempC: Vector = Array(N).fill(0);
        const uno_menos_d = 1 - d;
        for (let i = 0; i < N; i++) {
            tempC[i] = uno_menos_d * r_0[i];
        }

        // PASO D: Sumar los resultados del Paso B y el Paso C para obtener r_next (r_{n+1})
        for (let i = 0; i < N; i++) {
            r_next[i] = tempB[i] + tempC[i];
        }

        // Criterio de parada: diferencia máxima absoluta entre r_next y r_n (Norma infinito)
        let diff = 0;
        for (let i = 0; i < N; i++) {
            const diff_val = Math.abs(r_next[i] - r_n[i]);
            if (diff_val > diff) {
                diff = diff_val;
            }
        }

        r_n = r_next;

        if (diff < epsilon) {
            break;
        }
    }

    return r_n;
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — orquesta los pasos del PageRank
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el vector PageRank r para un grafo de N nodos.
 *
 * Encadena los pasos del algoritmo:
 *
 *     A  →  P̄  →  H (columnas)  →  r
 *
 * Si no se proporciona el vector v (r_0), se usa v = e/N (caso uniforme).
 *
 * @param N         Número de nodos.
 * @param hayEnlace Predicado (i, j) → boolean del grafo dirigido.
 * @param v         Vector de personalización (opcional, por defecto e/N).
 * @param d         Factor de amortiguamiento (opcional, por defecto 0.85).
 * @returns         Vector PageRank final.
 */
export function calcularPageRank(
    N: number,
    hayEnlace: (i: number, j: number) => boolean,
    v?: Vector,
    d: number = ALPHA_DEFAULT,
): Vector {
    // Vector de personalización / inicial por defecto: r_0 = e/N
    const r_0: Vector = v ?? Array(N).fill(1 / N);

    const A = construirMatrizConectividad(N, hayEnlace);
    const P_barra = hacerEstocastica(A, N);
    
    // Obtener la matriz estocástica por columnas H = P_barraᵀ
    const H = obtenerMatrizColumnas(P_barra, N);

    // Calcular el vector PageRank usando el método de potencias explícito
    const r = metodoDePotencias(H, r_0, d, N);

    return r;
}


/**
 * Calcula el vector PageRank r usando una matriz de conectividad ponderada.
 *
 * @param N     Número de nodos.
 * @param pesos Matriz N × N de pesos (frecuencias de transición).
 * @param v     Vector de personalización (opcional, por defecto e/N).
 * @param d     Factor de amortiguamiento (opcional, por defecto 0.85).
 * @returns     Vector PageRank final.
 */
export function calcularPageRankPonderado(
    N: number,
    pesos: number[][],
    v?: Vector,
    d: number = ALPHA_DEFAULT,
): Vector {
    // Vector de personalización / inicial por defecto: r_0 = e/N
    const r_0: Vector = v ?? Array(N).fill(1 / N);

    const A = construirMatrizConectividadPonderada(N, pesos);
    const P_barra = hacerEstocastica(A, N);
    
    // Obtener la matriz estocástica por columnas H = P_barraᵀ
    const H = obtenerMatrizColumnas(P_barra, N);

    // Calcular el vector PageRank usando el método de potencias explícito
    const r = metodoDePotencias(H, r_0, d, N);

    return r;
}
