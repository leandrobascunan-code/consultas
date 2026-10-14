# Asistente IA Educativa · SLEP Andalién Sur

Chat de consultas para que directivos, equipos técnico-pedagógicos, docentes y asistentes de la educación del **SLEP Andalién Sur** resuelvan dudas sobre el uso de la inteligencia artificial y **diseñen material con IA** de forma ética y segura.

Las respuestas se basan en:

- La serie de **5 manuales** "Inteligencia Artificial para la Gestión Educativa" del SLEP Andalién Sur (2026).
- Las orientaciones del **MINEDUC** citadas en ellos (*PotencIA el aprendizaje*, 2025; *Guía para docentes*, 2023).
- La **Ley N.º 21.719** de protección de datos personales (y las leyes 19.628, 21.040 y 20.285).

## Qué hace

| Función | Descripción |
|---|---|
| 💬 Chat de consultas | Responde preguntas buscando en la base de conocimiento de los manuales. |
| ✏️ Asistente de prompts | En 4 preguntas arma un prompt profesional (rol, tarea, contexto, formato, restricciones, criterio de calidad) para guías, rúbricas, pruebas, clases, etc. |
| 🔒 Detector de datos personales | Avisa si la consulta trae RUT, correos, teléfonos, nombres o diagnósticos y propone una versión anonimizada. |
| 📚 Temas por manual | Menú lateral con todas las fichas, ordenadas por manual. |
| 📲 Aplicación instalable | Se instala en celular o computador con el ícono del SLEP y funciona sin conexión (modo guías). |
| 🎨 Colores institucionales | Paleta del logo del SLEP; tema claro por defecto y oscuro opcional. |

## Dos modos de funcionamiento

- **Modo guías** (por defecto): funciona solo con GitHub Pages. Las consultas **no salen del navegador**.
- **Modo IA**: si se configura la API de Google Apps Script (`Codigo.gs`, que **no** se sube a GitHub), las respuestas se redactan con IA de **Groq** (modelo `openai/gpt-oss-120b`) usando los fragmentos de los manuales como contexto. La clave queda protegida en las Propiedades del script de Apps Script, nunca en GitHub.

## Estructura

```
├── index.html            Página del chat
├── css/estilos.css       Diseño visual
├── js/config.js          Dirección de la API (sin secretos)
├── js/conocimiento.js    Base de conocimiento (editable)
├── js/app.js             Lógica del chat
├── manifest.webmanifest  Datos de la aplicación instalable
├── sw.js                 Funcionamiento sin conexión (subir VERSION al actualizar)
├── img/logo-slep.png     Logo institucional
├── img/iconos/           Íconos de la aplicación
├── img/ayuda.jpg         Ilustración
└── docs/MANUAL.md        Manual de publicación y operación
```

## Publicar en GitHub Pages (resumen)

1. Cree un repositorio público (idealmente en una organización institucional).
2. Suba todos los archivos manteniendo las carpetas; `index.html` debe quedar en la raíz.
3. **Settings → Pages → Deploy from a branch → main / (root) → Save**.
4. Marque **Enforce HTTPS**.

Instrucciones completas, modo IA y mantenimiento en [docs/MANUAL.md](docs/MANUAL.md).

## Responsables

- Responsable institucional: _[completar]_
- Responsable técnico: _[completar]_

> Las respuestas se basan en una **propuesta técnica**, no en lineamientos vigentes del Servicio. Este asistente no constituye asesoría jurídica.
