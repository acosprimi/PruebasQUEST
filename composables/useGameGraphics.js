// Perfiles gráficos (Automático, Alta, Equilibrada, Lite) y acceso a las imágenes del juego.
// El perfil efectivo (quality) es siempre alta | equilibrada | lite. En modo Automático parte de lo observado
// en sesiones anteriores y solo baja de perfil ante problemas sostenidos de fluidez (nunca sube sola,
// para evitar oscilaciones). Una preferencia manual del estudiante se respeta siempre.
import { useAssetManager, fondoNivel, recursosEsenciales } from './useAssetManager.js'
import { perfilInferior } from './useFramePacing.js'

const PROFILES = ['alta', 'equilibrada', 'lite']
const MODOS = ['auto', ...PROFILES]

export function useGameGraphics() {
  const quality = useState('english-quest-graphics-quality', () => 'equilibrada')
  const qualityMode = useState('english-quest-graphics-mode', () => 'auto')
  const preferencesLoaded = useState('english-quest-graphics-loaded', () => false)
  const introSeen = useState('english-quest-intro-seen', () => false)
  const recomendacion = useState('english-quest-graphics-recommendation', () => null)
  const preparacion = useState('english-quest-graphics-preparation', () => ({ etiqueta: '', loaded: 0, total: 0, failed: 0 }))
  const { t } = useLanguage()
  const { language } = useLanguage()
  const progreso = usePlayerProgress()
  const assets = useAssetManager(() => quality.value)

  function loadPreferences() {
    if (!import.meta.client || preferencesLoaded.value) return
    progreso.cargar()
    const a = progreso.estado.ajustes
    qualityMode.value = a.calidad
    quality.value = a.calidad === 'auto' ? a.calidadAuto : a.calidad
    introSeen.value = a.introVista
    language.value = a.idioma
    preferencesLoaded.value = true
    watch(language, (valor) => progreso.ajustar({ idioma: valor }))
  }

  // Cambiar de modo/perfil libera las imágenes del perfil anterior (las del nuevo se preparan al necesitarlas).
  function setQualityMode(valor) {
    if (!MODOS.includes(valor)) return
    const a = progreso.estado.ajustes
    const antes = quality.value
    qualityMode.value = valor
    quality.value = valor === 'auto' ? a.calidadAuto : valor
    recomendacion.value = null
    progreso.ajustar({ calidad: valor })
    if (antes !== quality.value) assets.liberarTodoExcepto()
  }
  const setQuality = setQualityMode

  // Recomendación de un perfil inferior (llega desde useFramePacing). En Automático se aplica en un momento seguro
  // (lo decide quien muestra la escena); en manual solo se ofrece.
  function recomendar(perfil) {
    if (PROFILES.includes(perfil) && PROFILES.indexOf(perfil) > PROFILES.indexOf(quality.value)) recomendacion.value = perfil
  }
  function aplicarRecomendacion() {
    const perfil = recomendacion.value
    if (!perfil) return
    const a = progreso.estado.ajustes
    recomendacion.value = null
    if (qualityMode.value === 'auto') {
      progreso.ajustar({ calidadAuto: perfil })
      quality.value = perfil
      assets.liberarTodoExcepto()
    } else setQualityMode(perfil)
    return a
  }
  function descartarRecomendacion() { recomendacion.value = null }
  // Vuelve a evaluar desde cero (Automático empieza otra vez en Equilibrada)
  function reevaluarAutomatico() { progreso.ajustar({ calidadAuto: 'equilibrada' }); setQualityMode('auto') }

  function finishIntro() { introSeen.value = true; progreso.ajustar({ introVista: true }) }

  function imageUrl(src, profile = quality.value) { return assets.resolver(src, profile) }
  function decodeImage(src) { return import.meta.client ? assets.decodificar(imageUrl(src)) : Promise.resolve() }
  function prepareImages(sources, opciones = {}) {
    const { onProgress, ...resto } = opciones
    return assets.preparar(sources, { ...resto, onProgress: (p) => { preparacion.value = { ...preparacion.value, ...p }; onProgress?.(p) } })
  }
  function levelEssentials(level, profile = quality.value) { return recursosEsenciales(level, profile) }
  function levelBackground(level, profile = quality.value) { return fondoNivel(level, profile) }
  function releaseScope(nombre) { assets.liberarAmbito(nombre) }
  function releaseLevelsExcept(numero) { for (let i = 1; i <= 4; i++) if (i !== numero) assets.liberarAmbito(`nivel-${i}`) }

  return {
    quality, qualityMode, modoCalidad: qualityMode, introSeen, preferencesLoaded, recomendacion, preparacion, assets, t,
    loadPreferences, setQuality, setQualityMode, recomendar, aplicarRecomendacion, descartarRecomendacion, reevaluarAutomatico,
    finishIntro, imageUrl, decodeImage, prepareImages, levelEssentials, levelBackground, releaseScope, releaseLevelsExcept,
    perfilInferior
  }
}
