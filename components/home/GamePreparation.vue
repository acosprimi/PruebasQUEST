<template>
  <div v-if="open" class="preparacion" role="dialog" aria-modal="true" :aria-label="t('Preparación del juego')">
    <section class="tarjeta">
      <p class="ceja">ENGLISH QUEST</p>
      <h1>{{ t('Prepara tu aventura') }}</h1>
      <p>{{ t('El juego incluye animaciones y efectos visuales que pueden exigir recursos del dispositivo. Puedes cambiar esta opción después.') }}</p>

      <fieldset>
        <legend>{{ t('Calidad gráfica') }}</legend>
        <label v-for="perfil in perfiles" :key="perfil.id" class="perfil">
          <input v-model="seleccion" type="radio" name="calidad-grafica" :value="perfil.id" />
          <span><strong>{{ t(perfil.nombre) }}</strong><small>{{ t(perfil.detalle) }}</small></span>
        </label>
      </fieldset>

      <p class="carga" role="status" aria-live="polite">
        <template v-if="cargando">{{ t('Preparando recursos esenciales') }}: {{ progreso.loaded }} / {{ progreso.total }}</template>
        <template v-else-if="progreso.failed">{{ t('Algunos recursos no se pudieron preparar; se intentarán cargar al necesitarlos.') }}</template>
        <template v-else>{{ t('Recursos esenciales listos') }}</template>
      </p>
      <progress v-if="cargando" :value="progreso.loaded" :max="Math.max(progreso.total, 1)" :aria-label="t('Progreso de carga')" />
      <div class="acciones">
        <v-btn color="amber-lighten-2" variant="flat" :disabled="cargando" @click="continuar">{{ t('Continuar') }}</v-btn>
        <v-btn color="amber-lighten-2" variant="tonal" @click="comenzarLite">{{ t('Comenzar en modo Lite') }}</v-btn>
        <v-btn v-if="progreso.failed && !cargando" color="amber-lighten-2" variant="text" @click="reintentar">{{ t('Reintentar carga') }}</v-btn>
      </div>
      <p v-if="cargando" class="aviso-lite" role="note">{{ t('Si omites la preparación, el juego comenzará en modo Lite (fondos estáticos y efectos simplificados). Podrás cambiarlo en Opciones.') }}</p>
      <div class="acciones">
        <v-btn color="amber-lighten-2" variant="text" :disabled="cargando" @click="saltarIntroduccion">{{ t('Saltar introducción') }}</v-btn>
      </div>
    </section>
  </div>
</template>

<script setup>
const emit = defineEmits(['skip-intro'])
const { introSeen, loadPreferences, setQualityMode, qualityMode, finishIntro, prepareImages, releaseScope } = useGameGraphics()
const { language, t } = useLanguage()
const open = ref(false)
const cargando = ref(true)
const progreso = ref({ loaded: 0, total: 3, failed: 0 })
const seleccion = ref('lite')
const intentos = ref(0)
let controlador
// Solo dos perfiles. Se explican en una frase cada uno.
const perfiles = [
  { id: 'alta', nombre: 'Gráficos altos', detalle: 'Experiencia visual completa: escenarios animados, auras, partículas, sombras, cámara y remates cinemáticos.' },
  { id: 'lite', nombre: 'Gráficos Lite', detalle: 'Optimizada para celulares de bajos recursos: fondos estáticos, imágenes ligeras y efectos simplificados. Mismo juego, mismas preguntas.' }
]
// El perfil sobre el que se prepara: el elegido. No se descargan los recursos exclusivos del otro perfil.
const perfilPreparado = computed(() => seleccion.value)

onMounted(() => {
  loadPreferences()
  seleccion.value = qualityMode.value
  open.value = !introSeen.value
  if (!open.value) cargando.value = false
})

watch([open, perfilPreparado, language, intentos], async ([visible, perfil], _, onCleanup) => {
  if (!visible) return
  const controller = new AbortController()
  controlador = controller
  onCleanup(() => controller.abort())
  cargando.value = true
  progreso.value = { loaded: 0, total: 3, failed: 0 }
  const base = [
    '/images/personajes-mate/caballero/reposo.png',
    language.value === 'en' ? '/images/mapa-del-reino-en.svg' : '/images/mapa-del-reino.svg',
    perfil === 'lite' ? '/images/arenas/static/puerta-real.webp' : '/images/arenas/puerta-real-animado.svg'
  ]
  releaseScope('menu') // invalida lo preparado para el otro perfil y cualquier solicitud en curso
  // El progreso es el real: cada imagen cuenta cuando termina de decodificarse (o falla).
  const resultado = await prepareImages(base, { signal: controller.signal, profile: perfil, ambito: 'menu', onProgress: (value) => { progreso.value = value } })
  if (controller.signal.aborted) return
  progreso.value = resultado
  cargando.value = false
})

onBeforeUnmount(() => controlador?.abort())

function terminar(modo) {
  controlador?.abort()
  setQualityMode(modo)
  finishIntro()
  open.value = false
}
function continuar() { terminar(seleccion.value) }
// Omitir la preparación activa de verdad el perfil Lite: se descartan las imágenes preparadas del otro perfil.
function comenzarLite() {
  seleccion.value = 'lite'
  releaseScope('menu')
  terminar('lite')
}
function reintentar() { intentos.value++ }
// Saltar la introducción narrativa es otra cosa: conserva el perfil elegido y lleva directo al mapa.
function saltarIntroduccion() {
  terminar(seleccion.value)
  emit('skip-intro')
}
</script>
<style scoped>
.preparacion { position: fixed; inset: 0; z-index: 100000; display: grid; place-items: center; padding: 1rem; background: #07101deF; }
.tarjeta { max-height: 100%; overflow-y: auto; width: min(100%, 560px); padding: clamp(1.1rem, 4vw, 2rem); border: 1px solid #b68a48; border-radius: 14px; background: linear-gradient(145deg, #30271f, #121a29 75%); color: #f7edda; box-shadow: 0 18px 60px #000a; }
.ceja { margin: 0; color: #e8bd71; font-weight: 800; letter-spacing: .16em; }
h1 { margin: .3rem 0 .65rem; color: #ffe09a; font: 800 clamp(1.5rem, 5vw, 2.2rem) Georgia, serif; }
.tarjeta > p:not(.ceja) { line-height: 1.5; }
fieldset { display: grid; gap: .55rem; margin: 1.1rem 0; padding: 0; border: 0; }
legend { margin-bottom: .55rem; color: #ffe09a; font-weight: 800; }
.perfil { display: flex; gap: .7rem; align-items: flex-start; padding: .75rem; border: 1px solid #8f7959; border-radius: 8px; background: #ffffff0a; cursor: pointer; }
.perfil input { margin-top: .25rem; accent-color: #f2c267; }
.perfil span { display: grid; gap: .15rem; }
.perfil small { color: #d3cbbb; line-height: 1.35; }
.carga { min-height: 1.5em; margin-bottom: .3rem; color: #cde5ee; font-size: .9rem; }
progress { display: block; width: 100%; height: 9px; accent-color: #e5b75f; }
.aviso-lite { margin: .5rem 0 0; color: #ffd8a0; font-size: .88rem; }
.acciones { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .4rem; margin-top: .85rem; }
</style>
