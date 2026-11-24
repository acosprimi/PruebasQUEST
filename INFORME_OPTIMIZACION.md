# Informe de optimización – English Quest

Repositorio de partida: `acevedocristian650-ai/OVA-EnglishQuest` (Vue 3 + Nuxt 3 + Vuetify, sin Pinia ni bases de datos).
Este informe distingue lo **implementado y verificado** de lo **pendiente o solo parcial**. No hay mediciones de FPS en celulares reales.

## 1. Diagnóstico inicial

Línea base: `npm test` pasaba (validación de preguntas y simulación de combate). La simulación extraía con una expresión regular el `<script>` de `CombatDesafio.vue` y lo ejecutaba con un «mini Vue» propio. No probaba un módulo importable.

### Problemas confirmados leyendo el código
| # | Problema | Dónde |
|---|----------|-------|
| 1 | `imageUrl()` solo elegía variante si el original terminaba en `.png`. Los WebP originales (guardia, carga, final, esquiva, poses nuevas, ~27 archivos) nunca tenían versión Lite. | `useGameGraphics.js` |
| 2 | El «modo Lite» ocultaba cosas con CSS (`display:none`) dentro de la misma escena pesada. Cada luchador mantenía ~25 `<img>` montadas, además de motas, auras y capas. | `CombatEscena.vue`, `responsive.css` |
| 3 | Las bolas del hacha se movían con `props.restante`, que el reloj educativo actualiza cada 100 ms (10 Hz). Se suavizaba con `transition: left`. Cada movimiento táctil llamaba a `getBoundingClientRect()` de cada bola y el campo se medía una sola vez. | `CombatHacha.vue` |
| 4 | La estela del hacha eran hasta 12 `<line>` reactivas con `filter: drop-shadow`, que se redibujaban en cada movimiento. | `CombatHacha.vue` |
| 5 | Reglas, reloj, temporizadores y animación estaban mezclados en un componente de 1144 líneas. El golpe se aplicaba desde eventos de animación, con un respaldo de temporizadores solo dentro de la escena. | `CombatDesafio.vue` |
| 6 | Caché de imágenes por número de entradas (48), sin tener en cuenta dimensiones ni memoria. No se liberaba nada al salir de la batalla o al cambiar de perfil. | `useGameGraphics.js` |
| 7 | Archivos `tw-*` (28) y `caballero/ascension.webp` sin referencia alguna. | `public/images` |
| 8 | Audio: un `new Audio()` por cada efecto y cada botón, sin volumen por canal ni límite de simultáneos. Música sin registro único. | `components/audio/*` |
| 9 | «Saltar introducción» omitía la preparación sin avisar y sin activar Lite. | `GamePreparation.vue` |
| 10 | Progreso: solo `english-quest-unlocked-level` y `english-quest-graphics-v1`. No había estadísticas, versionado ni validación. | `pages/map.vue` |

### Causas de rendimiento
- **Confirmadas por inspección del código y del DOM**: DOM de escena (ver tabla del punto 5), reactividad a 10 Hz en el hacha, estela reactiva con filtros y Lite solo por CSS.
- **Sospechadas, no medidas**: coste de composición de los filtros y sombras de las poses, coste de las animaciones SVG de los fondos en móviles de gama baja, y la fuente de Google Fonts importada en `layouts/default.vue` (solicitud externa que no he tocado).

## 2. Cambios realizados (por fase)

1. **Imágenes y memoria**
   - `scripts/generar-variantes.mjs` (requiere ImageMagick) genera las variantes `-lite.webp` que faltan, escribe el manifiesto `data/variantes-imagenes.json` y con `--verificar` comprueba que los archivos existen y que las variantes conservan proporción y transparencia (tolerancia 1,5 %), que el manifiesto coincide con `public/images` y que no hay referencias literales a archivos inexistentes. `--eliminar-obsoletos` borra lo que no tiene ninguna referencia.
   - Se generaron **27 variantes Lite** (60 % del tamaño, misma proporción y alfa) para los WebP que no tenían.
   - Se eliminaron **29 archivos** sin referencia: 28 `tw-*` y `ascension.webp`. Antes de borrarlos se comprobó que no había referencias directas, dinámicas ni indirectas.
   - Los fondos estáticos de Lite eran casi vacíos (rayos de luz sobre fondo oscuro). Se regeneraron a partir del SVG animado de cada nivel y ahora conservan el escenario (960×540, 6–15 KB).
   - `composables/useAssetManager.js`:
     - `resolverImagen` consulta el manifiesto y nunca pide un archivo que no exista. Cubre PNG y WebP, y SVG o rutas desconocidas pasan sin tocar.
     - Cadena de respaldo por perfil.
     - La caché guarda las dimensiones reales y su coste teórico RGBA, con presupuesto por perfil (96 / 64 / 28 MB), y expulsa primero lo que ningún ámbito necesita, por uso reciente.
     - Ámbitos `menu`, `nivel-N`: se liberan al volver al mapa, al cambiar de nivel y al cambiar de perfil.
     - Las solicitudes duplicadas comparten una descarga. Los fallos no se guardan, de modo que un reintento vuelve a pedir.
   - Soltar una referencia **no garantiza** que el navegador libere los píxeles; el código solo lo permite.
2. **Motor de combate**
   - `composables/useCombatEngine.js` y `useCombatClock.js` concentran vida, daño, furia, curación, ataques, contraataques, bloqueos, esquivas, remates, temporizadores, fases, victoria/derrota e historial. Solo importan `vue`.
   - `CombatDesafio.vue` pasó de 1144 a ~780 líneas, la mayoría CSS, y solo dibuja lo que decide el motor.
   - Vigilancia propia: si la escena no avisa «impactar» o «terminar» (animación interrumpida, desactivada o pestaña oculta), el motor aplica el golpe una sola vez. En el solar espera el audio.
   - Reloj con tiempo real, que se detiene con pestaña oculta, pausa o ayuda abierta.
   - Contadores de combate separados del historial educativo.
   - Pausa segura, tiempo ampliado (×1,5 / ×2) y práctica sin límite.
3. **Lite real**: `CombatEscenaLite.vue` y `CombatEfectosLite.vue`.
   - Una sola `<img>` por luchador, que cambia de pose solo cuando la nueva ya está decodificada. Fondo estático. Animaciones solo con `transform`/`opacity`.
   - Conserva proyectiles, advertencias de coletazo, escudo, cifras de daño y curación, auras simples, remates simplificados (cruzado, sombras y solar con sus dos clips de audio) y las poses originales con las medidas de `medidas-poses.json`.
   - Las escenas se cargan con `defineAsyncComponent`. En el navegador, con Lite **no se descarga la escena pesada**.
   - El cambio de perfil durante una batalla solo se aplica entre rondas.
   - Equilibrada reduce partículas **reales** (la mitad de motas, chispas, partículas de carga y primer plano, y sangre) y usa los WebP completos.
4. **Actividades**: `CombatHacha.vue` reescrito.
   - Su propio bucle `requestAnimationFrame` con tiempo real, separado del reloj educativo. Las bolas y el hacha se mueven con `transform`, sin reactividad a alta frecuencia.
   - La colisión barre el segmento recorrido por la hoja contra la posición analítica de cada bola, así que un movimiento rápido no la atraviesa.
   - Medidas del campo en caché, con `ResizeObserver` y `orientationchange`.
   - Estela en dos `<polyline>` actualizadas directamente. Como máximo 3 destellos. Gestión de `pointercancel` y `lostpointercapture`. Un solo puntero activo. Alternativa con las flechas del teclado.
   - Se revisó solo esta actividad; las demás se conservaron tal cual.
5. **Carga y transiciones**
   - `GamePreparation.vue`: Automático / Alta / Equilibrada / Lite. Progreso **real** (imágenes decodificadas / total). «Comenzar en modo Lite» activa de verdad Lite. La advertencia es visible mientras se prepara. «Saltar introducción» (narrativa) queda aparte y conserva el perfil elegido. Hay opción «Reintentar carga».
   - `MapEncuentroTransicion.vue` prepara las imágenes del nivel en el ámbito `nivel-N`. Los reintentos reutilizan lo ya decodificado.
6. **Audio**: `useAudioMixer.js`.
   - Volumen independiente de música, efectos y voces.
   - Una sola música a la vez y reutilización de elementos de audio.
   - Máximo 8 efectos y 2 voces simultáneos.
   - Liberación de los audios de combate al volver al mapa. Desbloqueo con `pointerdown` o tecla ante el bloqueo del navegador. Nada se descarga por adelantado.
7. **Calidad adaptativa**: `useFramePacing.js` (reescrito).
   - Ventanas de 2 s. Una caída aislada se ignora. Se necesita una racha de 3 ventanas lentas, o 5 de las últimas 7. Las ventanas con pocas muestras (pestaña limitada) no cuentan. Se usan tareas largas cuando el navegador las mide.
   - **No se usa RAM, modelo ni resolución.**
   - Solo recomienda bajar de perfil. En Automático se aplica en un momento seguro (mapa, o entre rondas). En manual se ofrece con un botón. Tras descartarla no se insiste durante 60 s.
   - Panel `DevDiagnostico.vue`, solo en desarrollo: FPS, duración de fotograma, fotogramas lentos, tareas largas, perfil, recursos y memoria teórica, estado de la precarga, memoria JS (si existe) y recomendación. Un único bucle acumula contadores y la pantalla se actualiza una vez por segundo. En producción el módulo no se incluye.
8. **Progreso y estadísticas**: `usePlayerProgress.js`, almacenamiento versionado v2.
   - Validación y corrección de campos. Migración de las claves antiguas sin borrarlas. Recuperación de datos corruptos (copia en `…-corrupto`). Detección de almacenamiento lleno o bloqueado, con el juego funcionando en memoria. Exportación e importación JSON validada. Reinicio con confirmación.
   - Niveles, intentos, victorias y derrotas, mejores resultados, estrellas (1 por victoria, 2.ª ≥ 70 % de precisión, 3.ª ≥ 90 % con ≥ 40 de vida), precisión por temática y por tipo, tiempo en actividades, refuerzo, última sesión y rangos medievales (Aprendiz de escudero … Campeón del Reino).
   - La experiencia **se deriva de los mejores resultados**: repetir sin mejorar da 0 XP.
   - **Educación y combate separados**: el hacha no cuenta como evidencia de inglés.
   - Ya no se guarda el progreso en `localStorage` directamente desde `pages/map.vue`.
9. **Pedagogía**
   - `data/lecciones.json` con 4 pergaminos (propósito, puntos, vocabulario, ejemplos, contraste y 2 prácticas con explicación). `LessonScroll.vue` se muestra antes de cada batalla (omisible) y se consulta desde «Pergaminos» en el mapa.
   - Retroalimentación en cada ronda: por qué es correcta, tu respuesta, regla a repasar y cómo resolver algo parecido.
   - `CombatInforme.vue`: informe de nivel (precisión, tema dominado o por reforzar, preguntas falladas con explicación, rendimiento de combate aparte, recompensas y rango nuevo) e informe general al completar los 4 niveles.
   - `PracticePanel.vue`: refuerzo sin consecuencias con **variantes distintas** de la misma ronda. Dos aciertos seguidos la sacan de la lista. Soporta cortar, escuchar, esquiva-frase, zona, errores, ordenar, proteger-aliado, romper-hechizo, parejas y clasificar.
   - `ProgressPanel.vue`: crónica del caballero.
   - **No se amplió el banco de preguntas** (no hizo falta) ni se cambió su contenido. Las lecciones usan las estructuras que ya evalúa.
10. **Accesibilidad e interfaz**
   - Tamaño de texto (3 niveles) y alto contraste. Movimiento sistema/reducido/completo (respeta `prefers-reduced-motion`). Reducir destellos y quitar movimientos de cámara: las animaciones siguen corriendo, de modo que los eventos y la lógica no cambian.
   - Foco visible, elementos táctiles ≥ 44 px, pausa con botón o tecla Esc, tiempo ampliado, práctica sin límite y volumen por canal.
   - Todo independiente del perfil gráfico y guardado localmente.
   - Todos los textos nuevos pasan por `t()` y `data/ingles.json`. `scripts/validar-traducciones.mjs` lo comprueba.

## 3. Archivos

**Creados**: `composables/{useAssetManager,useCombatEngine,useCombatClock,useAudioMixer,usePlayerProgress}.js`, `components/combat/{CombatEscenaLite,CombatEfectosLite,CombatInforme}.vue`, `components/lessons/LessonScroll.vue`, `components/progress/{ProgressPanel,PracticePanel}.vue`, `components/dev/DevDiagnostico.vue`, `data/{lecciones,variantes-imagenes}.json`, `scripts/{generar-variantes,pruebas-modulos,validar-traducciones,e2e-navegador}.mjs`, 27 `*-lite.webp`, este informe.

**Modificados**: `composables/{useGameGraphics,useFramePacing}.js`, `components/combat/{CombatDesafio,CombatHacha,CombatEscena,CombatEfectos}.vue`, `components/home/{GamePreparation,HomeOptions}.vue`, `components/map/MapEncuentroTransicion.vue`, `components/audio/{Efecto,SonidoBoton,MusicaHome}.vue`, `pages/map.vue`, `app.vue`, `assets/css/responsive.css`, `data/ingles.json`, `scripts/simular-combate.mjs`, `nuxt.config.js`, `package.json`, los 4 fondos de `public/images/arenas/static/`.

**Eliminados**: 28 `tw-*` (todos los perfiles) y `caballero/ascension.webp`.

### Decisiones de arquitectura
- Los composables con lógica de juego dependen solo de `vue` y reciben sus dependencias externas (reloj, almacenamiento, creación de imágenes). Así los importan tanto Nuxt como Node, y las pruebas ejecutan **el mismo código de producción**.
- La lógica de combate no recibe el perfil gráfico, y una prueba lo comprueba.
- `package.json`: `build` ahora es `nuxt generate` y `nuxt.config.js` fija `nitro.output.publicDir = 'dist'`, para que `npm run build` deje `dist/index.html` (despliegue estático). Se añadió `npm run variantes`.
- `nuxt.config.js`: se desactivó `devtools` (era una sobrecarga solo de desarrollo).

## 4. Comparaciones (calculadas por `scripts/generar-variantes.mjs`)

Se midieron 84 recursos de `public/images` (PNG/WebP).

| Perfil | Descarga total | Memoria decodificada teórica (RGBA) |
|---|---|---|
| Alta | 18,51 MB | 111,5 MB |
| Equilibrada | 5,16 MB | 111,5 MB |
| Lite | 1,55 MB | 37,3 MB |

- Equilibrada reduce la descarga, pero **no** la memoria decodificada (mismas dimensiones). Lite reduce ambas.
- Lite tiene más variantes que antes (se añadieron las 27 de los WebP).

### Medición en navegador (Chromium headless, emulación móvil 844×390 @2x, compilación de producción)
Nivel 1, justo después de entrar en combate (`scripts/e2e-navegador.mjs`):

| Perfil | `<img>` en la escena | Nodos en la escena | Escena cargada | Imágenes pedidas | 404 / errores |
|---|---|---|---|---|---|
| Alta | 40 | 93 | pesada | 30 PNG, 13 WebP, 1 SVG animado | 0 / 0 |
| Equilibrada | 40 | 77 | pesada | 43 WebP | 0 / 0 |
| Lite | 2 | 16 | **solo Lite** (no se pidió el JS/CSS de la escena pesada) | 40 `-lite.webp`, 0 PNG | 0 / 0 |

Son conteos de DOM y red, **no de FPS**.

## 5. Pruebas

`npm test` encadena y todas pasan:
- `validar-preguntas.mjs`: banco completo y variantes (sin cambios de criterio).
- `simular-combate.mjs`: **conserva todos sus criterios**, pero ahora ejecuta el módulo real `useCombatEngine.js` con Vue real. Al hacerlo salió un fallo propio de producción, que se corrigió: la vigilancia comparaba un objeto con su proxy reactivo y nunca se habría activado.
- `pruebas-modulos.mjs` (nuevo, ~65 comprobaciones):
  - **Combate**: daño una sola vez, vigilancia sin eventos de la escena, limpieza de temporizadores, pausa, pestaña oculta, tiempo ampliado, práctica, bloqueo, curación, furia, remates, victoria, derrota y contadores.
  - **Almacenamiento y progreso**: migración, datos corruptos, valores fuera de rango, almacenamiento lleno o bloqueado, XP sin repetición, hacha no lingüística, refuerzo, exportar/importar, reinicio y rangos.
  - **Imágenes**: variantes por perfil, recursos esenciales de los 4 niveles en los 3 perfiles (existen todos), proporción y transparencia, y gestor de caché.
  - **Fluidez**: caída momentánea frente a problema sostenido, ventanas ignoradas y solo bajar de perfil.
- `validar-traducciones.mjs` y `generar-variantes.mjs --verificar`.
- `npm run build` / `npm run generate`: correctos (`dist/index.html`, 36 MB).
- **Navegador**: para cada perfil (Alta, Equilibrada y Lite) se probó mapa → lección previa → transición → combate → pausa y reanudación → agotar el tiempo (el guardián golpea una vez: 100 → 77 de vida) → retroalimentación → siguiente ronda → volver al mapa → progreso v2 guardado.

## 6. Limitaciones y pendiente (sin maquillar)

- **No hay mediciones de FPS ni de memoria real**, ni se probó un celular. Solo hay un Chromium de escritorio sin GPU con emulación móvil. Los objetivos de 30/60 FPS **no están verificados**. No se hizo comparación «antes/después» de FPS.
- **No se jugaron en el navegador los cuatro niveles completos en los tres perfiles.** Solo se jugó la primera ronda del nivel 1 en los tres perfiles. Los demás niveles solo se validan por simulación del motor y por la existencia de sus recursos. Las demás actividades interactivas, las transformaciones y los remates **no se vieron visualmente**; los remates simplificados de Lite no se han revisado a ojo. Tampoco se probaron en navegador los cambios de orientación, el cambio de perfil durante una batalla ni las conexiones lentas o la caché vacía (solo hubo caché vacía al abrir).
- La posición del chorro del guardián en la escena Lite (niveles 2 y 4) y el avance de los luchadores son aproximaciones. **Se deben revisar visualmente.**
- La escena completa (Alta/Equilibrada) conserva su arquitectura de 25 poses montadas; solo se redujo el número de partículas. Alta no se optimizó más.
- Las demás actividades (clasificar, cortar, esquiva, conjuro, escuchar, parejas, errores, ordenar) **no se reescribieron** con el patrón del hacha. No se auditaron sus eventos táctiles ni su multitáctil.
- La refactorización de `CombatEscena.vue` (1271 líneas) no se tocó más allá de las partículas, el volumen y el perfil. Los eventos `animationstart` de la escena completa siguen disparando el impacto, con la vigilancia del motor como respaldo.
- Los reintentos de batalla reutilizan la caché, pero no pasan por la pantalla de transición.
- Las partidas abandonadas a mitad no suman un intento.
- Una versión de Equilibrada realmente intermedia en recursos de fondo (por ahora usa el SVG animado, como Alta) queda pendiente.
- La fuente de Google Fonts (`layouts/default.vue`) es una solicitud externa preexistente; no se cambió para no alterar la identidad visual.
- Accesibilidad: el texto grande afecta a lo que usa `rem`; las partes con tamaños en `px`/`vw` crecen menos. No hay lector de pantalla probado. Las actividades de arrastre (hacha) tienen alternativa de teclado; las demás conservan solo su interacción original.
- Los commits son por bloques de fases (no uno por fase).

## 7. Cómo ejecutar y comprobar

```bash
npm install
npm test                       # preguntas, motor real, módulos, traducciones y variantes
npm run variantes              # (re)genera las variantes gráficas y el manifiesto (requiere ImageMagick)
npm run build                  # nuxt generate → dist/ (estático)
npx serve dist                 # o: npm run preview
npm run dev                    # con el panel de diagnóstico (botón «… fps» abajo a la izquierda)
# Prueba en navegador de la compilación (instalar aparte, no es dependencia del proyecto):
npm i --no-save playwright-core && npx playwright-core install chromium && node scripts/e2e-navegador.mjs lite,alta,equilibrada
```
