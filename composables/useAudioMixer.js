// Ciclo de vida del audio: volumen por canal (música, efectos, voces), una sola música activa,
// reutilización de elementos de audio y límite de efectos simultáneos. No descarga nada por adelantado:
// cada archivo se pide la primera vez que suena.
import { usePlayerProgress } from './usePlayerProgress.js'

const MAX_EFECTOS = 8
const MAX_VOCES = 2
const activos = { efectos: [], voces: [] }
const libres = new Map() // ruta → [Audio] reutilizables
let musica = null

export function volumenCanal(canal) {
  const v = usePlayerProgress().estado.ajustes.volumen
  return typeof v[canal] === 'number' ? v[canal] : 1
}

function tomar(ruta) {
  const lista = libres.get(ruta)
  const audio = lista?.pop() ?? new Audio(ruta)
  audio.currentTime = 0
  return audio
}
function devolver(ruta, audio) {
  const lista = libres.get(ruta) ?? []
  if (lista.length < 2) { lista.push(audio); libres.set(ruta, lista) }
}

// Reproduce un efecto. Si hay demasiados a la vez se corta el más antiguo (los avisos importantes son los más recientes).
export function reproducirEfecto(ruta, { volumen = 0.85, canal = 'efectos' } = {}) {
  if (!ruta || typeof Audio === 'undefined') return null
  const cola = activos[canal] ?? activos.efectos
  const limite = canal === 'voces' ? MAX_VOCES : MAX_EFECTOS
  while (cola.length >= limite) {
    const viejo = cola.shift()
    viejo.audio.pause()
    viejo.fin()
  }
  const audio = tomar(ruta)
  audio.volume = Math.min(1, Math.max(0, volumen * volumenCanal(canal)))
  const entrada = { audio, fin: () => { audio.onended = null; devolver(ruta, audio) } }
  audio.onended = () => { const i = cola.indexOf(entrada); if (i >= 0) cola.splice(i, 1); entrada.fin() }
  cola.push(entrada)
  audio.play().catch(() => { const i = cola.indexOf(entrada); if (i >= 0) cola.splice(i, 1) })
  return entrada
}

export function detenerEfectos() {
  for (const canal of Object.keys(activos)) { activos[canal].forEach((e) => e.audio.pause()); activos[canal].length = 0 }
}
// Al salir de una batalla se sueltan los audios reutilizables (efectos de combate, voces del jefe).
export function liberarAudioBatalla() {
  detenerEfectos()
  for (const [ruta, lista] of libres) if (ruta.includes('/audio/combate/')) { lista.forEach((a) => { a.src = '' }); libres.delete(ruta) }
}

// Música: solo una pista a la vez; al registrar otra, la anterior se detiene.
export function registrarMusica(audio, volumenBase) {
  if (musica && musica.audio !== audio) { musica.audio.pause() }
  musica = { audio, volumenBase }
  aplicarVolumenMusica()
}
export function liberarMusica(audio) { if (musica?.audio === audio) musica = null }
export function aplicarVolumenMusica() { if (musica) musica.audio.volume = Math.min(1, Math.max(0, musica.volumenBase * volumenCanal('musica'))) }
