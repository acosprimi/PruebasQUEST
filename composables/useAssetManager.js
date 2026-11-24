// Gestión de imágenes del juego: variantes por perfil, decodificación única y memoria acotada.
//
// - Las variantes salen de data/variantes-imagenes.json (generado por scripts/generar-variantes.mjs).
//   Solo se pide un archivo si el manifiesto confirma que existe: no hay solicitudes a rutas inventadas.
// - La caché guarda objetos Image ya decodificados con su coste teórico (ancho × alto × 4 bytes).
//   Esa cifra es una estimación de memoria RGBA, no una medición: el navegador decide cuándo libera
//   realmente los píxeles. Soltar la referencia solo permite que pueda hacerlo.
// - Cada recurso pertenece a uno o más «ámbitos» (menu, mapa, nivel-2...). Al cerrar un ámbito se sueltan
//   los recursos que ningún otro ámbito necesita.
import manifiesto from '../data/variantes-imagenes.json' with { type: 'json' }

export const PERFILES = ['alta', 'equilibrada', 'lite']
// Presupuesto de memoria decodificada teórica por perfil (bytes). Lite trabaja con menos.
export const PRESUPUESTO = { alta: 96 * 1048576, equilibrada: 64 * 1048576, lite: 28 * 1048576 }
const CADENA = { alta: ['alta', 'equilibrada', 'lite'], equilibrada: ['equilibrada', 'alta'], lite: ['lite', 'equilibrada', 'alta'] }

const tallo = (src) => src.replace(/\.(png|webp)$/, '').replace(/-lite$/, '')

// Función pura: devuelve la URL de la variante para un perfil, o el mismo src si no hay manifiesto para él.
export function resolverImagen(src, perfil = 'equilibrada', sustituciones) {
  if (typeof src !== 'string') return src
  const entrada = manifiesto[tallo(src)]
  if (!entrada || !/\.(png|webp)$/.test(src)) return src
  const elegida = CADENA[perfil]?.find((p) => entrada[p])
  const url = elegida ? entrada[elegida][0] : src
  return sustituciones?.get(url) || url
}

// Dimensiones y peso conocidos de una URL concreta (null si no está en el manifiesto).
export function medidasDe(url) {
  const entrada = manifiesto[tallo(url)]
  if (!entrada) return null
  for (const v of Object.values(entrada)) if (v[0] === url) return { ancho: v[1], alto: v[2], bytes: v[3], memoria: v[1] * v[2] * 4 }
  return null
}

export function variantesDisponibles(src) {
  const entrada = manifiesto[tallo(src)]
  return entrada ? Object.keys(entrada) : []
}

export function crearGestorImagenes({ crearImagen = () => new Image(), perfil = () => 'equilibrada', limiteMs = 12000, memoriaPorDefecto = 512 * 512 * 4 } = {}) {
  const cache = new Map() // url → { imagen, memoria, ambitos:Set, usos, ultimo }
  const pendientes = new Map() // url → promesa (solicitudes duplicadas comparten descarga)
  const sustituciones = new Map() // url que falló → url alternativa que sí cargó
  const estadisticas = { descargas: 0, aciertos: 0, fallos: 0, liberadas: 0 }
  let reloj = 0

  const memoriaDe = (url) => medidasDe(url)?.memoria ?? memoriaPorDefecto
  const memoriaTotal = () => { let n = 0; for (const e of cache.values()) n += e.memoria; return n }
  const resolver = (src, p = perfil()) => resolverImagen(src, p, sustituciones)

  function ajustar(excepto) {
    const limite = PRESUPUESTO[perfil()] ?? PRESUPUESTO.equilibrada
    if (memoriaTotal() <= limite) return
    // Primero lo que ningún ámbito necesita, del menos reciente al más reciente; luego, nunca lo fijado.
    const candidatas = [...cache.entries()]
      .filter(([url, e]) => url !== excepto && e.ambitos.size === 0)
      .sort((a, b) => a[1].ultimo - b[1].ultimo || a[1].usos - b[1].usos)
    for (const [url, e] of candidatas) {
      if (memoriaTotal() <= limite) break
      e.imagen.src = ''
      cache.delete(url)
      estadisticas.liberadas++
    }
  }

  function cargar(url) {
    if (pendientes.has(url)) return pendientes.get(url)
    const imagen = crearImagen()
    estadisticas.descargas++
    const promesa = new Promise((resolve) => {
      const temporizador = setTimeout(() => { imagen.onload = imagen.onerror = null; resolve(false) }, limiteMs)
      imagen.onload = async () => {
        try { await imagen.decode?.(); resolve(imagen) } catch { resolve(false) } finally { clearTimeout(temporizador) }
      }
      imagen.onerror = () => { clearTimeout(temporizador); resolve(false) }
      imagen.src = url
    }).then((resultado) => {
      pendientes.delete(url)
      if (resultado) { estadisticas.aciertos++ } else estadisticas.fallos++
      return resultado
    })
    pendientes.set(url, promesa)
    return promesa
  }

  // Decodifica una URL ya resuelta. Los aciertos se reutilizan; los fallos no se guardan, así un reintento vuelve a pedir.
  async function decodificar(url, ambito) {
    if (!url) return false
    let e = cache.get(url)
    if (e) {
      e.usos++; e.ultimo = ++reloj
      if (ambito) e.ambitos.add(ambito)
      return e.imagen
    }
    const imagen = await cargar(url)
    if (!imagen) return false
    e = cache.get(url)
    if (!e) {
      e = { imagen, memoria: memoriaDe(url), ambitos: new Set(), usos: 0, ultimo: 0 }
      cache.set(url, e)
    }
    e.usos++; e.ultimo = ++reloj
    if (ambito) e.ambitos.add(ambito)
    ajustar(url)
    return imagen
  }

  // Prepara varias imágenes con la variante del perfil; si una variante falla, prueba la siguiente de la cadena.
  async function preparar(fuentes, { signal, onProgress, perfil: p = perfil(), ambito, concurrencia = 3 } = {}) {
    const unicas = [...new Set(fuentes.filter(Boolean))]
    let cargadas = 0, falladas = 0, cursor = 0
    const trabajador = async () => {
      while (cursor < unicas.length && !signal?.aborted) {
        const original = unicas[cursor++]
        const alternativa = original.startsWith('/images/arenas/static/') ? original.replace('/arenas/static/', '/arenas/').replace('.webp', '-animado.svg') : null
        const intentos = [...new Set([resolver(original, p), ...(CADENA[p] ?? []).map((q) => resolverImagen(original, q)), original, alternativa].filter(Boolean))]
        let ok = false
        for (const url of intentos) {
          if (signal?.aborted) return
          ok = await decodificar(url, ambito)
          if (ok) { if (url !== intentos[0]) sustituciones.set(intentos[0], url); break }
        }
        if (signal?.aborted) return
        if (!ok) falladas++
        cargadas++
        onProgress?.({ loaded: cargadas, total: unicas.length, failed: falladas })
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrencia, unicas.length) }, trabajador))
    return { loaded: cargadas, total: unicas.length, failed: falladas, cancelled: Boolean(signal?.aborted) }
  }

  // Cierra un ámbito: suelta las referencias que nadie más necesita.
  function liberarAmbito(ambito) {
    for (const [url, e] of cache) {
      if (!e.ambitos.delete(ambito) || e.ambitos.size) continue
      e.imagen.src = ''
      cache.delete(url)
      estadisticas.liberadas++
    }
  }
  // Cambio de perfil o reinicio: suelta todo lo que no pertenece a los ámbitos indicados.
  function liberarTodoExcepto(...conservar) {
    for (const [url, e] of cache) {
      if ([...e.ambitos].some((a) => conservar.includes(a))) continue
      e.imagen.src = ''
      cache.delete(url)
      estadisticas.liberadas++
    }
  }
  function fijar(ambito, urls) { for (const u of urls) cache.get(u)?.ambitos.add(ambito) }
  function listo(src, p = perfil()) { return cache.has(resolver(src, p)) }
  function instantanea() {
    return { entradas: cache.size, memoriaTeorica: memoriaTotal(), pendientes: pendientes.size, ...estadisticas }
  }

  return { resolver, decodificar, preparar, liberarAmbito, liberarTodoExcepto, fijar, listo, instantanea, ajustar }
}

let compartido = null
export function useAssetManager(obtenerPerfil) {
  if (!compartido) {
    compartido = crearGestorImagenes({ perfil: () => compartido.perfilActual?.() ?? 'equilibrada' })
  }
  if (obtenerPerfil) compartido.perfilActual = obtenerPerfil
  return compartido
}

// Fondo del nivel según perfil: Lite usa la imagen estática; Alta y Equilibrada, el fondo animado.
export function fondoNivel(nivel, perfil) {
  if (perfil !== 'lite') return nivel.fondo
  return nivel.fondo.replace('/arenas/', '/arenas/static/').replace(/-animado\.svg$/, '.webp')
}

// Recursos que deben estar listos antes de empezar la batalla (poses iniciales, guardián, primeras animaciones).
export function recursosEsenciales(nivel, perfil) {
  const heroe = '/images/personajes-mate/caballero'
  const guardian = nivel.arte
  const base = [
    fondoNivel(nivel, perfil),
    `${heroe}/reposo.png`, `${heroe}/preparacion-hachazo.png`, `${heroe}/impacto-hachazo.png`, `${heroe}/guardia.webp`,
    `${guardian}/reposo.png`, `${guardian}/preparacion.png`, `${guardian}/impacto.png`, `${guardian}/carga-1.webp`, `${guardian}/carga-2.webp`,
    ...(nivel.preguntas.some((q) => q.tipo === 'hacha') ? [`${heroe}/sin-arma.webp`] : [])
  ]
  // Lite dibuja una sola pose por luchador: se aseguran también las reacciones más frecuentes.
  if (perfil === 'lite') base.push(`${heroe}/dolor.png`, `${heroe}/golpeado.webp`, `${guardian}/ataque.webp`)
  return base
}
