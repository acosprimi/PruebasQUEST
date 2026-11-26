# English Quest — integración de versiones

## Base y decisiones
- Base: Lo_que_esta_en_main.zip. Se conservaron todos sus archivos, incluida la configuración y el bloqueo de dependencias de Nuxt.
- Sonnet (en Arena): mapa, desplazamiento del caballero, Grimorio, presentación de retos, distractores, banco de 36 preguntas base y 99 variantes.
- EnglishQuest-mejoras.zip: actividades de biblioteca y contenidos ampliados, diario vertical móvil y corrección de enunciado dinámico de esquiva. Se unieron las traducciones; Sonnet prevalece ante conflictos. No se mezclaron indiscriminadamente variantes de ambas versiones para evitar incoherencias y duplicados.
- Se unificó el barajado: todas las posiciones de selección y emparejamiento son posibles, sin dejar oraciones resueltas cuando existe una permutación diferente. Se conservan las fichas falsas. Se conectó también a la práctica de refuerzo; en la biblioteca el orden inicial es determinista para evitar diferencias de hidratación y se cambia la semilla al repetir.
- Se ajustaron instrucciones del casco y will, y el viaje del mapa respeta movimiento reducido.
- No se incorporaron Gemini, WhatER, Next.js, PostgreSQL ni archivos de plantilla Arena.

## Integridad
- 301 archivos originales presentes; 219 archivos de public/ idénticos byte por byte.
- useCombatEngine.js, package.json, package-lock.json y nuxt.config.js idénticos a la base.
- 17 archivos originales modificados; nuevos: composables/useBarajar.js, scripts/pruebas-barajado.mjs.

## Archivos modificados
- `components/biblioteca/Actividad.vue`
- `components/combat/CombatDesafio.vue`
- `components/combat/CombatEscuchar.vue`
- `components/combat/CombatEsquiva.vue`
- `components/combat/CombatParejas.vue`
- `components/combat/CombatPreguntaDuelo.vue`
- `components/map/MapBoard.vue`
- `components/map/MapListaZonas.vue`
- `components/map/MapZone.vue`
- `components/map/MisionFicha.vue`
- `components/progress/PracticePanel.vue`
- `data/contenidos.json`
- `data/ingles.json`
- `data/niveles.json`
- `pages/biblioteca.vue`
- `pages/map.vue`
- `scripts/validar-preguntas.mjs`

## Pruebas realizadas
- `node scripts/validar-preguntas.mjs`: OK, 5 niveles y 99 variantes.
- `node scripts/validar-traducciones.mjs`: OK.
- `node scripts/generar-variantes.mjs --verificar`: OK, 84 recursos; alta 18,51 MB y lite 1,55 MB (estimación de recursos, no medición de descarga real).
- `node scripts/pruebas-barajado.mjs`: OK, 26 versiones de ordenar × 100 intentos, todas las posiciones de selección y 6 permutaciones de tres parejas observadas.
- `node --check`: 48 bloques script de Vue comprobados, sin errores de sintaxis JavaScript (no equivale a compilar Vue).
- `npm test`: se detuvo en simular-combate.mjs al no disponer de Vue instalado. No se ejecutaron simulación, pruebas de módulos, compilación ni pruebas visuales/móviles.

## Pendientes
- Identificadores permanentes y recuperación exacta de variantes falladas; el refuerzo todavía usa el criterio de identificación original.
- Criterio del 70 % por temática (tres preguntas) continúa intacto: decidir con el docente el umbral global y por tema.
- Revisar transferencia en evaluación final, alternativas auditivas, ayudas, accesibilidad y fluidez mediante pruebas reales. El banco ampliado no fue auditado pedagógicamente en su totalidad.

## Ejecutar localmente
```bash
npm ci
npm test
node scripts/pruebas-barajado.mjs
npm run dev
```
Prueba antes de subir al repositorio.
