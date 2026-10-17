# Manual de publicación y operación

Documento para quien publique, mantenga o continúe este proyecto (Manual 5, apartado 10.3).

---

## 1. Publicar el sitio en GitHub Pages

1. Ingrese a [github.com](https://github.com). Para uso institucional, cree una **organización** del Servicio o del establecimiento con **al menos dos administradores**.
2. Botón **New** → nombre sin espacios ni tildes (ej.: `asistente-ia`) → **Public** → **Create repository**.
3. **Add file → Upload files** y arrastre: `index.html`, `manifest.webmanifest`, `sw.js`, `README.md` y las carpetas `css`, `js`, `img`, `docs`.
   **No** suba `Codigo.gs` (va en Apps Script), ni los manuales `.docx` ni el PDF de la ley (su contenido ya está en `js/conocimiento.js`).
4. **Commit changes**.
5. **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
6. Espere 1 a 3 minutos. La dirección será `https://NOMBRE-ORGANIZACION.github.io/asistente-ia/`.
7. Marque **Enforce HTTPS**.

En este punto el asistente ya funciona en **modo guías**.

### Subdominio institucional (opcional)
Solicite al área de informática un registro DNS `CNAME` (ej.: `asistente.slepandaliensur.cl` → `NOMBRE-ORGANIZACION.github.io`) y escríbalo en **Settings → Pages → Custom domain**. No registre dominios a nombre personal.

### Instalar como aplicación
Una vez publicado con HTTPS, el sitio se puede **instalar como aplicación** (PWA) con el ícono del SLEP:
- **Android (Chrome):** botón verde "Instalar como aplicación", o menú ⋮ → *Instalar aplicación*.
- **iPhone/iPad (Safari):** Compartir ⬆️ → *Agregar a pantalla de inicio*.
- **Computador (Chrome/Edge):** botón "Instalar" o ícono ⊕ en la barra de direcciones.

Instalada, funciona incluso **sin conexión** en modo guías.

> **Importante al actualizar:** cada vez que publique cambios, aumente el número de `VERSION` en `sw.js` (ej.: `asistente-slep-v3`) para que las apps instaladas descarguen la versión nueva.

Los íconos están en `img/iconos/` (normales, *maskable* para Android y `apple-touch-icon` para iPhone).

---

## 2. Activar el modo IA (opcional)

> **Proveedor:** Groq ([console.groq.com](https://console.groq.com)), modelo `openai/gpt-oss-120b`.
> **Requisito previo** (Manual 2, Anexo A.4): cuenta de IA **a nombre de la institución**, revisión de los términos de uso de datos del proveedor y validación de la asesoría jurídica del Servicio.
> El asistente bloquea consultas con datos personales tanto en el navegador como en el servidor.

1. Cree un proyecto en [script.google.com](https://script.google.com) con la cuenta institucional → **Nuevo proyecto** → nómbrelo `API Asistente IA`.
2. Reemplace el contenido de `Código.gs` por el de `Codigo.gs` y guarde.
3. **Configuración del proyecto (⚙️) → Propiedades del script → Agregar propiedad**:

   | Propiedad | Valor |
   |---|---|
   | `CLAVE_GROQ` | Clave de API de Groq (empieza con `gsk_`) |
   | `MODELO_IA` | *(opcional)* por defecto `openai/gpt-oss-120b`; más rápido: `openai/gpt-oss-20b` |
   | `LIMITE_DIARIO` | *(opcional)* consultas máximas por día; por defecto `300` |
   | `ID_PLANILLA` | *(opcional)* ID de una planilla con una hoja llamada `bitacora` |

4. En el editor, seleccione la función `probarConexion` → **Ejecutar** → autorice. Debe aparecer "conexión correcta" en el registro.
5. **Implementar → Nueva implementación → ⚙️ Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona** (el chat no trata datos personales). Si se quiere limitar a cuentas institucionales, elija la opción de la organización; en ese caso los usuarios deben haber iniciado sesión con su cuenta institucional.
6. Copie la URL que termina en `/exec`.
7. En GitHub, edite `js/config.js` y pegue la URL en `API: "https://script.google.com/macros/s/.../exec"`. Guarde (commit).
8. Recargue el sitio: el indicador lateral dirá **Modo IA conectado**.

**Si la IA falla**, el chat responde automáticamente con los manuales (modo guías).

### Bitácora
Si configura `ID_PLANILLA`, cada consulta registra fecha, tipo de operación y largo del texto — **nunca el contenido** (Manual 2, A.2, paso 7). La planilla no debe compartirse con enlace público.

---

## 3. Editar o agregar contenido

Todo el conocimiento está en `js/conocimiento.js`. Para agregar una ficha, copie un bloque y edite:

```js
{
  id: "identificador-unico", fuente: "M2", titulo: "Título visible",
  claves: ["palabras", "que la gente", "usaría al preguntar"],
  texto: `Respuesta en Markdown simple: **negrita**, listas con - o 1.`
},
```

Fuentes disponibles: `M1`–`M5`, `LEY`, `MINEDUC` (se pueden agregar en el objeto `FUENTES`).
Los tipos de material del asistente de prompts están en `TIPOS_MATERIAL` al final del mismo archivo.

Para probar en local, abra la carpeta con cualquier servidor web estático (por ejemplo la extensión *Live Server* de VS Code).

---

## 4. Seguridad (lista de verificación)

- [ ] Ninguna clave en el repositorio (busque `key`, `token`, `password`, `gsk_`).
- [ ] `Codigo.gs` **no** está en el repositorio de GitHub.
- [ ] La clave de IA solo está en **Propiedades del script**.
- [ ] Si una clave se publicó por error: **revóquela** y genere otra (borrarla no basta; GitHub guarda historial).
- [ ] HTTPS forzado en GitHub Pages.
- [ ] Repositorio y proyecto de Apps Script con al menos dos responsables.
- [ ] La planilla de bitácora (si existe) no está compartida públicamente.

---

## 5. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Error 404 | `index.html` debe estar en la raíz del repositorio. |
| Los cambios no se ven | Espere 2 minutos y recargue con **Ctrl + F5**. |
| "No pude conectar con el servicio de IA" | Revise la URL en `config.js`, que la implementación esté activa y que `CLAVE_GROQ` exista. |
| "Muchas consultas en este momento" | Límite por minuto del plan de Groq; esperar o ampliar el plan en console.groq.com. |
| Error con el modelo | Groq retira modelos con el tiempo: revise los vigentes en console.groq.com/docs/models y cambie `MODELO_IA`. |
| Cambié `Codigo.gs` y no surte efecto | **Implementar → Administrar implementaciones → editar → Nueva versión**. |
| "Límite diario de consultas" | Aumente `LIMITE_DIARIO` en Propiedades del script. |

---

## 5b. Panel de configuración (admin.html)

Página aparte, **no enlazada** desde el asistente: `https://USUARIO.github.io/REPOSITORIO/admin.html`.

- La clave se verifica en **Apps Script**, nunca en GitHub. Para cambiarla: Propiedades del script → `CLAVE_ADMIN` (mínimo 8 caracteres).
- Diez intentos fallidos bloquean el panel por 15 minutos.
- Lo guardado queda en una planilla de Google, que se crea al ejecutar `configurarContenido` en el editor de Apps Script.
- Tres pestañas:
  - **🏫 Establecimientos**: todos los colegios (los 80 del PAL más los agregados), agrupados por comuna, con buscador. Cada ficha se puede **editar**, **eliminar** (los del PAL se pueden **restaurar**) o volver a su **versión original**.
  - **📚 Fuentes y documentos**: los documentos de la Biblioteca por categoría y la información del Servicio, con las mismas acciones.
  - **➕ Añadir**: establecimiento, documento o enlace (aparece en la Biblioteca y el chat lo usa), información del Servicio o **carga masiva** de establecimientos (`Nombre ; Comuna ; Entorno ; Niveles ; Características`).
- **PEI de cada colegio** (al editar o agregar un establecimiento): misión, visión, sellos, historia y enlace al PEI completo. El botón «📋 Pegar el texto del PEI» detecta cada parte por sus títulos. El asistente usa el PEI (sin el nombre del colegio) para alinear sus sugerencias, y en «Ver datos de mi establecimiento» muestra cada parte con un botón **Copiar**. Requiere Apps Script groq-6.
- **👥 Roles y perfiles**: funciones y normativa de cada cargo (docentes, directivos, asistentes y áreas del SLEP). Se pueden editar, eliminar, restaurar o agregar cargos nuevos. Al iniciar el chat, la persona elige su cargo y el asistente ajusta sus sugerencias a esas funciones. Los funcionarios del nivel central eligen además si trabajan con todos los establecimientos, una comuna o los que seleccionen. Requiere Apps Script groq-7.
- Editar o eliminar algo de base no modifica los archivos de GitHub: el panel guarda un registro con el mismo id que lo reemplaza o lo oculta.
- Solo información institucional: el sistema rechaza RUT, correos y teléfonos.

El asistente y la Biblioteca descargan este contenido al abrirse.

## 5c. Búsqueda web (Apps Script groq-5)

Si los documentos del asistente no responden la consulta, la IA puede buscar en internet (herramienta `browser_search` de Groq) **solo en fuentes confiables de educación** (mineduc.cl, curriculumnacional.cl, cpeip.cl, educacionpublica.gob.cl, agenciaeducacion.cl, supereduc.cl, bcn.cl, unesco.org, oecd.org, entre otras). La respuesta termina con **"Fuentes externas sugeridas (verificar)"** y el chat muestra un aviso 🌐. Para desactivarla: propiedad `BUSQUEDA_WEB` = `no`. Si la búsqueda no está disponible en la cuenta de Groq, el asistente responde igual, sin ella.

---

## 5d. Gráficos, videos e imágenes en las respuestas

- **Gráficos animados** (SVG propio, sin librerías externas, colores SLEP): barras, barras horizontales, líneas, torta, dona y cifras destacadas. Se animan al aparecer en pantalla y tienen el botón «Ver datos». La IA los genera con un bloque ```grafico con JSON, **solo con datos reales y con su fuente**.
- **Datos del PAL**: «Ver datos de mi establecimiento» muestra matrícula, cursos, % PIE y variación proyectada; «¿Qué colegios hay en [comuna]?» muestra la matrícula 2025 de cada establecimiento.
- Toda **tabla con números** ofrece el botón «📊 Ver como gráfico».
- **Videos de YouTube (verificados)**: el chat consulta a YouTube el título y el **canal real** de cada video (oEmbed). Si el video no existe o no está disponible, lo tacha y avisa; si la respuesta lo atribuye a una institución distinta del canal real, muestra una advertencia. Se reproduce en el chat (youtube-nocookie).
- **Imágenes**: `![descripción](https://…)` en una línea propia. Si la imagen no carga, se oculta.

## 5e. Compartir y descargar en PDF

- Bajo cada respuesta con contenido aparecen los botones **📄 PDF**, **WhatsApp**, **✉️ Correo**, **📋 Copiar** y, en celulares, **↗️ Más** (menú para compartir del teléfono).
- **WhatsApp y correo** abren la aplicación con el texto ordenado (títulos, listas, datos de los gráficos y enlaces) para que la persona elija el destinatario. Si el texto es muy largo se resume y se sugiere enviar el PDF.
- También se puede escribir en el chat «envíalo por WhatsApp», «mándalo por correo» o «descárgalo en PDF».
- **PDF:** documento formal en tamaño A4 con membrete del SLEP, título, fecha, rol/cargo, la consulta, el contenido (con gráficos y tablas), fuentes consultadas, nota sobre el uso de IA y número de página. Se guarda con «Guardar como PDF» en la ventana de impresión (en iPhone: Compartir → Imprimir → Guardar).
- **Gráficos a pedido:** si la persona entrega sus datos y pide un gráfico, la IA lo diseña con esos números (sello «Gráfico elaborado con los datos que entregaste»). Cada gráfico permite cambiar el tipo (barras, horizontales, líneas, dona).

## 6. Registro de cambios

| Fecha | Cambio | Responsable |
|---|---|---|
| 2026-10-14 | Versión inicial | _[completar]_ |
| 2026-10-14 | Roles, Bases Curriculares, MBE, MBDLE, convivencia, panel de configuración y manuales con logos | _[completar]_ |
| 2026-10-15 | Biblioteca con documentos oficiales, panel con edición por comuna, búsqueda web en fuentes confiables y robot animado | _[completar]_ |
