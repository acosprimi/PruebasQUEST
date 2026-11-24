<!--
  HomeOptions.vue - VENTANA "OPCIONES"
  Se abre y se cierra desde fuera con v-model:  <HomeOptions v-model="showOptions" />
  Idioma, calidad gráfica (Automático / Alta / Equilibrada / Lite), accesibilidad y volumen por canal.
  Los ajustes de accesibilidad y audio no dependen del perfil gráfico y se guardan en el almacenamiento local.
-->
<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card color="brown-darken-4" rounded="lg" border>
      <v-card-title class="text-amber-lighten-2">{{ t('Opciones') }}</v-card-title>

      <v-card-text class="opciones-cuerpo">
        <p class="text-subtitle-1 mb-2">{{ t('Idioma') }}</p>
        <v-btn-toggle v-model="language" mandatory color="amber-lighten-2" divided :aria-label="t('Selector de idioma')">
          <v-btn value="es" :aria-pressed="language === 'es'">{{ t('Español') }}</v-btn>
          <v-btn value="en" :aria-pressed="language === 'en'">{{ t('Inglés') }}</v-btn>
        </v-btn-toggle>

        <p class="text-subtitle-1 mt-5 mb-2">{{ t('Calidad gráfica') }}</p>
        <v-btn-toggle :model-value="qualityMode" mandatory color="amber-lighten-2" divided
          :aria-label="t('Selector de calidad gráfica')" @update:model-value="setQualityMode">
          <v-btn value="auto">{{ t('Automático') }}</v-btn>
          <v-btn value="alta">{{ t('Alta') }}</v-btn>
          <v-btn value="equilibrada">{{ t('Equilibrada') }}</v-btn>
          <v-btn value="lite">Lite</v-btn>
        </v-btn-toggle>
        <p class="text-caption mt-2">
          {{ t('Perfil en uso') }}: <strong>{{ t(nombres[quality]) }}</strong>.
          {{ t('Si lo cambias durante una batalla, se aplica entre rondas sin perder el estado de la partida.') }}
        </p>
        <v-btn v-if="qualityMode === 'auto' && ajustes.calidadAuto !== 'equilibrada'" size="small" variant="text" @click="reevaluarAutomatico">{{ t('Volver a evaluar la calidad') }}</v-btn>

        <p class="text-subtitle-1 mt-5 mb-2">{{ t('Accesibilidad') }}</p>
        <div class="ajuste">
          <label for="ajuste-texto">{{ t('Tamaño del texto') }}</label>
          <select id="ajuste-texto" :value="ajustes.textoEscala" @change="cambiar({ textoEscala: Number($event.target.value) })">
            <option :value="1">{{ t('Normal') }}</option><option :value="1.15">{{ t('Grande') }}</option><option :value="1.3">{{ t('Muy grande') }}</option>
          </select>
        </div>
        <div class="ajuste">
          <label for="ajuste-movimiento">{{ t('Movimiento') }}</label>
          <select id="ajuste-movimiento" :value="ajustes.movimiento" @change="cambiar({ movimiento: $event.target.value })">
            <option value="sistema">{{ t('Según el sistema') }}</option><option value="reducido">{{ t('Reducido') }}</option><option value="completo">{{ t('Completo') }}</option>
          </select>
        </div>
        <div class="ajuste">
          <label for="ajuste-tiempo">{{ t('Tiempo en las actividades') }}</label>
          <select id="ajuste-tiempo" :value="ajustes.tiempoExtra" :disabled="ajustes.practica" @change="cambiar({ tiempoExtra: Number($event.target.value) })">
            <option :value="1">{{ t('Normal') }}</option><option :value="1.5">{{ t('Ampliado ×1,5') }}</option><option :value="2">{{ t('Ampliado ×2') }}</option>
          </select>
        </div>
        <label class="marca"><input type="checkbox" :checked="ajustes.practica" @change="cambiar({ practica: $event.target.checked })"> {{ t('Modo de práctica: sin límite de tiempo (no suma estrellas ni experiencia)') }}</label>
        <label class="marca"><input type="checkbox" :checked="ajustes.altoContraste" @change="cambiar({ altoContraste: $event.target.checked })"> {{ t('Alto contraste') }}</label>
        <label class="marca"><input type="checkbox" :checked="ajustes.sinDestellos" @change="cambiar({ sinDestellos: $event.target.checked })"> {{ t('Reducir destellos intensos') }}</label>
        <label class="marca"><input type="checkbox" :checked="ajustes.sinCamara" @change="cambiar({ sinCamara: $event.target.checked })"> {{ t('Sin movimientos de cámara') }}</label>

        <p class="text-subtitle-1 mt-5 mb-2">{{ t('Volumen') }}</p>
        <div v-for="canal in canales" :key="canal.id" class="ajuste">
          <label :for="`vol-${canal.id}`">{{ t(canal.nombre) }}</label>
          <input :id="`vol-${canal.id}`" type="range" min="0" max="100" step="5" :value="Math.round(ajustes.volumen[canal.id] * 100)"
            :aria-valuetext="`${Math.round(ajustes.volumen[canal.id] * 100)} %`"
            @input="cambiar({ volumen: { ...ajustes.volumen, [canal.id]: $event.target.value / 100 } })">
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="progreso" variant="text" color="amber-lighten-2" @click="open = false; emit('estadisticas')">{{ t('Estadísticas') }}</v-btn>
        <v-spacer />
        <v-btn color="amber" variant="flat" @click="open = false">{{ t('Cerrar') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
const open = defineModel({ type: Boolean, default: false })
defineProps({ progreso: { type: Boolean, default: false } })
const emit = defineEmits(['estadisticas'])
const { language, t } = useLanguage()
const { quality, qualityMode, setQualityMode, reevaluarAutomatico } = useGameGraphics()
const store = usePlayerProgress()
const ajustes = computed(() => store.estado.ajustes)
const cambiar = (cambios) => store.ajustar(cambios)
const nombres = { alta: 'Alta', equilibrada: 'Equilibrada', lite: 'Lite' }
const canales = [{ id: 'musica', nombre: 'Música' }, { id: 'efectos', nombre: 'Efectos' }, { id: 'voces', nombre: 'Voces' }]
</script>

<style scoped>
.opciones-cuerpo { max-height: 70vh; }
.ajuste { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 44px; }
.ajuste select { min-height: 40px; padding: 0 .5rem; color: #fff; background: #2b1d14; border: 1px solid #b3955c; border-radius: 6px; }
.ajuste input[type='range'] { flex: 1; max-width: 55%; min-height: 32px; accent-color: #f2d28c; }
.marca { display: flex; align-items: flex-start; gap: .6rem; min-height: 44px; padding: .35rem 0; cursor: pointer; line-height: 1.3; }
.marca input { width: 22px; height: 22px; margin-top: 1px; accent-color: #f2d28c; flex: none; }
</style>
