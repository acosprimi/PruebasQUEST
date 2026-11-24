<template>
  <span hidden aria-hidden="true" />
</template>

<script setup>
// Una sola música activa a la vez, con el volumen del canal «música» y recuperación ante el bloqueo
// de reproducción automática (se inicia con el primer toque, tecla o clic).
const props = defineProps({
  ruta: { type: String, required: true },
  volumen: { type: Number, default: 0.5 }
})
const progreso = usePlayerProgress()
const audio = ref(null)
const audioEnPrimerPlano = useState('audio-en-primer-plano', () => false)

const iniciarMusica = () => {
  if (audio.value && audio.value.paused && !audioEnPrimerPlano.value) audio.value.play().catch(() => {})
}
const desbloquear = () => { iniciarMusica(); quitarDesbloqueo() }
function quitarDesbloqueo() {
  for (const tipo of ['pointerdown', 'keydown']) document.removeEventListener(tipo, desbloquear)
}

watch(audioEnPrimerPlano, (reproducirVoz) => {
  if (!audio.value) return
  if (reproducirVoz) audio.value.pause()
  else iniciarMusica()
})
watch(() => progreso.estado.ajustes.volumen.musica, aplicarVolumenMusica)

onMounted(() => {
  audio.value = new Audio(rutaAudio(props.ruta))
  audio.value.loop = true
  registrarMusica(audio.value, props.volumen)
  if (!audioEnPrimerPlano.value) {
    audio.value.play().catch(() => {
      for (const tipo of ['pointerdown', 'keydown']) document.addEventListener(tipo, desbloquear, { once: true })
    })
  }
})

onUnmounted(() => {
  quitarDesbloqueo()
  if (audio.value) {
    audio.value.pause()
    audio.value.currentTime = 0
    liberarMusica(audio.value)
    audio.value.src = ''
    audio.value = null
  }
})
</script>
