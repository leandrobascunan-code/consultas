/* =====================================================================
   Asistente IA Educativa · SLEP Andalién Sur
   Lógica del chat: búsqueda en la base de conocimiento, asistente de
   prompts por rol, perfil (rol, comuna, establecimiento), detector de
   datos personales, contenido actualizable desde el panel y API de IA.
   ===================================================================== */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = {
    chat: $("#chat"), mensajes: $("#mensajes"), bienvenida: $("#bienvenida"),
    sugerencias: $("#sugerencias"), temas: $("#temas"), modo: $("#modo"),
    form: $("#formulario"), entrada: $("#entrada"), enviar: $("#btnEnviar"),
    sidebar: $("#sidebar"), overlay: $("#overlay")
  };
  const MODO_IA = typeof CONFIG !== "undefined" && /^https:\/\//.test(CONFIG.API || "");
  const CLAVE_TEMA = "slep-ia-tema";
  const CLAVE_PERFIL = "slep-ia-perfil";
  const CLAVE_CONTENIDO = "slep-ia-contenido";

  let historial = [];   // solo en memoria: al cerrar la app, la conversación vuelve al inicio
  let wizard = null;    // estado del asistente de prompts
  let ocupado = false;
  try { localStorage.removeItem("slep-ia-historial"); } catch (e) { /* versiones anteriores guardaban el historial */ }

  /* ================================================================
     1. UTILIDADES DE TEXTO
     ================================================================ */
  const STOP = new Set(("a al algo algun alguna como con cual cuales cuando de del desde donde el ella ellos en entre era es esa ese eso esta estan este esto hay la las le les lo los mas me mi mis muy no nos o para pero por que quien se sea segun ser si sin sobre son su sus tambien te tengo tiene tu un una uno unos y ya yo puedo puede debo debe hacer hago quiero necesito ayuda ayudame favor hola gracias cosa cosas usar uso").split(" "));

  function normalizar(t) {
    return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function raiz(p) {
    if (p.length > 5 && p.endsWith("es")) return p.slice(0, -2);
    if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
    return p;
  }
  function tokens(t) {
    return normalizar(t).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(raiz);
  }
  function escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Markdown mínimo y seguro (se escapa todo antes de dar formato) */
  function enLinea(t) {
    return t
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  }
  function markdown(md) {
    const lineas = escapar(md).split("\n");
    let html = "", lista = null, i = 0;
    const cerrarLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
    while (i < lineas.length) {
      const l = lineas[i];
      if (/^```/.test(l.trim())) {               // bloque de código / prompt
        cerrarLista();
        const buf = []; i++;
        while (i < lineas.length && !/^```/.test(lineas[i].trim())) buf.push(lineas[i++]);
        i++;
        html += `<div class="bloque-codigo"><button class="btn-copiar" type="button">Copiar</button><pre>${buf.join("\n")}</pre></div>`;
        continue;
      }
      if (/^\|.*\|\s*$/.test(l.trim())) {         // tabla
        cerrarLista();
        const filas = [];
        while (i < lineas.length && /^\|.*\|\s*$/.test(lineas[i].trim())) filas.push(lineas[i++].trim());
        const celdas = (f) => f.slice(1, -1).split("|").map((c) => enLinea(c.trim()));
        let t = "<div class='tabla-wrap'><table>";
        filas.forEach((f, n) => {
          if (/^\|[\s:|-]+\|$/.test(f)) return;
          const tag = n === 0 ? "th" : "td";
          t += "<tr>" + celdas(f).map((c) => `<${tag}>${c}</${tag}>`).join("") + "</tr>";
        });
        html += t + "</table></div>";
        continue;
      }
      let m;
      if ((m = l.match(/^#{1,3}\s+(.*)/))) { cerrarLista(); html += `<h4>${enLinea(m[1])}</h4>`; }
      else if ((m = l.match(/^\s*[-•]\s+(.*)/))) { if (lista !== "ul") { cerrarLista(); html += "<ul>"; lista = "ul"; } html += `<li>${enLinea(m[1])}</li>`; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== "ol") { cerrarLista(); html += "<ol>"; lista = "ol"; } html += `<li>${enLinea(m[1])}</li>`; }
      else if (/^\s*[a-z]\)\s+/.test(l)) { cerrarLista(); html += `<p>${enLinea(l)}</p>`; }
      else if (l.trim() === "") { cerrarLista(); }
      else { cerrarLista(); html += `<p>${enLinea(l)}</p>`; }
      i++;
    }
    cerrarLista();
    return html;
  }

  /* ================================================================
     2. MOTOR DE BÚSQUEDA LOCAL (se reconstruye al recibir contenido nuevo)
     ================================================================ */
  let indice = [], df = {};
  function construirIndice() {
    indice = CONOCIMIENTO.map((f) => ({
      ficha: f,
      titulo: new Set(tokens(f.titulo)),
      claves: f.claves.map(normalizar),
      clavesTok: new Set(f.claves.flatMap(tokens)),
      texto: tokens(f.texto)
    }));
    df = {};
    indice.forEach((d) => new Set(d.texto).forEach((t) => { df[t] = (df[t] || 0) + 1; }));
  }
  const idf = (t) => Math.log(1 + indice.length / (1 + (df[t] || 0)));

  function buscar(consulta, n = 4) {
    const q = tokens(consulta);
    const qn = " " + normalizar(consulta) + " ";
    if (!q.length) return [];
    return indice.map((d) => {
      let s = 0;
      d.claves.forEach((c) => { if (c.length > 2 && qn.includes(" " + c + " ")) s += 4 + c.split(" ").length * 2; });
      q.forEach((t) => {
        if (d.titulo.has(t)) s += 3 * idf(t);
        if (d.clavesTok.has(t)) s += 2.5 * idf(t);
        const f = d.texto.filter((x) => x === t).length;
        if (f) s += Math.min(f, 3) * 0.6 * idf(t);
      });
      return { ficha: d.ficha, puntaje: s };
    }).filter((r) => r.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje).slice(0, n);
  }

  /* ================================================================
     3. ESTABLECIMIENTOS (base en establecimientos.js + panel de configuración)
     ================================================================ */
  const GENERICAS = new Set("escuela liceo colegio complejo educacional basica basico particular municipal jardin infantil sala cuna centro de la el los las del y n no".split(" "));
  function palabrasNombre(t) { return normalizar(t).split(" ").filter((w) => w.length > 1 && !GENERICAS.has(w)); }

  function buscarEstablecimiento(texto, comuna) {
    const q = palabrasNombre(texto);
    if (!q.length) return [];
    return ESTABLECIMIENTOS
      .filter((e) => !comuna || !e.comuna || normalizar(e.comuna) === normalizar(comuna))
      .map((e) => {
        const nombre = palabrasNombre(e.nombre + " " + (e.alias || ""));
        const coinciden = q.filter((w) => nombre.some((n) => n === w || (w.length > 3 && n.startsWith(w)))).length;
        return { e, puntaje: coinciden / Math.max(q.length, 1) };
      })
      .filter((r) => r.puntaje >= 0.5)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 4).map((r) => r.e);
  }
  const estDePerfil = (p) => (p && p.estId ? ESTABLECIMIENTOS.find((e) => e.id === p.estId) : null);

  /* ================================================================
     4. DETECTOR DE DATOS PERSONALES (Manual 2, apartado 6)
     ================================================================ */
  const PATRONES = [
    { nombre: "RUT", re: /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g, reemplazo: "[RUT]" },
    { nombre: "correo electrónico", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, reemplazo: "[CORREO]" },
    { nombre: "teléfono", re: /(\+?56\s?)?\b9\s?\d{4}\s?\d{4}\b/g, reemplazo: "[TELÉFONO]" }
  ];
  const SENSIBLES = /\b(tdah|tea|autis\w*|diagnostic\w*|depresi\w*|ansiedad|abuso|vulneraci\w*|maltrato|embaraz\w*|discapacidad|medicamento\w*|psiquiatr\w*)\b/;
  const NOMBRE_PROPIO = /\b(estudiante|alumn[oa]|ni[ñn][oa]|apoderad[oa]|profesor[a]?|docente|se llama|llamad[oa])\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?/;

  function revisarPrivacidad(texto) {
    const hallazgos = PATRONES.filter((p) => { p.re.lastIndex = 0; return p.re.test(texto); }).map((p) => p.nombre);
    if (NOMBRE_PROPIO.test(texto)) hallazgos.push("posible nombre de una persona");
    if (hallazgos.length && SENSIBLES.test(normalizar(texto))) hallazgos.push("dato sensible de salud");
    return { hallazgos };
  }
  function limpiarDatos(texto) {
    let t = texto;
    PATRONES.forEach((p) => { t = t.replace(p.re, p.reemplazo); });
    t = t.replace(NOMBRE_PROPIO, (m, rol) => rol + " [PERSONA]");
    t = t.replace(/\b(TDAH|TEA|autis\w*|diagn[oó]stic\w*|depresi[oó]n|ansiedad|discapacidad\w*|medicamento\w*|psiqui[aá]tr\w*|embarazad\w*)\b/gi, "[DATO SENSIBLE OMITIDO]");
    return t.replace(/,?\s*RUT \[RUT\]/g, "").replace(/\s{2,}/g, " ");
  }

  /* ================================================================
     5. RENDERIZADO DE MENSAJES
     ================================================================ */
  const AVATAR = `<div class="avatar" aria-hidden="true"><img src="favicon-48.png" alt=""></div>`;
  const COLORES = { M1: "#0071ea", M2: "#ff3c4c", LEY: "#9b59d0", M3: "#4fa61a", M4: "#f0a500", M5: "#22a9dc", MINEDUC: "#0071ea", EXT: "#e0559b", DOC: "#0b8f6a", DIR: "#5b4bd1", ASI: "#d9622b", SLEP: "#0071ea" };

  function ocultarBienvenida() { el.bienvenida.hidden = true; }

  /* Las respuestas del asistente se muestran DESDE SU INICIO (la persona baja
     leyendo); los mensajes propios y el indicador de escritura van al final. */
  function agregar(rol, html, { texto = "", guardar = true, alFinal = false } = {}) {
    ocultarBienvenida();
    const div = document.createElement("div");
    div.className = `msg ${rol}`;
    div.innerHTML = rol === "bot" ? `${AVATAR}<div class="burbuja">${html}</div>` : `<div class="burbuja">${html}</div>`;
    el.mensajes.appendChild(div);
    if (rol === "user" || alFinal) {
      el.chat.scrollTop = el.chat.scrollHeight;
    } else {
      // Lleva el INICIO de la respuesta a la parte superior del área del chat
      const top = div.getBoundingClientRect().top - el.chat.getBoundingClientRect().top + el.chat.scrollTop - 12;
      el.chat.scrollTop = Math.max(0, top);
    }
    if (guardar) historial.push({ rol, html, texto });
    return div;
  }
  function agregarUsuario(texto) { agregar("user", escapar(texto), { texto }); }

  function chips(lista, titulo) {
    if (!lista.length) return "";
    return `<div class="chips">${titulo ? `<span class="chips-titulo">${escapar(titulo)}</span>` : ""}${lista.map((c) =>
      `<button class="chip ${c.primario ? "primario" : ""}" type="button" data-accion="${escapar(c.accion || "preguntar")}" data-valor="${escapar(c.valor)}">${escapar(c.etiqueta || c.valor)}</button>`).join("")}</div>`;
  }
  function etiquetaFuente(f) {
    return `<span class="fuente" style="--c:${COLORES[f.fuente] || "var(--azul)"}">📘 ${escapar(FUENTES[f.fuente] || f.fuente)}</span>`;
  }
  function mostrarEscribiendo() {
    return agregar("bot", `<span class="escribiendo" aria-label="Escribiendo"><i></i><i></i><i></i></span>`, { guardar: false, alFinal: true });
  }

  /* ================================================================
     6. RESPUESTAS
     ================================================================ */
  function htmlFicha(f, relacionadas) {
    let h = `<h3>${escapar(f.titulo)}</h3>${markdown(f.texto)}<div class="pie-msg">${etiquetaFuente(f)}</div>`;
    if (relacionadas && relacionadas.length) h += chips(relacionadas.map((r) => ({ valor: r.titulo })), "También te puede servir:");
    return h;
  }

  function respuestaLocal(consulta) {
    const res = buscar(consulta, 5);
    if (!res.length || res[0].puntaje < 2.2) {
      return `<p>No encontré esto en los manuales del Servicio. 🤔 Prueba reformulando con otras palabras o elige un tema:</p>` +
        chips([
          { valor: "¿Puedo ingresar datos de estudiantes a la IA?" },
          { valor: "¿Qué se puede delegar en la IA y qué no?" },
          { valor: "Estructura de un prompt profesional" },
          { valor: "crear prompt", etiqueta: "✏️ Crear un prompt paso a paso", primario: true }
        ]) +
        `<div class="nota">Recuerda: para normativa, verifica siempre en <strong>bcn.cl</strong> o en el sitio del MINEDUC.</div>`;
    }
    const top = res[0];
    const rel = res.slice(1).filter((r) => r.puntaje > top.puntaje * 0.45).slice(0, 3).map((r) => r.ficha);
    return htmlFicha(top.ficha, rel);
  }

  function contextoPerfil() {
    const p = leerPerfil();
    if (!p) return "";
    const est = estDePerfil(p);
    const partes = [];
    if (p.rol && ROLES[p.rol]) partes.push(`Rol de quien consulta: ${ROLES[p.rol].nombre}. Referente principal: ${ROLES[p.rol].marco}.`);
    if (p.comuna) partes.push(`Trabaja en un establecimiento de educación pública de la comuna de ${p.comuna}` + (p.entorno ? `, entorno ${p.entorno.toLowerCase()}` : "") + ".");
    if (est && est.caracteristicas) partes.push(`Características del establecimiento (sin identificarlo): ${est.caracteristicas}`);
    return partes.length ? `\n\n### Contexto de quien consulta\n${partes.join(" ")} Adapta tus sugerencias a este rol y contexto, sin estereotipos.` : "";
  }

  async function respuestaIA(consulta) {
    const contexto = buscar(consulta, 4).map((r) => `### ${r.ficha.titulo} (${FUENTES[r.ficha.fuente] || r.ficha.fuente})\n${r.ficha.texto}`).join("\n\n") + contextoPerfil();
    const previos = historial.slice(-9, -1).map((m) => ({
      role: m.rol === "user" ? "user" : "assistant",
      content: (m.texto || m.html.replace(/<[^>]+>/g, " ")).slice(0, 2000)
    }));
    const r = await fetch(CONFIG.API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // evita preflight CORS (Manual 5, 7.2)
      body: JSON.stringify({ accion: "consultar", pregunta: consulta, historial: previos, contexto })
    });
    const datos = await r.json();
    if (!datos.ok) throw new Error(datos.error || "Respuesta no válida");
    const fuentes = buscar(consulta, 3).map((x) => x.ficha);
    return markdown(datos.respuesta) +
      (fuentes.length ? `<div class="pie-msg">${fuentes.slice(0, 2).map(etiquetaFuente).join("")}</div>` : "") +
      `<div class="nota">Respuesta generada con IA a partir de los manuales y fuentes oficiales. Verifica datos y normativa antes de usarla.</div>`;
  }

  /* ================================================================
     7. PERFIL: rol, comuna, establecimiento y entorno (solo en este dispositivo)
     La comuna y el establecimiento son datos institucionales, no personales.
     Aun así, el NOMBRE del establecimiento no se incluye en los prompts:
     combinado con datos de estudiantes es un identificador indirecto
     (Manual 2, apartado 6.1). Sus características sí se usan para sugerir.
     ================================================================ */
  function leerPerfil() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PERFIL) || "null"); } catch (e) { return null; }
  }
  function guardarPerfil(cambios) {
    const p = Object.assign({}, leerPerfil() || {}, cambios);
    try { localStorage.setItem(CLAVE_PERFIL, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ }
    mostrarPerfil(); construirSugerencias();
    return p;
  }
  function resumenPerfil(p) {
    return [p.rol && ROLES[p.rol] ? ROLES[p.rol].corto : "", p.establecimiento, p.comuna, p.entorno].filter(Boolean).join(" · ");
  }

  const chipsRoles = () => chips(Object.keys(ROLES).map((k) => ({ accion: "wizard", valor: k, etiqueta: `${ROLES[k].emoji} ${ROLES[k].nombre}` })));
  const chipsComunas = () => chips(Object.keys(COMUNAS).map((c) => ({ accion: "wizard", valor: c }))
    .concat([{ accion: "wizard", valor: "Otra comuna" }, { accion: "wizard", valor: "-", etiqueta: "Prefiero no indicar" }]));
  const tiposDelRol = (rol) => TIPOS_MATERIAL.filter((t) => !rol || t.roles.includes(rol));

  /* ================================================================
     8. ASISTENTE DE PROMPTS Y PERFIL (flujo conversacional)
     ================================================================ */
  function iniciarWizard(soloPerfil) {
    const p = leerPerfil() || {};
    wizard = { datos: {}, soloPerfil: !!soloPerfil, n: 0 };
    if (soloPerfil) {
      agregar("bot", `<h3>📍 Personaliza tu experiencia</h3>
        <p>Con tu rol, tu comuna y tu establecimiento adaptaré las sugerencias y los prompts. Se guarda <strong>solo en este dispositivo</strong>.</p>`);
      preguntar("rol");
      return;
    }
    agregar("bot",
      `<h3>✏️ Armemos tu prompt paso a paso</h3>
       <p>Te haré algunas preguntas breves para entregarte un prompt con la estructura del <strong>Manual 4</strong> (rol, tarea, contexto, formato, restricciones y criterio de calidad), alineado con los referentes oficiales de tu rol.</p>` +
      chips([{ accion: "wizard-cancelar", valor: "x", etiqueta: "Cancelar" }]));
    if (!p.rol) preguntar("rol"); else preguntar("tipo");
  }

  function preguntar(paso) {
    wizard.paso = paso;
    const n = ++wizard.n, d = wizard.datos, p = leerPerfil() || {};
    const titulo = (t) => `<p><strong>${wizard.soloPerfil ? "" : "Paso " + n + " · "}${t}</strong></p>`;
    switch (paso) {
      case "rol":
        agregar("bot", titulo("¿Cuál es tu rol?") + `<p>Así te mostraré materiales y referentes acordes a tu función.</p>` + chipsRoles());
        break;
      case "tipo": {
        const rol = d.rol || p.rol;
        agregar("bot", titulo("¿Qué material quieres crear?") +
          (ROLES[rol] ? `<p>Opciones para <strong>${escapar(ROLES[rol].nombre)}</strong>.</p>` : "") +
          chips(tiposDelRol(rol).map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre }))));
        break;
      }
      case "nivel":
        agregar("bot", titulo("¿Para qué nivel?") + `<p>Los niveles siguen las <strong>Bases Curriculares</strong> vigentes. También puedes escribir el curso (ej.: "6° básico").</p>` +
          chips(NIVELES.map((x) => ({ accion: "wizard", valor: x.nombre }))));
        break;
      case "asignatura": {
        const lista = ASIGNATURAS[d.nivel] || [];
        const parv = d.nivelObj && d.nivelObj.parvularia;
        agregar("bot", titulo(parv ? "¿Qué núcleo de aprendizaje?" : "¿Qué asignatura o módulo?") +
          (lista.length ? "" : `<p>Escribe la asignatura o el módulo (ej.: "Matemática" o un módulo de tu especialidad TP).</p>`) +
          chips(lista.map((x) => ({ accion: "wizard", valor: x }))));
        break;
      }
      case "tema":
        agregar("bot", titulo("¿Qué tema o contenido quieres trabajar?") + `<p>Ej.: <em>"ciclo del agua"</em>, <em>"fracciones equivalentes"</em>, <em>"texto argumentativo"</em>.</p>`);
        break;
      case "oa":
        agregar("bot", titulo("¿Tienes el Objetivo de Aprendizaje (OA)? (recomendado)") +
          `<p>Cópialo desde las Bases Curriculares en 🔗 <a href="https://www.curriculumnacional.cl/Curriculum/Bases_Curriculares" target="_blank" rel="noopener">curriculumnacional.cl</a> y pégalo aquí. Así la IA trabaja sobre el OA real y no inventa uno.</p>` +
          chips([{ accion: "wizard", valor: "-", etiqueta: "No lo tengo ahora" }]));
        break;
      case "proposito":
        agregar("bot", titulo("¿Cuál es el tema o propósito?") +
          `<p>Descríbelo en una frase, sin datos de personas. Ej.: <em>"mejorar la puntualidad en el inicio de clases"</em> o <em>"recreos más inclusivos"</em>.</p>`);
        break;
      case "destinatarios":
        agregar("bot", titulo("¿Para quién es?") + chips(DESTINATARIOS.map((x) => ({ accion: "wizard", valor: x }))));
        break;
      case "perfil":
        agregar("bot", titulo("¿Usamos los datos de tu perfil?") + `<p>📍 <strong>${escapar(resumenPerfil(p))}</strong></p>` +
          chips([{ accion: "wizard", valor: "si", etiqueta: "Sí, usar mi perfil", primario: true }, { accion: "wizard", valor: "cambiar", etiqueta: "Cambiar comuna o establecimiento" }]));
        break;
      case "comuna":
        agregar("bot", titulo("¿En qué comuna está tu establecimiento?") +
          `<p>Cada comuna tiene una realidad geográfica distinta: así los ejemplos serán cercanos a tus estudiantes.</p>` + chipsComunas());
        break;
      case "otraComuna":
        agregar("bot", `<p>Escribe el nombre de la comuna:</p>`);
        break;
      case "establecimiento": {
        const deComuna = ESTABLECIMIENTOS.filter((e) => d.comuna && normalizar(e.comuna) === normalizar(d.comuna));
        agregar("bot", titulo("¿Cuál es tu establecimiento? (opcional)") +
          `<p>${deComuna.length ? "Elígelo de la lista o escribe su nombre." : "Escribe su nombre."} Si está registrado en el Plan Anual Local, usaré sus características para darte sugerencias más pertinentes.</p>
           <div class="nota">🔒 El nombre del establecimiento <strong>no se incluirá en los prompts</strong>: junto con información de estudiantes puede identificarlos (Manual 2, apartado 6.1).</div>` +
          (deComuna.length && deComuna.length <= 30 ? chips(deComuna.map((e) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: e.nombre }))) : "") +
          chips([{ accion: "wizard", valor: "-", etiqueta: "Omitir" }]));
        break;
      }
      case "confirmarEst": {
        const op = wizard.opciones;
        agregar("bot", `<p>${op.length === 1 ? "¿Te refieres a este establecimiento?" : "¿Te refieres a alguno de estos?"}</p>` +
          chips(op.map((e) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: `${e.nombre}${e.comuna ? " (" + e.comuna + ")" : ""}`, primario: op.length === 1 }))
            .concat([{ accion: "wizard", valor: "otro", etiqueta: "No, es otro" }])));
        break;
      }
      case "entorno":
        agregar("bot", titulo("¿Cuál es el entorno de tu establecimiento?") + chips(ENTORNOS.map((x) => ({ accion: "wizard", valor: x }))));
        break;
      case "referencias": {
        const c = COMUNAS[d.comuna];
        const sug = c ? c.referencias : [];
        agregar("bot", titulo("¿Qué referencias locales quieres que use la IA?") +
          (c ? `<p>Sugerencias para <strong>${escapar(d.comuna)}</strong> (${escapar(c.descripcion)}):</p><ul>${sug.map((s) => `<li>${escapar(s)}</li>`).join("")}</ul>` : "") +
          `<p>Puedes usarlas o <strong>escribir las tuyas</strong>, que suelen ser mejores: la feria del sector, un estero o cerro cercano, una actividad productiva o una tradición local.</p>` +
          chips((c ? [{ accion: "wizard", valor: "sugeridas", etiqueta: "Usar las sugeridas", primario: true }] : [])
            .concat([{ accion: "wizard", valor: "-", etiqueta: "Sin referencias locales" }])));
        break;
      }
      case "recursos":
        agregar("bot", titulo("¿Con qué recursos cuentas?") +
          `<p>Así las actividades serán realizables por todos (Manual 3, equidad territorial).</p>` +
          chips(RECURSOS_AULA.map((x) => ({ accion: "wizard", valor: x })).concat([{ accion: "wizard", valor: "-", etiqueta: "Omitir" }])));
        break;
      case "contexto":
        agregar("bot", titulo("¿Algo más que la IA deba considerar? (opcional)") +
          `<p>Ej.: <em>"32 estudiantes, ritmos heterogéneos, les motiva el trabajo en equipo"</em>.</p>
           <div class="nota">🔒 Describe la situación <strong>sin nombres, RUT ni diagnósticos individuales</strong>.</div>` +
          chips([{ accion: "wizard", valor: "-", etiqueta: "Omitir este paso" }]));
        break;
    }
  }

  /* Después de definir el material, pasa a la parte de ubicación/perfil */
  function pasoUbicacion() {
    const p = leerPerfil() || {};
    preguntar(p.comuna ? "perfil" : "comuna");
  }
  function trasUbicacion() {
    if (wizard.soloPerfil) { terminarPerfil(); return; }
    preguntar(wizard.datos.tipo.curricular ? "referencias" : "contexto");
  }
  function terminarPerfil() {
    wizard = null;
    agregar("bot", `<p>✅ Listo, guardé tu perfil: <strong>${escapar(resumenPerfil(leerPerfil() || {}) || "sin datos")}</strong>. Lo usaré para adaptar sugerencias y prompts. Puedes cambiarlo cuando quieras desde el menú.</p>` +
      chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear prompt para material", primario: true }, { accion: "preguntar", valor: "Mi establecimiento" }]));
  }
  function elegirEstablecimiento(est) {
    const d = wizard.datos;
    d.estId = est.id; d.establecimiento = est.nombre;
    if (est.comuna) d.comuna = est.comuna;
    guardarPerfil({ comuna: d.comuna, establecimiento: est.nombre, estId: est.id });
    if (est.entorno) { d.entorno = est.entorno; guardarPerfil({ entorno: est.entorno }); trasUbicacion(); }
    else preguntar("entorno");
  }

  function avanzarWizard(valor) {
    const d = wizard.datos, p = leerPerfil() || {};
    const omitido = valor === "-";
    switch (wizard.paso) {
      case "rol": {
        const rol = ROLES[valor] ? valor : Object.keys(ROLES).find((k) => normalizar(ROLES[k].nombre).includes(normalizar(valor)) || normalizar(valor).includes(normalizar(ROLES[k].corto)));
        if (!rol) { agregar("bot", `<p>Elige una de las opciones:</p>` + chipsRoles()); return; }
        d.rol = rol; guardarPerfil({ rol });
        if (wizard.soloPerfil) preguntar("comuna"); else preguntar("tipo");
        return;
      }
      case "tipo": {
        const lista = tiposDelRol(d.rol || p.rol);
        const tipo = lista.find((t) => t.id === valor) || lista.find((t) => normalizar(t.nombre).includes(normalizar(valor)));
        if (!tipo) { agregar("bot", `<p>Elige una de las opciones de material:</p>` + chips(lista.map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre })))); return; }
        d.tipo = tipo;
        preguntar(tipo.curricular ? "nivel" : "proposito");
        return;
      }
      case "nivel":
        d.nivel = valor; d.nivelObj = NIVELES.find((x) => x.nombre === valor) || null;
        preguntar("asignatura"); return;
      case "asignatura": d.asignatura = valor; preguntar("tema"); return;
      case "tema": d.tema = valor; preguntar("oa"); return;
      case "oa": d.oa = omitido ? "" : valor; pasoUbicacion(); return;
      case "proposito": d.proposito = valor; preguntar("destinatarios"); return;
      case "destinatarios": d.destinatarios = valor; pasoUbicacion(); return;
      case "perfil":
        if (valor === "si") { d.comuna = p.comuna; d.entorno = p.entorno; d.estId = p.estId; trasUbicacion(); }
        else preguntar("comuna");
        return;
      case "comuna":
        if (valor === "Otra comuna") { wizard.n--; preguntar("otraComuna"); return; }
        d.comuna = omitido ? "" : valor;
        if (d.comuna !== p.comuna) guardarPerfil({ comuna: d.comuna, establecimiento: "", estId: "", entorno: "" });
        preguntar("establecimiento"); return;
      case "otraComuna":
        d.comuna = valor; guardarPerfil({ comuna: valor, establecimiento: "", estId: "", entorno: "" });
        preguntar("establecimiento"); return;
      case "establecimiento":
      case "confirmarEst": {
        if (valor.startsWith("id:")) { const est = ESTABLECIMIENTOS.find((e) => e.id === valor.slice(3)); if (est) { elegirEstablecimiento(est); return; } }
        if (omitido) { guardarPerfil({ establecimiento: "", estId: "" }); preguntar("entorno"); return; }
        if (valor === "otro") { wizard.paso = "establecimientoLibre"; agregar("bot", `<p>Escribe el nombre de tu establecimiento, o presiona Omitir.</p>` + chips([{ accion: "wizard", valor: "-", etiqueta: "Omitir" }])); return; }
        const coincidencias = buscarEstablecimiento(valor, d.comuna);
        if (coincidencias.length && wizard.paso === "establecimiento") { wizard.opciones = coincidencias; wizard.n--; preguntar("confirmarEst"); return; }
        guardarPerfil({ establecimiento: valor, estId: "" }); d.establecimiento = valor;
        preguntar("entorno"); return;
      }
      case "establecimientoLibre":
        if (!omitido) { guardarPerfil({ establecimiento: valor, estId: "" }); d.establecimiento = valor; }
        preguntar("entorno"); return;
      case "entorno":
        d.entorno = valor; guardarPerfil({ entorno: valor });
        trasUbicacion(); return;
      case "referencias": {
        const c = COMUNAS[d.comuna];
        d.referencias = omitido ? "" : (valor === "sugeridas" && c ? c.referencias.join(", ") : valor);
        preguntar("recursos"); return;
      }
      case "recursos": d.recursos = omitido ? "" : valor; preguntar("contexto"); return;
      case "contexto":
        d.contexto = omitido ? "" : valor;
        entregarPrompt(d);
        wizard = null;
        return;
    }
  }

  function entregarPrompt(d) {
    const t = d.tipo, p = leerPerfil() || {};
    const est = estDePerfil({ estId: d.estId || p.estId });
    const lugar = (d.comuna
      ? `establecimiento de educación pública de la comuna de ${d.comuna} (Región del Biobío, Chile)`
      : "establecimiento de educación pública de la Región del Biobío, Chile") + (d.entorno ? `, entorno ${d.entorno.toLowerCase()}` : "");
    const carEst = est && est.caracteristicas ? `\nCaracterísticas del establecimiento: ${est.caracteristicas}` : "";
    let rolIA = t.rol, tarea = t.tarea, formato = t.formato, contexto, marco, restricciones, criterio, declaracion;

    if (t.curricular) {
      const parv = d.nivelObj && d.nivelObj.parvularia;
      if (parv && t.id === "clase") {
        rolIA = "educadora de párvulos con experiencia en el sistema de educación parvularia chileno";
        tarea = "diseña una experiencia de aprendizaje";
        formato = "inicio, desarrollo y cierre (30 a 45 minutos), con juego, movimiento y material concreto, preguntas mediadoras y evidencias a observar";
      }
      contexto = [
        `${parv ? "niños y niñas de" : "estudiantes de"} ${d.nivel}`,
        `${parv ? "núcleo de aprendizaje" : "asignatura"}: ${d.asignatura}`,
        `tema: ${d.tema}`,
        lugar,
        d.contexto ? `características del grupo: ${d.contexto}` : ""
      ].filter(Boolean).join("; ") + "." + carEst;
      const local = d.referencias
        ? ` Cuando sea pertinente, usa situaciones y ejemplos con referencias reconocibles para estos estudiantes: ${d.referencias}.`
        : " Cuando sea pertinente, usa situaciones reconocibles para estudiantes del entorno del establecimiento.";
      contexto += local + " El contexto local debe ayudar a comprender, no ser requisito para resolver.";
      if (d.recursos) contexto += `\n\nRECURSOS DISPONIBLES: ${d.recursos}. Diseña actividades que todo el grupo pueda realizar con esos recursos.`;
      if (d.oa) contexto += `\n\nOBJETIVO DE APRENDIZAJE (copiado de las Bases Curriculares): ${d.oa}`;
      marco = parv
        ? "Bases Curriculares de Educación Parvularia y Marco para la Buena Enseñanza de Educación Parvularia (dominios A y C). Privilegia experiencias lúdicas, el juego y el bienestar integral."
        : `${d.nivelObj ? d.nivelObj.bases : "Bases Curriculares vigentes del nivel"} y Marco para la Buena Enseñanza 2021, estándares ${t.estandares || "3 y 7"}.`;
      restricciones = "lenguaje claro y adecuado al nivel; terminología del sistema escolar chileno. " +
        (d.oa ? "Trabaja exclusivamente sobre el OA indicado; no inventes otros objetivos ni cites normativa." : "No inventes objetivos de aprendizaje ni cites las Bases Curriculares o normativa: yo verificaré la alineación curricular en curriculumnacional.cl.") +
        " No reproduzcas estereotipos sobre lo urbano o lo rural. Si te falta información, márcala como [PENDIENTE] en lugar de inventarla.";
      criterio = "todo lo que se pida debe producir evidencia observable del aprendizaje, y el material debe ser accesible para todo el grupo.";
      declaracion = "Material elaborado con apoyo de herramientas de inteligencia artificial y adaptado por el equipo docente de la asignatura.";
    } else {
      contexto = [`tema o propósito: ${d.proposito}`, `destinatarios: ${d.destinatarios}`, lugar, d.contexto ? `consideraciones: ${d.contexto}` : ""]
        .filter(Boolean).join("; ") + "." + carEst;
      marco = t.marco;
      restricciones = "lenguaje claro y respetuoso, adecuado a los destinatarios; terminología del sistema escolar chileno. No inventes normativa, cifras ni datos del establecimiento: márcalos como [PENDIENTE]. No incluyas datos personales ni emitas juicios sobre personas.";
      criterio = "acciones concretas, realizables y verificables, coherentes con el propósito y con la realidad del establecimiento.";
      declaracion = "Versión preliminar elaborada con apoyo de inteligencia artificial generativa. Contenido revisado, corregido y validado por [cargo].";
    }

    const prompt =
`Actúa como ${rolIA}.

TAREA: ${tarea}.

CONTEXTO: ${contexto}

MARCO DE REFERENCIA: ${marco}

FORMATO: ${formato}.

RESTRICCIONES: ${restricciones}

CRITERIO DE CALIDAD: ${criterio}

Al final, indica qué partes debo verificar y qué información te faltó para responder mejor.${t.pegar ? "\n\nMATERIAL ORIGINAL:\n[pega aquí el material, sin datos personales]" : ""}`;

    agregar("bot",
      `<h3>✅ Tu prompt está listo</h3>
       <p>Cópialo y pégalo en la herramienta de IA autorizada en tu establecimiento:</p>
       ${markdown("```\n" + prompt + "\n```")}
       <h4>Después de la primera respuesta, itera:</h4>
       <ul>
         <li>"Hazlo más breve" · "Agrega ejemplos concretos"</li>
         <li>"Explícalo de manera más simple" · "Reorganízalo en una tabla"</li>
       </ul>
       <div class="nota">📌 Antes de usarlo: ${t.curricular ? "verifica la alineación curricular, " : ""}revisa sesgos y declara el uso de IA: <em>"${escapar(declaracion)}"</em></div>
       <div class="pie-msg">${etiquetaFuente({ fuente: "M4" })}${etiquetaFuente({ fuente: t.curricular ? "DOC" : (p.rol === "asistente" ? "ASI" : "DIR") })}</div>` +
      chips([
        { accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear otro prompt", primario: true },
        { valor: "Frases para ajustar la respuesta de la IA" },
        { valor: "Cómo declarar el uso de IA" }
      ]),
      { texto: prompt });
  }

  /* Tarjeta "Mi establecimiento" */
  function respuestaMiEstablecimiento() {
    const p = leerPerfil() || {};
    const est = estDePerfil(p);
    if (!p.establecimiento && !est) {
      return `<p>Aún no me has dicho cuál es tu establecimiento.</p>` + chips([{ accion: "perfil-iniciar", valor: "x", etiqueta: "📍 Configurar mi perfil", primario: true }]);
    }
    if (!est) {
      return `<h3>🏫 ${escapar(p.establecimiento)}</h3><p>Este establecimiento aún no tiene características registradas en el asistente. El equipo del Servicio puede agregarlas desde el panel de configuración, a partir del Plan Anual Local.</p>` +
        chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear prompt para material", primario: true }]);
    }
    const enlaces = (est.enlaces || []).map((e) => `- [${e.titulo}](${e.url})`).join("\n");
    return `<h3>🏫 ${escapar(est.nombre)}</h3>` +
      markdown([est.comuna ? `**Comuna:** ${est.comuna}` : "", est.entorno ? `**Entorno:** ${est.entorno}` : "", est.niveles ? `**Niveles:** ${est.niveles}` : "",
        est.caracteristicas ? `\n${est.caracteristicas}` : "", enlaces ? `\n**Enlaces:**\n${enlaces}` : ""].filter(Boolean).join("\n")) +
      `<div class="nota">Fuente: Plan Anual Local del Servicio y registros del equipo. Usaré estas características (sin el nombre) para adaptar tus prompts.</div>` +
      chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear prompt para material", primario: true }]);
  }

  /* ================================================================
     9. FLUJO PRINCIPAL DE CONSULTA
     ================================================================ */
  const RE_SALUDO = /^(hola|buen[oa]s?( dias| tardes| noches)?|hey|saludos|que tal)[\s!.?]*$/;
  const RE_WIZARD = /(crear|armar|hacer|generar|construir|redactar|escribir)( un| mi)? prompt|asistente de prompt|ayudame a (crear|disenar|hacer) (un |una )?(material|guia|rubrica|prueba|clase)|disenar (un |una )?material|^crear prompt$/;
  const RE_PERFIL = /^(mi )?(perfil|rol|mi rol|comuna|mi comuna|cambiar (mi )?(comuna|perfil|establecimiento|rol))[\s!.?]*$/;
  const RE_MIEST = /^(mi (establecimiento|colegio|escuela|liceo|jardin)|caracteristicas de mi (establecimiento|colegio|escuela|liceo))[\s!.?]*$/;
  const RE_GRACIAS = /^(gracias|muchas gracias|ok|vale|perfecto|genial)[\s!.]*$/;

  async function procesar(texto, { omitirRevision = false } = {}) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    const n = normalizar(texto);

    // Respuestas dentro del asistente de prompts
    if (wizard && !RE_WIZARD.test(n)) {
      const priv = revisarPrivacidad(texto);
      agregarUsuario(texto);
      if (priv.hallazgos.length) {
        agregar("bot", `<div class="alerta"><strong>⚠️ Detecté ${escapar(priv.hallazgos.join(", "))}.</strong> No lo incluiré en el prompt.</div><p>Escríbelo de nuevo de forma general (ej.: "un curso de segundo ciclo").</p>`);
        return;
      }
      avanzarWizard(texto);
      return;
    }

    // Revisión de datos personales antes de cualquier procesamiento
    if (!omitirRevision) {
      const priv = revisarPrivacidad(texto);
      if (priv.hallazgos.length) {
        agregarUsuario(texto);
        const limpio = limpiarDatos(texto);
        agregar("bot",
          `<div class="alerta"><strong>⚠️ Tu consulta parece contener ${escapar(priv.hallazgos.join(", "))}.</strong></div>
           <p>Según el <strong>Manual 2</strong> y la <strong>Ley 21.719</strong>, los datos personales de estudiantes, familias o funcionarios no deben ingresar a plataformas de IA de uso público. Te propongo esta versión anonimizada:</p>
           ${markdown("```\n" + limpio + "\n```")}` +
          chips([
            { accion: "enviar-limpio", valor: limpio, etiqueta: "Enviar versión anonimizada", primario: true },
            { valor: "¿Cómo anonimizar una consulta?" }
          ]));
        return;
      }
    }

    agregarUsuario(texto);

    if (RE_WIZARD.test(n)) { iniciarWizard(); return; }
    if (RE_PERFIL.test(n)) { iniciarWizard(true); return; }
    if (RE_MIEST.test(n)) { agregar("bot", respuestaMiEstablecimiento()); return; }
    if (RE_SALUDO.test(n)) {
      agregar("bot", `<p>¡Hola! 👋 Soy el asistente de IA del <strong>SLEP Andalién Sur</strong>. Puedo resolver dudas sobre uso ético de la IA, protección de datos, herramientas, prompts y los referentes oficiales de tu rol, o ayudarte a <strong>crear un prompt</strong> para diseñar material.</p>` +
        chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear prompt para material", primario: true }, { valor: "¿Qué herramientas de IA puedo usar?" }, { valor: "¿Puedo ingresar datos de estudiantes a la IA?" }]));
      return;
    }
    if (RE_GRACIAS.test(n)) {
      agregar("bot", `<p>¡Con gusto! 😊 Si necesitas algo más, aquí estaré. Recuerda: <strong>la decisión final siempre es humana</strong>.</p>`);
      return;
    }

    if (!MODO_IA) { agregar("bot", respuestaLocal(texto)); return; }

    ocupado = true; el.enviar.disabled = true;
    const espera = mostrarEscribiendo();
    try {
      const html = await respuestaIA(texto);
      espera.remove();
      agregar("bot", html);
    } catch (e) {
      espera.remove();
      agregar("bot", respuestaLocal(texto) + `<div class="nota">No pude conectar con el servicio de IA, así que te respondo con los manuales. (${escapar(e.message)})</div>`);
    } finally {
      ocupado = false; el.enviar.disabled = false; el.entrada.focus();
    }
  }

  /* ================================================================
     10. CONTENIDO ACTUALIZABLE (panel de configuración → Apps Script)
     ================================================================ */
  function aplicarContenido(items) {
    if (!Array.isArray(items)) return;
    // Quita lo cargado antes desde el panel y vuelve a agregar
    for (let i = CONOCIMIENTO.length - 1; i >= 0; i--) if (CONOCIMIENTO[i].fuente === "SLEP") CONOCIMIENTO.splice(i, 1);
    for (let i = ESTABLECIMIENTOS.length - 1; i >= 0; i--) if (ESTABLECIMIENTOS[i].remoto) ESTABLECIMIENTOS.splice(i, 1);
    items.forEach((it) => {
      const enlaces = String(it.enlaces || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => /^https?:\/\//.test(x[1] || x[0] || ""))
        .map((x) => (x.length > 1 ? { titulo: x[0], url: x[1] } : { titulo: x[0], url: x[0] }));
      if (it.tipo === "establecimiento") {
        const base = ESTABLECIMIENTOS.findIndex((e) => e.id === it.id || normalizar(e.nombre) === normalizar(it.titulo));
        const est = { id: it.id, nombre: it.titulo, comuna: it.comuna || "", entorno: it.entorno || "", niveles: it.niveles || "", alias: it.claves || "", caracteristicas: it.texto || "", enlaces, remoto: true };
        if (base >= 0) ESTABLECIMIENTOS.splice(base, 1, est); else ESTABLECIMIENTOS.push(est);
      } else {
        const lista = enlaces.map((e) => `🔗 [${e.titulo}](${e.url})`).join("\n");
        CONOCIMIENTO.push({ id: "slep-" + it.id, fuente: "SLEP", titulo: it.titulo, claves: String(it.claves || "").split(",").map((c) => c.trim()).filter(Boolean),
          texto: (it.texto || "") + (lista ? "\n\n" + lista : "") });
      }
    });
    construirIndice(); construirTemas();
  }

  async function cargarContenido() {
    try { const c = JSON.parse(localStorage.getItem(CLAVE_CONTENIDO) || "null"); if (c) aplicarContenido(c); } catch (e) { /* sin caché */ }
    if (!MODO_IA) return;
    try {
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(CONFIG.API + "?accion=contenido", { signal: ctrl.signal });
      const datos = await r.json();
      if (datos.ok && Array.isArray(datos.items)) {
        aplicarContenido(datos.items);
        try { localStorage.setItem(CLAVE_CONTENIDO, JSON.stringify(datos.items)); } catch (e) { /* sin almacenamiento */ }
      }
    } catch (e) { /* sin conexión: se usa la base local */ }
  }

  /* ================================================================
     11. INTERFAZ: temas, sugerencias, modo, eventos
     ================================================================ */
  function construirTemas() {
    const orden = ["SLEP", "M1", "M2", "LEY", "M3", "M4", "M5", "DOC", "DIR", "ASI", "EXT"];
    const grupos = {};
    CONOCIMIENTO.forEach((f) => { const k = f.fuente === "MINEDUC" ? "M1" : f.fuente; (grupos[k] = grupos[k] || []).push(f); });
    el.temas.innerHTML = orden.filter((k) => grupos[k]).map((k, i) =>
      `<details ${i === 0 ? "open" : ""}><summary><span class="dot" style="background:${COLORES[k]}"></span>${escapar((FUENTES[k] || k).replace(" · ", " — "))}</summary>
        ${grupos[k].map((f) => `<button class="tema" type="button" style="--c:${COLORES[k]}" data-id="${f.id}">${escapar(f.titulo)}</button>`).join("")}
      </details>`).join("");
  }

  const SUG_BASE = [
    { emoji: "✏️", color: "#f8b400", titulo: "Crear un prompt para material", texto: "Paso a paso, según tu rol y tu comuna", accion: "wizard-iniciar" },
    { emoji: "🔒", color: "#ff3c4c", titulo: "¿Puedo ingresar datos de estudiantes?", texto: "Lo que dice la Ley 21.719 y el Manual 2" },
    { emoji: "⚖️", color: "#0071ea", titulo: "¿Qué se puede delegar en la IA?", texto: "Tareas permitidas y zona prohibida" },
    { emoji: "🧰", color: "#90d039", titulo: "¿Qué herramientas de IA puedo usar?", texto: "Seis familias y cómo evaluarlas" }
  ];
  const SUG_ROL = {
    docente: [
      { emoji: "📗", color: "#0b8f6a", titulo: "Bases Curriculares: ¿cuál corresponde a mi nivel?", texto: "Niveles, asignaturas y cómo usar el OA" },
      { emoji: "🍎", color: "#0b8f6a", titulo: "Marco para la Buena Enseñanza (MBE 2021)", texto: "4 dominios y 12 estándares" }
    ],
    directivo: [
      { emoji: "🧭", color: "#5b4bd1", titulo: "Marco para la Buena Dirección y el Liderazgo Escolar (MBDLE 2015)", texto: "5 dimensiones de prácticas" },
      { emoji: "📊", color: "#5b4bd1", titulo: "Recursos oficiales para equipos directivos (PME, estándares, normativa)", texto: "PME, estándares y normativa" }
    ],
    asistente: [
      { emoji: "🤝", color: "#d9622b", titulo: "Convivencia educativa: recursos oficiales del MINEDUC", texto: "PNCE, Ley 21.809, reglamentos" },
      { emoji: "🧩", color: "#d9622b", titulo: "Profesionales asistentes de la educación en el PIE", texto: "Roles evaluador, de apoyo y colaborador" }
    ]
  };
  const SUG_FINAL = [
    { emoji: "🎓", color: "#e0559b", titulo: "Cursos de IA del CPEIP", texto: "Formación oficial gratuita" },
    { emoji: "📚", color: "#22a9dc", titulo: "Leer los manuales", texto: "Biblioteca digital de la serie completa", accion: "ir", valor: "manuales.html" }
  ];
  function construirSugerencias() {
    const p = leerPerfil() || {};
    const lista = SUG_BASE.concat(SUG_ROL[p.rol] || [
      { emoji: "👤", color: "#0b8f6a", titulo: "Personalizar según mi rol", texto: "Docente, directivo o asistente de la educación", accion: "perfil-iniciar", valor: "x" },
      { emoji: "🛡️", color: "#ff98a4", titulo: "¿Cómo anonimizar una consulta?", texto: "Ejemplo correcto e incorrecto" }
    ]).concat(SUG_FINAL);
    el.sugerencias.innerHTML = lista.map((s) =>
      `<button class="sug" type="button" style="--c:${s.color}" data-accion="${s.accion || "preguntar"}" data-valor="${escapar(s.valor || s.titulo)}">
         <span class="emoji" aria-hidden="true">${s.emoji}</span><span><strong>${escapar(s.titulo)}</strong><span>${escapar(s.texto)}</span></span>
       </button>`).join("");
  }

  function mostrarPerfil() {
    const p = leerPerfil() || {};
    const caja = $("#perfil"), saludo = $("#saludo");
    if (p.rol || p.comuna) {
      const rol = ROLES[p.rol];
      caja.innerHTML = `<span class="perfil-ico">${rol ? rol.emoji : "📍"}</span><span><strong>${escapar(p.establecimiento || (rol ? rol.nombre : "Mi perfil"))}</strong><small>${escapar([rol && p.establecimiento ? rol.corto : "", p.comuna, p.entorno].filter(Boolean).join(" · "))} · Cambiar</small></span>`;
      if (saludo) saludo.textContent = p.establecimiento ? `¡Hola, equipo de ${p.establecimiento}!` : (p.comuna ? `¡Hola, ${p.comuna}! ¿En qué te ayudo?` : "¡Hola! ¿En qué te ayudo hoy?");
    } else {
      caja.innerHTML = `<span class="perfil-ico">📍</span><span><strong>Mi rol, comuna y establecimiento</strong><small>Personaliza sugerencias y prompts</small></span>`;
      if (saludo) saludo.textContent = "¡Hola! ¿En qué te ayudo hoy?";
    }
  }

  function construirModo() {
    el.modo.className = "modo" + (MODO_IA ? " ia" : "");
    el.modo.innerHTML = MODO_IA
      ? `<span class="luz"></span><div><strong>Modo IA conectado</strong>Respuestas generadas con IA a partir de los manuales.</div>`
      : `<span class="luz"></span><div><strong>Modo guías</strong>Responde con los manuales del Servicio. Tus consultas no salen de este navegador.</div>`;
  }

  function nuevaConversacion() {
    historial = []; wizard = null;
    el.mensajes.innerHTML = ""; el.bienvenida.hidden = false; el.chat.scrollTop = 0;
    cerrarMenu(); el.entrada.focus();
  }

  function aplicarTema(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(CLAVE_TEMA, t); } catch (e) { /* sin almacenamiento */ }
  }
  function temaInicial() {
    let t = null;
    try { t = localStorage.getItem(CLAVE_TEMA); } catch (e) { /* sin almacenamiento */ }
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");   // claro por defecto
  }

  /* Aplicación instalable (PWA) */
  let avisoInstalar = null;
  const btnInstalar = $("#btnInstalar"), btnInstalarTop = $("#btnInstalarTop");
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function mostrarInstalar(ver) { btnInstalar.hidden = !ver; btnInstalarTop.hidden = !ver; }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); avisoInstalar = e; mostrarInstalar(true); });
  window.addEventListener("appinstalled", () => { avisoInstalar = null; mostrarInstalar(false); });
  async function instalar() {
    cerrarMenu();
    if (avisoInstalar) {
      avisoInstalar.prompt();
      await avisoInstalar.userChoice;
      avisoInstalar = null; mostrarInstalar(false);
    } else {
      agregar("bot", `<h3>📲 Instalar como aplicación</h3>
        <ul>
          <li><strong>iPhone / iPad (Safari):</strong> toca <strong>Compartir</strong> ⬆️ y luego <strong>"Agregar a pantalla de inicio"</strong>.</li>
          <li><strong>Android (Chrome):</strong> menú <strong>⋮</strong> → <strong>"Instalar aplicación"</strong> o "Agregar a pantalla principal".</li>
          <li><strong>Computador (Chrome / Edge):</strong> ícono de instalación ⊕ en la barra de direcciones.</li>
        </ul>`, { guardar: false });
    }
  }
  if (esIOS && !instalada) mostrarInstalar(true);
  btnInstalar.addEventListener("click", instalar);
  btnInstalarTop.addEventListener("click", instalar);
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  function abrirMenu() { el.sidebar.classList.add("abierta"); el.overlay.hidden = false; }
  function cerrarMenu() { el.sidebar.classList.remove("abierta"); el.overlay.hidden = true; }
  function autoAltura() { el.entrada.style.height = "auto"; el.entrada.style.height = Math.min(el.entrada.scrollHeight, 200) + "px"; }

  // Eventos
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = el.entrada.value;
    el.entrada.value = ""; autoAltura();
    procesar(t);
  });
  el.entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.form.requestSubmit(); }
  });
  el.entrada.addEventListener("input", autoAltura);

  document.addEventListener("click", async (e) => {
    const copiar = e.target.closest(".btn-copiar");
    if (copiar) {
      const txt = copiar.nextElementSibling.textContent;
      try { await navigator.clipboard.writeText(txt); } catch (err) {
        const r = document.createRange(); r.selectNodeContents(copiar.nextElementSibling);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); s.removeAllRanges();
      }
      copiar.textContent = "¡Copiado!"; setTimeout(() => { copiar.textContent = "Copiar"; }, 1600);
      return;
    }
    const tema = e.target.closest(".tema");
    if (tema) {
      const f = CONOCIMIENTO.find((x) => x.id === tema.dataset.id);
      if (!f) return;
      cerrarMenu(); wizard = null;
      agregarUsuario(f.titulo);
      const rel = buscar(f.titulo + " " + f.claves.slice(0, 3).join(" "), 4).map((r) => r.ficha).filter((x) => x.id !== f.id).slice(0, 3);
      agregar("bot", htmlFicha(f, rel));
      return;
    }
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const { accion, valor } = b.dataset;
    if (accion === "preguntar") procesar(valor);
    else if (accion === "wizard-iniciar") { cerrarMenu(); agregarUsuario("Crear prompt para material"); iniciarWizard(); }
    else if (accion === "wizard" && wizard) { agregarUsuario(b.textContent.trim()); avanzarWizard(valor); }
    else if (accion === "ir") { location.href = valor; }
    else if (accion === "perfil-iniciar") { cerrarMenu(); agregarUsuario("Mi perfil"); iniciarWizard(true); }
    else if (accion === "wizard-cancelar") { wizard = null; agregar("bot", "<p>Listo, cancelé el asistente. ¿En qué más te ayudo?</p>"); }
    else if (accion === "enviar-limpio") procesar(valor, { omitirRevision: true });
  });

  $("#btnNueva").addEventListener("click", nuevaConversacion);
  $("#btnWizard").addEventListener("click", () => { cerrarMenu(); agregarUsuario("Crear prompt para material"); iniciarWizard(); });
  $("#btnMenu").addEventListener("click", abrirMenu);
  $("#btnCerrarMenu").addEventListener("click", cerrarMenu);
  el.overlay.addEventListener("click", cerrarMenu);
  $("#btnTema").addEventListener("click", () => aplicarTema(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });

  // Si la app vuelve a mostrarse desde la memoria del navegador, parte desde el inicio
  window.addEventListener("pageshow", (e) => { if (e.persisted) nuevaConversacion(); });

  // Inicio: siempre desde la pantalla de bienvenida
  temaInicial();
  construirIndice();
  construirTemas();
  construirSugerencias();
  construirModo();
  mostrarPerfil();
  cargarContenido();
  if (new URLSearchParams(location.search).get("accion") === "prompt") {   // atajo de la app instalada
    agregarUsuario("Crear prompt para material"); iniciarWizard();
  }
  el.entrada.focus();
})();
