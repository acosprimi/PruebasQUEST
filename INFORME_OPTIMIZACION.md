# English Quest — Informe de optimización (IA 1 · corrección V2)

**Commit inicial:** `8aaeb4b` («v2», rama `main` de `acosprimi/PruebasQUEST`). No se hizo push.
Stack sin cambios: Nuxt 3 + Vue 3 + Vuetify, JavaScript, Composition API, sin Pinia ni bases de datos. `package.json` no se modificó.

## Modificaciones realizadas

### 1. Perfiles gráficos: solo Alta y Lite
- Eliminados «Equilibrada» y «Automático» de selectores (`HomeOptions.vue`, `GamePreparation.vue`), composables, CSS, traducciones, manifiesto, presupuestos, scripts y pruebas.
- Migración (`usePlayerProgress.js`): `equilibrada`, `auto` o un valor desconocido pasan a **Lite**; `alta` y `lite` se respetan. El progreso educativo no se toca y el ajuste obsoleto `calidadAuto` desaparece.
- Se borraron 57 WebP de tamaño completo con PNG hermano (exclusivos de Equilibrada; Alta usa el PNG y nada los referenciaba). Se conservan los PNG de Alta, todas las variantes `-lite.webp` y los fondos estáticos Lite 960×540. No se reintrodujeron los `tw-*`.
- `scripts/generar-variantes.mjs` genera solo `alta` y `lite`; `--eliminar-obsoletos` borra esos WebP si no tienen referencias.
- La detección de fluidez (`useFramePacing.js`) solo **recomienda** pasar de Alta a Lite (botón «Cambiar a Lite»). Nunca cambia la calidad sola.

### 2. Memoria y precarga (`useAssetManager.js`, reescrito)
- Prioridades: 0 visible · 1 imprescindible · 2 próximas poses · 3 secundarias · 4 baja · sin ámbito = obsoleto.
- Pertenecer al nivel actual ya no impide expulsar: se expulsan obsoletos y prioridades 4, 3 y 2 (menos recientes primero). Nunca visibles ni imprescindibles; si estos superan el presupuesto se anota `excesos` en el diagnóstico.
- Un recurso secundario que no cabe **no se pide** (evita ciclos descarga→decodificación→expulsión) y se cuenta en `omitidas`.
- Presupuestos teóricos (estimación RGBA, no RAM real): Alta 96 MB, Lite 28 MB.
- Condiciones de carrera: tokens de generación por ámbito y global, deduplicación, cancelación de descargas (`src = ''`) cuando ya nadie las espera, y rechazo de resultados tardíos (batalla abandonada, cambio de nivel, reintento, cambio de perfil, transición cancelada).
- Corregido un fallo previo: `prepareImages` recibía `profile` pero el gestor leía `perfil`, así que la opción se ignoraba.

### 3. Lite — poses coherentes (`CombatEscenaLite.vue`)
- Cada luchador tiene un único estado `{ pose, src, ancho, alto, estilo }` que se actualiza **de una vez** cuando la nueva imagen está decodificada (antes el estilo de la pose nueva se aplicaba a la imagen anterior). Turnos por luchador descartan solicitudes antiguas; si falla la carga se conserva la pose previa completa. Medidas de `medidas-poses.json` con respaldo a `reposo`.
- Precarga progresiva por prioridad, solo entre actividades y cancelada al desmontar. La pose visible se marca como prioridad 0.
- `CombatConjuro.vue` y `HomePortalTransicion.vue` ahora usan la variante del perfil (antes cargaban el WebP completo también en Lite).

### 4. Alta — menos nodos (`CombatEscena.vue`)
- Se distingue preparadas / montadas / visibles: solo se montan las poses de estado (reposo, guardia, dolor, caída, cargas…) y las que necesita el golpe en curso (antes ~25 `<img>` por luchador). El resto queda decodificado sin ocupar DOM.
- Precarga con prioridades en lugar de decodificar todas las poses.
- Efectos, auras, partículas, cámara y remates se conservan.

### 5. Lite en toda la aplicación
- CSS `[data-graphics='lite']` extendido a menú, portal, mapa, transiciones y modales (sin brasas, niebla, brillos infinitos, filtros ni `backdrop-filter`).
- Nuxt ya no precarga ni hace prefetch de las escenas (`hooks['build:manifest']`); la transición calienta solo el módulo del perfil elegido. Verificado en `dist/`: los chunks de las escenas no aparecen en `index.html` ni `map/index.html`.

### 6. Reloj compartido, pausa y actividades
- `useCombatClock.js`: `tiempoActivo()` (monótono, sin pausas) y una única política de recuperación (`MAX_SALTO` = 0,5 s por lectura). `CombatHacha.vue` ya no suma `min(dt, .5)` por su cuenta: toma el tiempo del mismo reloj que el educativo.
- Pausa manual, ayuda abierta o pestaña oculta: no avanzan proyectiles ni reloj, no hay colisiones y el motor rechaza respuestas, cortes y golpes (`entradaBloqueada`).
- `CombatCortar.vue`: geometría medida una vez por gesto, movimientos agrupados por fotograma, sin cortes en pausa y limpieza al desmontar.
- Las demás actividades ya tenían `pointercancel`, `lostpointercapture` y `touch-action` localizado; no se reescribieron.

### 7. Audio
- `useAudioMixer.js`: `reproducirClipAudio()` (volumen del canal, elemento reutilizado, límite de seguridad, detenido al salir de la batalla) y `rutaAudio()` (respeta `app.baseURL`). Las dos escenas lo usan para `solar-transformacion` y `solar-carga`; se quitaron los `<audio preload="auto">` y los `new Audio()` sueltos de las escenas.

### 8. Otros
- Google Fonts sustituido por Cinzel / Cinzel Decorative locales (`public/fonts`, `assets/css/fuentes.css`, licencia OFL).
- Transición de encuentro: límite de 20 s con opción de reintentar o volver al mapa, y cancelar libera las precargas del nivel.
- Diagnóstico (solo desarrollo): presupuesto, visibles, excesos, omitidas, descartadas y canceladas.
- Pruebas: adaptadas a 2 perfiles y nuevas (prioridades, invalidación de precargas, reloj compartido, migración).

## Estado de Alta y Lite
- **Alta:** PNG/WebP originales, fondos SVG animados, todos los efectos. Escena con menos nodos.
- **Lite:** escena independiente, `-lite.webp`, fondos estáticos 960×540, una imagen por luchador. Mismo motor, preguntas, recompensas y condiciones de victoria.

## Audio
Los 27 MP3 de `public/audio` se conservan sin cambios (comprobados en el ZIP y en `dist/audio`).

## Compilación y pruebas
- `npm test`: correcto (preguntas, simulación de combate, módulos, traducciones, variantes).
- `npm run build` (`nuxt generate`): correcto.
- No se ejecutó ninguna prueba en navegador.

## Pendiente y limitaciones
- **Nada se vio ni se jugó en navegador ni en un celular.** No hay mediciones de FPS ni de memoria real; los 30/60 FPS no están verificados. Hay que revisar visualmente las poses de Lite (remates, chorros de los guardianes de los niveles 2 y 4) y la escena Alta con el montaje reducido, sobre todo remates y poses de reacción.
- Alta: si una pose necesaria no está preparada, se carga bajo demanda (posible parpadeo puntual).
- Las imágenes referenciadas por ruta absoluta no se prefijan con `app.baseURL`; el audio sí. Para publicar en una subcarpeta habría que extender `resolverImagen`.
- No se reescribieron Clasificar, Esquiva, Conjuro, Parejas, Errores ni Escuchar. La fusión de `CombatEscena.vue` (~1250 líneas) no se subdividió.
- Pedagogía y progreso: se verificó la correspondencia de las 4 temáticas con `niveles.json` y `lecciones.json`, y que el hacha sigue siendo motriz y no cuenta como evidencia lingüística. No se auditó más contenido.
- Accesibilidad: sin cambios nuevos (las opciones existentes se mantienen). Sin lector de pantalla probado.
- Las partidas abandonadas siguen sin sumar intento.

## Cómo ejecutar
```bash
npm install
npm test
npm run build   # nuxt generate → dist/
npm run dev
```


## Integracion posterior de la entrega

Se restauraron los 27 MP3 originales desde IA 1, sin modificarlos. Los tres WOFF2 mencionados en el informe anterior no estaban incluidos en la exportacion; se sustituyeron sus URLs inexistentes por referencias a fuentes instaladas localmente y se conservaron las alternativas serif existentes. No se incorporaron dependencias de red. Se excluyeron los directorios generados del ZIP.

## Corrección de audio posterior a la integración

Se sustituyó el uso de `import.meta.env.BASE_URL` (base de compilación de Vite, que en Nuxt puede apuntar a `/_nuxt/`) por `useRuntimeConfig().app.baseURL` mediante `plugins/audio.client.js`. Los recursos públicos se resuelven desde la ruta base del sitio. Se corrigió el reintento de reproducción de música tras bloqueos de autoplay y la detención idempotente de efectos, evitando que un componente antiguo detenga un sonido reutilizado. Los 27 MP3 conservan sus hashes SHA-256 originales. Se verificaron los archivos con FFprobe, la decodificación con FFmpeg y las rutas y el ciclo de vida con un Audio simulado en Node. No se verificó la reproducción en la aplicación Nuxt: la navegación local del navegador de pruebas fue bloqueada por el entorno. La compilación completa y las pruebas en el dispositivo del usuario quedan pendientes.
