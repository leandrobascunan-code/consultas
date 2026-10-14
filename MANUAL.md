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

## 6. Registro de cambios

| Fecha | Cambio | Responsable |
|---|---|---|
| 2026-10-14 | Versión inicial | _[completar]_ |
