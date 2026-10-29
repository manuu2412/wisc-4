# WISC-IV Calificador (PWA)

App web instalable (PWA) que reemplaza la plantilla de Excel del WISC-IV.
Funciona sin conexión, con estilo iOS (modo claro y oscuro) y genera un informe PDF.

## Flujo
1. **Inicio de sesión**.
2. **Datos generales**: evaluado (nombre, nacimiento, sexo, escolaridad, escuela, motivo) y evaluador (nombre, profesión/cédula, institución, fecha de aplicación). La edad cronológica se calcula sola.
3. **Puntuaciones escalares** de los 15 subtests (10 obligatorios + 5 opcionales). Se suman por índice y se muestra la desviación contra la media (10).
4. **Puntuaciones compuestas** (CV, RP, MT, VP y CIT), capturadas según las tablas del manual. Se calcula percentil y clasificación.
5. **Resumen** con perfiles, unidad de índices, agrupaciones de procesos e interpretación → botón **Finalizar y generar PDF**.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `wisc-app`).
2. Sube **el contenido** de esta carpeta a la raíz del repositorio (`index.html` debe quedar en la raíz).
3. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. En 1 o 2 minutos quedará en `https://TU-USUARIO.github.io/wisc-app/`.
5. Ábrela en el celular y usa **Compartir → Añadir a pantalla de inicio** (iPhone) o **Instalar app** (Android/Chrome).

> Al publicar cambios, sube el número de `VERSION` en `sw.js` (wisc-v4, wisc-v5...). Los dispositivos mostrarán el aviso "Nueva versión disponible" y se actualizan con un toque en "Actualizar".

## Lógica heredada del Excel
- Suma de escalares por índice: solo subtests obligatorios (CV: S, V, C · RP: CC, Co, M · MT: D, LN · VP: CI, BS · CIT: los 10).
- Percentil = `NORMDIST(compuesta; 100; 15)` × 100 (orientativo).
- Desviación = escalar − 10.
- Unidad de un índice: diferencia entre el subtest mayor y menor < 5.
- Agrupaciones de procesos (necesitan subtests opcionales): fórmulas en `js/scoring.js`, constante `PROCESS`.
  - Ojo: "Razonamiento Fluido Verbal" en el Excel original usa (Cubos + Dígitos + Conceptos) / 3. Se respetó tal cual; si es un error de la plantilla, corrígelo en `PROCESS`.

## Interpretación
Clasificación de compuestas: ≥130 Muy superior · 120–129 Superior · 110–119 Medio alto · 90–109 Medio · 80–89 Medio bajo · 70–79 Limítrofe · ≤69 Extremadamente bajo.
Escalares: ≥16 Muy alto · 13–15 Alto · 8–12 Promedio · 5–7 Bajo · ≤4 Muy bajo.

## Seguridad del acceso
El login se valida en el navegador (la contraseña no está en texto plano, solo su hash SHA-256). Sirve para evitar accesos casuales, **no** es seguridad real: el código de una página en GitHub Pages es público. No guardes ni expongas datos sensibles en el repositorio; los datos del evaluado solo viven en el dispositivo (localStorage) y en el PDF.

## Estructura
```
index.html · manifest.webmanifest · sw.js
css/styles.css
js/scoring.js   (cálculos)  js/report.js (PDF)  js/app.js (interfaz)
lib/pdf-lib.min.js  (generador de PDF, incluido para uso sin conexión)
fonts/  (Poppins, incluida para uso sin conexión)
icons/
```
