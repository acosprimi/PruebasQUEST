<template>
  <div class="eq-modal" role="dialog" aria-modal="true" :aria-label="t('Pergamino de lección')" @keydown.esc="emit('cerrar')">
    <article class="eq-caja pergamino">
      <template v-if="!leccion">
        <p class="eq-ceja">{{ t('Pergaminos del reino') }}</p>
        <h2>{{ t('Elige un pergamino') }}</h2>
        <button v-for="n in desbloqueado" :key="n" type="button" class="eq-opcion" @click="elegido = n">
          {{ n }}. {{ t(lecciones.niveles[n].titulo) }} <small>· {{ t(nombres[n]) }}</small>
        </button>
        <div class="eq-fila"><button type="button" class="eq-btn sec" @click="emit('cerrar')">{{ t('Cerrar') }}</button></div>
      </template>

      <template v-else>
        <p class="eq-ceja">{{ t('Lección') }} {{ numero }} · {{ paso + 1 }} / {{ total }}</p>
        <h2>{{ t(leccion.titulo) }}</h2>
        <p class="voz"><em>{{ t(leccion.voz) }}</em></p>

        <section v-if="paso === 0">
          <h3>{{ t('Propósito') }}</h3>
          <p>{{ t(leccion.proposito) }}</p>
          <ul><li v-for="p in leccion.puntos" :key="p" lang="es">{{ t(p) }}</li></ul>
        </section>

        <section v-else-if="paso === 1">
          <h3>{{ t('Vocabulario') }}</h3>
          <table class="eq-tabla">
            <tbody><tr v-for="v in leccion.vocabulario" :key="v.en"><td lang="en"><strong>{{ v.en }}</strong></td><td>{{ t(v.es) }}</td></tr></tbody>
          </table>
          <h3>{{ t('Ejemplos') }}</h3>
          <p v-for="e in leccion.ejemplos" :key="e.en" lang="en" class="ejemplo">{{ e.en }}<br><small lang="es">{{ t(e.es) }}</small></p>
        </section>

        <section v-else-if="paso === 2">
          <h3>{{ t(leccion.contraste.titulo) }}</h3>
          <div class="contraste">
            <div><strong lang="en">{{ leccion.contraste.a.en }}</strong><p>{{ t(leccion.contraste.a.nota) }}</p></div>
            <div><strong lang="en">{{ leccion.contraste.b.en }}</strong><p>{{ t(leccion.contraste.b.nota) }}</p></div>
          </div>
          <p class="regla"><b>{{ t('Regla para repasar') }}</b> {{ t(leccion.regla) }}</p>
        </section>

        <section v-else-if="paso < 3 + leccion.practica.length">
          <h3>{{ t('Pequeño entrenamiento') }}</h3>
          <p>{{ t(actual.enunciado) }}</p>
          <button v-for="(o, i) in actual.opciones" :key="o" type="button" class="eq-opcion" lang="en"
            :class="{ bien: respondido !== null && i === actual.correcta, mal: respondido === i && i !== actual.correcta }"
            :disabled="respondido !== null && respondido !== i && i !== actual.correcta" @click="responder(i)">{{ o }}</button>
          <p v-if="respondido !== null" role="status" class="porque">
            <strong>{{ respondido === actual.correcta ? t('¡Correcto!') : t('Casi: revisa la regla.') }}</strong> {{ t(actual.porque) }}
          </p>
        </section>

        <section v-else>
          <h3>{{ t('Antes del combate') }}</h3>
          <p>{{ t(leccion.guia) }}</p>
        </section>

        <div class="eq-fila acciones">
          <button type="button" class="eq-btn sec" :disabled="paso === 0" @click="retroceder">{{ t('Anterior') }}</button>
          <button v-if="paso < total - 1" type="button" class="eq-btn" :disabled="bloqueado" @click="avanzar">{{ t('Siguiente') }}</button>
          <button v-else type="button" class="eq-btn" @click="terminar">{{ previa ? t('Ir al combate') : t('Cerrar') }}</button>
          <button v-if="previa" type="button" class="eq-btn sec" @click="terminar">{{ t('Omitir lección') }}</button>
          <button v-else-if="!nivelFijo" type="button" class="eq-btn sec" @click="elegido = null">{{ t('Otros pergaminos') }}</button>
        </div>
      </template>
    </article>
  </div>
</template>

<script setup>
import lecciones from '~/data/lecciones.json'
// nivel: número fijo (lección previa al combate o consulta de una zona). Sin nivel: selector de pergaminos del mapa.
const props = defineProps({ nivel: { type: Number, default: null }, previa: Boolean, desbloqueado: { type: Number, default: 1 } })
const emit = defineEmits(['cerrar', 'terminar'])
const { t } = useLanguage()
const nombres = { 1: 'Bosque del Alba', 2: 'Puente del Río', 3: 'Torre del Viento', 4: 'Puerta Real' }
const nivelFijo = computed(() => props.nivel !== null)
const elegido = ref(props.nivel)
const numero = computed(() => elegido.value)
const leccion = computed(() => (elegido.value ? lecciones.niveles[elegido.value] : null))
const paso = ref(0)
const respondido = ref(null)
const total = computed(() => (leccion.value ? 4 + leccion.value.practica.length : 0))
const actual = computed(() => leccion.value?.practica[paso.value - 3])
// En la práctica hay que intentar la pregunta para continuar (el error no penaliza nada).
const bloqueado = computed(() => paso.value >= 3 && paso.value < 3 + (leccion.value?.practica.length ?? 0) && respondido.value === null)
watch(elegido, () => { paso.value = 0; respondido.value = null })
function responder(i) { if (respondido.value === null) respondido.value = i }
function avanzar() { paso.value++; respondido.value = null }
function retroceder() { paso.value--; respondido.value = null }
function terminar() { emit('terminar'); emit('cerrar') }
</script>

<style scoped>
.pergamino { max-width: 38rem; }
.voz { color: #d9b873; margin: 0 0 .6rem; }
.ejemplo { margin: .3rem 0; font-size: 1.05rem; }
.ejemplo small { color: #c4c7cd; }
.contraste { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .6rem; }
.contraste > div { padding: .5rem; border: 1px solid #6b5a3c; border-radius: 6px; background: #19212c; }
.regla { margin-top: .7rem; padding: .5rem; border-left: 3px solid #f2d28c; background: #2a2118; }
.porque { margin-top: .5rem; }
.acciones { margin-top: 1rem; justify-content: flex-end; }
</style>
