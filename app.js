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

  /* Búsqueda tolerante a errores de escritura:
     - por palabra: distancia de edición (letras cambiadas, faltantes o sobrantes)
     - por nombre completo: parecido de pares de letras (sirve si se juntan o separan palabras)
     Devuelve [{ e, puntaje }] de 0 a 1; sobre 0,97 se considera coincidencia exacta. */
  function distancia(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    // Distancia con transposiciones: "jhon" → "john" cuenta como un solo error
    let ante = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (ante && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], ante[j - 2] + 1);
      }
      ante = prev; prev = cur;
    }
    return prev[n];
  }
  function simPalabra(a, b) {
    if (a === b) return 1;
    if (/^\d+$/.test(a) || /^\d+$/.test(b)) return 0;          // los números (D-123, A-45) deben coincidir exacto
    let s = 1 - distancia(a, b) / Math.max(a.length, b.length);
    if (a.length >= 3 && b.startsWith(a)) s = Math.max(s, 0.85);  // abreviaturas: "balm" → "balmaceda"
    return s;
  }
  function pares(t) { const s = t.replace(/ /g, ""); const r = []; for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i + 2)); return r; }
  function parecido(a, b) {
    const A = pares(a), B = pares(b);
    if (!A.length || !B.length) return 0;
    const m = new Map(); B.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
    let c = 0; A.forEach((x) => { const k = m.get(x); if (k) { c++; m.set(x, k - 1); } });
    return (2 * c) / (A.length + B.length);
  }
  function puntajeEstablecimiento(texto, e) {
    const q = palabrasNombre(texto);
    if (!q.length) return 0;
    let mejor = 0;
    [e.nombre].concat(String(e.alias || "").split(",")).filter((v) => v.trim()).forEach((v) => {
      const n = palabrasNombre(v);
      if (!n.length) return;
      const porPalabra = q.reduce((s, w) => s + Math.max(...n.map((x) => simPalabra(w, x))), 0) / q.length;
      const cobertura = n.reduce((s, x) => s + Math.max(...q.map((w) => simPalabra(w, x))), 0) / n.length;
      mejor = Math.max(mejor, 0.75 * porPalabra + 0.25 * cobertura, parecido(q.join(" "), n.join(" ")));
    });
    return mejor;
  }
  /* Detecta si una consulta del chat menciona un establecimiento registrado,
     aunque esté mal escrito. Devuelve [{ e, puntaje }] o []. */
  const PALABRAS_INSTITUCION = ["escuela", "colegio", "liceo", "jardin", "complejo", "instituto", "establecimiento", "cole", "sala"];
  function detectarMencion(texto) {
    const todas = normalizar(texto).split(" ").filter((w) => w.length > 1);
    const q = palabrasNombre(texto);
    if (!q.length) return [];
    const nombraInstitucion = todas.some((w) => PALABRAS_INSTITUCION.some((p) => simPalabra(w, p) >= 0.75));
    const esInstitucion = (w) => w === "basica" || w === "basico" || PALABRAS_INSTITUCION.some((p) => simPalabra(w, p) >= 0.75);
    return ESTABLECIMIENTOS.map((e) => {
      let mejor = 0;
      [e.nombre].concat(String(e.alias || "").split(",")).filter((v) => v.trim()).forEach((v) => {
        const n = palabrasNombre(v);
        if (!n.length) return;
        if (!nombraInstitucion && n.length < 2) return;
        const sims = n.map((x) => Math.max(...q.map((w) => simPalabra(w, x))));
        if (sims.every((s) => s === 1) && (n.length >= 2 || nombraInstitucion)) {
          // Nombre de una sola palabra (ej. "Escuela Básica Florida"): debe ir justo después de escuela/colegio/liceo
          if (n.length === 1) {
            const j = todas.findIndex((w) => simPalabra(w, n[0]) === 1);
            if (!(j > 0 && (esInstitucion(todas[j - 1]) || (j > 1 && esInstitucion(todas[j - 2]))))) return;
          }
          mejor = 1; return;
        }
        const distintivas = n.map((x, i) => (x.length >= 4 ? sims[i] : 0));
        const mejorPalabra = Math.max(...distintivas);
        const cobertura = sims.reduce((s, x) => s + x, 0) / n.length;
        if (n.length === 1) return;                         // una sola palabra solo cuenta si coincide exacta (arriba)
        if (mejorPalabra >= 0.7 && (cobertura >= 0.6 || mejorPalabra >= 0.85)) mejor = Math.max(mejor, 0.5 * cobertura + 0.5 * mejorPalabra);
      });
      return { e, puntaje: mejor };
    }).filter((r) => r.puntaje >= 0.6).sort((a, b) => b.puntaje - a.puntaje).slice(0, 3);
  }

  function buscarEstablecimiento(texto, comuna) {
    return ESTABLECIMIENTOS
      .map((e) => ({ e, puntaje: puntajeEstablecimiento(texto, e) + (comuna && normalizar(e.comuna) === normalizar(comuna) ? 0.04 : 0) }))
      .filter((r) => r.puntaje >= 0.62)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 4);
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
  const COLORES = { PAL: "#f0a500", M1: "#0071ea", M2: "#ff3c4c", LEY: "#9b59d0", M3: "#4fa61a", M4: "#f0a500", M5: "#22a9dc", MINEDUC: "#0071ea", EXT: "#e0559b", DOC: "#0b8f6a", DIR: "#5b4bd1", ASI: "#d9622b", SLEP: "#0071ea" };

  function ocultarBienvenida() { el.bienvenida.hidden = true; }

  /* Las respuestas del asistente se muestran DESDE SU INICIO (la persona baja
     leyendo); los mensajes propios y el indicador de escritura van al final. */
  function agregar(rol, html, { texto = "", guardar = true, alFinal = false } = {}) {
    if (!enInicio) ocultarBienvenida();   // durante las preguntas iniciales se mantiene la portada arriba
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
    // Consulta breve que calza con varios temas parecidos: preguntar en vez de suponer
    if (res.length >= 2 && res[0].puntaje >= 2.2 && tokens(consulta).length <= 3 && res[1].puntaje >= res[0].puntaje * 0.8) {
      return `<p>Tu consulta puede referirse a varios temas. Para no suponer, ¿cuál de estos buscas?</p>` +
        chips(res.filter((r) => r.puntaje >= res[0].puntaje * 0.6).slice(0, 4).map((r, i) => ({ valor: r.ficha.titulo, primario: i === 0 }))) +
        `<p class="ayuda-chat">También puedes escribir tu pregunta con más detalle.</p>`;
    }
    if (!res.length || res[0].puntaje < 2.2) {
      return `<p>No encontré esto en los manuales del Servicio. 🤔 Prueba reformulando con otras palabras o elige un tema:</p>` +
        chips([
          { valor: "¿Puedo ingresar datos de estudiantes a la IA?" },
          { valor: "¿Qué se puede delegar en la IA y qué no?" },
          { valor: "Estructura de un prompt profesional" },
          { valor: "crear prompt", etiqueta: "✏️ Diseñar un material paso a paso", primario: true }
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
    if (p.alcance) partes.push(`Quiere trabajar con: ${p.alcance.toLowerCase()}.`);
    if (est && est.caracteristicas) partes.push(`Características del establecimiento (sin identificarlo): ${est.caracteristicas}`);
    return partes.length ? `\n\n### Contexto de quien consulta\n${partes.join(" ")} Adapta tus sugerencias a este rol y contexto, sin estereotipos.` : "";
  }

  const REGLA_SIN_PROMPTS = "Responde TÚ directamente con el contenido, la orientación o el material solicitado. " +
    "NO entregues prompts, plantillas de prompt ni instrucciones para usar en otra herramienta de IA, salvo que la persona lo pida explícitamente " +
    "(por ejemplo, si escribe la palabra «prompt»).";
  const INSTRUCCION_ACLARAR = "\n\n### Cómo responder\n" + REGLA_SIN_PROMPTS + " Si la consulta es ambigua o le falta información clave para responder bien " +
    "(por ejemplo nivel, asignatura, propósito, destinatarios o a qué establecimiento o tema se refiere), NO supongas ni inventes: " +
    "responde solo con 1 a 3 preguntas breves de aclaración, ofreciendo opciones concretas basadas en el contexto y en el rol de quien consulta. " +
    "Si la consulta es clara, responde directamente.";
  const INSTRUCCION_MATERIAL = "\n\n### Cómo responder\nLa persona ya entregó todos los datos necesarios. Elabora DIRECTAMENTE el material completo, " +
    "listo para usar, siguiendo la especificación. NO escribas un prompt ni expliques cómo pedírselo a otra IA. " +
    "Al final agrega una breve sección «Para revisar antes de usar» (2 a 4 puntos: alineación curricular, pertinencia, sesgos) y la declaración de uso de IA.";

  /* Elabora un material con la IA a partir de la especificación armada paso a paso */
  async function generarMaterialIA(especificacion) {
    const r = await fetch(CONFIG.API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "consultar", pregunta: especificacion, historial: [], contexto: contextoPerfil() + INSTRUCCION_MATERIAL })
    });
    const datos = await r.json();
    if (!datos.ok) throw new Error(datos.error || "Respuesta no válida");
    return datos.respuesta;
  }

  async function respuestaIA(consulta, estMencionado) {
    const contexto = buscar(consulta, 4).map((r) => `### ${r.ficha.titulo} (${FUENTES[r.ficha.fuente] || r.ficha.fuente})\n${r.ficha.texto}`).join("\n\n") + contextoPerfil() +
      (estMencionado ? `\n\n### Establecimiento mencionado en la consulta\n${estMencionado.nombre}` + (estMencionado.comuna ? ` (${estMencionado.comuna}` + (estMencionado.entorno ? `, ${estMencionado.entorno.toLowerCase()}` : "") + ")" : "") +
        (estMencionado.niveles ? `. Niveles: ${estMencionado.niveles}` : "") + (estMencionado.caracteristicas ? `. Características según el PAL: ${estMencionado.caracteristicas}` : "") : "") +
      INSTRUCCION_ACLARAR;
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
  /* El perfil dura SOLO la conversación actual: se pregunta al inicio y se
     borra al cerrar la app o al iniciar una conversación nueva. */
  let perfilSesion = null;
  try { localStorage.removeItem(CLAVE_PERFIL); } catch (e) { /* versiones anteriores lo guardaban */ }
  function leerPerfil() { return perfilSesion; }
  function guardarPerfil(cambios) {
    perfilSesion = Object.assign({}, perfilSesion || {}, cambios);
    mostrarPerfil(); construirSugerencias();
    return perfilSesion;
  }
  function resumenPerfil(p) {
    return [p.rol && ROLES[p.rol] ? ROLES[p.rol].corto : "", p.establecimiento, p.comuna, p.alcance].filter(Boolean).join(" · ");
  }

  /* Con quién quiere trabajar, según el rol */
  const ALCANCES = {
    docente: ["Un curso o asignatura", "Un nivel o ciclo", "Todo el establecimiento"],
    directivo: ["Todo el establecimiento", "Un nivel o ciclo", "Equipo docente o directivo"],
    asistente: ["Todo el establecimiento", "Un nivel o ciclo", "Un grupo de estudiantes o familias"]
  };
  const trabajaTodoEst = (p) => !!(p && /todo el establecimiento/i.test(p.alcance || ""));

  const chipsRoles = () => chips(Object.keys(ROLES).map((k) => ({ accion: "wizard", valor: k, etiqueta: `${ROLES[k].emoji} ${ROLES[k].nombre}` })));
  const chipsComunas = () => chips(Object.keys(COMUNAS).map((c) => ({ accion: "wizard", valor: c }))
    .concat([{ accion: "wizard", valor: "Otra comuna" }, { accion: "wizard", valor: "-", etiqueta: "Prefiero no indicar" }]));
  const tiposDelRol = (rol) => TIPOS_MATERIAL.filter((t) => !rol || t.roles.includes(rol));

  /* ================================================================
     8. ASISTENTE DE PROMPTS Y PERFIL (flujo conversacional)
     ================================================================ */
  /* prefill: { tipo, tema } cuando la persona ya pidió un material en el chat */
  let enInicio = false;   // true mientras se hacen las preguntas iniciales de la conversación

  /* Preguntas iniciales: rol, establecimiento y con quién quiere trabajar */
  function iniciarConversacion() {
    perfilSesion = null; mostrarPerfil(); construirSugerencias();
    enInicio = true; el.sugerencias.hidden = true;
    wizard = { datos: {}, soloPerfil: true, inicio: true, n: 0 };
    agregar("bot", `<h3>👋 ¡Hola! Soy el asistente de IA del SLEP Andalién Sur</h3>
      <p>Antes de comenzar, cuéntame un poco de ti para responderte de forma pertinente. Solo lo usaré durante esta conversación.</p>`);
    preguntar("rol");
  }

  /* prefill: { tipo, tema } cuando la persona ya pidió un material en el chat */
  function iniciarWizard(soloPerfil, prefill) {
    const p = leerPerfil() || {};
    wizard = { datos: {}, soloPerfil: !!soloPerfil, n: 0, prefill: prefill || null };
    if (soloPerfil) {
      agregar("bot", `<h3>📍 Actualicemos tus datos</h3><p>Solo se usan durante esta conversación.</p>`);
      preguntar("rol");
      return;
    }
    if (prefill) {
      if (prefill.tema) wizard.datos.tema = prefill.tema;
      agregar("bot", `<h3>✏️ Diseñemos tu material</h3>
        <p>Quieres ${prefill.tipo ? "<strong>" + escapar(prefill.tipo.nombre.toLowerCase()) + "</strong>" : "un material"}${prefill.tema ? " sobre «" + escapar(prefill.tema) + "»" : ""}. Te haré solo las preguntas que faltan y luego <strong>lo elaboro</strong>.</p>` +
        chips([{ accion: "wizard-cancelar", valor: "x", etiqueta: "Cancelar" }]));
      if (!p.rol) { preguntar("rol"); return; }
      if (prefill.tipo) { aplicarTipo(prefill.tipo); return; }
      preguntar("tipo");
      return;
    }
    agregar("bot",
      `<h3>✏️ Diseñemos tu material</h3>
       <p>Te haré algunas preguntas breves y luego <strong>elaboro el material</strong>, alineado con los referentes oficiales de tu rol.</p>` +
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
      case "estInicio":
        agregar("bot", titulo("¿En qué establecimiento trabajas?") +
          `<p>Escribe su nombre (no importa si no recuerdas el nombre exacto) o elige la comuna para ver la lista.</p>` +
          chipsComunas() +
          chips([{ accion: "wizard", valor: "slep", etiqueta: "Trabajo en el SLEP (nivel central)" }]));
        break;
      case "alcance": {
        const rol = p.rol || "docente";
        agregar("bot", titulo("¿Con quién quieres trabajar?") +
          `<p>Puedes cambiarlo cuando quieras. Por ejemplo, un material para <strong>todo el establecimiento</strong> o solo para un nivel.</p>` +
          chips((ALCANCES[rol] || ALCANCES.docente).map((x, i) => ({ accion: "wizard", valor: x, primario: i === 0 }))));
        break;
      }
      case "tipo": {
        const rol = d.rol || p.rol;
        agregar("bot", titulo("¿Qué material quieres crear?") +
          (ROLES[rol] ? `<p>Opciones para <strong>${escapar(ROLES[rol].nombre)}</strong>.</p>` : "") +
          chips(tiposDelRol(rol).map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre }))));
        break;
      }
      case "nivel": {
        const todo = { accion: "wizard", valor: "Todo el establecimiento", etiqueta: "🏫 Todo el establecimiento", primario: trabajaTodoEst(p) };
        agregar("bot", titulo("¿Para qué nivel?") + `<p>Los niveles siguen las <strong>Bases Curriculares</strong> vigentes. También puedes escribir el curso (ej.: "6° básico").</p>` +
          chips((trabajaTodoEst(p) ? [todo] : []).concat(NIVELES.map((x) => ({ accion: "wizard", valor: x.nombre }))).concat(trabajaTodoEst(p) ? [] : [todo])));
        break;
      }
      case "asignatura": {
        const lista = d.nivel === "Todo el establecimiento"
          ? ["Transversal (varias asignaturas)", "Lectura y escritura", "Matemática", "Ciencias", "Historia y formación ciudadana", "Orientación y convivencia", "Artes y cultura"]
          : (ASIGNATURAS[d.nivel] || []);
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
        agregar("bot", titulo("¿Para quién es?") + chips((trabajaTodoEst(p) ? ["Toda la comunidad educativa"] : []).concat(DESTINATARIOS).concat(trabajaTodoEst(p) ? [] : ["Toda la comunidad educativa"])
          .map((x, i) => ({ accion: "wizard", valor: x, primario: i === 0 && trabajaTodoEst(p) }))));
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
        const op = wizard.opciones, exacto = wizard.exacto;
        agregar("bot", (exacto
            ? `<p>¿Te refieres a <strong>${escapar(op[0].nombre)}</strong>${op[0].comuna ? " (" + escapar(op[0].comuna) + ")" : ""}?</p>`
            : `<p>No encontré exactamente «${escapar(wizard.buscado)}». ${op.length === 1 ? "¿Quisiste decir este establecimiento?" : "¿Quisiste decir alguno de estos?"}</p>`) +
          chips(op.map((e, i) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: `${e.nombre}${e.comuna ? " (" + e.comuna + ")" : ""}`, primario: i === 0 })), exacto ? "" : "Nombres registrados:") +
          chips([{ accion: "wizard", valor: "reintentar", etiqueta: "Ninguno: escribir de nuevo" }, { accion: "wizard", valor: "lista", etiqueta: "Ver la lista completa" }]));
        break;
      }
      case "noEncontrado":
        agregar("bot", `<p>No encontré «${escapar(wizard.buscado)}» entre los ${ESTABLECIMIENTOS.length} establecimientos registrados${d.comuna ? " (busqué en todas las comunas)" : ""}. Para no suponer, ¿qué prefieres?</p>` +
          chips([
            { accion: "wizard", valor: "reintentar", etiqueta: "Escribirlo de nuevo", primario: true },
            { accion: "wizard", valor: "lista", etiqueta: "Ver la lista" },
            { accion: "wizard", valor: "usar", etiqueta: `Usar «${wizard.buscado}» igual` },
            { accion: "wizard", valor: "-", etiqueta: "Omitir" }
          ]));
        break;
      case "listaEst": {
        const deComuna = ESTABLECIMIENTOS.filter((e) => !d.comuna || normalizar(e.comuna) === normalizar(d.comuna));
        const lista = (deComuna.length ? deComuna : ESTABLECIMIENTOS).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        agregar("bot", `<p>Establecimientos registrados${deComuna.length && d.comuna ? " en <strong>" + escapar(d.comuna) + "</strong>" : ""} (${lista.length}). Elige el tuyo:</p>` +
          chips(lista.map((e) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: e.nombre + (d.comuna ? "" : " (" + e.comuna + ")") }))) +
          chips([{ accion: "wizard", valor: "-", etiqueta: "No está en la lista / omitir" }]));
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

  /* Fija el tipo de material y pregunta solo lo que falta */
  function aplicarTipo(tipo) {
    const d = wizard.datos;
    d.tipo = tipo;
    if (tipo.curricular) { preguntar("nivel"); return; }
    if (d.tema && !d.proposito) d.proposito = d.tema;
    preguntar(d.proposito ? "destinatarios" : "proposito");
  }

  /* Después de definir el material, pasa a la parte de ubicación/perfil */
  /* Usa automáticamente los datos dados al inicio; solo pregunta si faltan */
  function pasoUbicacion() {
    const p = leerPerfil() || {}, d = wizard.datos;
    if (p.comuna || p.estId || p.establecimiento) {
      d.comuna = p.comuna; d.entorno = p.entorno; d.estId = p.estId;
      trasUbicacion(); return;
    }
    preguntar("comuna");
  }
  function trasUbicacion() {
    if (wizard.soloPerfil) { preguntar("alcance"); return; }
    preguntar(wizard.datos.tipo.curricular ? "referencias" : "contexto");
  }
  function terminarPerfil() {
    const p = leerPerfil() || {};
    const fueInicio = wizard && wizard.inicio;
    wizard = null; enInicio = false; el.sugerencias.hidden = false;
    const sug = (SUG_ROL[p.rol] || []).map((s) => ({ valor: s.titulo }));
    agregar("bot", `<p>✅ Perfecto: <strong>${escapar(resumenPerfil(p) || "sin datos")}</strong>.</p>
      <p><strong>¿En qué te ayudo?</strong> Escríbeme tu consulta con tus palabras, o elige una opción:</p>` +
      chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Diseñar un material", primario: true }]
        .concat(p.estId ? [{ valor: "Mi establecimiento", etiqueta: "🏫 Ver datos de mi establecimiento" }] : [])
        .concat(sug)));
    if (fueInicio) el.entrada.focus();
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
        if (wizard.soloPerfil) { preguntar("estInicio"); return; }
        const pre = wizard.prefill && wizard.prefill.tipo;
        if (pre && pre.roles.includes(rol)) aplicarTipo(pre); else preguntar("tipo");
        return;
      }
      case "tipo": {
        const lista = tiposDelRol(d.rol || p.rol);
        const tipo = lista.find((t) => t.id === valor) || lista.find((t) => normalizar(t.nombre).includes(normalizar(valor)));
        if (!tipo) { agregar("bot", `<p>Elige una de las opciones de material:</p>` + chips(lista.map((t) => ({ accion: "wizard", valor: t.id, etiqueta: t.nombre })))); return; }
        aplicarTipo(tipo);
        return;
      }
      case "nivel":
        d.nivel = valor; d.nivelObj = NIVELES.find((x) => x.nombre === valor) || null;
        preguntar("asignatura"); return;
      case "asignatura": d.asignatura = valor; preguntar(d.tema ? "oa" : "tema"); return;
      case "tema": d.tema = valor; preguntar("oa"); return;
      case "oa": d.oa = omitido ? "" : valor; pasoUbicacion(); return;
      case "proposito": d.proposito = valor; preguntar("destinatarios"); return;
      case "destinatarios": d.destinatarios = valor; pasoUbicacion(); return;
      case "estInicio":
        if (COMUNAS[valor]) { d.comuna = valor; guardarPerfil({ comuna: valor }); wizard.n--; preguntar("listaEst"); return; }
        if (valor === "Otra comuna") { wizard.n--; preguntar("otraComuna"); return; }
        if (omitido) { preguntar("alcance"); return; }
        if (valor === "slep") { guardarPerfil({ establecimiento: "SLEP Andalién Sur (nivel central)", estId: "" }); preguntar("alcance"); return; }
        wizard.paso = "establecimiento"; avanzarWizard(valor);   // escribió un nombre: búsqueda tolerante a errores
        return;
      case "alcance":
        guardarPerfil({ alcance: valor });
        terminarPerfil();
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
      case "confirmarEst":
      case "noEncontrado":
      case "listaEst": {
        if (valor.startsWith("id:")) { const est = ESTABLECIMIENTOS.find((e) => e.id === valor.slice(3)); if (est) { elegirEstablecimiento(est); return; } }
        if (omitido) { guardarPerfil({ establecimiento: "", estId: "" }); preguntar(wizard.soloPerfil ? "alcance" : "entorno"); return; }
        if (valor === "reintentar") { wizard.paso = "establecimiento"; agregar("bot", `<p>Escribe el nombre de tu establecimiento (no importa si no recuerdas el nombre exacto).</p>`); return; }
        if (valor === "lista") { wizard.n--; preguntar("listaEst"); return; }
        if (valor === "usar") { guardarPerfil({ establecimiento: wizard.buscado, estId: "" }); d.establecimiento = wizard.buscado; preguntar("entorno"); return; }
        // Texto escrito: buscar con tolerancia a errores en TODAS las comunas (prioriza la elegida)
        if (!ESTABLECIMIENTOS.length) { guardarPerfil({ establecimiento: valor, estId: "" }); d.establecimiento = valor; preguntar("entorno"); return; }
        const res = buscarEstablecimiento(valor, d.comuna);
        wizard.buscado = valor; wizard.n--;
        if (res.length) {
          wizard.opciones = res.map((r) => r.e);
          wizard.exacto = res[0].puntaje >= 0.97 && (res.length === 1 || res[1].puntaje < 0.9);
          if (wizard.exacto) wizard.opciones = [res[0].e];
          preguntar("confirmarEst");
        } else preguntar("noEncontrado");
        return;
      }
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
        wizard = null;
        entregarMaterial(d);
        return;
    }
  }

  async function entregarMaterial(d) {
    const t = d.tipo, p = leerPerfil() || {};
    const todoEst = d.nivel === "Todo el establecimiento";
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
      if (todoEst) formato += "; con una propuesta común y adaptaciones breves por ciclo o nivel";
      contexto = [
        todoEst ? `todo el establecimiento (todos sus niveles${est && est.niveles ? ": " + est.niveles : ""})` : `${parv ? "niños y niñas de" : "estudiantes de"} ${d.nivel}`,
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
        : todoEst
          ? `Bases Curriculares de los niveles que imparte el establecimiento, Marco para la Buena Enseñanza 2021 (estándares ${t.estandares || "3 y 7"}) y los sellos del SLEP Andalién Sur (formación integral, identidad territorial, multiculturalidad, creatividad e innovación).`
          : `${d.nivelObj ? d.nivelObj.bases : "Bases Curriculares vigentes del nivel"} y Marco para la Buena Enseñanza 2021, estándares ${t.estandares || "3 y 7"}.`;
      restricciones = "lenguaje claro y adecuado al nivel; terminología del sistema escolar chileno. " +
        (d.oa ? "Trabaja exclusivamente sobre el OA indicado; no inventes otros objetivos ni cites normativa." : "No inventes objetivos de aprendizaje ni cites las Bases Curriculares o normativa: yo verificaré la alineación curricular en curriculumnacional.cl.") +
        " No reproduzcas estereotipos sobre lo urbano o lo rural. Si te falta información, márcala como [PENDIENTE] en lugar de inventarla.";
      criterio = "todo lo que se pida debe producir evidencia observable del aprendizaje, y el material debe ser accesible para todo el grupo.";
      declaracion = "Material elaborado con apoyo de herramientas de inteligencia artificial y adaptado por el equipo docente de la asignatura.";
    } else {
      contexto = [`tema o propósito: ${d.proposito}`, `destinatarios: ${d.destinatarios}`, lugar, p.alcance ? `alcance: ${p.alcance.toLowerCase()}` : "", d.contexto ? `consideraciones: ${d.contexto}` : ""]
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

    const fuentes = `<div class="pie-msg">${etiquetaFuente({ fuente: t.curricular ? "DOC" : (p.rol === "asistente" ? "ASI" : "DIR") })}</div>`;
    const verPrompt = `<details class="ver-prompt"><summary>Ver la especificación usada (por si quieres usarla en otra herramienta)</summary>${markdown("```\n" + prompt + "\n```")}</details>`;
    const siguientes = chips([
      { valor: "Hazlo más breve" }, { valor: "Agrega ejemplos concretos" }, { valor: "Adáptalo para estudiantes con más apoyo" },
      { accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Diseñar otro material" }
    ], "¿Quieres ajustarlo?");

    // Sin IA conectada (modo guías) solo se puede entregar la especificación para usarla en otra herramienta
    if (!MODO_IA || t.pegar) {
      agregar("bot", `<h3>📝 Tu material, listo para generar</h3>
        <p>${t.pegar ? "Este material necesita que pegues tu texto original, así que te dejo la especificación lista: cópiala, agrega tu material al final y úsala en la herramienta de IA autorizada." : "El asistente está en modo guías (sin IA conectada). Copia esta especificación en la herramienta de IA autorizada en tu establecimiento:"}</p>
        ${markdown("```\n" + prompt + "\n```")}
        <div class="nota">📌 Antes de usarlo: ${t.curricular ? "verifica la alineación curricular, " : ""}revisa sesgos y declara el uso de IA: <em>"${escapar(declaracion)}"</em></div>` + fuentes, { texto: prompt });
      return;
    }

    ocupado = true; el.enviar.disabled = true;
    const espera = mostrarEscribiendo();
    try {
      const material = await generarMaterialIA(prompt);
      espera.remove();
      agregar("bot", `<h3>✅ ${escapar(t.nombre)}</h3>${markdown(material)}${verPrompt}
        <div class="nota">📌 Revisa el material antes de usarlo${t.curricular ? " (alineación curricular, pertinencia y sesgos)" : ""} y declara el uso de IA: <em>"${escapar(declaracion)}"</em></div>` + fuentes + siguientes,
        { texto: material });
    } catch (e) {
      espera.remove();
      agregar("bot", `<p>No pude conectar con el servicio de IA para elaborarlo (${escapar(e.message)}). Te dejo la especificación para que la uses en otra herramienta:</p>${markdown("```\n" + prompt + "\n```")}`, { texto: prompt });
    } finally {
      ocupado = false; el.enviar.disabled = false; el.entrada.focus();
    }
  }

  /* Ficha breve de un establecimiento registrado */
  function tarjetaEstablecimiento(est) {
    const datos = [est.comuna, est.entorno, est.niveles].filter(Boolean).join(" · ");
    return `<div class="nota">🏫 <strong>${escapar(est.nombre)}</strong>${datos ? " — " + escapar(datos) : ""}` +
      (est.caracteristicas ? `<br>${escapar(est.caracteristicas)}` : "") + `</div>`;
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
        chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Diseñar material con IA", primario: true }]);
    }
    const enlaces = (est.enlaces || []).map((e) => `- [${e.titulo}](${e.url})`).join("\n");
    return `<h3>🏫 ${escapar(est.nombre)}</h3>` +
      markdown([est.comuna ? `**Comuna:** ${est.comuna}` : "", est.entorno ? `**Entorno:** ${est.entorno}` : "", est.niveles ? `**Niveles:** ${est.niveles}` : "",
        est.caracteristicas ? `\n${est.caracteristicas}` : "", enlaces ? `\n**Enlaces:**\n${enlaces}` : ""].filter(Boolean).join("\n")) +
      `<div class="nota">Fuente: Plan Anual Local del Servicio y registros del equipo. Usaré estas características (sin el nombre) para adaptar tus prompts.</div>` +
      chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Diseñar material con IA", primario: true }]);
  }

  /* ================================================================
     9. FLUJO PRINCIPAL DE CONSULTA
     ================================================================ */
  const RE_SALUDO = /^(hola|buen[oa]s?( dias| tardes| noches)?|hey|saludos|que tal)[\s!.?]*$/;
  const RE_WIZARD = /(crear|armar|hacer|generar|construir|redactar|escribir)( un| mi)? prompt|asistente de prompt|ayudame a (crear|disenar|hacer) (un |una )?(material|guia|rubrica|prueba|clase)|disenar (un |una )?material|^crear prompt$/;
  const RE_PERFIL = /^(mi )?(perfil|rol|mi rol|comuna|mi comuna|cambiar (mi )?(comuna|perfil|establecimiento|rol))[\s!.?]*$/;
  const RE_MIEST = /^(mi (establecimiento|colegio|escuela|liceo|jardin)|caracteristicas de mi (establecimiento|colegio|escuela|liceo))[\s!.?]*$/;
  const RE_GRACIAS = /^(gracias|muchas gracias|ok|vale|perfecto|genial)[\s!.]*$/;
  // Pedidos de material escritos directamente en el chat
  const MATERIAL_CLAVES = [
    [/\bguia/, "guia"], [/\brubrica/, "rubrica"], [/\b(prueba|evaluacion|items|preguntas de alternativa)/, "prueba"],
    [/\b(clase|planificacion|experiencia de aprendizaje)/, "clase"], [/\binfografia/, "infografia"], [/\bcomunicado|circular/, "comunicado"],
    [/\b(taller|actividad de convivencia|recreo)/, "taller"], [/\bpauta de (observacion|acompanamiento)|acompanamiento al aula/, "acompanamiento"],
    [/\b(agenda|jornada|reunion)/, "agenda"], [/\bpme|plan de mejoramiento/, "pme"], [/\bprotocolo/, "protocolo"]
  ];
  const RE_PEDIDO = /\b(hazme|haz|crea|creame|genera|generame|disena|disename|necesito|quiero|elabora|elaborame|prepara|preparame|redacta|redactame|arma|armame)\b/;
  let pendiente = null;   // consulta en espera de una confirmación

  function detectarPedido(n) {
    if (!RE_PEDIDO.test(n)) return null;
    const p = leerPerfil() || {};
    const hallado = MATERIAL_CLAVES.find(([re]) => re.test(n));
    if (!hallado) return null;
    const tipo = TIPOS_MATERIAL.find((t) => t.id === hallado[1] && (!p.rol || t.roles.includes(p.rol))) || null;
    const m = n.match(/\b(?:de|sobre|para trabajar|acerca de)\s+(.{3,80})$/);
    return { tipo, tema: m ? m[1].trim() : "" };
  }

  async function procesar(texto, { omitirRevision = false, directo = false, estMencionado = null, yaMostrado = false } = {}) {
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

    if (!yaMostrado) agregarUsuario(texto);

    if (RE_WIZARD.test(n)) { iniciarWizard(); return; }
    if (RE_PERFIL.test(n)) { iniciarWizard(true); return; }
    if (RE_MIEST.test(n)) { agregar("bot", respuestaMiEstablecimiento()); return; }
    // "¿Qué establecimientos hay en Florida?": lista exacta desde el PAL (sin pasar por la IA)
    const pideLista = n.match(/\b(establecimientos|colegios|escuelas|liceos|jardines|salas cuna)\b.*\b(concepcion|chiguayante|florida|hualqui)\b/);
    if (pideLista && /\b(que|cuales|cuantos|cuantas|lista|listado|hay|nombres)\b/.test(n)) {
      const comuna = Object.keys(COMUNAS).find((c) => normalizar(c) === pideLista[2]);
      const filtro = pideLista[1];
      const lista = ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === pideLista[2] &&
        (filtro === "establecimientos" || filtro === "colegios" ? true :
         filtro === "escuelas" ? /escuela/i.test(e.nombre) : filtro === "liceos" ? /liceo/i.test(e.nombre) : /jard|sala cuna/i.test(e.nombre)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      agregar("bot", `<h3>🏫 ${escapar(filtro.charAt(0).toUpperCase() + filtro.slice(1))} en ${escapar(comuna)} (${lista.length})</h3>` +
        (lista.length ? `<ul>${lista.map((e) => `<li><strong>${escapar(e.nombre)}</strong>${e.niveles ? " — " + escapar(e.niveles) : ""}</li>`).join("")}</ul>` : "<p>No hay registros con ese criterio.</p>") +
        `<div class="nota">Fuente: Plan Anual Local 2026. ${ESTABLECIMIENTOS.some((e) => !e.comuna) ? "Algunos jardines infantiles aún no tienen comuna registrada." : ""}</div>` +
        chips([{ accion: "perfil-iniciar", valor: "x", etiqueta: "📍 Elegir mi establecimiento", primario: true }]));
      return;
    }
    if (RE_SALUDO.test(n)) {
      agregar("bot", `<p>¡Hola! 👋 Soy el asistente de IA del <strong>SLEP Andalién Sur</strong>. Puedo resolver dudas sobre uso ético de la IA, protección de datos, herramientas, prompts y los referentes oficiales de tu rol, o ayudarte a <strong>crear un prompt</strong> para diseñar material.</p>` +
        chips([{ accion: "wizard-iniciar", valor: "x", etiqueta: "✏️ Diseñar material con IA", primario: true }, { valor: "¿Qué herramientas de IA puedo usar?" }, { valor: "¿Puedo ingresar datos de estudiantes a la IA?" }]));
      return;
    }
    if (RE_GRACIAS.test(n)) {
      agregar("bot", `<p>¡Con gusto! 😊 Si necesitas algo más, aquí estaré. Recuerda: <strong>la decisión final siempre es humana</strong>.</p>`);
      return;
    }

    // ¿Menciona un establecimiento? Confirmar el nombre real antes de responder
    if (!estMencionado && ESTABLECIMIENTOS.length) {
      const res = detectarMencion(texto);
      if (res.length) {
        const exacto = res[0].puntaje >= 0.97 && (res.length === 1 || res[1].puntaje < 0.9);
        if (exacto) { estMencionado = res[0].e; }
        else {
          pendiente = { texto };
          agregar("bot", `<p>Creo que mencionas un establecimiento, pero no lo encontré escrito así. Para no suponer, ¿te refieres a ${res.length === 1 ? "este" : "alguno de estos"}?</p>` +
            chips(res.map((r, i) => ({ accion: "mencion", valor: r.e.id, etiqueta: `${r.e.nombre}${r.e.comuna ? " (" + r.e.comuna + ")" : ""}`, primario: i === 0 }))
              .concat([{ accion: "mencion", valor: "-", etiqueta: "Ninguno, responder igual" }])));
          return;
        }
      }
    }

    // ¿Pide un material? Ofrecer armarlo paso a paso en vez de suponer nivel y contexto
    if (!directo) {
      const pedido = detectarPedido(n);
      if (pedido) {
        pendiente = { texto, pedido, estMencionado };
        agregar("bot", `<p>Entendí que quieres ${pedido.tipo ? "una <strong>" + escapar(pedido.tipo.nombre.toLowerCase()) + "</strong>" : "un material"}${pedido.tema ? " sobre «" + escapar(pedido.tema) + "»" : ""}. ` +
          `Para no suponer datos importantes (nivel, asignatura u OA, destinatarios, contexto de tu establecimiento), te propongo armarlo paso a paso.</p>` +
          chips([{ accion: "pedido-paso", valor: "x", etiqueta: "✏️ Sí, paso a paso", primario: true }, { accion: "pedido-directo", valor: "x", etiqueta: "Responder directamente" }]));
        return;
      }
    }

    if (!MODO_IA) {
      agregar("bot", (estMencionado ? tarjetaEstablecimiento(estMencionado) : "") + respuestaLocal(texto));
      return;
    }

    ocupado = true; el.enviar.disabled = true;
    const espera = mostrarEscribiendo();
    try {
      const html = await respuestaIA(texto, estMencionado);
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
    const orden = ["SLEP", "PAL", "M1", "M2", "LEY", "M3", "M4", "M5", "DOC", "DIR", "ASI", "EXT"];
    const grupos = {};
    CONOCIMIENTO.forEach((f) => { const k = f.fuente === "MINEDUC" ? "M1" : f.fuente; (grupos[k] = grupos[k] || []).push(f); });
    el.temas.innerHTML = orden.filter((k) => grupos[k]).map((k, i) =>
      `<details ${i === 0 ? "open" : ""}><summary><span class="dot" style="background:${COLORES[k]}"></span>${escapar((FUENTES[k] || k).replace(" · ", " — "))}</summary>
        ${grupos[k].map((f) => `<button class="tema" type="button" style="--c:${COLORES[k]}" data-id="${f.id}">${escapar(f.titulo)}</button>`).join("")}
      </details>`).join("");
  }

  const SUG_BASE = [
    { emoji: "✏️", color: "#f8b400", titulo: "Diseñar un material con IA", texto: "Te pregunto lo necesario y lo elaboro", accion: "wizard-iniciar" },
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
    { emoji: "📚", color: "#22a9dc", titulo: "Biblioteca", texto: "Manuales y documentos oficiales (MINEDUC, CPEIP, Ley 21.719)", accion: "ir", valor: "manuales.html" }
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
      caja.innerHTML = `<span class="perfil-ico">${rol ? rol.emoji : "📍"}</span><span><strong>${escapar(p.establecimiento || (rol ? rol.nombre : "Mi perfil"))}</strong><small>${escapar([rol && p.establecimiento ? rol.corto : "", p.comuna, p.alcance].filter(Boolean).join(" · "))} · Cambiar</small></span>`;
      if (saludo) saludo.textContent = p.establecimiento ? `¡Hola, equipo de ${p.establecimiento}!` : (p.comuna ? `¡Hola, ${p.comuna}! ¿En qué te ayudo?` : "¡Hola! ¿En qué te ayudo hoy?");
    } else {
      caja.innerHTML = `<span class="perfil-ico">📍</span><span><strong>Mi rol y establecimiento</strong><small>Se pregunta al iniciar cada conversación</small></span>`;
      if (saludo) saludo.textContent = "¡Hola! ¿En qué te ayudo hoy?";
    }
  }

  function construirModo() {
    el.modo.className = "modo" + (MODO_IA ? " ia" : "");
    el.modo.innerHTML = MODO_IA
      ? `<span class="luz"></span><div><strong>Modo IA conectado</strong>Respuestas generadas con IA a partir de los manuales.</div>`
      : `<span class="luz"></span><div><strong>Modo guías</strong>Responde con los manuales del Servicio. Tus consultas no salen de este navegador.</div>`;
  }

  /* Conversación nueva = todo desde cero, incluido el perfil (rol, colegio, alcance) */
  function nuevaConversacion() {
    historial = []; wizard = null; pendiente = null;
    el.mensajes.innerHTML = ""; el.bienvenida.hidden = false; el.chat.scrollTop = 0;
    cerrarMenu();
    iniciarConversacion();
    el.entrada.focus();
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
    else if (accion === "wizard-iniciar") { cerrarMenu(); agregarUsuario("Diseñar material con IA"); iniciarWizard(); }
    else if (accion === "wizard" && wizard) { agregarUsuario(b.textContent.trim()); avanzarWizard(valor); }
    else if (accion === "ir") { location.href = valor; }
    else if (accion === "perfil-iniciar") { cerrarMenu(); agregarUsuario("Mi perfil"); iniciarWizard(true); }
    else if (accion === "wizard-cancelar") { wizard = null; agregar("bot", "<p>Listo, cancelé el asistente. ¿En qué más te ayudo?</p>"); }
    else if (accion === "enviar-limpio") procesar(valor, { omitirRevision: true });
    else if (accion === "mencion" && pendiente) {
      const p = pendiente; pendiente = null;
      const est = ESTABLECIMIENTOS.find((x) => x.id === valor);
      agregarUsuario(est ? est.nombre : "Ninguno, responder igual");
      // Se agrega el nombre real a la consulta antes de responder
      const texto = est ? `${p.texto} (establecimiento: ${est.nombre})` : p.texto;
      procesar(texto, { omitirRevision: true, yaMostrado: true, estMencionado: est || null });
    }
    else if (accion === "pedido-paso" && pendiente) {
      const p = pendiente; pendiente = null;
      agregarUsuario("Sí, paso a paso");
      iniciarWizard(false, p.pedido);
    }
    else if (accion === "pedido-directo" && pendiente) {
      const p = pendiente; pendiente = null;
      agregarUsuario("Responder directamente");
      procesar(p.texto, { omitirRevision: true, yaMostrado: true, directo: true, estMencionado: p.estMencionado });
    }
  });

  $("#btnNueva").addEventListener("click", nuevaConversacion);
  $("#btnWizard").addEventListener("click", () => { cerrarMenu(); agregarUsuario("Diseñar material con IA"); iniciarWizard(); });
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
    agregarUsuario("Diseñar material con IA"); iniciarWizard();
  } else {
    iniciarConversacion();   // siempre parte preguntando rol, establecimiento y alcance
  }
  el.entrada.focus();
})();
