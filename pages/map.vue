<template>
  <div ref="juego" class="juego">
    <!-- Una pista por pantalla: el key obliga a desmontar una y montar la otra al cambiar. -->
    <AudioMusicaHome v-if="pantalla === 'mapa'" key="musica-mapa" ruta="/audio/Mapa.mp3" />
    <AudioMusicaHome v-else :key="`musica-combate-${nivelActual?.numero}`"
      :ruta="`/audio/combate/batalla-${nivelActual?.numero ?? 1}.mp3`" :volumen="0.4" />
    <section v-if="pantalla === 'mapa'" class="reino">
      <div class="contenido">
        <header class="cabecera-mapa">
          <AudioSonidoBoton>
            <v-btn to="/" variant="text" color="amber-lighten-3" class="volver">{{ t('Volver al inicio') }}</v-btn>
          </AudioSonidoBoton>

          <v-btn v-if="pantallaCompletaDisponible" variant="tonal" size="small" class="boton-pantalla"
            :aria-pressed="pantallaCompleta" @click="alternarPantalla">
            {{ t(pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa') }}
          </v-btn>
          <v-btn variant="tonal" size="small" class="boton-opciones" @click="showOptions = true">{{ t('Opciones') }}</v-btn>
          <v-btn variant="tonal" size="small" class="boton-opciones" @click="verLecciones = true">{{ t('Pergaminos') }}</v-btn>
          <v-btn variant="tonal" size="small" class="boton-opciones" @click="verEstadisticas = true">{{ t('Estadísticas') }}</v-btn>
          <h1>{{ t('Mapa del Reino') }}</h1>
          <p>{{ t('Sigue el camino dorado. Toca un marcador para entrar en la zona.') }}</p>
          <p v-if="nivelDesbloqueado > niveles.length" class="conquista">{{ t('Completaste las cuatro zonas del reino.') }}</p>
        </header>
        <p v-if="avisoPantalla" role="status">{{ t('El navegador no pudo cambiar la pantalla completa.') }}</p>
        <!-- El tablero se escala para caber completo en el espacio que queda (sin scroll) -->
        <aside v-if="recomendacion && modoCalidad !== 'auto'" role="status">
          {{ t('El juego ha perdido fluidez. ¿Quieres usar una calidad gráfica inferior?') }}
          <v-btn size="small" @click="aplicarRecomendacion">{{ t('Bajar calidad') }}</v-btn>
          <v-btn size="small" @click="descartarRecomendacion">{{ t('Ahora no') }}</v-btn>
        </aside>
        <div class="zona-mapa">
          <MapBoard class="tablero" :niveles="niveles" :nivel-desbloqueado="nivelDesbloqueado" @elegir="entrar" />
        </div>
        <MapListaZonas class="lista-zonas sin-barra" :niveles="niveles" :nivel-desbloqueado="nivelDesbloqueado" @elegir="entrar" />
        <HomeOptions v-model="showOptions" progreso @estadisticas="verEstadisticas = true" />
      </div>
    </section>
    <LazyCombatDesafio
      v-else-if="nivelActual"
      :key="intento"
      :nivel="nivelActual"
      @victoria="desbloquear"
      @volver="volverAlMapa"
      @reintentar="reintentar"
    />

    <LessonsLessonScroll v-if="verLecciones" :desbloqueado="nivelDesbloqueado > niveles.length ? niveles.length : nivelDesbloqueado" @cerrar="verLecciones = false" />
    <LessonsLessonScroll v-if="leccionPrevia" :nivel="leccionPrevia" previa :desbloqueado="leccionPrevia"
      @terminar="comenzarTrasLeccion" @cerrar="leccionPrevia = null" />
    <ProgressProgressPanel v-if="verEstadisticas" @cerrar="verEstadisticas = false" @practicar="verEstadisticas = false; practicando = true" />
    <ProgressPracticePanel v-if="practicando" @cerrar="practicando = false" />

    <!-- Transición Cinemática de Encuentro / Versus al entrar al nivel -->
    <MapEncuentroTransicion
      :activo="enTransicion"
      :nivel="nivelSeleccionado"
      @listo="iniciarCombate"
      @cancelar="enTransicion = false"
    />
  </div>
</template>

<script setup>
import nivelesBase from '~/data/niveles.json'

const { language, t, translateContent } = useLanguage()
const { loadPreferences, quality, modoCalidad, recomendacion, aplicarRecomendacion, descartarRecomendacion, releaseScope, releaseLevelsExcept } = useGameGraphics()
const progreso = usePlayerProgress()
const verLecciones = ref(false)
const verEstadisticas = ref(false)
const practicando = ref(false)
const leccionPrevia = ref(null)
const juego = ref(null)
const pantallaCompleta = ref(false)
const pantallaCompletaDisponible = ref(false)
const avisoPantalla = ref(false)

function actualizarPantalla() {
  pantallaCompleta.value = document.fullscreenElement === juego.value
}

async function alternarPantalla() {
  avisoPantalla.value = false
  try {
    if (pantallaCompleta.value) {
      await document.exitFullscreen()
    } else {
      await juego.value.requestFullscreen()
    }
  } catch {
    avisoPantalla.value = true
  }
}

onMounted(() => {
  pantallaCompletaDisponible.value = Boolean(document.fullscreenEnabled && juego.value?.requestFullscreen)
  document.addEventListener('fullscreenchange', actualizarPantalla)
})
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', actualizarPantalla))

const pantalla = ref('mapa')
const nivelActual = ref(null)
const nivelSeleccionado = ref(null)
const enTransicion = ref(false)
const nivelDesbloqueado = computed(() => progreso.estado.progreso.desbloqueado)
const intento = ref(0)
const showOptions = ref(false)
// Mide la fluidez mientras se juega (mapa y batalla). La recomendación se aplica en momentos seguros.
useFramePacing(computed(() => !enTransicion.value && quality.value !== 'lite'))
// En modo Automático, una recomendación sostenida se aplica sola en el mapa (en batalla, entre rondas).
watch(recomendacion, (valor) => { if (valor && modoCalidad.value === 'auto' && pantalla.value === 'mapa') aplicarRecomendacion() })

onMounted(() => {
  loadPreferences()
})

const niveles = computed(() => language.value === 'en'
  ? translateContent(nivelesBase)
  : nivelesBase)

function entrar(numero) {
  if (numero > nivelDesbloqueado.value || enTransicion.value) return
  const nivel = niveles.value.find((zona) => zona.numero === numero)
  if (!nivel) return

  nivelSeleccionado.value = nivel
  // Cada batalla empieza con un pergamino breve; se puede omitir y volver a consultar desde el mapa.
  leccionPrevia.value = numero
}
function comenzarTrasLeccion() {
  leccionPrevia.value = null
  enTransicion.value = true
}

// Cada ronda puede tener «variantes»: en cada intento se sortea una, distinta de la anterior.
const ultimaVariante = {}
function prepararNivel(nivel) {
  const preguntas = nivel.preguntas.map((base, i) => {
    const opciones = [base, ...(base.variantes ?? [])]
    if (opciones.length === 1) return base
    const clave = `${nivel.numero}-${i}`
    let elegido
    do { elegido = Math.floor(Math.random() * opciones.length) } while (elegido === ultimaVariante[clave])
    ultimaVariante[clave] = elegido
    return opciones[elegido]
  })
  return { ...nivel, preguntas }
}

function reintentar() {
  nivelActual.value = prepararNivel(niveles.value.find((zona) => zona.numero === nivelActual.value.numero))
  intento.value++
}

function iniciarCombate() {
  releaseLevelsExcept(nivelSeleccionado.value.numero)
  nivelActual.value = prepararNivel(nivelSeleccionado.value)
  pantalla.value = 'combate'
  enTransicion.value = false
}

function desbloquear() {
  progreso.desbloquear(nivelActual.value.numero + 1)
}

function volverAlMapa() {
  if (nivelActual.value) releaseScope(`nivel-${nivelActual.value.numero}`)
  liberarAudioBatalla()
  pantalla.value = 'mapa'
  nivelActual.value = null
}
</script>

<style scoped>
.reino {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  padding:
    max(8px, env(safe-area-inset-top))
    max(12px, env(safe-area-inset-right))
    max(10px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  background: #0b1325;
  animation: aparicion-mapa 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes aparicion-mapa {
  0% {
    opacity: 0;
    transform: scale(1.03);
  }
  40% {
    opacity: 0.85;
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.contenido {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1100px;
  margin-inline: auto;
}

.cabecera-mapa { flex: none; }

h1 {
  margin-top: 0.25rem;
  color: #ffe09a;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.4rem, 4.5vw, 2.4rem);
  line-height: 1.15;
}

p {
  margin: 0.25rem 0 0.6rem;
  font-size: clamp(0.85rem, 2.4vw, 1rem);
}

.conquista { color: #a9e8c3; }

/* Espacio para el tablero: ocupa todo lo que queda y lo centra */
.zona-mapa {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  container-type: size;
}

/* 1000 / 640 = 1.5625: proporción del dibujo del mapa. Cabe a lo ancho y a lo alto. */
.tablero {
  width: min(100cqw, 156.25cqh);
}

.juego { background: #0b1325; }
.juego:fullscreen { width: 100%; height: 100%; }
.boton-pantalla { margin-inline-start: 6px; }
.contenido .lista-zonas { display: none; }

@media (orientation: landscape) and (max-height: 560px) {
  .reino .contenido { display: grid; grid-template: auto minmax(0, 1fr) / minmax(0, 1.5fr) minmax(185px, 1fr); gap: 4px 12px; }
  .cabecera-mapa { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; }
  .cabecera-mapa h1 { order: -1; flex: 1; margin: 0; font-size: 20px; }
  .cabecera-mapa .volver, .boton-pantalla { height: 32px; min-height: 32px; font-size: 12px; }
  .cabecera-mapa p:not(.conquista) { display: none; }
  .tablero :deep(.rotulo) { display: none; }
  .contenido .lista-zonas { display: grid; align-content: center; gap: 4px; overflow-y: auto; }
  .lista-zonas :deep(.fila) { min-height: 38px; gap: 6px; padding: 3px 6px; }
  .lista-zonas :deep(.numero) { width: 29px; height: 29px; }
  .lista-zonas :deep(.texto strong) { font-size: 14px; }
  .lista-zonas :deep(.texto small), .lista-zonas :deep(.estado) { font-size: 11px; }
}
@media (orientation: portrait) and (max-width: 700px), (orientation: portrait) and (pointer: coarse) and (max-width: 950px) {
  .reino { overflow-y: auto; }
  .contenido { height: auto; gap: 12px; }
  .zona-mapa { display: block; flex: none; container-type: normal; }
  .tablero { width: 100%; }
  .tablero :deep(.rotulo) { display: none; }
  .contenido .lista-zonas { display: grid; }
}
</style>
