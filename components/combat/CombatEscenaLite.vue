<template>
  <div class="escenario" :class="[`nivel-${nivel.numero}`, { urgente, 'arena-esquiva': posicionEsquiva !== null }]"
    :style="{ '--fondo': `url('${fondo}')`, '--carga': carga ?? 0, '--pe': posicionEsquiva ?? 0 }">
    <!-- Escena Lite: fondo estático, una sola pose visible por luchador y animaciones de transform/opacity.
         Comparte con la escena completa las mismas reglas (CombatEngine), props, eventos y ranura de actividad. -->
    <div class="secuencia" :class="[ataque?.id, { activa: ataque, final: ataque?.final }]" :style="tiempos">
      <div class="accion">
        <span v-if="ataque?.final" class="penumbra" />
        <div class="luchador caballero" data-destino-palabra="heroe" :class="claseCaballero" role="img"
          :aria-label="t(sinArma ? 'Caballero sin arma' : 'Caballero con hacha y escudo solar')">
          <span v-if="furia" class="aura-lite" />
          <span v-if="bloqueando" class="barrera-bloqueo"><b>{{ t('¡Bloqueado!') }}</b></span>
          <img v-if="srcCaballero" class="pose" :style="estiloPose('caballero', poseCaballero)" :src="srcCaballero" alt="" draggable="false" />
        </div>
        <div class="luchador guardian" data-destino-palabra="monstruo" :class="claseGuardian" role="img" :aria-label="nivel.guardian">
          <span v-if="enfurecido" class="aura-lite ira" />
          <img v-if="srcGuardian" class="pose" :style="estiloPose(carpetaGuardian, poseGuardian)" :src="srcGuardian" alt="" draggable="false" />
          <img v-if="ataqueRival && chorro && !ladoGolpe" class="chorro" :class="`chorro-${nivel.numero}`" :style="estiloPose(carpetaGuardian, 'ataque')" :src="imageUrl(chorro, 'lite')" alt="" draggable="false" />
        </div>
        <span v-if="ataque?.final" class="rotulo-final">{{ ataque.nombre }}</span>
        <template v-if="ataque">
          <div v-if="ladoGolpe" class="zona-coletazo" :class="ladoGolpe">
            <span class="advertencia-coletazo" />
            <img :src="nivel.efecto" alt="" />
          </div>
          <CombatEfectosLite v-else-if="!ataque.remate" :nivel="nivel.numero" :ataque="ataque" :estela="efecto"
            :dano="bloqueando ? null : danoAplicado" :curacion="curacion" />
          <span v-else-if="remateCruzado" class="tajos"><i /><i /></span>
        </template>
      </div>
    </div>
    <slot name="actividad" />
    <span v-if="ataque?.lado && danoAplicado !== null" class="resultado-esquiva" :class="{ acierto: ataque.esquivado }" role="status">
      {{ ataque.esquivado ? t('¡Esquiva! · Contraataca') : '−' + danoAplicado + ' ' + t('PV') }}
    </span>
    <span v-if="vidaBaja" class="vida-baja" aria-hidden="true" />
  </div>
</template>

<script setup>
import medidasPoses from '~/data/medidas-poses.json'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const { t } = useLanguage()
const { imageUrl, levelBackground, prepareImages, assets, levelEssentials } = useGameGraphics()
const props = defineProps({
  nivel: { type: Object, required: true },
  ataque: { type: Object, default: null },
  danoAplicado: { type: Number, default: null },
  curacion: { type: Number, default: 0 },
  posicionEsquiva: { type: Number, default: null },
  ladoGolpe: { type: String, default: null },
  sinArma: Boolean,
  vidaCaballero: { type: Number, required: true },
  vidaRival: { type: Number, required: true },
  furia: Boolean,
  enfurecido: Boolean,
  bloqueado: Boolean,
  carga: { type: Number, default: null }
})
const emit = defineEmits(['impactar', 'terminar'])

const HEROE = '/images/personajes-mate/caballero'
const NUEVAS = new Set(['guardia', 'final-1', 'final-2', 'final-3', 'golpeado', 'anticipacion', 'esquiva', 'sin-arma', 'carga-1', 'carga-2', 'ataque', 'derrota-1', 'derrota-2'])
const ruta = (carpeta, pose) => `${carpeta}/${pose}.${NUEVAS.has(pose) ? 'webp' : 'png'}`
const fondo = computed(() => levelBackground(props.nivel, 'lite'))
const carpetaGuardian = computed(() => props.nivel.arte.split('/').pop())
const chorros = { 2: '/images/jefes/rio/ola-venenosa.png', 4: '/images/jefes/real/aliento-fuego.png' }
const chorro = computed(() => chorros[props.nivel.numero])
function estiloPose(personaje, pose) {
  const m = medidasPoses[personaje][pose]
  return { '--ancho-pose': m.ancho, '--centro-pose': m.centro, '--margen-inferior': m.margenInferior }
}

// --- Estado derivado (mismas condiciones que la escena completa)
const esperando = computed(() => props.carga !== null && !props.ataque)
const urgente = computed(() => esperando.value && props.carga >= 0.7)
const ataqueRival = computed(() => props.ataque?.id === 'rival')
const bloqueando = computed(() => props.bloqueado && ataqueRival.value)
const vidaBaja = computed(() => props.vidaCaballero > 0 && props.vidaCaballero <= 30)
const remateCruzado = computed(() => props.ataque?.final && props.ataque.remate === 'cruzado')
const remateSolar = computed(() => props.ataque?.final && props.ataque.remate === 'solar')
const victoria = computed(() => props.vidaRival === 0 && props.vidaCaballero > 0 && !props.ataque)
const efecto = computed(() => {
  if (!props.ataque || props.ataque.magia || props.ataque.remate) return undefined
  const id = props.ataque.id
  if (id === 'rival') return props.nivel.efecto
  return id === 'hachazo' ? '/images/bosque-del-alba/hachazo.svg' : `/images/caballero/${id}.svg`
})
const tiempos = computed(() => {
  if (!props.ataque) return null
  const d = props.ataque.duracion
  const impacto = Math.round(d * (remateSolar.value ? 0.84 : props.ataque.final ? 0.46 : 0.54))
  return { '--duracion': `${d}ms`, '--momento-impacto': `${impacto}ms`, '--duracion-reaccion': `${d - impacto}ms` }
})

// --- Línea de tiempo visual: temporizadores propios (no dependen de animationend).
// fase: 'previa' → 'contacto' (tras el impacto) → 'salida'. Los eventos impactar/terminar salen de aquí.
const fase = ref('previa')
const subfase = ref(0) // paso intermedio de la secuencia final / ataque del rival
let temporizadores = []
let secuencia = 0
const limpiar = () => { temporizadores.forEach(clearTimeout); temporizadores = [] }
const en = (ms, fn, id) => temporizadores.push(setTimeout(() => { if (id === secuencia) fn() }, Math.max(0, ms)))
function esperarVisible(fn, id) {
  if (id !== secuencia) return
  if (document.hidden) { temporizadores.push(setTimeout(() => esperarVisible(fn, id), 250)); return }
  fn()
}
const audios = { transformacion: null, carga: null }
function clip(nombre) {
  const a = new Audio(`/audio/combate/solar-${nombre}.mp3`)
  a.volume = 0.75 * volumenCanal('efectos')
  audios[nombre] = a
  return new Promise((resolve) => {
    const fin = () => { clearTimeout(limite); resolve() }
    const limite = setTimeout(fin, 12000)
    a.addEventListener('ended', fin, { once: true })
    a.addEventListener('error', fin, { once: true })
    a.play().catch(fin)
  })
}
function detenerAudio() { for (const k of Object.keys(audios)) { audios[k]?.pause(); audios[k] = null } }

watch(() => props.ataque, async (golpe) => {
  limpiar(); detenerAudio()
  const id = ++secuencia
  fase.value = 'previa'; subfase.value = 0
  if (!golpe) return
  const d = golpe.duracion
  const impacto = d * (golpe.remate === 'solar' && golpe.final ? 0.84 : golpe.final ? 0.46 : 0.54)
  if (golpe.final && golpe.remate === 'solar') {
    // Transformación solar: la secuencia espera su clip de audio (como la escena completa) y luego dispara la carga.
    await clip('transformacion')
    if (id !== secuencia) return
    clip('carga')
  }
  if (golpe.final) { en(d * 0.3, () => (subfase.value = 1), id); en(d * 0.46, () => (subfase.value = 2), id); en(d * 0.6, () => (subfase.value = 3), id) }
  else if (golpe.id === 'rival') en(d * 0.36, () => (subfase.value = 1), id)
  en(impacto + 40, () => esperarVisible(() => { fase.value = 'contacto'; emit('impactar'); en(d * 0.16, () => (fase.value = 'salida'), id) }, id), id)
  en(d + 80, () => esperarVisible(() => emit('terminar'), id), id)
})

// --- Pose única de cada luchador
const reaccion = computed(() => props.ataque && fase.value !== 'previa' && props.danoAplicado !== null)
const poseCaballero = computed(() => {
  if (props.sinArma) return 'sin-arma'
  const a = props.ataque
  if (!a) {
    if (props.vidaCaballero === 0) return 'caida'
    if (victoria.value) return 'final-3'
    if (esperando.value && props.carga > 0.06) return 'guardia'
    return props.vidaCaballero / 100 <= 0.34 ? 'dolor' : 'reposo'
  }
  if (a.esquivado) return 'esquiva'
  if (a.id === 'rival') {
    if (bloqueando.value) return 'guardia'
    if (reaccion.value && props.danoAplicado > 0) return props.vidaCaballero === 0 ? 'caida' : fase.value === 'contacto' ? 'golpeado' : 'dolor'
    return 'guardia'
  }
  if (a.final) {
    if (a.remate === 'solar') return fase.value === 'previa' && subfase.value < 2 ? 'reposo' : 'impacto-rayo'
    return ['anticipacion', 'final-1', 'final-2', 'final-3'][subfase.value] ?? 'final-3'
  }
  const familia = a.magia ? a.id : a.id
  if (fase.value === 'previa') return `preparacion-${familia}`
  if (fase.value === 'contacto') return `impacto-${familia}`
  return a.magia ? 'salida-magia' : `salida-${familia}`
})
const poseGuardian = computed(() => {
  const a = props.ataque
  const conDerrota = props.nivel.derrota
  if (!a) {
    if (props.vidaRival === 0) return conDerrota ? 'derrota-2' : 'caida'
    if (esperando.value) return props.carga >= 0.66 ? 'carga-2' : props.carga >= 0.33 ? 'carga-1' : (props.vidaRival / props.nivel.vida <= 0.34 ? 'dolor' : 'reposo')
    return props.vidaRival / props.nivel.vida <= 0.34 ? 'dolor' : 'reposo'
  }
  if (a.id === 'rival') {
    if (fase.value === 'salida') return 'recuperacion'
    if (fase.value === 'contacto') return 'ataque'
    return subfase.value >= 1 ? 'ataque' : 'preparacion'
  }
  if (a.esquivado) return 'reposo'
  if (reaccion.value) {
    if (props.vidaRival === 0) return conDerrota ? (fase.value === 'contacto' ? 'derrota-1' : 'derrota-2') : 'caida'
    return fase.value === 'contacto' ? 'retroceso' : 'tambaleo'
  }
  return 'reposo'
})

const claseCaballero = computed(() => ({
  emisor: props.ataque && !ataqueRival.value && !props.ataque.lado, receptor: props.ataque && ataqueRival.value && !props.ataque.esquivado && !bloqueando.value,
  tenso: urgente.value, golpe: fase.value === 'contacto' && props.ataque && ataqueRival.value && props.danoAplicado > 0
}))
const claseGuardian = computed(() => ({
  emisor: props.ataque && ataqueRival.value, receptor: props.ataque && !ataqueRival.value && !props.ataque.lado,
  golpe: fase.value === 'contacto' && props.ataque && !ataqueRival.value && props.danoAplicado > 0, esperando: esperando.value
}))

// --- Imagen visible: no se cambia hasta que la nueva pose está decodificada (evita parpadeos y descargas a mitad de golpe).
const srcCaballero = ref('')
const srcGuardian = ref('')
let vivo = true
async function mostrar(destino, deseada) {
  const url = imageUrl(deseada, 'lite')
  if (assets.listo(deseada, 'lite')) { destino.value = url; return }
  if (!destino.value) destino.value = url // primera imagen: se pide directamente
  await assets.decodificar(url, `nivel-${props.nivel.numero}`)
  const vigente = (destino === srcCaballero ? ruta(HEROE, poseCaballero.value) : ruta(props.nivel.arte, poseGuardian.value)) === deseada
  if (vivo && vigente) destino.value = url
}
watch(poseCaballero, (p) => mostrar(srcCaballero, ruta(HEROE, p)), { immediate: true })
watch(poseGuardian, (p) => mostrar(srcGuardian, ruta(props.nivel.arte, p)), { immediate: true })

// --- Precarga ligera del resto de poses, solo entre actividades (nunca mientras corre el reloj de una pregunta)
const poses = {
  [HEROE]: ['reposo', 'guardia', 'dolor', 'golpeado', 'esquiva', 'caida', 'anticipacion', 'final-1', 'final-2', 'final-3', 'sin-arma',
    ...['hachazo', 'barrido', 'escudo', 'rayo', 'fenix'].flatMap((a) => [`preparacion-${a}`, `impacto-${a}`]),
    'salida-hachazo', 'salida-barrido', 'salida-escudo', 'salida-magia']
}
let precargaViva = true
let precargando = false
async function precargar() {
  if (precargando) return
  precargando = true
  const lista = [
    ...poses[HEROE].map((p) => ruta(HEROE, p)),
    ...['reposo', 'preparacion', 'ataque', 'impacto', 'retroceso', 'tambaleo', 'recuperacion', 'dolor', 'caida', 'carga-1', 'carga-2', ...(props.nivel.derrota ? ['derrota-1', 'derrota-2'] : [])]
      .map((p) => ruta(props.nivel.arte, p))
  ].filter((r) => !assets.listo(r, 'lite'))
  for (const r of lista) {
    if (!precargaViva) break
    while (precargaViva && props.carga !== null && props.carga > 0) await new Promise((x) => setTimeout(x, 400))
    await prepareImages([r], { ambito: `nivel-${props.nivel.numero}`, profile: 'lite', concurrencia: 1 })
    await new Promise((x) => setTimeout(x, 60))
  }
  precargando = false
}
onMounted(() => { setTimeout(() => { if (precargaViva) precargar() }, 1200) })
onBeforeUnmount(() => { vivo = false; precargaViva = false; limpiar(); detenerAudio() })
</script>

<style scoped>
@property --alto { syntax: '<length>'; inherits: true; initial-value: 300px; }
@property --unidad-figura { syntax: '<length>'; inherits: true; initial-value: 60px; }
.escenario {
  --alto: var(--alto-escena, clamp(175px, 60dvh, 610px));
  position: relative; height: var(--alto); overflow: hidden; isolation: isolate;
  border: 1px solid #938060; border-radius: 10px; background: #293335 var(--fondo) center 66% / cover no-repeat;
}
.secuencia { position: absolute; inset: 0; }
.accion { position: relative; width: min(100%, calc(var(--alto) * 3.2)); height: 100%; margin-inline: auto; container-type: size; --suelo: 10%; }
.luchador, .chorro { --unidad-figura: min(18.5cqw, 45cqh); }
.luchador { position: absolute; width: 46%; height: 100%; bottom: 0; container-type: size; transition: transform 180ms ease-out; }
.caballero { left: 2.5%; }
.guardian { left: 51%; }
.luchador::before { content: ''; position: absolute; left: 50%; bottom: calc(var(--suelo) - 4.5%); width: min(72%, calc(var(--alto) * 0.87)); height: 9%; transform: translateX(-50%); background: radial-gradient(ellipse, #101112bd 5%, #10111262 44%, transparent 74%); }
.pose { position: absolute; left: calc(50% - var(--unidad-figura) * var(--centro-pose)); bottom: calc(var(--suelo) - var(--unidad-figura) * var(--margen-inferior)); width: calc(var(--unidad-figura) * var(--ancho-pose)); max-width: none; height: auto; transform-origin: center bottom; user-select: none; -webkit-user-drag: none; }
.chorro { position: absolute; z-index: 2; pointer-events: none; opacity: 0; left: calc(50% - var(--unidad-figura) * var(--centro-pose)); bottom: calc(var(--suelo) - var(--unidad-figura) * var(--margen-inferior)); width: calc(var(--unidad-figura) * 2.4); animation: lite-chorro calc(var(--duracion) * .5) ease-out calc(var(--duracion) * .3) both; }
.aura-lite { position: absolute; left: 50%; bottom: calc(var(--suelo) - 2%); width: 55%; aspect-ratio: 1.6; translate: -50% 0; border-radius: 50%; border: 3px solid #ffd54f; opacity: .7; }
.aura-lite.ira { border-color: #ff5a3c; }
.escenario.nivel-2 .aura-lite { border-color: #00e676; }
/* Avances y reacciones: solo transform y opacity */
.caballero.emisor { transform: translateX(0); animation: lite-avance var(--duracion) ease-in-out both; --avance: 70%; }
.guardian.emisor { animation: lite-avance var(--duracion) ease-in-out both; --avance: -45%; }
.luchador.golpe { animation: lite-sacudida 220ms linear 1; }
.caballero.tenso { animation: lite-tension .5s ease-in-out infinite; }
.arena-esquiva .caballero { transform: translateX(calc((4 + var(--pe)) * 2.1739%)); }
.arena-esquiva .caballero.emisor, .arena-esquiva .caballero.receptor { animation: none; }
.penumbra { position: absolute; inset: 0; background: #05070c; opacity: .45; }
.rotulo-final { position: absolute; z-index: 5; left: 50%; top: 14%; translate: -50% 0; padding: .2rem .8rem; color: #ffe9b8; font: 800 clamp(1.1rem, 4.5vw, 2.2rem) Georgia, serif; text-shadow: 0 2px 6px #000; white-space: nowrap; animation: lite-cifra var(--duracion) ease-out both; }
.tajos i { position: absolute; z-index: 4; left: 52%; top: 50%; width: 46%; height: 5px; translate: -50% -50%; background: linear-gradient(90deg, transparent, #fff, transparent); opacity: 0; rotate: -28deg; animation: lite-corte 300ms ease-out calc(var(--momento-impacto) - 120ms) both; }
.tajos i + i { rotate: 28deg; animation-delay: calc(var(--momento-impacto) + 80ms); }
.zona-coletazo { position: absolute; inset: 29% 71% 4% 0; z-index: 2; pointer-events: none; overflow: hidden; }
.zona-coletazo.derecha { inset-inline: 29% 42%; }
.advertencia-coletazo { position: absolute; inset: 20% 4% 0; border-bottom: 4px solid #efaa65; border-radius: 50%; background: #d65b352e; animation: lite-aviso var(--momento-impacto) ease-in both; }
.zona-coletazo img { width: 100%; height: 100%; object-fit: contain; opacity: 0; animation: lite-coletazo 600ms ease-out var(--momento-impacto) both; }
.zona-coletazo.derecha img { scale: -1 1; }
.resultado-esquiva { position: absolute; z-index: 12; left: 29%; top: 62%; translate: -50% -50%; padding: .35rem .7rem; border-radius: 6px; border: 1px solid #df8b78; background: #25141bf2; color: #ffb09e; font-size: clamp(1rem, 2.2vw, 1.2rem); font-weight: 800; pointer-events: none; }
.resultado-esquiva.acierto { border-color: #95d9ba; background: #112b26f2; color: #c3ffe2; }
.barrera-bloqueo { position: absolute; z-index: 3; left: 78%; bottom: 22%; width: 38%; aspect-ratio: 1; border: 4px solid #8fd4ff; border-radius: 50%; background: #8fd4ff30; display: grid; place-items: center; animation: lite-cifra 900ms ease-out both; }
.barrera-bloqueo b { color: #e8f6ff; font-size: clamp(.7rem, 2vw, 1rem); text-shadow: 0 1px 3px #000; }
.vida-baja { position: absolute; inset: 0; z-index: 1; pointer-events: none; box-shadow: inset 0 0 clamp(30px, 9vw, 110px) 6px #d32f2fa6; }
.escenario.urgente::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at center, transparent 52%, #c4121f 135%); opacity: .5; }
@keyframes lite-avance { 0%, 30% { transform: translateX(0); } 54% { transform: translateX(var(--avance)); } 80% { transform: translateX(var(--avance)); } 100% { transform: translateX(0); } }
@keyframes lite-sacudida { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3%); } 75% { transform: translateX(3%); } }
@keyframes lite-tension { 0%, 100% { transform: translateX(-2%); } 50% { transform: translateX(-3.4%); } }
@keyframes lite-cifra { 0% { opacity: 0; transform: translateY(8px); } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-14px); } }
@keyframes lite-corte { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
@keyframes lite-aviso { from { opacity: 0; } 75% { opacity: 1; } to { opacity: 0; } }
@keyframes lite-coletazo { 0%, 100% { opacity: 0; } 30%, 60% { opacity: 1; } }
@keyframes lite-chorro { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
</style>
