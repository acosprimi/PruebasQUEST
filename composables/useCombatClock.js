// Reloj educativo de una ronda. Cuenta tiempo real (no fotogramas): usa la diferencia entre lecturas,
// se detiene con la pestaña oculta, con una pausa segura o con la ayuda abierta, y puede no tener límite
// (modo de práctica). No mueve nada en pantalla: el movimiento visual tiene su propio ciclo.
import { ref } from 'vue'

export function crearRelojCombate({
  ahora = () => performance.now(),
  programar = (fn, ms) => setInterval(fn, ms),
  cancelar = (id) => clearInterval(id),
  detenido = () => false,
  sinLimite = () => false,
  alAgotar = () => {},
  paso = 100
} = {}) {
  const restante = ref(0)
  const total = ref(0)
  const transcurrido = ref(0) // segundos activos de la ronda (sin pausas), útil para estadísticas
  let id = null
  let ultimo = 0

  function parar() {
    if (id !== null) cancelar(id)
    id = null
  }
  function arrancar(segundos) {
    parar()
    total.value = segundos
    restante.value = segundos
    transcurrido.value = 0
    ultimo = ahora()
    id = programar(tick, paso)
  }
  function reiniciarReferencia() { ultimo = ahora() }
  function tick() {
    const t = ahora()
    const dt = (t - ultimo) / 1000
    ultimo = t
    if (detenido()) return
    transcurrido.value += dt
    if (sinLimite()) return
    restante.value = Math.max(0, restante.value - dt)
    if (restante.value === 0) alAgotar()
  }
  return { restante, total, transcurrido, arrancar, parar, reiniciarReferencia, tick, activo: () => id !== null }
}
