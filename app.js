/* =====================================================================
   Asistente IA Educativa · SLEP Andalién Sur
   Lógica del chat: búsqueda en la base de conocimiento, asistente de
   prompts, detector de datos personales y conexión opcional a la API.
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
  const CLAVE_HISTORIAL = "slep-ia-historial";
  const CLAVE_TEMA = "slep-ia-tema";

  let historial = [];   // [{rol: "user"|"bot", html, texto}]
  let wizard = null;    // estado del asistente de prompts
  let ocupado = false;

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
     2. MOTOR DE BÚSQUEDA LOCAL (sobre CONOCIMIENTO)
     ================================================================ */
  const indice = CONOCIMIENTO.map((f) => ({
    ficha: f,
    titulo: new Set(tokens(f.titulo)),
    claves: f.claves.map(normalizar),
    clavesTok: new Set(f.claves.flatMap(tokens)),
    texto: tokens(f.texto)
  }));
  const df = {};
  indice.forEach((d) => new Set(d.texto).forEach((t) => { df[t] = (df[t] || 0) + 1; }));
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
     3. DETECTOR DE DATOS PERSONALES (Manual 2, apartado 6)
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
    // Un diagnóstico solo se marca si acompaña a una persona identificable
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
     4. RENDERIZADO DE MENSAJES
     ================================================================ */
  const AVATAR = `<div class="avatar" aria-hidden="true"><img src="favicon-48.png" alt=""></div>`;
  const COLORES = { M1: "#0071ea", M2: "#ff3c4c", LEY: "#9b59d0", M3: "#4fa61a", M4: "#f0a500", M5: "#22a9dc", MINEDUC: "#0071ea", EXT: "#e0559b" };

  function ocultarBienvenida() { el.bienvenida.hidden = true; }

  function agregar(rol, html, { guardar = true, texto = "" } = {}) {
    ocultarBienvenida();
    const div = document.createElement("div");
    div.className = `msg ${rol}`;
    div.innerHTML = rol === "bot" ? `${AVATAR}<div class="burbuja">${html}</div>` : `<div class="burbuja">${html}</div>`;
    el.mensajes.appendChild(div);
    requestAnimationFrame(() => { el.chat.scrollTop = el.chat.scrollHeight; });
    if (guardar) { historial.push({ rol, html, texto }); persistir(); }
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
    return agregar("bot", `<span class="escribiendo" aria-label="Escribiendo"><i></i><i></i><i></i></span>`, { guardar: false });
  }

  /* ================================================================
     5. RESPUESTAS
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

  async function respuestaIA(consulta) {
    const perfil = leerPerfil();
    const contexto = buscar(consulta, 4).map((r) => `### ${r.ficha.titulo} (${FUENTES[r.ficha.fuente]})\n${r.ficha.texto}`).join("\n\n") +
      (perfil && perfil.comuna ? `\n\n### Contexto de quien consulta\nTrabaja en un establecimiento de educación pública de la comuna de ${perfil.comuna}` +
        (perfil.entorno ? `, entorno ${perfil.entorno.toLowerCase()}` : "") + ". Si diseñas material, usa ejemplos reconocibles para esa comuna." : "");
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
      `<div class="nota">Respuesta generada con IA a partir de los manuales. Verifica datos y normativa antes de usarla.</div>`;
  }

  /* ================================================================
     6. ASISTENTE DE PROMPTS (flujo conversacional)
     ================================================================ */
  /* ---- Perfil (comuna, entorno y establecimiento): solo en este dispositivo ----
     La comuna y el establecimiento son datos institucionales, no personales.
     Aun así, el nombre del establecimiento NO se incluye en los prompts:
     combinado con datos de estudiantes es un identificador indirecto
     (Manual 2, apartado 6.1). Se usa solo para personalizar la experiencia. */
  const CLAVE_PERFIL = "slep-ia-perfil";
  function leerPerfil() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PERFIL) || "null"); } catch (e) { return null; }
  }
  function guardarPerfil(p) {
    try { localStorage.setItem(CLAVE_PERFIL, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ }
    mostrarPerfil();
  }
  function resumenPerfil(p) {
    return [p.establecimiento, p.comuna, p.entorno].filter(Boolean).join(" · ");
  }

  const chipsComunas = () => chips(Object.keys(COMUNAS).map((c) => ({ accion: "wizard", valor: c }))
    .concat([{ accion: "wizard", valor: "Otra comuna" }, { accion: "wizard", valor: "-", etiqueta: "Prefiero no indicar" }]));

  function iniciarWizard(soloPerfil) {
    wizard = { paso: soloPerfil ? "comuna" : "tipo", datos: {}, soloPerfil: !!soloPerfil, n: 1 };
    if (soloPerfil) {
      agregar("bot", `<h3>📍 Personaliza tu experiencia</h3>
        <p>Con tu comuna y el entorno de tu establecimiento, los prompts usarán ejemplos cercanos a tus estudiantes. Se guarda <strong>solo en este dispositivo</strong>.</p>
        <p><strong>¿En qué comuna está tu establecimiento?</strong></p>` + chipsComunas());
      return;
    }
    agregar("bot",
      `<h3>✏️ Armemos tu prompt paso a paso</h3>
       <p>Te haré algunas preguntas breves para entregarte un prompt con la estructura del <strong>Manual 4</strong> (rol, tarea, contexto, formato, restricciones y criterio de calidad), adaptado a tu comuna y tus estudiantes.</p>
       <p><strong>Paso 1 · ¿Qué material quieres crear?</strong></p>` +
      chips(TIPOS_MATERIAL.map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre }))) +
      chips([{ accion: "wizard-cancelar", valor: "x", etiqueta: "Cancelar" }]));
  }

  function preguntar(paso) {
    wizard.paso = paso;
    const n = ++wizard.n, d = wizard.datos, p = leerPerfil();
    const titulo = (t) => `<p><strong>${wizard.soloPerfil ? "" : "Paso " + n + " · "}${t}</strong></p>`;
    if (paso === "nivel") {
      agregar("bot", titulo("¿Para qué nivel?") + `<p>Elige uno o escribe el curso (ej.: "6° básico").</p>` +
        chips(NIVELES.map((x) => ({ accion: "wizard", valor: x }))));
    } else if (paso === "asignatura") {
      agregar("bot", titulo("¿Qué asignatura y qué tema u objetivo?") + `<p>Ej.: <em>"Ciencias Naturales, ciclo del agua"</em> o <em>"Matemática, fracciones equivalentes"</em>.</p>`);
    } else if (paso === "perfil") {
      agregar("bot", titulo("¿Usamos los datos de tu perfil?") + `<p>📍 <strong>${escapar(resumenPerfil(p))}</strong></p>` +
        chips([{ accion: "wizard", valor: "si", etiqueta: "Sí, usar mi perfil", primario: true }, { accion: "wizard", valor: "cambiar", etiqueta: "Cambiar comuna o entorno" }]));
    } else if (paso === "comuna") {
      agregar("bot", titulo("¿En qué comuna está tu establecimiento?") +
        `<p>Cada comuna tiene una realidad geográfica distinta: así los ejemplos serán cercanos a tus estudiantes.</p>` + chipsComunas());
    } else if (paso === "otraComuna") {
      agregar("bot", `<p>Escribe el nombre de la comuna:</p>`);
    } else if (paso === "entorno") {
      agregar("bot", titulo("¿Cuál es el entorno de tu establecimiento?") +
        chips(ENTORNOS.map((x) => ({ accion: "wizard", valor: x }))));
    } else if (paso === "establecimiento") {
      agregar("bot", titulo("¿Cuál es tu establecimiento? (opcional)") +
        `<p>Solo para personalizar tu experiencia en este dispositivo.</p>
         <div class="nota">🔒 El nombre del establecimiento <strong>no se incluirá en los prompts</strong>: junto con información de estudiantes puede identificarlos (Manual 2, apartado 6.1). Nunca escribas aquí datos de personas.</div>` +
        chips([{ accion: "wizard", valor: "-", etiqueta: "Omitir" }]));
    } else if (paso === "referencias") {
      const c = COMUNAS[d.comuna];
      const sug = c ? c.referencias : [];
      agregar("bot", titulo("¿Qué referencias locales quieres que use la IA?") +
        (c ? `<p>Sugerencias para <strong>${escapar(d.comuna)}</strong> (${escapar(c.descripcion)}):</p><ul>${sug.map((s) => `<li>${escapar(s)}</li>`).join("")}</ul>` : "") +
        `<p>Puedes usarlas o <strong>escribir las tuyas</strong>, que suelen ser mejores: la feria del sector, un estero o cerro cercano, una actividad productiva o una tradición local.</p>` +
        chips((c ? [{ accion: "wizard", valor: "sugeridas", etiqueta: "Usar las sugeridas", primario: true }] : [])
          .concat([{ accion: "wizard", valor: "-", etiqueta: "Sin referencias locales" }])));
    } else if (paso === "recursos") {
      agregar("bot", titulo("¿Con qué recursos cuentas en la sala?") +
        `<p>Así las actividades serán realizables por todo el curso (Manual 3, equidad territorial).</p>` +
        chips(RECURSOS_AULA.map((x) => ({ accion: "wizard", valor: x })).concat([{ accion: "wizard", valor: "-", etiqueta: "Omitir" }])));
    } else if (paso === "contexto") {
      agregar("bot", titulo("¿Algo más del grupo que la IA deba considerar? (opcional)") +
        `<p>Ej.: <em>"32 estudiantes, ritmos heterogéneos, les motiva el trabajo en equipo"</em>.</p>
        <div class="nota">🔒 Describe al grupo <strong>sin nombres, RUT ni diagnósticos individuales</strong>.</div>` +
        chips([{ accion: "wizard", valor: "-", etiqueta: "Omitir este paso" }]));
    }
  }

  function avanzarWizard(valor) {
    const d = wizard.datos, p = leerPerfil();
    const omitido = valor === "-";
    switch (wizard.paso) {
      case "tipo": {
        const tipo = TIPOS_MATERIAL.find((t) => t.id === valor) ||
          TIPOS_MATERIAL.find((t) => normalizar(t.nombre).includes(normalizar(valor)));
        if (!tipo) { agregar("bot", `<p>Elige una de las opciones de material:</p>` + chips(TIPOS_MATERIAL.map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre })))); return; }
        d.tipo = tipo; preguntar("nivel"); return;
      }
      case "nivel": d.nivel = valor; preguntar("asignatura"); return;
      case "asignatura": d.asignatura = valor; preguntar(p && p.comuna ? "perfil" : "comuna"); return;
      case "perfil":
        if (valor === "si") { d.comuna = p.comuna; d.entorno = p.entorno; preguntar("referencias"); }
        else preguntar("comuna");
        return;
      case "comuna":
        if (valor === "Otra comuna") { preguntar("otraComuna"); wizard.n--; return; }
        d.comuna = omitido ? "" : valor; preguntar("entorno"); return;
      case "otraComuna": d.comuna = valor; wizard.paso = "comuna"; preguntar("entorno"); return;
      case "entorno": {
        d.entorno = valor;
        const anterior = p || {};
        // Pregunta por el establecimiento solo al crear el perfil
        if (wizard.soloPerfil || !anterior.comuna || anterior.comuna !== d.comuna) { preguntar("establecimiento"); return; }
        guardarPerfil({ comuna: d.comuna, entorno: d.entorno, establecimiento: anterior.establecimiento || "" });
        preguntar("referencias"); return;
      }
      case "establecimiento":
        guardarPerfil({ comuna: d.comuna, entorno: d.entorno, establecimiento: omitido ? "" : valor });
        if (wizard.soloPerfil) {
          wizard = null;
          agregar("bot", `<p>✅ Listo, guardé tu perfil: <strong>${escapar(resumenPerfil(leerPerfil()) || "sin datos")}</strong>. Lo usaré para adaptar los prompts. Puedes cambiarlo cuando quieras desde el menú <em>Mi comuna y establecimiento</em>.</p>` +
            chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear prompt para material", primario: true }]));
          return;
        }
        preguntar("referencias"); return;
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
    const t = d.tipo;
    const pegar = /diversificar|texto/.test(t.id);
    const lugar = d.comuna
      ? `establecimiento de educación pública de la comuna de ${d.comuna} (Región del Biobío, Chile)`
      : "establecimiento de educación pública de la Región del Biobío, Chile";
    const ctx = [
      `estudiantes de ${d.nivel}`,
      `asignatura y tema: ${d.asignatura}`,
      lugar + (d.entorno ? `, entorno ${d.entorno.toLowerCase()}` : ""),
      d.contexto ? `características del grupo: ${d.contexto}` : ""
    ].filter(Boolean).join("; ");
    const local = d.referencias
      ? `Cuando sea pertinente, usa situaciones y ejemplos con referencias reconocibles para estos estudiantes: ${d.referencias}.`
      : "Cuando sea pertinente, usa situaciones reconocibles para estudiantes del entorno del establecimiento.";
    const recursos = d.recursos
      ? `\n\nRECURSOS DISPONIBLES: ${d.recursos}. Diseña actividades que todo el curso pueda realizar con esos recursos.`
      : "";
    const prompt =
`Actúa como ${t.rol}.

TAREA: ${t.tarea}.

CONTEXTO: ${ctx}. ${local} El contexto local debe ayudar a comprender, no ser requisito para resolver.${recursos}

FORMATO: ${t.formato}.

RESTRICCIONES: lenguaje claro y adecuado al nivel; terminología del sistema escolar chileno. No inventes objetivos de aprendizaje ni cites las Bases Curriculares o normativa: yo verificaré la alineación curricular. No reproduzcas estereotipos sobre lo urbano o lo rural. Si te falta información, márcala como [PENDIENTE] en lugar de inventarla.

CRITERIO DE CALIDAD: todo lo que pidas a los estudiantes debe producir evidencia observable del aprendizaje, y el material debe ser accesible para todo el curso.

Al final, indica qué partes debo verificar y qué información te faltó para responder mejor.${pegar ? "\n\nMATERIAL ORIGINAL:\n[pega aquí el material, sin datos personales]" : ""}`;

    agregar("bot",
      `<h3>✅ Tu prompt está listo</h3>
       <p>Cópialo y pégalo en la herramienta de IA autorizada en tu establecimiento:</p>
       ${markdown("```\n" + prompt + "\n```")}
       <h4>Después de la primera respuesta, itera:</h4>
       <ul>
         <li>"Hazlo más breve" · "Agrega ejemplos concretos"</li>
         <li>"Explícalo de manera más simple" · "Reorganízalo en una tabla"</li>
       </ul>
       <div class="nota">📌 Antes de usarlo: verifica la alineación curricular, revisa sesgos y declara el uso de IA: <em>"Material elaborado con apoyo de herramientas de inteligencia artificial y adaptado por el equipo docente de la asignatura."</em></div>
       <div class="pie-msg">${etiquetaFuente({ fuente: "M4" })}</div>` +
      chips([
        { accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Crear otro prompt", primario: true },
        { valor: "Frases para ajustar la respuesta de la IA" },
        { valor: "Cómo declarar el uso de IA" }
      ]),
      { texto: prompt });
  }

  /* ================================================================
     7. FLUJO PRINCIPAL DE CONSULTA
     ================================================================ */
  const RE_SALUDO = /^(hola|buen[oa]s?( dias| tardes| noches)?|hey|saludos|que tal)[\s!.?]*$/;
  const RE_WIZARD = /(crear|armar|hacer|generar|construir|redactar|escribir)( un| mi)? prompt|asistente de prompt|ayudame a (crear|disenar|hacer) (un |una )?(material|guia|rubrica|prueba|clase)|disenar (un |una )?material|^crear prompt$/;
  const RE_PERFIL = /^(mi )?(perfil|comuna|mi comuna|mi establecimiento|cambiar (mi )?(comuna|perfil|establecimiento))[\s!.?]*$/;
  const RE_GRACIAS =/^(gracias|muchas gracias|ok|vale|perfecto|genial)[\s!.]*$/;

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
    if (RE_SALUDO.test(n)) {
      agregar("bot", `<p>¡Hola! 👋 Soy el asistente de IA del <strong>SLEP Andalién Sur</strong>. Puedo resolver dudas sobre uso ético de la IA, protección de datos, herramientas y prompts, o ayudarte a <strong>crear un prompt</strong> para diseñar material.</p>` +
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
     8. INTERFAZ: temas, sugerencias, modo, persistencia, eventos
     ================================================================ */
  function construirTemas() {
    const orden = ["M1", "M2", "LEY", "M3", "M4", "M5", "EXT"];
    const grupos = {};
    CONOCIMIENTO.forEach((f) => { const k = f.fuente === "MINEDUC" ? "M1" : f.fuente; (grupos[k] = grupos[k] || []).push(f); });
    el.temas.innerHTML = orden.filter((k) => grupos[k]).map((k, i) =>
      `<details ${i === 0 ? "open" : ""}><summary><span class="dot" style="background:${COLORES[k]}"></span>${escapar(FUENTES[k].replace(" · ", " — "))}</summary>
        ${grupos[k].map((f) => `<button class="tema" type="button" style="--c:${COLORES[k]}" data-id="${f.id}">${escapar(f.titulo)}</button>`).join("")}
      </details>`).join("");
  }

  const SUGERENCIAS = [
    { emoji: "✏️", color: "#f8b400", titulo: "Crear un prompt para material", texto: "Guías, rúbricas, pruebas o clases paso a paso", accion: "wizard-iniciar" },
    { emoji: "🔒", color: "#ff3c4c", titulo: "¿Puedo ingresar datos de estudiantes?", texto: "Lo que dice la Ley 21.719 y el Manual 2" },
    { emoji: "⚖️", color: "#0071ea", titulo: "¿Qué se puede delegar en la IA?", texto: "Tareas permitidas y zona prohibida" },
    { emoji: "🧰", color: "#90d039", titulo: "¿Qué herramientas de IA puedo usar?", texto: "Seis familias y cómo evaluarlas" },
    { emoji: "🎯", color: "#3abff0", titulo: "Estructura de un prompt profesional", texto: "Rol, tarea, contexto, formato…" },
    { emoji: "🛡️", color: "#ff98a4", titulo: "¿Cómo anonimizar una consulta?", texto: "Ejemplo correcto e incorrecto" },
    { emoji: "🎓", color: "#e0559b", titulo: "Cursos de IA del CPEIP", texto: "Formación oficial para docentes y directivos" },
    { emoji: "📚", color: "#22a9dc", titulo: "Leer los manuales", texto: "Biblioteca digital de la serie completa", accion: "ir", valor: "manuales.html" }
  ];
  function construirSugerencias() {
    el.sugerencias.innerHTML = SUGERENCIAS.map((s) =>
      `<button class="sug" type="button" style="--c:${s.color}" data-accion="${s.accion || "preguntar"}" data-valor="${escapar(s.valor || s.titulo)}">
         <span class="emoji" aria-hidden="true">${s.emoji}</span><span><strong>${escapar(s.titulo)}</strong><span>${escapar(s.texto)}</span></span>
       </button>`).join("");
  }

  function mostrarPerfil() {
    const p = leerPerfil();
    const caja = $("#perfil"), saludo = $("#saludo");
    if (p && p.comuna) {
      caja.innerHTML = `<span class="perfil-ico">📍</span><span><strong>${escapar(p.establecimiento || "Mi establecimiento")}</strong><small>${escapar([p.comuna, p.entorno].filter(Boolean).join(" · "))} · Cambiar</small></span>`;
      if (saludo) saludo.textContent = p.establecimiento ? `¡Hola, equipo de ${p.establecimiento}!` : `¡Hola, ${p.comuna}! ¿En qué te ayudo?`;
    } else {
      caja.innerHTML = `<span class="perfil-ico">📍</span><span><strong>Mi comuna y establecimiento</strong><small>Personaliza los ejemplos de tus prompts</small></span>`;
      if (saludo) saludo.textContent = "¡Hola! ¿En qué te ayudo hoy?";
    }
  }

  function construirModo() {
    el.modo.className = "modo" + (MODO_IA ? " ia" : "");
    el.modo.innerHTML = MODO_IA
      ? `<span class="luz"></span><div><strong>Modo IA conectado</strong>Respuestas generadas con IA a partir de los manuales.</div>`
      : `<span class="luz"></span><div><strong>Modo guías</strong>Responde con los manuales del Servicio. Tus consultas no salen de este navegador.</div>`;
  }

  function persistir() {
    try { localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(-60))); } catch (e) { /* sin almacenamiento */ }
  }
  function restaurar() {
    try {
      const h = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) || "[]");
      if (Array.isArray(h) && h.length) { historial = h; h.forEach((m) => agregar(m.rol, m.html, { guardar: false })); }
    } catch (e) { historial = []; }
  }
  function nuevaConversacion() {
    historial = []; wizard = null; persistir();
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
    else if (accion === "perfil-iniciar") { cerrarMenu(); agregarUsuario("Mi comuna y establecimiento"); iniciarWizard(true); }
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

  // Inicio
  temaInicial();
  construirTemas();
  construirSugerencias();
  construirModo();
  mostrarPerfil();
  restaurar();
  if (new URLSearchParams(location.search).get("accion") === "prompt") {   // atajo de la app instalada
    agregarUsuario("Crear prompt para material"); iniciarWizard();
  }
  el.entrada.focus();
})();
