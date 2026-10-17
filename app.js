/* =====================================================================
   Asistente IA Educativa · SLEP Andalién Sur
   Lógica del chat: búsqueda en la base de conocimiento, asistente de
   prompts por rol, perfil (rol, comuna, establecimiento), detector de
   datos personales, contenido actualizable desde el panel y API de IA.
   ===================================================================== */
(function () {
  "use strict";

  // Copia intacta de establecimientos.js: el panel puede editar o eliminar colegios de esta base
  const ESTABLECIMIENTOS_BASE = ESTABLECIMIENTOS.map((e) => Object.assign({}, e));
  // Perfiles de cargo: base de conocimiento.js + los que el equipo edite o agregue en el panel
  const PERFILES = PERFILES_BASE.map((x) => Object.assign({}, x));
  const $ = (sel) => document.querySelector(sel);
  const el = {
    chat: $("#chat"), mensajes: $("#mensajes"), bienvenida: $("#bienvenida"), elaborado: $("#elaborado"),
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
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">🖼️ $1</a>')   // imagen dentro de un párrafo: enlace
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  }
  function markdown(md) {
    const lineas = escapar(md).split("\n");
    let html = "", lista = null, i = 0, nTitulo = 0;
    // Títulos (# a ######): sin los "#", con un ícono en los colores del SLEP
    const COLORES_TITULO = ["#0071ea", "#4fa61a", "#f0a500", "#ff3c4c", "#22a9dc"];
    const titulo = (t) => `<h4 class="titulo-sec"><span class="ico-sec" style="--c:${COLORES_TITULO[nTitulo++ % COLORES_TITULO.length]}"></span>${enLinea(t)}</h4>`;
    const cerrarLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
    while (i < lineas.length) {
      const l = lineas[i];
      if (/^```/.test(l.trim())) {               // bloque de código / prompt / gráfico
        cerrarLista();
        const lenguaje = (l.trim().match(/^```\s*([a-záéíóú]+)/i) || [])[1] || "";
        const buf = []; i++;
        while (i < lineas.length && !/^```/.test(lineas[i].trim())) buf.push(lineas[i++]);
        i++;
        const pareceGrafico = /^json$/i.test(lenguaje) && /"(series|datasets|cifras)"\s*:/.test(desescapar(buf.join(" ")));
        if (/^(grafico|gráfico|chart|grafica|gráfica)$/i.test(lenguaje) || pareceGrafico) {   // datos → gráfico animado
          const g = graficoDesdeTexto(buf.join("\n"));
          if (g) { html += g; continue; }
        }
        html += `<div class="bloque-codigo"><button class="btn-copiar" type="button">Copiar</button><pre>${buf.join("\n")}</pre></div>`;
        continue;
      }
      // Imagen sola en una línea: ![descripción](https://...) — si no carga, se oculta
      const img = l.trim().match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);
      if (img) {
        cerrarLista();
        html += `<figure class="img-resp"><img src="${img[2]}" alt="${img[1]}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">` +
          (img[1] ? `<figcaption>${img[1]}</figcaption>` : "") + `</figure>`;
        i++; continue;
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
      if ((m = l.match(/^\s*#{1,6}\s*(.+?)\s*#*\s*$/))) { cerrarLista(); html += titulo(m[1].replace(/^\*\*(.*)\*\*$/, "$1")); }
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
     1b. RECURSOS VISUALES: gráficos animados, videos de YouTube e imágenes
     Gráficos dibujados aquí mismo en SVG (sin librerías externas), con los
     colores del SLEP. Se animan cuando aparecen en pantalla.
     ================================================================ */
  const PALETA = ["#0071ea", "#4fa61a", "#f0a500", "#ff3c4c", "#22a9dc", "#9b59d0", "#e0559b", "#0b8f6a"];
  // Aclara un color hexadecimal (mezcla con blanco) para los degradados
  function aclarar(hex, k) {
    const m = String(hex).match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (!m) return hex;
    return "#" + m.slice(1).map((x) => Math.round(parseInt(x, 16) + (255 - parseInt(x, 16)) * k).toString(16).padStart(2, "0")).join("");
  }
  const desescapar = (t) => String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  function aNumero(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    let s = String(v == null ? "" : v).replace(/[%\s$]/g, "");
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,5
    else s = s.replace(",", ".");
    const x = parseFloat(s);
    return isFinite(x) ? x : null;
  }
  const fmtNum = (n, u) => n.toLocaleString("es-CL", { maximumFractionDigits: Math.abs(n) < 10 && n % 1 ? 2 : 1 }) + (u ? (u === "%" ? "%" : " " + u) : "");
  const corto = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));
  const numAnim = (v, u, extra = "") => `<tspan class="g-num" data-v="${v}" data-u="${escapar(u || "")}"${extra}>${fmtNum(v, u)}</tspan>`;

  /* Verificación de datos: un gráfico de la IA solo se dibuja si sus números están en la información que el
     asistente le entregó (PAL, fichas, perfil) o si indica el enlace exacto de donde salen los datos. */
  let contextoVigente = "";   // contexto enviado en la última consulta a la IA
  let datosUsuarioVigentes = "";   // lo que la persona escribió (si entrega sus propios datos para un gráfico)
  const numerosDe = (txt) => new Set((String(txt).match(/-?\d[\d.,]*\d|-?\d/g) || []).map((x) => aNumero(x)).filter((x) => x !== null).map((x) => +x.toFixed(2)));
  const valoresDe = (spec) => spec.tipo === "cifras" ? (spec.cifras || []).map((c) => aNumero(c.valor))
    : (spec.series || []).flatMap((s) => (s.datos || []).map(aNumero));
  function verificarDatos(spec, contexto) {
    const enlace = /^https:\/\//.test(spec.enlace || "") ? spec.enlace : ((String(spec.fuente || "").match(/https:\/\/\S+/) || [])[0] || "");
    const vals = valoresDe(spec).filter((x) => x !== null);
    if (vals.length && contexto) {
      const enCtx = numerosDe(contexto);
      if (vals.every((v) => enCtx.has(+v.toFixed(2)))) return { estado: "contexto", enlace };
    }
    if (vals.length && datosUsuarioVigentes) {   // números que la propia persona entregó en el chat
      const enUsu = numerosDe(datosUsuarioVigentes);
      if (vals.every((v) => enUsu.has(+v.toFixed(2)))) return { estado: "usuario", enlace };
    }
    if (enlace && spec.fuente) return { estado: "enlace", enlace };
    return { estado: "sin-fuente" };
  }
  function graficoDesdeTexto(txt) {
    let spec;
    try { spec = normalizarSpec(JSON.parse(desescapar(txt))); } catch (e) { console.warn("Gráfico no válido:", e.message); return ""; }
    const v = verificarDatos(spec, contextoVigente);
    if (v.estado === "sin-fuente") {
      return `<div class="nota grafico-rechazado">📊 No muestro este gráfico porque sus datos no tienen una fuente verificable: no coinciden con la información del asistente ni indican el enlace de donde provienen.</div>`;
    }
    spec.enlace = v.enlace;
    spec._sello = v.estado === "contexto" ? "✅ Datos verificados con la información del asistente"
      : v.estado === "usuario" ? "✅ Gráfico elaborado con los datos que entregaste" : "🔗 Datos de una fuente externa: revísalos en el enlace";
    if (v.estado === "usuario" && !spec.fuente) spec.fuente = "Datos entregados por quien consulta";
    return graficoHTML(spec);
  }
  // spec: { tipo, titulo, etiquetas, series:[{nombre, datos}], unidad, fuente }  ·  tipo "cifras": { cifras:[{etiqueta, valor, unidad}] }
  // Acepta también el formato habitual de otras herramientas (labels/datasets/type/title)
  function normalizarSpec(s) {
    if (!s || typeof s !== "object") return s;
    const o = Object.assign({}, s);
    if (!o.tipo && o.type) o.tipo = { bar: "barras", horizontalBar: "barras-h", line: "lineas", pie: "torta", doughnut: "dona" }[o.type] || o.type;
    if (!o.titulo && (o.title || o.options?.plugins?.title?.text)) o.titulo = o.title || o.options.plugins.title.text;
    const datos = o.data && typeof o.data === "object" && !Array.isArray(o.data) ? o.data : o;
    if (!o.etiquetas && datos.labels) o.etiquetas = datos.labels;
    if (!o.series && datos.datasets) o.series = datos.datasets.map((d) => ({ nombre: d.label || d.nombre || "", datos: d.data || d.datos || [] }));
    if (!o.fuente && o.source) o.fuente = o.source;
    if (!o.unidad && (o.unit || (o.series && o.series[0] && o.series[0].unidad))) o.unidad = o.unit || o.series[0].unidad;
    return o;
  }
  function graficoHTML(spec) {
    if (!spec || typeof spec !== "object") return "";
    spec = normalizarSpec(spec);
    const u = spec.unidad || "";
    let tipo = String(spec.tipo || "barras").toLowerCase().replace("gráfico de ", "").replace(/\s+/g, "-");
    tipo = { bar: "barras", barra: "barras", columnas: "barras", horizontal: "barras-h", line: "lineas", linea: "lineas", líneas: "lineas", pie: "torta",
      circular: "torta", donut: "dona", indicadores: "cifras", kpi: "cifras" }[tipo] || tipo;
    let cuerpo = "", leyenda = "", tabla = "", defs = "", nSeries = 0;
    const movil = (window.innerWidth || 800) < 600;   // en celular el dibujo es más angosto para que el texto se lea bien
    const uid = "g" + Math.random().toString(36).slice(2, 8);   // ids únicos para los degradados de este gráfico
    if (tipo === "cifras") {
      const cs = (spec.cifras || []).map((c) => ({ e: c.etiqueta || c.nombre || "", v: aNumero(c.valor), u: c.unidad || u })).filter((c) => c.v !== null).slice(0, 6);
      if (!cs.length) return "";
      cuerpo = `<div class="g-cifras">${cs.map((c, i) => `<div class="g-cifra" style="--c:${PALETA[i % PALETA.length]};--d:${i * 120}ms">` +
        `<strong><span class="g-num" data-v="${c.v}" data-u="${escapar(c.u)}">${fmtNum(c.v, c.u)}</span></strong><span>${escapar(c.e)}</span></div>`).join("")}</div>`;
      tabla = `<table><tr><th>Indicador</th><th>Valor</th></tr>${cs.map((c) => `<tr><td>${escapar(c.e)}</td><td>${fmtNum(c.v, c.u)}</td></tr>`).join("")}</table>`;
    } else {
      const et = (spec.etiquetas || []).slice(0, 30).map(String);
      const series = (spec.series || (spec.datos ? [{ nombre: spec.titulo || "", datos: spec.datos }] : []))
        .slice(0, 5).map((s, k) => ({ n: s.nombre || "", c: s.color || PALETA[k % PALETA.length], d: et.map((_, i) => aNumero((s.datos || [])[i])) }));
      if (!et.length || !series.length || series.every((s) => s.d.every((x) => x === null))) return "";
      nSeries = series.length;
      // Degradados: barras verticales, horizontales y área bajo las líneas
      defs = series.map((s, k) => `<linearGradient id="${uid}v${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${aclarar(s.c, .38)}"/><stop offset="1" stop-color="${s.c}"/></linearGradient>` +
        `<linearGradient id="${uid}h${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s.c}"/><stop offset="1" stop-color="${aclarar(s.c, .38)}"/></linearGradient>` +
        `<linearGradient id="${uid}a${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".32"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></linearGradient>`).join("") +
        `<linearGradient id="${uid}hd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0a500"/><stop offset="1" stop-color="#f8d63c"/></linearGradient>`;   // barra destacada
      tabla = `<table><tr><th></th>${series.map((s) => `<th>${escapar(s.n || "Valor")}</th>`).join("")}</tr>` +
        et.map((e, i) => `<tr><td>${escapar(e)}</td>${series.map((s) => `<td>${s.d[i] === null ? "—" : fmtNum(s.d[i], u)}</td>`).join("")}</tr>`).join("") + `</table>`;
      if (series.length > 1 || tipo === "lineas") leyenda = `<div class="g-leyenda">${series.map((s) => `<span><i style="background:${s.c}"></i>${escapar(s.n)}</span>`).join("")}</div>`;
      if (!spec._forzar && tipo === "barras" && (et.length > 8 || et.reduce((a, e) => a + e.length, 0) / et.length > 13)) tipo = "barras-h";
      if ((tipo === "torta" || tipo === "dona") && series.length > 1) tipo = "barras";   // torta/dona: una sola serie
      const vals = series.flatMap((s) => s.d).filter((x) => x !== null);
      // Escala con pasos "redondos" (0, 25, 50, 75, 100…) para que el eje se lea fácil
      const redondo = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
      const pasoEje = redondo((Math.max(0, ...vals) - Math.min(0, ...vals)) / 4 || 1);
      const max = Math.ceil(Math.max(0, ...vals) / pasoEje) * pasoEje || pasoEje, min = Math.floor(Math.min(0, ...vals) / pasoEje) * pasoEje, rango = max - min || 1;

      if (tipo === "torta" || tipo === "dona") {
        const s = series[0], total = s.d.reduce((a, x) => a + (x > 0 ? x : 0), 0) || 1;
        let acum = 0;
        const dona = tipo === "dona", r = dona ? 70 : 45, ancho = dona ? 32 : 90;
        const segs = et.map((e, i) => {
          const v = s.d[i] > 0 ? s.d[i] : 0, pct = (v / total) * 100;
          const seg = `<circle class="g-seg" cx="100" cy="100" r="${r}" pathLength="100" fill="none" stroke="${PALETA[i % PALETA.length]}" stroke-width="${ancho}"
            stroke-dasharray="0 100" stroke-dashoffset="${-acum}" data-pct="${pct}" style="--d:${i * 140}ms"><title>${escapar(e)}: ${fmtNum(v, u)} (${fmtNum(pct, "%")})</title></circle>`;
          acum += pct; return seg;
        }).join("");
        cuerpo = `<div class="g-circular"><svg viewBox="0 0 200 200" class="g-svg-circ" role="img" aria-label="${escapar(spec.titulo || "Gráfico")}"><g transform="rotate(-90 100 100)">${segs}</g>` +
          (dona ? `<text x="100" y="96" text-anchor="middle" class="g-centro">${numAnim(total, u)}</text><text x="100" y="116" text-anchor="middle" class="g-centro-sub">Total</text>` : "") + `</svg>` +
          `<div class="g-leyenda g-leyenda-v">${et.map((e, i) => { const v = s.d[i] > 0 ? s.d[i] : 0;
            return `<span><i style="background:${PALETA[i % PALETA.length]}"></i>${escapar(e)} <b>${fmtNum((v / total) * 100, "%")}</b></span>`; }).join("")}</div></div>`;
        leyenda = "";
      } else if (tipo === "barras-h") {
        const W = movil ? 360 : 640, fila = 30, izq = movil ? 128 : 210, der = movil ? 52 : 70, H = et.length * fila * Math.max(1, series.length * 0.75) + 16, alto = (H - 16) / et.length;
        const x = (v) => izq + ((v - min) / rango) * (W - izq - der), bw = (alto * 0.72) / series.length;
        let svg = "";
        et.forEach((e, i) => {
          const y0 = 8 + i * alto;
          svg += `<text x="${izq - 8}" y="${y0 + alto / 2 + 4}" text-anchor="end" class="g-et">${escapar(corto(e, movil ? 19 : 32))}<title>${escapar(e)}</title></text>`;
          series.forEach((s, k) => {
            const v = s.d[i]; if (v === null) return;
            const y = y0 + alto * 0.14 + k * bw, xa = x(Math.min(0, v)), w = Math.abs(x(v) - x(0));
            svg += `<rect class="g-barra g-barra-h" x="${xa}" y="${y}" width="${Math.max(w, 1)}" height="${bw - 2}" rx="${Math.min(7, (bw - 2) / 2)}" fill="url(#${uid}${spec.destacar && e === spec.destacar ? "hd" : "h" + k})" style="--d:${(i * series.length + k) * 45}ms;transform-origin:${v < 0 ? "right" : "left"} center"><title>${escapar(e)}: ${fmtNum(v, u)}</title></rect>` +
              `<text x="${x(v) + (v < 0 ? -6 : 6)}" y="${y + bw / 2 + 2}" text-anchor="${v < 0 ? "end" : "start"}" class="g-val">${numAnim(v, u)}</text>`;
          });
        });
        cuerpo = `<svg viewBox="0 0 ${W} ${H}" class="g-svg" role="img" aria-label="${escapar(spec.titulo || "Gráfico")}"><defs>${defs}</defs>${svg}</svg>`;
      } else {
        // barras verticales o líneas
        const W = movil ? 360 : 640, H = movil ? 270 : 300, izq = movil ? 44 : 52, der = 10, arr = 18, rotar = et.length > (movil ? 4 : 6), abajo = rotar ? 74 : 40, pw = W - izq - der, ph = H - arr - abajo;
        const y = (v) => arr + ph - ((v - min) / rango) * ph, paso = pw / et.length;
        let svg = "";
        for (let v = min; v <= max + pasoEje / 1000; v += pasoEje) {   // líneas guía en pasos redondos
          const yy = y(v);
          svg += `<line x1="${izq}" x2="${W - der}" y1="${yy}" y2="${yy}" class="g-guia"/><text x="${izq - 6}" y="${yy + 4}" text-anchor="end" class="g-eje">${fmtNum(+v.toFixed(2), u)}</text>`;
        }
        et.forEach((e, i) => {
          const cx = izq + paso * (i + 0.5);
          svg += rotar ? `<text transform="translate(${cx},${H - abajo + 14}) rotate(-35)" text-anchor="end" class="g-et">${escapar(corto(e, movil ? 13 : 18))}<title>${escapar(e)}</title></text>`
            : `<text x="${cx}" y="${H - abajo + 18}" text-anchor="middle" class="g-et">${escapar(corto(e, movil ? 11 : 16))}<title>${escapar(e)}</title></text>`;
        });
        if (tipo === "lineas") {
          series.forEach((s, k) => {
            const pts = et.map((_, i) => (s.d[i] === null ? null : [izq + paso * (i + 0.5), y(s.d[i])])).filter(Boolean);
            if (!pts.length) return;
            const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
            svg += `<path d="${d} L${pts[pts.length - 1][0]} ${y(Math.max(min, 0))} L${pts[0][0]} ${y(Math.max(min, 0))} Z" fill="url(#${uid}a${k})" class="g-area"/>` +
              `<path d="${d}" pathLength="1" fill="none" stroke="${s.c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="g-linea" style="--d:${k * 250}ms"/>`;
            et.forEach((e, i) => { if (s.d[i] === null) return; const px = izq + paso * (i + 0.5), py = y(s.d[i]);
              svg += `<circle cx="${px}" cy="${py}" r="5" fill="#fff" stroke="${s.c}" stroke-width="3" class="g-punto" style="--d:${600 + i * 90}ms"><title>${escapar(e)}: ${fmtNum(s.d[i], u)}</title></circle>` +
                (series.length === 1 ? `<text x="${px}" y="${py - 11}" text-anchor="middle" class="g-val g-punto" style="--d:${600 + i * 90}ms">${numAnim(s.d[i], u)}</text>` : ""); });
          });
        } else {
          const bw = (paso * 0.7) / series.length;
          et.forEach((e, i) => series.forEach((s, k) => {
            const v = s.d[i]; if (v === null) return;
            const bx = izq + paso * i + paso * 0.15 + k * bw, top = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
            svg += `<rect class="g-barra" x="${bx}" y="${top}" width="${bw - 3}" height="${Math.max(h, 1)}" rx="${Math.min(8, (bw - 3) / 2)}" fill="url(#${uid}v${k})" style="--d:${(i * series.length + k) * 55}ms;transform-origin:center ${v < 0 ? "top" : "bottom"}"><title>${escapar(e)}${s.n ? " · " + escapar(s.n) : ""}: ${fmtNum(v, u)}</title></rect>` +
              (et.length * series.length <= (movil ? 8 : 16) && bw >= (movil ? 30 : 24) ? `<text x="${bx + (bw - 3) / 2}" y="${v < 0 ? y(v) + 14 : top - 6}" text-anchor="middle" class="g-val">${numAnim(v, u)}</text>` : "");
          }));
        }
        svg += `<line x1="${izq}" x2="${W - der}" y1="${y(0)}" y2="${y(0)}" class="g-base"/>`;
        cuerpo = `<svg viewBox="0 0 ${W} ${H}" class="g-svg" role="img" aria-label="${escapar(spec.titulo || "Gráfico")}"><defs>${defs}</defs>${svg}</svg>`;
      }
    }
    // Cambiar el tipo de gráfico con los mismos datos
    const ICONOS = { barras: "📊", "barras-h": "📶", lineas: "📈", dona: "🍩", torta: "🥧", cifras: "🔢" };
    const opciones = tipo === "cifras" ? [] : ["barras", "barras-h", "lineas"].concat(nSeries === 1 ? ["dona"] : []);
    const guardado = Object.assign({}, spec); delete guardado._forzar;
    return `<figure class="grafico" data-tipo="${escapar(tipo)}" data-spec="${escapar(JSON.stringify(guardado))}">` +
      `<figcaption class="g-titulo"><span class="g-ico">${ICONOS[tipo] || "📊"}</span><span><b>${escapar(spec.titulo || "Gráfico")}</b>` +
        (spec.subtitulo ? `<small>${escapar(spec.subtitulo)}</small>` : "") + `</span></figcaption>` +
      (opciones.length ? `<div class="g-tipos" role="group" aria-label="Tipo de gráfico">${opciones.map((o) =>
        `<button type="button" data-g-tipo="${o}" class="${o === tipo ? "activo" : ""}" title="${{ barras: "Barras", "barras-h": "Barras horizontales", lineas: "Líneas", dona: "Dona" }[o]}">${ICONOS[o]}</button>`).join("")}</div>` : "") +
      cuerpo + leyenda +
      `<div class="g-pie"><span class="g-fuente">${spec.fuente ? `Fuente: ${escapar(spec.fuente)}` : "Fuente no indicada"}` +
        (spec.enlace ? ` · <a href="${escapar(spec.enlace)}" target="_blank" rel="noopener">ver fuente ↗</a>` : "") +
        (spec._sello ? `<br><span class="g-sello">${escapar(spec._sello)}</span>` : "") + `</span>` +
      `<button class="g-ver-datos" type="button">Ver datos</button></div><div class="g-tabla" hidden>${tabla}</div></figure>`;
  }

  // Cuenta hacia arriba los números de un gráfico
  function contar(elemento) {
    const v = +elemento.dataset.v, u = elemento.dataset.u, t0 = performance.now(), dur = 1100;
    const paso = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const dec = Number.isInteger(v) ? 0 : (Math.abs(v) < 10 ? 2 : 1);   // los enteros cuentan sin decimales
      elemento.textContent = fmtNum(k < 1 ? +(v * e).toFixed(dec) : v, u); if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }
  function animarGrafico(g) {
    if (g.classList.contains("animado")) return;
    g.classList.add("animado");
    g.querySelectorAll(".g-num").forEach(contar);
    const segs = g.querySelectorAll(".g-seg"), hueco = segs.length > 1 ? 0.7 : 0;   // pequeña separación entre segmentos
    segs.forEach((s) => { const p = +s.dataset.pct; setTimeout(() => { s.style.strokeDasharray = `${Math.max(p - hueco, 0)} ${100 - p + hueco}`; }, 30); });
  }
  const observadorGraficos = "IntersectionObserver" in window
    ? new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { animarGrafico(en.target); observadorGraficos.unobserve(en.target); } }), { threshold: 0.35 })
    : null;

  // Tabla con números → botón "Ver como gráfico"
  function graficoDesdeTabla(tabla) {
    const filas = [...tabla.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
    if (filas.length < 3) return null;
    const cab = filas[0], datos = filas.slice(1);
    const cols = cab.map((_, j) => j).filter((j) => j > 0 && datos.filter((f) => aNumero(f[j]) !== null).length >= Math.max(2, datos.length * 0.7)).slice(0, 4);
    if (!cols.length) return null;
    const pct = datos.some((f) => cols.some((j) => /%/.test(f[j] || "")));
    return { tipo: "barras", titulo: cab[cols[0]] && cols.length === 1 ? cab[cols[0]] : "", etiquetas: datos.map((f) => f[0]),
      series: cols.map((j) => ({ nombre: cab[j], datos: datos.map((f) => aNumero(f[j])) })), unidad: pct ? "%" : "", fuente: "datos de la tabla anterior" };
  }

  // Activa gráficos, videos y tablas de un mensaje recién agregado
  function activarVisuales(nodo) {
    nodo.querySelectorAll(".grafico").forEach((g) => { if (observadorGraficos) observadorGraficos.observe(g); else animarGrafico(g); });
    nodo.querySelectorAll(".burbuja table").forEach((t) => {
      if (t.closest(".grafico") || t.dataset.grafico) return;
      const spec = graficoDesdeTabla(t); if (!spec) return;
      // Solo se ofrece graficar una tabla si sus números coinciden con la información real del asistente
      const v = verificarDatos(spec, contextoVigente);
      if (v.estado !== "contexto" && v.estado !== "usuario") return;
      spec._sello = v.estado === "usuario" ? "✅ Datos que entregaste" : "✅ Datos verificados con la información del asistente";
      t.dataset.grafico = "1";
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip g-desde-tabla"; b.textContent = "📊 Ver como gráfico";
      b.addEventListener("click", () => {
        const div = document.createElement("div"); div.innerHTML = graficoHTML(spec);
        const g = div.firstElementChild; b.replaceWith(g); animarGrafico(g); conectarGrafico(g);
      });
      (t.closest(".tabla-wrap") || t).after(b);
    });
    nodo.querySelectorAll(".grafico").forEach(conectarGrafico);
    // Videos de YouTube: tarjeta con miniatura; si el video no existe, no se muestra
    const vistos = new Set(), ultimoDe = new Map();   // ultimoDe: mantiene el orden si hay varios videos en una misma lista
    nodo.querySelectorAll(".burbuja a[href]").forEach((a) => {
      const m = a.getAttribute("href").match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
      if (!m || vistos.has(m[1]) || vistos.size >= 3) return;
      vistos.add(m[1]);
      const id = m[1];
      const bloque = a.closest("li") ? a.closest("ul, ol") : a.closest("p, h4, div.nota") || a;
      const textoCerca = normalizar((a.closest("li, p") || a).textContent);
      const card = document.createElement("div");
      card.className = "video-yt verificando"; card.dataset.video = id;
      card.innerHTML = `<div class="yt-pie">🔎 Verificando el video en YouTube…</div>`;
      (ultimoDe.get(bloque) || bloque).after(card); ultimoDe.set(bloque, card);
      verificarVideo(id).then((info) => {
        if (!info.ok) {
          if (info.noExiste) {   // no existe o no está disponible: se quita el enlace para no recomendarlo
            const aviso = document.createElement("span");
            aviso.className = "video-no";
            aviso.innerHTML = `<s>${escapar(a.textContent.trim())}</s> <em>(⚠️ este video no existe o no está disponible en YouTube: no lo recomiendo)</em>`;
            a.replaceWith(aviso);
          }
          card.remove();
          return;
        }
        // Canal REAL según YouTube; si el texto lo atribuye a otra institución, se advierte
        const atribuida = ORGS_VIDEO.find((o) => o.re.test(textoCerca));
        const coincide = !atribuida || atribuida.ok.test(normalizar(info.canal));
        card.className = "video-yt";
        card.innerHTML = `<button type="button" class="yt-play" aria-label="Reproducir video: ${escapar(info.titulo)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-icono"></span></button>` +
          `<div class="yt-pie"><strong>${escapar(corto(info.titulo, 110))}</strong>` +
          `<span class="yt-canal">✅ Verificado en YouTube · Canal: ${info.urlCanal ? `<a href="${escapar(info.urlCanal)}" target="_blank" rel="noopener">${escapar(info.canal)}</a>` : escapar(info.canal)}</span>` +
          (coincide ? "" : `<span class="yt-alerta">⚠️ La respuesta lo atribuye a «${escapar(atribuida.nombre)}», pero el canal real es «${escapar(info.canal)}». Considéralo una fuente no oficial.</span>`) + `</div>`;
        card.querySelector(".yt-play").addEventListener("click", () => {
          card.querySelector(".yt-play").outerHTML = `<div class="yt-marco"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${escapar(info.titulo)}" ` +
            `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
        });
      });
    });
  }
  // Instituciones que la IA podría mencionar como autoras de un video, y cómo se llaman sus canales oficiales
  const ORGS_VIDEO = [
    { re: /\bmineduc\b|ministerio de educacion/, ok: /mineduc|ministerio de educaci/, nombre: "MINEDUC" },
    { re: /\bcpeip\b/, ok: /cpeip/, nombre: "CPEIP" },
    { re: /agencia de (la )?calidad/, ok: /agencia.*calidad/, nombre: "Agencia de Calidad de la Educación" },
    { re: /superintendencia de educacion|supereduc/, ok: /superintendencia|supereduc/, nombre: "Superintendencia de Educación" },
    { re: /educacion publica|\bdep\b/, ok: /educaci.n p.blica/, nombre: "Educación Pública" },
    { re: /\bslep\b|servicio local/, ok: /slep|servicio local/, nombre: "SLEP" },
    { re: /curriculum nacional|curriculumnacional/, ok: /curr.culum/, nombre: "Currículum Nacional" },
    { re: /\bunesco\b/, ok: /unesco/, nombre: "UNESCO" },
    { re: /\bunicef\b/, ok: /unicef/, nombre: "UNICEF" },
    { re: /\bocde\b|\boecd\b/, ok: /ocde|oecd/, nombre: "OCDE" },
    { re: /biblioteca del congreso|\bbcn\b/, ok: /biblioteca del congreso|bcn/, nombre: "Biblioteca del Congreso Nacional" }
  ];
  // Consulta a YouTube el título y el canal reales del video (oEmbed). Se guarda en memoria para no repetir.
  const cacheVideos = {};
  function verificarVideo(id) {
    if (!cacheVideos[id]) {
      cacheVideos[id] = fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id))
        .then((r) => (r.ok ? r.json().then((d) => ({ ok: true, titulo: d.title || "Video", canal: d.author_name || "Canal no informado", urlCanal: d.author_url || "" }))
          : { ok: false, noExiste: r.status === 400 || r.status === 404 || r.status === 401 || r.status === 403 }))
        .catch(() => ({ ok: false, noExiste: false }));   // sin conexión: se deja solo el enlace
    }
    return cacheVideos[id];
  }
  function conectarGrafico(g) {
    const b = g.querySelector(".g-ver-datos"); if (!b || b.dataset.ok) return;
    b.dataset.ok = "1";
    b.addEventListener("click", () => { const t = g.querySelector(".g-tabla"); t.hidden = !t.hidden; b.textContent = t.hidden ? "Ver datos" : "Ocultar datos"; });
    // Cambiar el tipo de gráfico (mismos datos verificados)
    g.querySelectorAll("[data-g-tipo]").forEach((bt) => bt.addEventListener("click", () => {
      let spec; try { spec = JSON.parse(g.dataset.spec); } catch (e) { return; }
      spec.tipo = bt.dataset.gTipo; spec._forzar = true;
      const div = document.createElement("div"); div.innerHTML = graficoHTML(spec);
      const nuevo = div.firstElementChild; if (!nuevo) return;
      g.replaceWith(nuevo); conectarGrafico(nuevo); requestAnimationFrame(() => animarGrafico(nuevo));
    }));
  }

  /* Enlaces automáticos: cuando una respuesta nombra una ley, un decreto o un documento
     oficial, se vuelve un enlace a su fuente oficial (una vez por respuesta). */
  const BCN = (n) => "https://www.bcn.cl/leychile/consulta/listaresultadosimple?cadena=" + encodeURIComponent(n);
  const NUM_LEY = "(?:N\\.?\\s*[°º]?\\s*|N[°º]\\s*|Nº\\s*)?";
  // Todas apuntan al CONTENIDO (texto de la ley, PDF del documento), no a la portada de la institución.
  const LEY = (n) => "https://www.bcn.cl/leychile/navegar?idLey=" + n;   // abre el texto completo de la ley
  const DECRETOS = {   // decretos de educación más citados (texto en la BCN)
    "67": "https://www.bcn.cl/leychile/navegar?idNorma=1127255",    // evaluación, calificación y promoción (2018)
    "83": "https://www.bcn.cl/leychile/navegar?idNorma=1074511",    // diversificación de la enseñanza (2015)
    "170": "https://www.bcn.cl/leychile/navegar?idNorma=1012570"    // NEE y subvención de educación especial (2009)
  };
  const REFERENCIAS = [
    { id: "ley", re: new RegExp("\\bLey\\s+" + NUM_LEY + "(\\d{1,2}\\.?\\d{3})\\b", "i"), url: (m) => LEY(m[1].replace(".", "")) },
    { id: "dto", re: /\bDecreto\s+(?:Supremo\s+|Exento\s+)?(?:N\.?\s*[°º]?\s*|N[°º]\s*)?(\d{1,4})(?:\s+(?:de|del)\s+(?:año\s+)?(\d{4}))?/i,
      url: (m) => DECRETOS[m[1]] || BCN("decreto " + m[1] + (m[2] ? " " + m[2] : "")) },
    { id: "mbe-ep", re: /\bMarco para la Buena Enseñanza de (?:la )?Educación Parvularia\b|\bMBE-EP\b/i, url: "https://parvularia.mineduc.cl/wp-content/uploads/2020/05/19-10-30-MBE-EP-Final-para-web-largo-comprimido-1.pdf" },
    { id: "mbe", re: /\bMarco para la Buena Enseñanza\b|\bMBE\b/i, url: "https://estandaresdocentes.mineduc.cl/wp-content/uploads/2021/08/MBE-2.pdf" },
    { id: "mbdle", re: /\bMarco para la Buena Dirección(?: y el Liderazgo Escolar)?\b|\bMBDLE\b/i, url: "https://liderazgoeducativo.mineduc.cl/wp-content/uploads/sites/55/2016/04/MBDLE_2015.pdf" },
    { id: "bases", re: /\bBases Curriculares\b/i, url: "https://www.curriculumnacional.cl/Curriculum/Bases_Curriculares" },
    { id: "eid", re: /\bEstándares Indicativos de Desempeño\b/i, url: "https://liderazgoeducativo.mineduc.cl/estandares-indicativos-de-desempeno/" },
    { id: "pme", re: /\bPlan de Mejoramiento Educativo\b|\bPME\b/, url: "https://liderazgoeducativo.mineduc.cl/orientaciones-pme-2026-2/" },
    { id: "pnia", re: /\bPolítica Nacional de Inteligencia Artificial\b/i, url: "https://www.bcn.cl/leychile/navegar?idNorma=1210664" },
    { id: "plan-conv", re: /\bPlan de (?:Gestión de )?Convivencia(?: Educativa| Escolar)?\b/i, url: "https://culturaeducativa.mineduc.gob.cl/wp-content/uploads/2026/07/PLAN-DE-GESTION-DE-CONVIVENCIA-EDUCATIVA-2026.pdf" },
    { id: "pie-asis", re: /\bProfesionales asistentes de la educación\b/i, url: "https://especial.mineduc.cl/wp-content/uploads/sites/31/2020/01/Profesionales-asistentes-de-la-educacion-002.pdf" },
    { id: "unesco", re: /\bGuía (?:de la UNESCO )?para el uso de (?:la )?IA generativa\b/i, url: "https://unesdoc.unesco.org/ark:/48223/pf0000389227_spa" },
    { id: "pal", re: /\bPlan Anual Local\b/i, url: "PAL-2026-SLEP-Andalien-Sur.pdf" },
    { id: "url", re: /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/i, url: (m) => m[0] },
    // "revisa la ley", "consulta esta norma"… → enlaza a la última ley nombrada en la respuesta
    { id: "la-ley", re: /\b(?:revis[ae]r?|consult[ae]r?|le[ée]r?|ver|revisando|consultando)\s+(?:la|esta|dicha|esa)\s+(?:ley|norma(?:tiva)?)\b/i, url: null }
  ];
  const SIN_ENLACE = /^(a|button|code|pre|span|summary|label|h3|h4|textarea|svg)$/i;
  function enlazar(html) {
    const usados = new Set();
    let dentro = 0, ultimaLey = null;   // última ley o decreto nombrado (para "revisa la ley")
    return html.split(/(<[^>]+>)/).map((parte) => {
      const tag = parte.match(/^<(\/?)([a-z0-9]+)/i);
      if (tag) { if (SIN_ENLACE.test(tag[2]) && !/\/>$/.test(parte)) dentro += tag[1] ? -1 : 1; return parte; }
      if (dentro > 0 || !parte.trim()) return parte;
      // Todas las menciones encontradas; gana la más temprana y, a igual inicio, la más larga o específica
      const cand = [];
      REFERENCIAS.forEach((r, k) => {
        const re = new RegExp(r.re.source, r.re.flags.replace("g", "") + "g");
        let m; while ((m = re.exec(parte))) { cand.push({ r, m, k, i: m.index, f: m.index + m[0].length }); if (!m[0]) re.lastIndex++; }
      });
      cand.sort((a, b) => a.i - b.i || (b.f - b.i) - (a.f - a.i) || a.k - b.k);
      let pos = 0, salida = "";
      cand.forEach(({ r, m, i, f }) => {
        if (i < pos) return;
        let url = typeof r.url === "function" ? r.url(m) : r.url;
        if (r.id === "ley" || r.id === "dto") ultimaLey = url;
        if (r.id === "la-ley") { if (!ultimaLey) return; url = ultimaLey; }
        // Clave: cada ley o decreto (por número), dirección o documento se enlaza una sola vez por respuesta
        const clave = r.id === "ley" ? "ley" + m[1].replace(".", "") : r.id === "dto" ? "dto" + m[1] :
          r.id === "url" ? m[0].toLowerCase() : r.id === "la-ley" ? "la-ley" + url : r.id;
        if (usados.has(clave)) return;
        usados.add(clave);
        salida += parte.slice(pos, i) + `<a href="${url}" target="_blank" rel="noopener" class="ref-oficial">${m[0]}</a>`;
        pos = f;
      });
      return salida + parte.slice(pos);
    }).join("");
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
  const PALABRAS_INSTITUCION = ["escuela", "colegio", "liceo", "jardin", "complejo", "instituto", "establecimiento"];
  // Palabras de uso diario que aparecen en nombres de colegios: por sí solas NO indican que se nombra uno
  const COMUNES_NOMBRE = new Set(("educacion especial adultos parvularia experimental integrado polivalente nueva nuevo esperanza amor chile comun " +
    "agua luna calle nino ninos nina ninas santa santo hospital gran siete puente claro corta fundo cancha palma toro bicentenario poetas " +
    "profesora profesor juntas libertadores republica concepcion chiguayante florida hualqui andalien biobio manitos pasitos semillitas " +
    "piececitos lucero estela gloria blanca").split(" "));
  const mencionesDescartadas = new Set();   // colegios que la persona ya dijo que NO nombraba (en esta conversación)
  function detectarMencion(texto) {
    const todas = normalizar(texto).split(" ").filter((w) => w.length > 1);
    const q = palabrasNombre(texto);
    if (!q.length) return [];
    // Solo palabras largas y muy parecidas: "para" o "cada" ya no se confunden con "sala"
    const esInstitucion = (w) => w === "cole" || (w.length >= 5 && PALABRAS_INSTITUCION.some((p) => simPalabra(w, p) >= 0.8)) ||
      (w === "sala" && todas.includes("cuna"));
    const nombraInstitucion = todas.some(esInstitucion);
    return ESTABLECIMIENTOS.map((e) => {
      let mejor = 0;
      if (mencionesDescartadas.has(e.id)) return { e, puntaje: 0 };
      [e.nombre].concat(String(e.alias || "").split(",")).filter((v) => v.trim()).forEach((v) => {
        const n = palabrasNombre(v);
        if (!n.length) return;
        // Sin "escuela/colegio/liceo…" en la frase, hace falta nombrar con claridad 2 palabras propias del nombre
        if (!nombraInstitucion) {
          const propias = n.filter((x) => x.length >= 4 && !COMUNES_NOMBRE.has(x));
          const ok = propias.filter((x) => q.some((w) => w.length >= 4 && simPalabra(w, x) >= 0.85));
          if (propias.length >= 2 && ok.length >= 2) mejor = Math.max(mejor, ok.length === propias.length ? 1 : 0.8);
          return;
        }
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
        const distintivas = n.map((x, i) => (x.length >= 4 && !COMUNES_NOMBRE.has(x) ? sims[i] : 0));
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
  /* Robot asistente: cuerpo completo (saludo y "pensando") y cara (ícono de cada respuesta) */
  const BOCA = `<svg class="r-boca" viewBox="0 0 40 20" aria-hidden="true"><path d="M4 5 Q20 19 36 5"/><ellipse cx="20" cy="9" rx="9" ry="6"/></svg>`;
  const OJOS = `<span class="r-ojo izq"></span><span class="r-ojo der"></span>`;
  // Las imágenes del robot van incluidas aquí mismo (no dependen de archivos aparte)
  const IMG_ROBOT = { cuerpo: "data:image/png;base64,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", cara: "data:image/png;base64,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", izq: "data:image/png;base64,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", der: "data:image/png;base64,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" };
  const ROBOT = (clase = "") => `<div class="robot ${clase}" aria-hidden="true"><div class="r-cuerpo"><img class="r-base" src="${IMG_ROBOT.cuerpo}" alt="">${OJOS}${BOCA}` +
    `<img class="r-mano izq" src="${IMG_ROBOT.izq}" alt=""><img class="r-mano der" src="${IMG_ROBOT.der}" alt=""></div></div>`;
  const AVATAR = `<div class="avatar robot-cara" aria-hidden="true"><img src="${IMG_ROBOT.cara}" alt="">${OJOS}${BOCA}</div>`;
  // Hace "hablar" al robot de un mensaje durante un rato (según el largo de la respuesta)
  function hablar(nodo, ms) {
    const r = nodo && (nodo.querySelector(".robot") || nodo.querySelector(".avatar")); if (!r) return;
    r.classList.add("hablando"); clearTimeout(r._t); r._t = setTimeout(() => r.classList.remove("hablando"), ms);
  }
  const COLORES = { PAL: "#f0a500", M1: "#0071ea", M2: "#ff3c4c", LEY: "#9b59d0", M3: "#4fa61a", M4: "#f0a500", M5: "#22a9dc", MINEDUC: "#0071ea", EXT: "#e0559b", DOC: "#0b8f6a", DIR: "#5b4bd1", ASI: "#d9622b", SLEP: "#0071ea" };

  function ocultarBienvenida() { el.bienvenida.hidden = true; el.elaborado.hidden = true; }

  /* Las respuestas del asistente se muestran DESDE SU INICIO (la persona baja
     leyendo); los mensajes propios y el indicador de escritura van al final. */
  let contadorMsg = 0;
  function agregar(rol, html, { texto = "", guardar = true, alFinal = false } = {}) {
    if (!enInicio) ocultarBienvenida();   // durante las preguntas iniciales se mantiene la portada arriba
    if (rol === "bot" && guardar) html = enlazar(html);   // leyes y documentos oficiales con enlace
    const div = document.createElement("div");
    div.className = `msg ${rol}`;
    div.innerHTML = rol === "bot" ? `${AVATAR}<div class="burbuja">${html}</div>` : `<div class="burbuja">${html}</div>`;
    div.dataset.id = "m" + (++contadorMsg);
    el.mensajes.appendChild(div);
    if (rol === "bot") activarVisuales(div);   // gráficos animados, videos y "Ver como gráfico" en tablas
    // Respuestas con contenido: botones para descargar en PDF o compartir por WhatsApp / correo
    if (rol === "bot" && guardar && !enInicio && !div.querySelector('[data-accion="wizard"]')) {
      const b = div.querySelector(".burbuja");
      if (b.textContent.length > 220 || b.querySelector(".grafico, table")) {
        b.insertAdjacentHTML("beforeend", accionesMsg());
        if (!window.html2pdf) setTimeout(() => cargarHtml2pdf().catch(() => {}), 2500);   // precarga: el PDF sale más rápido
      }
    }
    if (enInicio && !el.mensajes.querySelector(".msg.user")) {
      el.chat.scrollTop = 0;   // al abrir, la portada se ve desde arriba; la persona baja a responder
    } else if (rol === "user" || alFinal) {
      el.chat.scrollTop = el.chat.scrollHeight;
    } else {
      // Lleva el INICIO de la respuesta a la parte superior del área del chat
      const top = div.getBoundingClientRect().top - el.chat.getBoundingClientRect().top + el.chat.scrollTop - 12;
      el.chat.scrollTop = Math.max(0, top);
    }
    if (guardar) historial.push({ rol, html, texto });
    if (rol === "bot" && guardar) hablar(div, Math.min(6000, 1400 + html.replace(/<[^>]+>/g, "").length * 12));
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
    return agregar("bot", `<div class="robot-pensando">${ROBOT("hablando")}<div><strong>Preparando tu respuesta…</strong>` +
      `<span class="escribiendo" aria-label="Escribiendo"><i></i><i></i><i></i></span></div></div>`, { guardar: false, alFinal: true });
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

  /* Proyecto Educativo Institucional (PEI): misión, visión, sellos e historia de cada colegio */
  const PEI_PARTES = [["mision", "🎯", "Misión"], ["vision", "🔭", "Visión"], ["sellos", "⭐", "Sellos educativos"], ["historia", "📜", "Historia"]];
  // Quita el nombre del colegio del texto que va a la IA (la regla: no identificarlo)
  function sinNombre(t, est) {
    let s = String(t || "");
    [est.nombre].concat(String(est.alias || "").split(",")).map((x) => x.trim()).filter((x) => x.length > 3)
      .forEach((n) => { s = s.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "el establecimiento"); });
    return s.replace(/\b(d)el el establecimiento/gi, "$1el establecimiento").replace(/\b(a)l? el establecimiento/gi, "$1l establecimiento")
      .replace(/\b(e)l el establecimiento/gi, "$1l establecimiento");
  }
  function contextoPEI(est) {
    if (!est) return "";
    const partes = PEI_PARTES.filter(([k]) => est[k]).map(([k, , t]) => `${t}: ${sinNombre(est[k], est).slice(0, k === "historia" ? 1500 : 900)}`);
    if (!partes.length && !est.pei) return "";
    return (partes.length ? ` Proyecto Educativo Institucional (PEI) del establecimiento — ${partes.join(" | ")}.` +
      " Alinea tus sugerencias, ejemplos y materiales con esta misión, visión, sellos e historia, nombrando la conexión cuando sea útil." : "") +
      (est.pei ? ` PEI completo (consúltalo si necesitas más información): ${est.pei}` : "");
  }
  function contextoPerfil() {
    const p = leerPerfil();
    if (!p) return "";
    const est = estDePerfil(p);
    const partes = [];
    if (p.rol && ROLES[p.rol]) partes.push(`Rol de quien consulta: ${ROLES[p.rol].nombre}. Referente principal: ${ROLES[p.rol].marco}.`);
    // Cargo o función: las actividades deben corresponder a sus funciones y a la normativa que lo rige
    const cargo = perfilDe(p);
    if (cargo) partes.push(`Cargo o función: ${cargo.nombre}. Funciones y responsabilidades: ${cargo.texto}` +
      (cargo.normativa ? ` Normativa que rige este cargo: ${cargo.normativa}.` : "") +
      " Propón solo actividades que correspondan a estas funciones y a lo que la normativa vigente permite a este cargo; si necesitas más detalle, puedes complementar con descripciones oficiales del cargo.");
    else if (p.cargo) partes.push(`Cargo o función (descrito por la persona): ${p.cargo}. Considera las funciones habituales de ese cargo según la normativa vigente.`);
    if (p.alcanceSlep) {
      const ests = estsSlep(p);
      if (p.alcanceSlep === "interna") partes.push("Trabaja en la gestión interna del Servicio (no con establecimientos específicos).");
      else if (ests.length) {
        const porComuna = {}; ests.forEach((e) => { const c = e.comuna || "sin comuna registrada"; porComuna[c] = (porComuna[c] || 0) + 1; });
        partes.push(`Trabaja con ${p.alcanceSlep === "todos" ? "todos los establecimientos del Servicio" : p.alcanceSlep === "comuna" ? "los establecimientos de la comuna de " + p.comuna : "estos establecimientos"}` +
          ` (${ests.length}: ${Object.keys(porComuna).map((c) => c + " " + porComuna[c]).join(", ")}). Considera su diversidad (niveles, entornos, programas como PIE) y propón acciones escalables.`);
        if (p.alcanceSlep === "elegidos") ests.slice(0, 6).forEach((e, i) => {   // sin nombres: "Establecimiento 1, 2…"
          const pei = PEI_PARTES.filter(([k]) => e[k] && k !== "historia").map(([k, , t]) => `${t}: ${sinNombre(e[k], e).slice(0, 350)}`).join(" | ");
          partes.push(`Establecimiento ${i + 1} (${e.comuna || "comuna no registrada"}${e.niveles ? ", " + e.niveles : ""}): ${sinNombre(e.caracteristicas || "", e).slice(0, 300)}${pei ? " PEI — " + pei : ""}`);
        });
      }
    }
    if (p.comuna && !p.alcanceSlep) partes.push(`Trabaja en un establecimiento de educación pública de la comuna de ${p.comuna}` + (p.entorno ? `, entorno ${p.entorno.toLowerCase()}` : "") + ".");
    if (p.alcance) partes.push(`Quiere trabajar con: ${p.alcance.toLowerCase()}.`);
    if (est && est.caracteristicas) partes.push(`Características del establecimiento (sin identificarlo): ${sinNombre(est.caracteristicas, est)}`);
    const pei = contextoPEI(est); if (pei) partes.push(pei.trim());
    return partes.length ? `\n\n### Contexto de quien consulta\n${partes.join(" ")} Adapta tus sugerencias a este rol, cargo y contexto, a la normativa vigente y, cuando exista, ` +
      "a la misión, visión y sellos del PEI, sin estereotipos. Para contextualizar, usa la realidad socioeconómica, comunitaria y natural del territorio; " +
      "no asumas ni repitas referencias geográficas puntuales (por ejemplo, un río) que la persona o el contexto no hayan indicado." : "";
  }

  const REGLA_SIN_PROMPTS = "Responde TÚ directamente con el contenido, la orientación o el material solicitado. " +
    "NO entregues prompts, plantillas de prompt ni instrucciones para usar en otra herramienta de IA, salvo que la persona lo pida explícitamente " +
    "(por ejemplo, si escribe la palabra «prompt»).";
  // Formatos visuales que el chat sabe mostrar (gráficos animados, videos, imágenes)
  const INSTRUCCION_VISUALES = "\n\n### Recursos visuales (opcional)\n" +
    "- Si presentas datos estadísticos REALES, agrégalos además como gráfico con un bloque de código de lenguaje grafico que contenga solo JSON. " +
    "Los números deben ser EXACTAMENTE los del CONTEXTO o los de una página que encontraste en la búsqueda; en este último caso agrega \"enlace\" con la dirección exacta de esa página. " +
    "El chat verifica cada número: si no coincide con el CONTEXTO ni trae enlace, el gráfico no se mostrará. Ejemplo:\n" +
    '```grafico\n{"tipo":"barras","titulo":"Matrícula 2025","etiquetas":["Escuela A","Escuela B"],"series":[{"nombre":"Estudiantes","datos":[242,918]}],"unidad":"","fuente":"Plan Anual Local 2026","enlace":""}\n```\n' +
    "  Tipos: barras, barras-h (nombres largos o muchas categorías), lineas (evolución en el tiempo), torta o dona (partes de un total), " +
    'cifras (1 a 4 indicadores destacados: {"tipo":"cifras","titulo":"…","cifras":[{"etiqueta":"Asistencia","valor":87.5,"unidad":"%"}],"fuente":"…"}). ' +
    "NUNCA inventes ni estimes cifras para un gráfico: si no tienes datos reales con fuente, no hagas gráficos.\n" +
    "- Si la persona PIDE un gráfico, diséñalo: elige el tipo que mejor comunica la idea, escribe un \"titulo\" claro y un \"subtitulo\" breve (qué muestra, período, unidad), " +
    "etiquetas cortas y en orden lógico (tiempo en orden cronológico; categorías de mayor a menor) y explica en 2 o 3 frases qué muestra. " +
    "Si te entrega sus datos, usa exactamente esos números (fuente: \"Datos entregados por quien consulta\") y no agregues años, períodos ni datos que no indicó. " +
    "Si el CONTEXTO ya trae datos numéricos pertinentes (por ejemplo, matrícula, cursos o % PIE del establecimiento), haz el gráfico DE INMEDIATO con ellos, sin preguntar. " +
    "Solo si no hay datos en su mensaje ni en el CONTEXTO, pídeselos (en una frase, con un ejemplo de cómo escribirlos). Nunca digas que entregas «JSON»: el chat lo muestra como gráfico.\n" +
    "- Videos de YouTube: recomienda uno SOLO si lo encontraste en la búsqueda de esta respuesta (nunca de memoria) y escríbelo como [título del video](https://www.youtube.com/watch?v=ID). " +
    "Nombra el canal EXACTAMENTE como aparece en YouTube; no digas que es del MINEDUC, CPEIP u otra institución salvo que sea su canal oficial. " +
    "El chat consulta a YouTube el título y el canal reales: si el video no existe lo quita, y si la atribución no coincide lo advierte. Si no encontraste un video confiable, no recomiendes ninguno.\n" +
    "- Puedes incluir una imagen en una línea propia con ![descripción](https://url-de-la-imagen) solo si la dirección es de una fuente oficial verificada. Si dudas, no la incluyas.";
  const INSTRUCCION_ACLARAR = INSTRUCCION_VISUALES + "\n\n### Cómo responder\n" + REGLA_SIN_PROMPTS + " Si la consulta es ambigua o le falta información clave para responder bien " +
    "(por ejemplo nivel, asignatura, propósito, destinatarios o a qué establecimiento o tema se refiere), NO supongas ni inventes: " +
    "responde solo con 1 a 3 preguntas breves de aclaración, ofreciendo opciones concretas basadas en el contexto y en el rol de quien consulta. " +
    "Si la consulta es clara, responde directamente.";
  const INSTRUCCION_MATERIAL = INSTRUCCION_VISUALES + "\n\n### Cómo responder\nLa persona ya entregó todos los datos necesarios. Elabora DIRECTAMENTE el material completo, " +
    "listo para usar, siguiendo la especificación. NO escribas un prompt ni expliques cómo pedírselo a otra IA. " +
    "Contextualiza con la realidad socioeconómica, comunitaria y natural indicada (no agregues referencias geográficas que no estén en la especificación). " +
    "Al final agrega una breve sección «Para revisar antes de usar» (2 a 4 puntos: alineación curricular, pertinencia, sesgos) y la declaración de uso de IA.";

  /* Llamada al servicio de IA. Si está saturado («muchas consultas»), espera y reintenta solo (hasta 2 veces);
     la segunda vez, sin búsqueda web, que es lo que más consume. */
  const RE_SATURADO = /recibiendo muchas consultas/i;
  async function consultarAPI(cuerpo) {
    let intento = 0;
    for (;;) {
      const r = await fetch(CONFIG.API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(cuerpo) });   // text/plain: sin preflight CORS
      const datos = await r.json();
      if (!datos.ok) throw new Error(datos.error || "Respuesta no válida");
      if (!RE_SATURADO.test(datos.respuesta || "") || intento >= 2) return datos;
      intento++;
      const escribiendo = el.mensajes.querySelector(".robot-pensando strong");
      if (escribiendo) escribiendo.textContent = "La IA está con muchas consultas: reintento en unos segundos…";
      await new Promise((ok) => setTimeout(ok, intento === 1 ? 9000 : 16000));
      if (intento === 2) cuerpo = Object.assign({}, cuerpo, { buscarWeb: false });
      if (escribiendo) escribiendo.textContent = "Preparando tu respuesta…";
    }
  }

  /* Elabora un material con la IA a partir de la especificación armada paso a paso */
  async function generarMaterialIA(especificacion) {
    const datos = await consultarAPI({ accion: "consultar", pregunta: especificacion, historial: [], contexto: contextoPerfil() + INSTRUCCION_MATERIAL });
    return datos.respuesta;
  }

  async function respuestaIA(consulta, estMencionado) {
    const fichas = buscar(consulta, 4).map((r) => `### ${r.ficha.titulo} (${FUENTES[r.ficha.fuente] || r.ficha.fuente})\n${r.ficha.texto}`).join("\n\n");
    const resto = contextoPerfil() +
      (estMencionado ? `\n\n### Establecimiento mencionado en la consulta\n${estMencionado.nombre}` + (estMencionado.comuna ? ` (${estMencionado.comuna}` + (estMencionado.entorno ? `, ${estMencionado.entorno.toLowerCase()}` : "") + ")" : "") +
        (estMencionado.niveles ? `. Niveles: ${estMencionado.niveles}` : "") + (estMencionado.caracteristicas ? `. Características según el PAL: ${estMencionado.caracteristicas}` : "") +
        (estDePerfil(leerPerfil()) === estMencionado ? "" : contextoPEI(estMencionado)) : "") +
      INSTRUCCION_ACLARAR;
    // El servidor acepta hasta 16.000 caracteres: se recortan las fichas para que las instrucciones (al final) nunca se pierdan
    // Consulta más liviana (el servicio gratuito de IA limita la cantidad de texto por minuto)
    const contexto = fichas.slice(0, Math.max(1500, Math.min(7000, 15500 - resto.length))) + resto;
    const previos = historial.slice(-7, -1).map((m) => ({
      role: m.rol === "user" ? "user" : "assistant",
      content: (m.texto || m.html.replace(/<[^>]+>/g, " ")).slice(0, 1200)
    }));
    // buscarWeb: si los documentos internos no bastan, la IA puede buscar en fuentes educativas confiables
    const datos = await consultarAPI({ accion: "consultar", pregunta: consulta, historial: previos, contexto, buscarWeb: true });
    const fuentes = buscar(consulta, 3).map((x) => x.ficha);
    const usoWeb = /fuentes externas sugeridas/i.test(datos.respuesta);
    contextoVigente = contexto;   // para verificar que los números de los gráficos sean reales
    datosUsuarioVigentes = [consulta].concat(historial.filter((m) => m.rol === "user").slice(-4).map((m) => m.texto || "")).join("\n");
    return markdown(datos.respuesta) +
      (fuentes.length ? `<div class="pie-msg">${fuentes.slice(0, 2).map(etiquetaFuente).join("")}</div>` : "") +
      `<div class="nota">${usoWeb
        ? "🌐 Esta respuesta incluye información buscada en internet porque no estaba en los documentos del asistente. Revisa las fuentes sugeridas antes de usarla."
        : "Respuesta generada con IA a partir de los manuales y fuentes oficiales. Verifica datos y normativa antes de usarla."}</div>`;
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
    return [p.rol && ROLES[p.rol] ? ROLES[p.rol].corto : "", p.cargo, p.establecimiento, p.comuna, p.alcance].filter(Boolean).join(" · ");
  }
  const perfilDe = (p) => (p && p.cargoId ? PERFILES.find((x) => x.id === p.cargoId) : null);
  const perfilesDelRol = (rol) => PERFILES.filter((x) => x.rol === rol);
  // Establecimientos con que trabaja un funcionario del SLEP (todos, una comuna o los elegidos)
  function estsSlep(p) {
    if (!p || !p.alcanceSlep) return [];
    if (p.alcanceSlep === "todos") return ESTABLECIMIENTOS.slice();
    if (p.alcanceSlep === "comuna") return ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === normalizar(p.comuna || ""));
    if (p.alcanceSlep === "elegidos") return (p.estIds || []).map((id) => ESTABLECIMIENTOS.find((e) => e.id === id)).filter(Boolean);
    return [];
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
    agregar("bot", `<div class="robot-saludo">${ROBOT()}<div><h3>👋 ¡Hola! Soy el asistente de IA del SLEP Andalién Sur</h3>
      <p>Resuelvo dudas sobre el uso de la inteligencia artificial en tu trabajo educativo y te ayudo a <strong>diseñar material con IA</strong> de forma ética, segura y pertinente.</p>
      <p>Antes de comenzar, cuéntame un poco de ti para responderte de forma pertinente. Solo lo usaré durante esta conversación.</p></div></div>
      <div class="aviso-privacidad">🔒 <span><strong>Cuida los datos personales:</strong> no escribas nombres, RUT, correos, teléfonos, direcciones ni datos de salud
      o situaciones personales de estudiantes, familias o funcionarios (Ley 21.719). Describe las situaciones en forma general.</span></div>`);
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
      case "cargo": {
        const rol = p.rol;
        agregar("bot", titulo("¿Cuál describe mejor tu cargo o función?") +
          `<p>Así mis sugerencias se ajustarán a tus funciones y a la normativa que rige tu cargo.</p>` +
          chips(perfilesDelRol(rol).map((x) => ({ accion: "wizard", valor: "cargo:" + x.id, etiqueta: x.nombre })), rol === "slep" ? "Área o unidad del Servicio" : "") +
          chips([{ accion: "wizard", valor: "otro", etiqueta: "✍️ Otro: escribir mi cargo" }, { accion: "wizard", valor: "-", etiqueta: "Prefiero no indicar" }]));
        break;
      }
      case "cargoOtro":
        agregar("bot", `<p>Escribe tu cargo o función (por ejemplo: <em>"coordinador/a de educación parvularia"</em>). Sin tu nombre.</p>`);
        break;
      case "alcanceSlep":
        agregar("bot", titulo("¿Con qué establecimientos quieres trabajar?") +
          `<p>Puedes trabajar con todo el Servicio, con una comuna o con los establecimientos que elijas.</p>` +
          chips([
            { accion: "wizard", valor: "todos", etiqueta: `🏛️ Todos los establecimientos (${ESTABLECIMIENTOS.length})`, primario: true },
            { accion: "wizard", valor: "comuna", etiqueta: "📍 Los de una comuna" },
            { accion: "wizard", valor: "elegidos", etiqueta: "🏫 Elegir uno o más establecimientos" },
            { accion: "wizard", valor: "interna", etiqueta: "🗂️ Gestión interna del Servicio" }
          ]));
        break;
      case "comunaSlep":
        agregar("bot", titulo("¿Qué comuna?") + chips(Object.keys(COMUNAS).map((c) => ({ accion: "wizard", valor: c,
          etiqueta: `${c} (${ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === normalizar(c)).length})` }))));
        break;
      case "multiEst": {
        const elegidos = (p.estIds || []).map((id) => ESTABLECIMIENTOS.find((e) => e.id === id)).filter(Boolean);
        agregar("bot", (elegidos.length
            ? `<p>✅ Elegidos (${elegidos.length}): <strong>${elegidos.map((e) => escapar(e.nombre)).join(", ")}</strong>.</p><p>Escribe otro nombre, elige una comuna para ver su lista o presiona <strong>Listo</strong>.</p>`
            : titulo("¿Qué establecimientos?") + `<p>Escribe el nombre de uno (no importa si no recuerdas el nombre exacto) o elige una comuna para ver su lista.</p>`) +
          chips(Object.keys(COMUNAS).map((c) => ({ accion: "wizard", valor: c, etiqueta: "📍 " + c }))) +
          (elegidos.length ? chips([{ accion: "wizard", valor: "listo", etiqueta: "✅ Listo", primario: true }]) : ""));
        break;
      }
      case "multiLista": {
        const ya = new Set(p.estIds || []);
        const lista = ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === normalizar(wizard.comunaLista || "") && !ya.has(e.id))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        agregar("bot", `<p>Establecimientos de <strong>${escapar(wizard.comunaLista)}</strong>. Toca los que quieras agregar (uno por vez):</p>` +
          chips(lista.map((e) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: e.nombre }))) +
          chips([{ accion: "wizard", valor: "todos-comuna", etiqueta: `➕ Agregar todos los de ${wizard.comunaLista}` },
            { accion: "wizard", valor: "listo", etiqueta: "✅ Listo", primario: true }]));
        break;
      }
      case "multiConfirmar":
        agregar("bot", `<p>No encontré exactamente «${escapar(wizard.buscado)}». ¿Te refieres a ${wizard.opciones.length === 1 ? "este" : "alguno de estos"}?</p>` +
          chips(wizard.opciones.map((e, i) => ({ accion: "wizard", valor: "id:" + e.id, etiqueta: `${e.nombre}${e.comuna ? " (" + e.comuna + ")" : ""}`, primario: i === 0 }))) +
          chips([{ accion: "wizard", valor: "otro-nombre", etiqueta: "Ninguno: escribir de nuevo" }]));
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
          `<p>Puedes usarlas o <strong>escribir las tuyas</strong>, que suelen ser mejores: la realidad del barrio o sector, sus organizaciones, los oficios y actividades productivas de las familias, un espacio natural cercano o una tradición local.</p>` +
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
    if (p.alcanceSlep) { trasUbicacion(); return; }   // nivel central: ya indicó con qué establecimientos trabaja
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
        .concat(sug)
        .concat([{ accion: "escribir", valor: "x", etiqueta: "✍️ Otro: escribir lo que necesito" }])));
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
        let rol = ROLES[valor] ? valor : Object.keys(ROLES).find((k) => normalizar(ROLES[k].nombre).includes(normalizar(valor)) || normalizar(valor).includes(normalizar(ROLES[k].corto)));
        const det = !rol ? detectarRolCargo(normalizar(valor)) : null;   // escrito con sus palabras: "soy jefa de UTP"
        if (det) rol = det.rol;
        if (!rol) { agregar("bot", `<p>Elige una de las opciones o escríbelo con tus palabras (por ejemplo, <em>"soy jefa de UTP"</em>):</p>` + chipsRoles()); return; }
        d.rol = rol; guardarPerfil({ rol, cargo: "", cargoId: "", alcanceSlep: "", estIds: [] });
        const cargoDet = det && det.cargoId && PERFILES.find((x) => x.id === det.cargoId);
        if (cargoDet) guardarPerfil({ cargoId: cargoDet.id, cargo: cargoDet.nombre });
        if (wizard.soloPerfil) { preguntar(!cargoDet && perfilesDelRol(rol).length ? "cargo" : (rol === "slep" ? "alcanceSlep" : "estInicio")); return; }
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
      case "cargo": {
        const siguiente = () => preguntar(p.rol === "slep" ? "alcanceSlep" : "estInicio");
        if (valor === "otro") { wizard.n--; preguntar("cargoOtro"); return; }
        if (omitido) { siguiente(); return; }
        const det = !valor.startsWith("cargo:") ? detectarRolCargo(normalizar(valor)) : null;
        const x = valor.startsWith("cargo:") ? PERFILES.find((c) => c.id === valor.slice(6))
          : perfilesDelRol(p.rol).find((c) => normalizar(c.nombre).includes(normalizar(valor)))
            || (det && det.cargoId && det.rol === p.rol ? PERFILES.find((c) => c.id === det.cargoId) : null);
        if (x) guardarPerfil({ cargoId: x.id, cargo: x.nombre }); else guardarPerfil({ cargo: valor.slice(0, 120), cargoId: "" });
        siguiente(); return;
      }
      case "cargoOtro":
        guardarPerfil({ cargo: valor.slice(0, 120), cargoId: "" });
        preguntar(p.rol === "slep" ? "alcanceSlep" : "estInicio"); return;
      case "alcanceSlep":
        if (valor === "todos") { guardarPerfil({ alcanceSlep: "todos", alcance: "Todos los establecimientos del Servicio" }); terminarPerfil(); return; }
        if (valor === "interna") { guardarPerfil({ alcanceSlep: "interna", alcance: "Gestión interna del Servicio" }); terminarPerfil(); return; }
        if (valor === "comuna" || COMUNAS[valor]) { if (COMUNAS[valor]) { wizard.paso = "comunaSlep"; avanzarWizard(valor); return; } preguntar("comunaSlep"); return; }
        guardarPerfil({ alcanceSlep: "elegidos", estIds: [] }); preguntar("multiEst"); return;
      case "comunaSlep": {
        const c = Object.keys(COMUNAS).find((k) => normalizar(k) === normalizar(valor));
        if (!c) { preguntar("comunaSlep"); return; }
        guardarPerfil({ alcanceSlep: "comuna", comuna: c, alcance: "Establecimientos de " + c }); terminarPerfil(); return;
      }
      case "multiEst":
      case "multiLista":
      case "multiConfirmar": {
        const ids = (p.estIds || []).slice();
        const cerrar = () => {
          if (!ids.length) { guardarPerfil({ alcanceSlep: "todos", alcance: "Todos los establecimientos del Servicio" }); terminarPerfil(); return; }
          guardarPerfil({ estIds: ids, alcance: ids.length === 1 ? "1 establecimiento elegido" : ids.length + " establecimientos elegidos" }); terminarPerfil();
        };
        const agregarId = (id) => { if (!ids.includes(id)) ids.push(id); guardarPerfil({ estIds: ids }); };
        if (valor === "listo") { cerrar(); return; }
        if (valor === "otro-nombre") { wizard.n--; preguntar("multiEst"); return; }
        if (COMUNAS[valor]) { wizard.comunaLista = valor; wizard.n--; preguntar("multiLista"); return; }
        if (valor === "todos-comuna") {
          ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === normalizar(wizard.comunaLista || "")).forEach((e) => agregarId(e.id));
          wizard.n--; preguntar("multiEst"); return;
        }
        if (valor.startsWith("id:")) { agregarId(valor.slice(3)); wizard.n--; preguntar(wizard.paso === "multiLista" ? "multiLista" : "multiEst"); return; }
        // Nombre escrito: búsqueda tolerante a errores
        const res = buscarEstablecimiento(valor);
        if (res.length && res[0].puntaje >= 0.97 && (res.length === 1 || res[1].puntaje < 0.9)) { agregarId(res[0].e.id); wizard.n--; preguntar("multiEst"); return; }
        if (res.length) { wizard.buscado = valor; wizard.opciones = res.map((r) => r.e); wizard.n--; preguntar("multiConfirmar"); return; }
        agregar("bot", `<p>No encontré «${escapar(valor)}» entre los establecimientos registrados. Escríbelo de otra forma o elige una comuna para ver la lista.</p>`);
        return;
      }
      case "estInicio":
        if (COMUNAS[valor]) { d.comuna = valor; guardarPerfil({ comuna: valor }); wizard.n--; preguntar("listaEst"); return; }
        if (valor === "Otra comuna") { wizard.n--; preguntar("otraComuna"); return; }
        if (omitido) { preguntar("alcance"); return; }
        if (valor === "slep") { guardarPerfil({ establecimiento: "SLEP Andalién Sur (nivel central)", estId: "" }); preguntar("alcanceSlep"); return; }
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

  /* Datos numéricos del PAL que vienen en las características de cada establecimiento */
  function datosPAL(est) {
    const t = String(est.caracteristicas || "");
    const m = (re) => { const x = t.match(re); return x ? aNumero(x[1]) : null; };
    return { matricula: m(/matr[ií]cula 2025:\s*([\d.]+)/i), cursos: m(/(\d+)\s+cursos/i), pie: m(/PIE \(aprox\.\s*(\d+)%\)/i),
      variacion: m(/variaci[oó]n de matr[ií]cula[^:]*:\s*(-?[\d.,]+)\s*%/i), cambioAnual: m(/matr[ií]cula 2025:\s*[\d.]+\s*\(([-+]?\d+)/i) };
  }
  function graficoPAL(est) {
    const d = datosPAL(est), cifras = [];
    if (d.matricula !== null) cifras.push({ etiqueta: "Matrícula 2025", valor: d.matricula });
    if (d.cursos !== null) cifras.push({ etiqueta: "Cursos", valor: d.cursos });
    if (d.pie !== null) cifras.push({ etiqueta: "Estudiantes en PIE (aprox.)", valor: d.pie, unidad: "%" });
    if (d.variacion !== null) cifras.push({ etiqueta: "Variación de matrícula 2020–2026 (proyectada)", valor: d.variacion, unidad: "%" });
    return cifras.length ? graficoHTML({ tipo: "cifras", titulo: "Datos del establecimiento", cifras, fuente: "Plan Anual Local 2026, SLEP Andalién Sur", _sello: "✅ Datos oficiales del Plan Anual Local" }) : "";
  }
  function graficoMatricula(lista, titulo, destacar) {
    const con = lista.map((e) => ({ e, v: datosPAL(e).matricula })).filter((x) => x.v !== null).sort((a, b) => b.v - a.v);
    if (con.length < 2) return "";
    return graficoHTML({ tipo: "barras-h", titulo, subtitulo: "Estudiantes por establecimiento", destacar: destacar || "", etiquetas: con.map((x) => x.e.nombre), series: [{ nombre: "Matrícula 2025", datos: con.map((x) => x.v) }],
      fuente: "Plan Anual Local 2026, SLEP Andalién Sur", _sello: "✅ Datos oficiales del Plan Anual Local" });
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
    // PEI: cada parte con su botón "Copiar"
    const pei = PEI_PARTES.filter(([k]) => est[k]).map(([k, ico, t]) =>
      `<div class="pei-bloque"><strong>${ico} ${t}</strong><button class="btn-copiar" type="button">Copiar</button><p>${escapar(est[k])}</p></div>`).join("");
    return `<h3>🏫 ${escapar(est.nombre)}</h3>` +
      markdown([est.comuna ? `**Comuna:** ${est.comuna}` : "", est.entorno ? `**Entorno:** ${est.entorno}` : "", est.niveles ? `**Niveles:** ${est.niveles}` : "",
        est.caracteristicas ? `\n${est.caracteristicas}` : ""].filter(Boolean).join("\n")) + graficoPAL(est) +
      (pei || est.pei ? `<h4 class="titulo-sec"><span class="ico-sec" style="--c:#4fa61a"></span>Proyecto Educativo Institucional (PEI)</h4>${pei}` +
        (est.pei ? `<p>📄 <a href="${escapar(est.pei)}" target="_blank" rel="noopener" class="ref-oficial">Ver el PEI completo</a></p>` : "") : "") +
      (enlaces ? markdown(`**Enlaces:**\n${enlaces}`) : "") +
      `<div class="nota">Fuente: Plan Anual Local, PEI y registros del equipo del Servicio. Usaré estos elementos (sin el nombre del colegio) para adaptar mis sugerencias a su misión, visión y sellos.</div>` +
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

  /* ---- Respuestas escritas durante las preguntas (sin tocar las opciones) ---- */
  // Si el texto corresponde a una de las opciones del último mensaje, devuelve su valor
  function chipCoincidente(n) {
    const ult = el.mensajes.lastElementChild;
    if (!ult || n.length < 4) return null;
    let mejor = null;
    ult.querySelectorAll('button[data-accion="wizard"]').forEach((b) => {
      const lab = normalizar(b.textContent).replace(/\(\d+\)/g, "").trim();
      if (lab.length < 3) return;
      if (lab === n || lab.includes(n) || (lab.length >= 5 && n.includes(lab) && n.split(" ").length <= lab.split(" ").length + 1)) { if (!mejor || lab.length > mejor.l) mejor = { v: b.dataset.valor, l: lab.length }; }
    });
    return mejor ? mejor.v : null;
  }
  const RE_CONSULTA = /^(que|como|cual|cuales|donde|cuando|por que|porque|puedo|se puede|necesito|quiero|quisiera|ayudame|ayuda|me puedes|podrias|puedes|dame|hazme|haz|crea|creame|genera|elabora|redacta|disena|explica|explicame|tengo una (duda|consulta)|una consulta|consulta|ideas|sugiere|sugerencias|recomienda)\b/;
  // Pasos donde se espera texto libre: ahí lo escrito siempre es la respuesta
  const PASOS_LIBRES = ["tema", "oa", "proposito", "contexto", "cargoOtro", "otraComuna", "referencias"];
  // Pasos con opciones fijas: lo que no coincide con una opción se trata como consulta
  const PASOS_FIJOS = ["alcance", "alcanceSlep", "comunaSlep", "entorno", "tipo"];
  function esConsultaFueraDelPaso(n) {
    const paso = wizard && wizard.paso;
    if (!paso || PASOS_LIBRES.includes(paso)) return false;
    const palabras = n.split(" ").length;
    const consulta = RE_CONSULTA.test(n) || palabras >= 9;
    if (paso === "rol") return !RE_SALUDO.test(n) && !detectarRolCargo(n);
    if (PASOS_FIJOS.includes(paso)) return consulta || palabras > 5;
    return consulta && palabras >= 3;   // nombre de colegio, cargo, nivel, asignatura, etc.
  }
  // Reconoce rol (y si se puede, el cargo) en lo que la persona escribe: "soy jefa de UTP", "trabajo en finanzas del SLEP"
  const CLAVES_CARGO = [
    [/\b(director(a)? ejecutiv|subdirector)/, "slep-direccion"], [/\b(asesor(a)?|atp)\b.*(tecnico|pedagog)|\batp\b/, "slep-atp"],
    [/planificacion y control|control de gestion/, "slep-planificacion"], [/finanzas|presupuesto|contabilidad|compras publicas|abastecimiento/, "slep-finanzas"],
    [/gestion de personas|recursos humanos|\brrhh\b|remuneraciones/, "slep-personas"], [/juridic|abogad/, "slep-juridica"],
    [/infraestructura|mantencion/, "slep-infra"], [/comunicaciones|periodist|vinculacion/, "slep-comunicaciones"],
    [/informatic|tecnologias de la informacion|soporte tecnico/, "slep-ti"],
    [/\butp\b|unidad tecnico pedagogica|jefe(a)? tecnic/, "dir-utp"], [/inspector(a)? general/, "dir-inspector"], [/orientador(a)?/, "dir-orientador"],
    [/\bdirector(a)?\b/, "dir-director"],
    [/convivencia/, "asi-convivencia"], [/psicolog|fonoaudiolog|terapeuta|kinesiolog|psicopedagog/, "asi-pie"], [/trabajador(a)? social|dupla/, "asi-dupla"],
    [/tecnic[oa] en (educacion )?parvul|asistente de aula/, "asi-tecnico"], [/paradocente|inspector(a)? de patio/, "asi-paradocente"],
    [/biblioteca|\bcra\b/, "asi-cra"], [/auxiliar/, "asi-auxiliar"],
    [/profesor(a)? jefe/, "doc-jefatura"], [/educador(a)? de parvulos|educadora/, "doc-parvularia"], [/diferencial/, "doc-diferencial"],
    [/tecnico profesional|especialidad/, "doc-tp"], [/\b(profesor|profesora|docente)\b/, "doc-aula"]
  ];
  function detectarRolCargo(n) {
    const panel = PERFILES.find((x) => normalizar(x.nombre).length > 5 && n.includes(normalizar(x.nombre)));
    if (panel) return { rol: panel.rol, cargoId: panel.id };
    const c = CLAVES_CARGO.find(([re]) => re.test(n));
    const x = c && PERFILES.find((p) => p.id === c[1]);
    if (x) return { rol: x.rol, cargoId: x.id };
    if (/\b(slep|servicio local|nivel central)\b/.test(n)) return { rol: "slep" };
    if (/\basistente\b/.test(n)) return { rol: "asistente" };
    if (/\bdirectiv/.test(n)) return { rol: "directivo" };
    return null;
  }

  async function procesar(texto, { omitirRevision = false, directo = false, estMencionado = null, yaMostrado = false } = {}) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    const n = normalizar(texto);

    // Respuestas dentro del asistente de prompts
    if (wizard && !RE_WIZARD.test(n)) {
      // Escribir el nombre de una opción equivale a tocarla
      const chip = chipCoincidente(n);
      if (chip) { agregarUsuario(texto); avanzarWizard(chip); return; }
      // Si escribió una consulta en vez de responder, se responde la consulta (no se obliga a marcar una opción)
      if (esConsultaFueraDelPaso(n)) {
        const eraInicio = !!wizard.inicio;
        wizard = null;
        if (eraInicio) { enInicio = false; el.sugerencias.hidden = false; }
        return procesar(texto, { omitirRevision, directo, estMencionado, yaMostrado });
      }
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

    // "Envíalo por WhatsApp", "mándalo por correo", "descárgalo en PDF": se ofrece sobre la última respuesta con contenido
    // Debe referirse a algo ya entregado ("envíalo", "comparte esto", "la respuesta") y no a redactar algo nuevo
    const refiereAnterior = /\b(envi|mand|compart|reenvi|pas)\w*(lo|la|los|las|melo|mela)\b|\b(esto|esta|este|eso|esa|ese|la respuesta|el material|la informacion|el documento|el resumen|lo anterior|la anterior)\b/.test(n);
    const pideEnviar = refiereAnterior && /\b(envi|mand|compart|reenvi|pas)\w*/.test(n) && /\b(whats ?app|wsp|wasap|wa|correo|e-?mail|mail|gmail|outlook)\b/.test(n);
    const pidePDF = /\bpdf\b/.test(n) && /\b(descarg|baj|export|guard|imprim|pas|conviert|dame|quiero|necesito|genera)\w*/.test(n) && (refiereAnterior || n.split(" ").length <= 6);
    if (pideEnviar || pidePDF) {
      const objetivo = [...el.mensajes.querySelectorAll(".msg.bot")].reverse().find((m) => m.querySelector(".acciones-msg"));
      if (objetivo) {
        const canal = /whats|wsp|wasap|\bwa\b/.test(n) ? "WhatsApp" : /correo|mail|gmail|outlook/.test(n) ? "correo" : "PDF";
        agregar("bot", `<p>Listo 👍 Puedes ${canal === "PDF" ? "descargar en <strong>PDF</strong>" : "enviar por <strong>" + canal + "</strong>"} la respuesta «${escapar(tituloMsg(objetivo))}». ` +
          `Elige una opción (se abrirá ${canal === "PDF" ? "la ventana para guardar el PDF" : "la aplicación para que elijas el destinatario"}):</p>` +
          accionesMsg(objetivo.dataset.id) +
          `<div class="nota">🔒 Antes de enviar, revisa que no incluya datos personales de estudiantes, familias o funcionarios.</div>`, { guardar: false });
        return;
      }
      agregar("bot", `<p>Aún no hay una respuesta para ${pidePDF ? "descargar" : "enviar"}. Hazme tu consulta o pide el material, y luego usa los botones <strong>📄 PDF</strong>, <strong>WhatsApp</strong> o <strong>✉️ Correo</strong> que aparecen bajo la respuesta.</p>`);
      return;
    }

    // "Diseñar un material" a secas abre el paso a paso; si ya viene con detalles ("ayúdame a crear una guía de fracciones
    // para 5° básico"), se responde directamente y el paso a paso queda como opción
    if (RE_WIZARD.test(n) && n.split(" ").length <= 6) { iniciarWizard(); return; }
    if (RE_PERFIL.test(n)) { iniciarWizard(true); return; }
    if (RE_MIEST.test(n)) { agregar("bot", respuestaMiEstablecimiento()); return; }
    // "¿Qué establecimientos hay en Florida?": lista exacta desde el PAL (sin pasar por la IA)
    // "Gráfico con los datos de mi establecimiento": cifras del PAL + comparación con la comuna (sin pasar por la IA)
    const estPropio = estDePerfil(leerPerfil());
    if (estPropio && /\bgrafic|\bgraf\b|\bchart\b|\bvisualiz/.test(n) && /\b(mi|mis|nuestro|nuestra)\s+(establecimiento|colegio|escuela|liceo|jardin|datos)\b|\bdatos de(l)? (mi )?(establecimiento|colegio)/.test(n)) {
      const cifras = graficoPAL(estPropio);
      const deComuna = ESTABLECIMIENTOS.filter((e) => e.comuna && normalizar(e.comuna) === normalizar(estPropio.comuna || ""));
      const comp = graficoMatricula(deComuna, `Matrícula 2025 en ${estPropio.comuna || "la comuna"}`, estPropio.nombre);
      if (cifras || comp) {
        agregar("bot", `<p>Estos son los datos de <strong>${escapar(estPropio.nombre)}</strong> según el Plan Anual Local 2026${comp ? ", y su matrícula comparada con los demás establecimientos de la comuna (destacado en amarillo)" : ""}.</p>` +
          cifras + comp + `<p>¿Quieres graficar otros datos (asistencia, resultados, convivencia)? Escríbelos, por ejemplo: <em>"marzo 85, abril 88, mayo 90"</em>, y armo el gráfico.</p>`);
        return;
      }
    }
    // "Gráfico de matrícula de Florida": se responde con los datos oficiales del PAL (sin pasar por la IA)
    if (/\bgrafic|\bgraf\b|\bchart\b/.test(n) && /\bmatricula/.test(n)) {
      const com = Object.keys(COMUNAS).find((c) => n.includes(normalizar(c)));
      const p = leerPerfil() || {};
      const lista = com ? ESTABLECIMIENTOS.filter((e) => normalizar(e.comuna) === normalizar(com)) : (p.alcanceSlep ? estsSlep(p) : ESTABLECIMIENTOS);
      const g = graficoMatricula(lista, `Matrícula 2025 · ${com || (p.alcanceSlep === "elegidos" ? "establecimientos elegidos" : p.alcanceSlep === "comuna" ? p.comuna : "SLEP Andalién Sur")}`);
      if (g) {
        agregar("bot", `<p>Este es el gráfico con la <strong>matrícula 2025</strong> según el Plan Anual Local. Puedes cambiar el tipo de gráfico con los botones de arriba o descargarlo en PDF.</p>${g}`);
        return;
      }
    }
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
        graficoMatricula(lista, `Matrícula 2025 · ${comuna}`) +
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
        const delPerfil = perfilSesion && res.find((r) => r.e.id === perfilSesion.estId);
        // Si ya pasó la etapa del perfil (eligió colegio o la omitió), no se vuelve a preguntar por establecimientos
        const perfilListo = !!perfilSesion && !enInicio;
        if (exacto) { estMencionado = res[0].e; }
        else if (delPerfil) { estMencionado = delPerfil.e; }   // es su propio colegio: no hace falta preguntar
        else if (perfilListo) { /* nombre aproximado: se responde sin interrumpir */ }
        else {
          pendiente = { texto, candidatos: res.map((r) => r.e.id) };
          agregar("bot", `<p>Creo que mencionas un establecimiento, pero no lo encontré escrito así. Para no suponer, ¿te refieres a ${res.length === 1 ? "este" : "alguno de estos"}?</p>` +
            chips(res.map((r, i) => ({ accion: "mencion", valor: r.e.id, etiqueta: `${r.e.nombre}${r.e.comuna ? " (" + r.e.comuna + ")" : ""}`, primario: i === 0 }))
              .concat([{ accion: "mencion", valor: "-", etiqueta: "Ninguno, responder igual" }])));
          return;
        }
      }
    }

    // ¿Pide un material? Se responde igual y se ofrece armarlo paso a paso (opcional)
    let ofrecerPaso = false;
    if (!directo) {
      const pedido = detectarPedido(n) || (RE_WIZARD.test(n) ? { tipo: null, tema: "" } : null);
      if (pedido) {
        // Se responde de inmediato (la IA pregunta lo que falte); armarlo paso a paso queda como opción, sin obligar a elegir
        pendiente = { texto, pedido, estMencionado };
        ofrecerPaso = true;
      }
    }
    const extra = ofrecerPaso ? chips([{ accion: "pedido-paso", valor: "x", etiqueta: "✏️ Prefiero armarlo paso a paso" }]) : "";

    if (!MODO_IA) {
      agregar("bot", (estMencionado ? tarjetaEstablecimiento(estMencionado) : "") + respuestaLocal(texto) + extra);
      return;
    }

    ocupado = true; el.enviar.disabled = true;
    const espera = mostrarEscribiendo();
    try {
      const html = await respuestaIA(texto, estMencionado);
      espera.remove();
      agregar("bot", html + extra);
    } catch (e) {
      espera.remove();
      agregar("bot", respuestaLocal(texto) + `<div class="nota">No pude conectar con el servicio de IA, así que te respondo con los manuales. (${escapar(e.message)})</div>`);
    } finally {
      ocupado = false; el.enviar.disabled = false; el.entrada.focus();
    }
  }

  /* ================================================================
     9b. COMPARTIR (WhatsApp, correo, copiar) Y DESCARGAR EN PDF
     ================================================================ */
  const ICONO_WA = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;
  const accionesMsg = (ref) => `<div class="acciones-msg" role="group" aria-label="Compartir o descargar esta respuesta">` +
    `<button type="button" class="acc" data-accion="msg-pdf"${ref ? ` data-ref="${ref}"` : ""}>📄 PDF</button>` +
    `<button type="button" class="acc acc-wa" data-accion="msg-wa"${ref ? ` data-ref="${ref}"` : ""}>${ICONO_WA} WhatsApp</button>` +
    `<button type="button" class="acc" data-accion="msg-mail"${ref ? ` data-ref="${ref}"` : ""}>✉️ Correo</button>` +
    `<button type="button" class="acc" data-accion="msg-copiar"${ref ? ` data-ref="${ref}"` : ""}>📋 Copiar</button>` +
    (navigator.share ? `<button type="button" class="acc" data-accion="msg-compartir"${ref ? ` data-ref="${ref}"` : ""}>↗️ Más</button>` : "") + `</div>`;

  function aviso(texto) {   // mensaje breve flotante
    const t = document.createElement("div"); t.className = "aviso-flotante"; t.textContent = texto;
    document.body.appendChild(t); setTimeout(() => t.classList.add("visible"), 10);
    setTimeout(() => { t.classList.remove("visible"); setTimeout(() => t.remove(), 400); }, 3200);
  }
  // Contenido de una respuesta, sin botones ni elementos de la interfaz
  function contenidoMsg(msg) {
    const c = msg.querySelector(".burbuja").cloneNode(true);
    c.querySelectorAll(".acciones-msg, .chips, .g-tipos, .g-ver-datos, .g-desde-tabla, .ver-prompt, .video-yt.verificando, .btn-copiar, .escribiendo").forEach((x) => x.remove());
    return c;
  }
  function tituloMsg(msg) {
    const h = msg.querySelector(".burbuja h3, .burbuja h4, .burbuja .g-titulo b");
    if (h && h.textContent.trim().length > 3) return h.textContent.replace(/^[^\wÁÉÍÓÚÑáéíóúñ¿¡]+/, "").trim().slice(0, 90);
    const q = preguntaDe(msg); return q ? corto(q, 90) : "Respuesta del Asistente IA";
  }
  function preguntaDe(msg) {   // la consulta que originó la respuesta
    let p = msg.previousElementSibling;
    while (p && !p.classList.contains("user")) p = p.previousElementSibling;
    return p ? p.textContent.trim() : "";
  }
  function resumenGrafico(g, fuerte) {
    const t = (g.querySelector(".g-titulo b") || {}).textContent || "Gráfico";
    const filas = [...g.querySelectorAll(".g-tabla tr")].slice(1).map((tr) => [...tr.children].map((c) => c.textContent.trim()));
    const gf = g.querySelector(".g-fuente"), cf = gf ? gf.cloneNode(true) : null;
    if (cf) cf.querySelectorAll(".g-sello, a").forEach((x) => x.remove());
    const fuente = cf ? cf.textContent.replace(/·\s*$/, "").trim() : "";
    return `📊 ${fuerte ? "*" + t + "*" : t}\n` + filas.map((f) => `• ${f[0]}: ${f.slice(1).join(" / ")}`).join("\n") + (fuente ? `\n(${fuente})` : "");
  }
  // Convierte una respuesta en texto ordenado (negrita con * para WhatsApp)
  function textoPlano(raiz, wa) {
    const fuerte = (t) => (t.trim() ? (wa ? `*${t.trim()}*` : t.trim()) : "");
    const rec = (n) => {
      if (n.nodeType === 3) return n.textContent.replace(/\s+/g, " ");
      if (n.nodeType !== 1) return "";
      if (n.matches("button, svg, script, style, .avatar, .pie-msg, .g-tabla, .chips")) return "";
      if (n.classList.contains("grafico")) return "\n" + resumenGrafico(n, wa) + "\n";
      if (n.classList.contains("video-yt")) {
        const tt = n.querySelector(".yt-pie strong"), canal = n.querySelector(".yt-canal");
        return tt ? `\n▶️ ${tt.textContent.trim()}${canal ? " — " + canal.textContent.replace(/.*Canal:\s*/, "Canal: ").trim() : ""}${n.dataset.video ? " https://youtu.be/" + n.dataset.video : ""}\n` : "";
      }
      const tag = n.tagName.toLowerCase(), hijos = [...n.childNodes].map(rec).join("");
      switch (tag) {
        case "h3": case "h4": case "figcaption": return `\n\n${fuerte(hijos)}\n`;
        case "p": case "div": case "section": case "figure": return hijos.trim() ? `\n${hijos.trim()}\n` : "";
        case "li": return `\n• ${hijos.trim()}`;
        case "ul": case "ol": return `\n${hijos}\n`;
        case "br": return "\n";
        case "strong": case "b": return fuerte(hijos) ? " " + fuerte(hijos) + " " : "";
        case "tr": return "\n" + [...n.children].map((c) => rec(c).trim()).join(" | ");
        case "table": return `\n${hijos}\n`;
        case "pre": return `\n${n.textContent}\n`;
        case "a": { const h = n.getAttribute("href") || ""; const t = hijos.trim(); return /^https?:/.test(h) && !t.includes(h) ? `${t} (${h})` : t; }
        default: return hijos;
      }
    };
    return rec(raiz).replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function textoParaEnviar(msg, wa, limite) {
    const titulo = tituloMsg(msg);
    let cuerpo = textoPlano(contenidoMsg(msg), wa);
    // Si el texto ya empieza con el título, no se repite
    const sinMarcas = (t) => normalizar(t.replace(/[*_]/g, ""));
    const primera = cuerpo.split("\n")[0];
    if (sinMarcas(primera) === sinMarcas(titulo)) cuerpo = cuerpo.slice(primera.length).trim();
    const enc = wa ? `*${titulo}*\n_Asistente IA · SLEP Andalién Sur_\n\n` : `${titulo}\nAsistente IA Educativa · SLEP Andalién Sur\n\n`;
    const pie = wa ? "\n\n_Elaborado con apoyo de IA. Verificar antes de usar._" : "\n\n—\nElaborado con apoyo de inteligencia artificial (Asistente IA Educativa, SLEP Andalién Sur). Verificar antes de usar.";
    let txt = enc + cuerpo;
    if (limite && txt.length > limite) txt = txt.slice(0, limite).replace(/\s+\S*$/, "") + "…\n\n(Texto resumido: descarga el PDF para ver la versión completa.)";
    return txt + pie;
  }
  async function copiarTexto(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }
  function compartirWhatsApp(msg) {
    window.open("https://wa.me/?text=" + encodeURIComponent(textoParaEnviar(msg, true, 3500)), "_blank", "noopener");
  }
  function compartirCorreo(msg) {
    // Los programas de correo aceptan textos de largo limitado en un enlace: si es largo, se resume y se sugiere adjuntar el PDF
    location.href = "mailto:?subject=" + encodeURIComponent(tituloMsg(msg) + " · SLEP Andalién Sur") + "&body=" + encodeURIComponent(textoParaEnviar(msg, false, 1700));
  }
  async function compartirNativo(msg) {
    try { await navigator.share({ title: tituloMsg(msg), text: textoParaEnviar(msg, false, 6000) }); } catch (e) { /* cancelado */ }
  }

  /* PDF: documento formal (membrete, datos, contenido ordenado, fuentes y nota de uso de IA).
     Se muestra como VISTA PREVIA dentro de la app (se cierra con ✕ o con «atrás»), se convierte en un
     PDF real (html2pdf.js, cargado solo cuando se usa) y se puede descargar o compartir como archivo. */
  const CSS_DOC = `
  .pdf-hoja { width: 186mm; background: #fff; color: #1d2633; font: 10.5pt/1.55 'Plus Jakarta Sans', system-ui, sans-serif; padding: 0; box-sizing: border-box; text-align: left;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdf-hoja * { box-sizing: border-box; }
  .pdf-hoja .doc-cab { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; position: relative; }
  .pdf-hoja .doc-cab::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; border-radius: 4px;
    background: linear-gradient(90deg, #0071ea 0 20%, #3abff0 20% 40%, #90d039 40% 60%, #f8d63c 60% 80%, #ff3c4c 80% 100%); }
  .pdf-hoja .doc-cab img { height: 50px; width: auto; }
  .pdf-hoja .doc-cab strong { display: block; font-size: 11.5pt; color: #0b2a55; }
  .pdf-hoja .doc-cab span { font-size: 8.5pt; color: #5a6678; }
  .pdf-hoja h1.doc-titulo { color: #0071ea; font-size: 19pt; line-height: 1.2; margin: 18px 0 10px; }
  .pdf-hoja table.doc-meta { width: 100%; border-collapse: collapse; margin: 0 0 12px; font-size: 9pt; }
  .pdf-hoja table.doc-meta th { text-align: left; width: 28%; color: #5a6678; font-weight: 700; padding: 4px 8px; background: #f3f7fd; border: 1px solid #e2e9f3; }
  .pdf-hoja table.doc-meta td { padding: 4px 8px; border: 1px solid #e2e9f3; }
  .pdf-hoja .doc-consulta { background: #eef7ff; border-left: 4px solid #3abff0; border-radius: 8px; padding: 9px 13px; margin: 0 0 16px; font-size: 10pt; }
  .pdf-hoja .doc-cuerpo { background: none !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; max-width: none !important; color: #1d2633; }
  .pdf-hoja .doc-cuerpo h3 { font-size: 13pt; color: #0b2a55; margin: 16px 0 6px; }
  .pdf-hoja .doc-cuerpo h4.titulo-sec { break-after: avoid; page-break-after: avoid; }
  .pdf-hoja .doc-cuerpo p, .pdf-hoja .doc-cuerpo li { orphans: 3; widows: 3; }
  .pdf-hoja .doc-cuerpo table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  .pdf-hoja .doc-cuerpo th { background: #0071ea; color: #fff; text-align: left; padding: 6px 8px; }
  .pdf-hoja .doc-cuerpo td { border: 1px solid #dfe6f0; padding: 5px 8px; }
  .pdf-hoja .doc-cuerpo tr:nth-child(even) td { background: #f7faff; }
  .pdf-hoja .doc-cuerpo .grafico, .pdf-hoja .doc-cuerpo .pei-bloque, .pdf-hoja .doc-cuerpo .nota, .pdf-hoja .doc-cuerpo .bloque-codigo, .pdf-hoja .doc-cuerpo tr { break-inside: avoid; page-break-inside: avoid; }
  .pdf-hoja .doc-cuerpo .grafico { box-shadow: none; background: #fff; }
  .pdf-hoja .doc-cuerpo .g-barra, .pdf-hoja .doc-cuerpo .g-cifra, .pdf-hoja .doc-cuerpo .g-punto { transform: none !important; opacity: 1 !important; transition: none !important; }
  .pdf-hoja .doc-cuerpo .g-val, .pdf-hoja .doc-cuerpo .g-area { opacity: 1 !important; transition: none !important; }
  .pdf-hoja .doc-cuerpo .g-linea { stroke-dashoffset: 0 !important; transition: none !important; }
  .pdf-hoja .doc-cuerpo .g-seg { transition: none !important; }
  .pdf-hoja .doc-cuerpo a { color: #0071ea; word-break: break-all; }
  .pdf-hoja .doc-cuerpo a.ref-oficial::after { content: ""; }
  .pdf-hoja .doc-cuerpo pre { white-space: pre-wrap; }
  .pdf-hoja .pdf-fuentes { font-size: 9pt; color: #5a6678; border-top: 1px solid #e2e9f3; padding-top: 6px; margin-top: 14px; }
  .pdf-hoja .pdf-video { font-size: 9.5pt; }
  /* Sin color-mix(): la librería que crea el PDF no lo reconoce */
  .pdf-hoja .ico-sec { background: var(--c) !important; box-shadow: none !important; }
  .pdf-hoja .g-cifra { background: #fff !important; }
  .pdf-hoja .doc-cuerpo tr:nth-child(odd) td { background: #fff !important; }
  .pdf-hoja .bloque-codigo pre { border: 1px solid #f3dc7a !important; border-left: 5px solid #f8d63c !important; }
  .pdf-hoja .fuente { background: #eef4fb !important; }
  .pdf-hoja .g-svg-circ, .pdf-hoja .g-barra, .pdf-hoja .g-linea { filter: none !important; }
  .pdf-hoja .grafico { background: #fff !important; }
  .pdf-hoja .doc-aviso { margin-top: 20px; padding: 10px 13px; border: 1px solid #e2e9f3; border-radius: 10px; background: #fbfcfe; font-size: 8.5pt; color: #5a6678; break-inside: avoid; page-break-inside: avoid; }`;

  // Arma el contenido del documento a partir de una respuesta del chat
  function partesDoc(msg) {
    const c = contenidoMsg(msg);
    c.querySelectorAll(".grafico").forEach((g) => {   // gráficos en su estado final
      g.classList.add("animado");
      const segs = g.querySelectorAll(".g-seg"), hueco = segs.length > 1 ? 0.7 : 0;
      segs.forEach((s) => { const p = +s.dataset.pct; s.style.strokeDasharray = `${Math.max(p - hueco, 0)} ${100 - p + hueco}`; });
      g.querySelectorAll(".g-num").forEach((n) => { n.textContent = fmtNum(+n.dataset.v, n.dataset.u); });
    });
    c.querySelectorAll(".video-yt").forEach((v) => {   // videos → referencia escrita con enlace
      const tt = v.querySelector(".yt-pie strong"), canal = v.querySelector(".yt-canal"), id = v.dataset.video;
      const p = document.createElement("p"); p.className = "pdf-video";
      p.innerHTML = tt ? `▶️ <strong>Video:</strong> ${escapar(tt.textContent)}${canal ? " — " + escapar(canal.textContent.replace(/.*Canal:\s*/, "Canal: ")) : ""}` +
        (id ? ` — <a href="https://www.youtube.com/watch?v=${id}">youtube.com/watch?v=${id}</a>` : "") : "";
      v.replaceWith(p);
    });
    c.querySelectorAll(".pie-msg").forEach((pm) => {   // etiquetas de fuente → línea formal
      const fuentes = [...pm.querySelectorAll(".fuente")].map((f) => f.textContent.replace(/^📘\s*/, "").trim()).filter(Boolean);
      const q = document.createElement("p"); q.className = "pdf-fuentes";
      q.innerHTML = fuentes.length ? `<strong>Fuentes consultadas:</strong> ${fuentes.map(escapar).join("; ")}.` : "";
      pm.replaceWith(q);
    });
    const titulo = tituloMsg(msg), pregunta = preguntaDe(msg), p = leerPerfil() || {};
    const ahora = new Date(), fecha = ahora.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    const filaMeta = (k, v) => (v ? `<tr><th>${k}</th><td>${escapar(v)}</td></tr>` : "");
    const nombre = normalizar(titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + ahora.toISOString().slice(0, 10) + ".pdf";
    const html =
      `<header class="doc-cab"><img src="logo-slep.png" alt="SLEP Andalién Sur"><div><strong>Servicio Local de Educación Pública Andalién Sur</strong><span>Asistente IA Educativa · Documento de trabajo</span></div></header>
      <h1 class="doc-titulo">${escapar(titulo)}</h1>
      <table class="doc-meta">${filaMeta("Fecha", fecha)}${filaMeta("Elaborado para", [p.rol && ROLES[p.rol] ? ROLES[p.rol].nombre : "", p.cargo].filter(Boolean).join(" · "))}${filaMeta("Establecimiento o alcance", [p.establecimiento, p.alcance].filter(Boolean).join(" · "))}</table>
      ${pregunta ? `<div class="doc-consulta"><strong>Consulta:</strong> ${escapar(pregunta)}</div>` : ""}
      <div class="burbuja doc-cuerpo">${c.innerHTML}</div>
      <section class="doc-aviso"><strong>Nota:</strong> documento elaborado con apoyo de inteligencia artificial mediante el Asistente IA Educativa del SLEP Andalién Sur. Su contenido es una propuesta que debe ser revisada por la persona responsable antes de usarse; verifique datos, normativa y fuentes. No incluye datos personales de estudiantes, familias ni funcionarios (Ley N° 21.719).</section>`;
    return { titulo, fecha, nombre, html };
  }

  // Los gráficos usan estilos de la hoja CSS: para convertirlos en imagen se copian como atributos
  function fijarEstilosSVG(raiz) {
    // Tamaño explícito: sin esto la librería dibuja el gráfico recortado y agrandado
    raiz.querySelectorAll("svg").forEach((s) => {
      const w = s.clientWidth, h = s.clientHeight;
      if (w && h) { s.setAttribute("width", w); s.setAttribute("height", h); s.style.width = w + "px"; s.style.height = h + "px"; }
    });
    raiz.querySelectorAll("svg *").forEach((n) => {
      const cs = getComputedStyle(n);
      ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "opacity", "font-size", "font-weight", "font-family"].forEach((k) => {
        const v = cs.getPropertyValue(k); if (v && v !== "normal") n.setAttribute(k, v);
      });
      n.style.transform = "none"; n.style.transition = "none";
    });
  }

  // Carga html2pdf.js (convierte la vista previa en PDF) solo la primera vez que se necesita
  let promesaHtml2pdf = null;
  function cargarHtml2pdf() {
    if (window.html2pdf) return Promise.resolve();
    if (!promesaHtml2pdf) {
      promesaHtml2pdf = new Promise((ok, mal) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        s.onload = () => ok(); s.onerror = () => { promesaHtml2pdf = null; mal(new Error("sin conexión")); };
        document.head.appendChild(s);
        setTimeout(() => mal(new Error("tiempo agotado")), 20000);
      });
    }
    return promesaHtml2pdf;
  }
  const conLimite = (promesa, ms) => Promise.race([promesa, new Promise((ok) => setTimeout(ok, ms))]);
  async function crearPDF(hoja, partes, avance) {
    avance && avance("⏳ Cargando el generador de PDF…");
    await cargarHtml2pdf();
    avance && avance("⏳ Armando el documento…");
    if (document.fonts) await conLimite(document.fonts.ready, 3000);
    await conLimite(Promise.all([...hoja.querySelectorAll("img")].map((i) => (i.complete ? 0 : new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })))), 4000);
    fijarEstilosSVG(hoja);
    // Resolución según el tamaño del documento y el equipo: en celulares una imagen muy grande lo deja pegado
    const movil = (window.innerWidth || 800) < 700 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const area = Math.max(1, hoja.offsetWidth * hoja.scrollHeight);
    const escala = Math.max(1, Math.min(movil ? 1.4 : 2, Math.sqrt((movil ? 6e6 : 12e6) / area)));
    avance && avance("⏳ Creando el PDF…");
    const trabajo = window.html2pdf().set({
      margin: [14, 12, 16, 12], filename: partes.nombre,
      image: { type: "jpeg", quality: 0.9 },
      html2canvas: { scale: escala, useCORS: true, backgroundColor: "#ffffff", logging: false, imageTimeout: 4000 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css"], avoid: [".grafico", ".pei-bloque", ".doc-aviso"] }
    }).from(hoja).toPdf();
    const pdf = await trabajo.get("pdf");
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {   // pie de página con número
      pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(122, 134, 150);
      pdf.text(`SLEP Andalién Sur · Asistente IA Educativa · ${partes.fecha}`, 12, 289);
      pdf.text(`Página ${i} de ${total}`, 198, 289, { align: "right" });
    }
    return pdf.output("blob");
  }

  /* Vista previa dentro de la app: no abre otra pestaña y se cierra con ✕, Esc o «atrás» */
  let vista = null;
  function abrirVistaPDF(msg, intencion) {
    cerrarVistaPDF(true);
    const partes = partesDoc(msg);
    const v = document.createElement("div");
    v.className = "pdf-vista"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Vista previa del PDF");
    v.innerHTML = `<style>${CSS_DOC}</style>
      <div class="pdf-barra">
        <button type="button" class="pdf-cerrar" data-pdf="cerrar" aria-label="Cerrar vista previa">✕ Cerrar</button>
        <span class="pdf-estado">⏳ Preparando el PDF…</span>
        <div class="pdf-botones">
          <button type="button" data-pdf="bajar" disabled>⬇️ Descargar</button>
          <button type="button" data-pdf="wa" class="pdf-wa" disabled>${ICONO_WA} WhatsApp</button>
          <button type="button" data-pdf="mail" disabled>✉️ Correo</button>
          ${navigator.share ? `<button type="button" data-pdf="mas" disabled>↗️ Más</button>` : ""}
          <button type="button" data-pdf="imprimir" title="Imprimir o guardar como PDF desde el navegador">🖨️</button>
        </div>
      </div>
      <div class="pdf-correo" hidden></div>
      <div class="pdf-lienzo"><div class="pdf-escala"><div class="pdf-hoja">${partes.html}</div></div></div>`;
    document.body.appendChild(v);
    document.body.classList.add("con-vista-pdf");
    vista = { el: v, msg, partes, blob: null, intencion };
    // «Atrás» del teléfono cierra la vista previa en vez de salir de la app
    try { history.pushState({ vistaPDF: true }, ""); } catch (e) { /* sin historial */ }
    ajustarEscala();
    const actual = vista;
    const t0 = Date.now(), estado = v.querySelector(".pdf-estado");
    const avance = (t) => { if (vista === actual) estado.textContent = t; };
    const reloj = setInterval(() => { if (vista !== actual || actual.blob) return clearInterval(reloj);
      const s = Math.round((Date.now() - t0) / 1000); if (s >= 4) estado.textContent = estado.textContent.replace(/\s*\(\d+ s\)$/, "") + ` (${s} s)`; }, 1000);
    // Tiempo máximo: si el equipo tarda demasiado, se ofrecen alternativas en vez de quedar pegado
    const limite = new Promise((_, mal) => setTimeout(() => mal(new Error("tardó demasiado")), 35000));
    Promise.race([crearPDF(v.querySelector(".pdf-hoja"), partes, avance), limite]).then((blob) => {
      clearInterval(reloj);
      if (vista !== actual) return;
      actual.blob = blob;
      v.querySelectorAll(".pdf-botones button").forEach((b) => { b.disabled = false; });
      const kb = Math.max(1, Math.round(blob.size / 1024));
      v.querySelector(".pdf-estado").textContent = `✅ PDF listo (${kb} KB)`;
      const destino = { wa: "wa", mail: "mail", compartir: "mas", pdf: "bajar" }[intencion];
      const b = destino && v.querySelector(`[data-pdf="${destino}"]`);
      if (b) { b.classList.add("pulso"); b.focus(); if (destino === "mail") mostrarFormCorreo(); }
    }).catch((e) => {
      clearInterval(reloj);
      if (vista !== actual) return;
      estado.textContent = `No se pudo crear el PDF (${e.message}).`;
      // Alternativas: enviar el contenido como texto ordenado, o guardar como PDF desde el navegador
      const alt = document.createElement("div");
      alt.className = "pdf-alternativas";
      alt.innerHTML = `<button type="button" data-pdf="texto-wa">${ICONO_WA} Enviar como texto por WhatsApp</button>` +
        `<button type="button" data-pdf="texto-mail">✉️ Enviar como texto por correo</button>` +
        `<button type="button" data-pdf="imprimir">🖨️ Guardar como PDF (imprimir)</button>`;
      v.querySelector(".pdf-barra").appendChild(alt);
    });
  }
  function ajustarEscala() {
    if (!vista) return;
    const lienzo = vista.el.querySelector(".pdf-lienzo"), esc = vista.el.querySelector(".pdf-escala"), hoja = vista.el.querySelector(".pdf-hoja");
    const k = Math.min(1, (lienzo.clientWidth - 24) / hoja.offsetWidth);
    esc.style.transform = `scale(${k})`; esc.style.height = (hoja.offsetHeight * k) + "px"; esc.style.width = (hoja.offsetWidth * k) + "px";
  }
  window.addEventListener("resize", ajustarEscala);
  function cerrarVistaPDF(sinHistorial) {
    if (!vista) return;
    vista.el.remove(); vista = null;
    document.body.classList.remove("con-vista-pdf");
    if (!sinHistorial && history.state && history.state.vistaPDF) { try { history.back(); } catch (e) { /* nada */ } }
  }
  window.addEventListener("popstate", () => { if (vista) cerrarVistaPDF(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && vista) cerrarVistaPDF(); });

  const archivoPDF = () => new File([vista.blob], vista.partes.nombre, { type: "application/pdf" });
  const puedeCompartirArchivo = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [archivoPDF()] })); } catch (e) { return false; } };
  function bajarPDF() {
    const url = URL.createObjectURL(vista.blob), a = document.createElement("a");
    a.href = url; a.download = vista.partes.nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function compartirArchivo(texto) {
    try { await navigator.share({ files: [archivoPDF()], title: vista.partes.titulo, text: texto }); return true; }
    catch (e) { return e && e.name === "AbortError"; }   // cancelado por la persona: no es error
  }
  async function pdfWhatsApp() {
    const texto = `Te comparto el documento «${vista.partes.titulo}» (SLEP Andalién Sur).`;
    if (puedeCompartirArchivo()) {   // celular: menú para compartir con el PDF adjunto → elegir WhatsApp
      aviso("Elige WhatsApp en el menú para enviar el PDF");
      await compartirArchivo(texto);
      return;
    }
    // Computador sin esa opción: se descarga el PDF y se abre WhatsApp para adjuntarlo
    bajarPDF();
    window.open("https://wa.me/?text=" + encodeURIComponent(texto + " (adjunto el PDF)"), "_blank", "noopener");
    aviso("El PDF se descargó: en WhatsApp toca 📎 y adjúntalo");
  }

  /* Correo desde la misma aplicación: el Apps Script lo envía con el PDF adjunto */
  function mostrarFormCorreo() {
    const caja = vista.el.querySelector(".pdf-correo");
    if (!caja.hidden) { caja.querySelector("input").focus(); return; }
    caja.hidden = false;
    caja.innerHTML = `<form class="form-correo">
        <strong>✉️ Enviar por correo con el PDF adjunto</strong>
        <label>Para <small>(hasta 5 correos, separados por coma)</small><input type="text" name="para" inputmode="email" autocomplete="email" placeholder="nombre@andaliensur.cl" required></label>
        <label>Asunto<input type="text" name="asunto" maxlength="150" value="${escapar(vista.partes.titulo)} · SLEP Andalién Sur"></label>
        <label>Mensaje<textarea name="mensaje" rows="3" maxlength="3000">Estimado/a:\n\nAdjunto el documento «${escapar(vista.partes.titulo)}», elaborado con el Asistente IA Educativa del SLEP Andalién Sur.\n\nSaludos cordiales.</textarea></label>
        <label>Tu correo, para que puedan responderte <small>(opcional)</small><input type="text" name="responder" inputmode="email" autocomplete="email"></label>
        <div class="form-correo-botones">
          <button type="submit" class="primario">📤 Enviar</button>
          <button type="button" data-pdf="mail-app">Usar mi app de correo</button>
          <button type="button" data-pdf="mail-cerrar">Cancelar</button>
        </div>
        <p class="form-correo-estado" aria-live="polite"></p>
      </form>`;
    caja.querySelector("input").focus();
    caja.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); enviarCorreoApp(e.target); });
  }
  const RE_CORREO = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
  async function enviarCorreoApp(form) {
    const estado = form.querySelector(".form-correo-estado");
    const para = form.para.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!para.length || para.length > 5 || !para.every((x) => RE_CORREO.test(x))) { estado.textContent = "⚠️ Revisa los correos de destino (máximo 5, separados por coma)."; return; }
    if (form.responder.value && !RE_CORREO.test(form.responder.value.trim())) { estado.textContent = "⚠️ Revisa tu correo para respuestas."; return; }
    if (revisarPrivacidad(form.mensaje.value).hallazgos.length) { estado.textContent = "⚠️ El mensaje parece incluir datos personales (RUT, teléfono o nombres con datos sensibles). Quítalos antes de enviar."; return; }
    if (!MODO_IA) { estado.textContent = "El envío directo necesita el servicio del asistente. Usa «Usar mi app de correo»."; return; }
    const boton = form.querySelector('button[type="submit"]'); boton.disabled = true; estado.textContent = "⏳ Enviando…";
    try {
      const b64 = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = mal; r.readAsDataURL(vista.blob); });
      const resp = await fetch(CONFIG.API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "enviar-correo", para, asunto: form.asunto.value, mensaje: form.mensaje.value, responder: form.responder.value.trim(), nombre: vista.partes.nombre, pdf: b64 }) });
      const d = await resp.json();
      if (!d.ok) throw new Error(d.error || "no se pudo enviar");
      estado.textContent = `✅ Correo enviado a ${para.join(", ")}.`;
      aviso("✅ Correo enviado con el PDF adjunto");
      setTimeout(() => { if (vista) vista.el.querySelector(".pdf-correo").hidden = true; }, 2500);
    } catch (e) {
      estado.textContent = /no reconocida/i.test(e.message)
        ? "El envío directo aún no está activado en el servicio (requiere actualizar el Apps Script). Usa «Usar mi app de correo»."
        : `No se pudo enviar (${e.message}). Puedes usar «Usar mi app de correo».`;
    } finally { boton.disabled = false; }
  }
  async function correoConMiApp() {
    if (puedeCompartirArchivo()) { await compartirArchivo(`Adjunto el documento «${vista.partes.titulo}» (SLEP Andalién Sur).`); return; }
    bajarPDF();
    location.href = "mailto:?subject=" + encodeURIComponent(vista.partes.titulo + " · SLEP Andalién Sur") +
      "&body=" + encodeURIComponent(`Estimado/a:\n\nAdjunto el documento «${vista.partes.titulo}», elaborado con el Asistente IA Educativa del SLEP Andalién Sur.\n\n(El PDF se descargó en tu equipo: adjúntalo a este correo.)\n\nSaludos cordiales.`);
    aviso("El PDF se descargó: adjúntalo al correo");
  }
  // Botones de la vista previa
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pdf]"); if (!b || !vista) return;
    const a = b.dataset.pdf;
    if (a === "cerrar") return cerrarVistaPDF();
    if (a === "imprimir") { window.print(); return; }   // la hoja de estilos de impresión muestra solo el documento
    if (a === "mail-cerrar") { vista.el.querySelector(".pdf-correo").hidden = true; return; }
    if (a === "texto-wa") { compartirWhatsApp(vista.msg); return; }   // alternativas si el PDF no se pudo crear
    if (a === "texto-mail") { compartirCorreo(vista.msg); return; }
    if (!vista.blob) return;
    b.classList.remove("pulso");
    if (a === "bajar") { bajarPDF(); aviso("⬇️ PDF descargado"); }
    else if (a === "wa") await pdfWhatsApp();
    else if (a === "mail") mostrarFormCorreo();
    else if (a === "mail-app") await correoConMiApp();
    else if (a === "mas") await compartirArchivo(`Documento «${vista.partes.titulo}» (SLEP Andalién Sur).`);
  });

  // Mensaje del chat al que corresponde un botón (el mismo, o el indicado con data-ref)
  const msgDe = (b) => (b.dataset.ref ? el.mensajes.querySelector(`.msg[data-id="${b.dataset.ref}"]`) : b.closest(".msg"));
  async function accionMensaje(accion, b) {
    const msg = msgDe(b); if (!msg) return;
    if (accion === "msg-copiar") { const ok = await copiarTexto(textoParaEnviar(msg, false)); aviso(ok ? "✅ Texto copiado" : "No se pudo copiar"); return; }
    // PDF, WhatsApp, correo y «Más» comparten el documento en PDF (más ordenado que un texto)
    abrirVistaPDF(msg, { "msg-pdf": "pdf", "msg-wa": "wa", "msg-mail": "mail", "msg-compartir": "compartir" }[accion]);
  }

  /* ================================================================
     10. CONTENIDO ACTUALIZABLE (panel de configuración → Apps Script)
     ================================================================ */
  function aplicarContenido(items) {
    if (!Array.isArray(items)) return;
    // Quita lo cargado antes desde el panel y vuelve a agregar
    for (let i = CONOCIMIENTO.length - 1; i >= 0; i--) if (CONOCIMIENTO[i].fuente === "SLEP" || CONOCIMIENTO[i].remoto) CONOCIMIENTO.splice(i, 1);
    // Vuelve a la base original antes de aplicar cambios (ediciones y eliminaciones del panel)
    ESTABLECIMIENTOS.splice(0, ESTABLECIMIENTOS.length, ...ESTABLECIMIENTOS_BASE.map((e) => Object.assign({}, e)));
    PERFILES.splice(0, PERFILES.length, ...PERFILES_BASE.map((x) => Object.assign({}, x)));
    items.forEach((it) => {
      if (it.eliminado) {   // colegio o perfil de base eliminado desde el panel
        const lista = it.tipo === "establecimiento" ? ESTABLECIMIENTOS : it.tipo === "perfil" ? PERFILES : null;
        if (lista) { const k = lista.findIndex((e) => e.id === it.id); if (k >= 0) lista.splice(k, 1); }
        return;
      }
      if (it.tipo === "perfil") {   // perfil de cargo (funciones del rol)
        const k = PERFILES.findIndex((x) => x.id === it.id);
        const perfil = { id: it.id, rol: ROLES[it.categoria] ? it.categoria : (k >= 0 ? PERFILES[k].rol : "slep"), nombre: it.titulo,
          texto: it.texto || "", normativa: it.claves || (k >= 0 ? PERFILES[k].normativa : ""), enlaces: it.enlaces || "" };
        if (k >= 0) PERFILES.splice(k, 1, perfil); else PERFILES.push(perfil);
        return;
      }
      const enlaces = String(it.enlaces || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => /^https?:\/\//.test(x[1] || x[0] || ""))
        .map((x) => (x.length > 1 ? { titulo: x[0], url: x[1] } : { titulo: x[0], url: x[0] }));
      if (it.tipo === "documento") {   // documento o enlace: también aparece en la Biblioteca
        const lista = enlaces.map((e) => `🔗 [${e.titulo}](${e.url})`).join("\n");
        CONOCIMIENTO.push({ id: "doc-panel-" + it.id, fuente: "EXT", remoto: true, titulo: it.titulo + (it.organismo ? ` (${it.organismo})` : ""),
          claves: String(it.claves || "").split(",").map((c) => c.trim()).filter(Boolean), texto: (it.texto || "") + (lista ? "\n\n" + lista : "") });
        return;
      }
      if (it.tipo === "establecimiento") {
        const base = ESTABLECIMIENTOS.findIndex((e) => e.id === it.id || normalizar(e.nombre) === normalizar(it.titulo));
        const est = Object.assign({}, base >= 0 ? ESTABLECIMIENTOS[base] : {}, { id: it.id, nombre: it.titulo, comuna: it.comuna || "", entorno: it.entorno || "",
          niveles: it.niveles || "", alias: it.claves || "", caracteristicas: it.texto || "", enlaces, remoto: true,
          mision: it.mision || "", vision: it.vision || "", sellos: it.sellos || "", historia: it.historia || "", pei: /^https?:\/\//.test(it.pei || "") ? it.pei : "" });
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
    ],
    slep: [
      { emoji: "🏛️", color: "#0071ea", titulo: "¿Cómo puede la IA apoyar mis funciones en el Servicio sin usar datos personales?", texto: "Ideas según tu área y la normativa" },
      { emoji: "📋", color: "#0071ea", titulo: "Ideas para acompañar a los establecimientos según su PEI", texto: "Misión, visión, sellos y contexto" }
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
      caja.innerHTML = `<span class="perfil-ico">${rol ? rol.emoji : "📍"}</span><span><strong>${escapar(p.establecimiento || (rol ? rol.nombre : "Mi perfil"))}</strong><small>${escapar([rol && p.establecimiento ? rol.corto : "", p.cargo, p.alcanceSlep === "comuna" ? "" : p.comuna, p.alcance].filter(Boolean).join(" · "))} · Cambiar</small></span>`;
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
    historial = []; wizard = null; pendiente = null; mencionesDescartadas.clear();
    el.mensajes.innerHTML = ""; el.bienvenida.hidden = false; el.elaborado.hidden = false; el.chat.scrollTop = 0;
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
    if (accion.startsWith("msg-")) { accionMensaje(accion, b); return; }   // PDF, WhatsApp, correo, copiar
    if (accion === "preguntar") procesar(valor);
    else if (accion === "wizard-iniciar") { cerrarMenu(); agregarUsuario("Diseñar material con IA"); iniciarWizard(); }
    else if (accion === "wizard" && wizard) { agregarUsuario(b.textContent.trim()); avanzarWizard(valor); }
    else if (accion === "ir") { location.href = valor; }
    else if (accion === "escribir") {   // "Otro": invita a escribir con sus palabras
      el.entrada.placeholder = "Escribe aquí lo que necesitas…";
      el.form.classList.add("resaltar"); setTimeout(() => el.form.classList.remove("resaltar"), 2400);
      el.entrada.focus();
    }
    else if (accion === "perfil-iniciar") { cerrarMenu(); agregarUsuario("Mi perfil"); iniciarWizard(true); }
    else if (accion === "wizard-cancelar") { wizard = null; agregar("bot", "<p>Listo, cancelé el asistente. ¿En qué más te ayudo?</p>"); }
    else if (accion === "enviar-limpio") procesar(valor, { omitirRevision: true });
    else if (accion === "mencion" && pendiente) {
      const p = pendiente; pendiente = null;
      const est = ESTABLECIMIENTOS.find((x) => x.id === valor);
      agregarUsuario(est ? est.nombre : "Ninguno, responder igual");
      // Los colegios descartados no se vuelven a sugerir en esta conversación
      (p.candidatos || []).forEach((id) => { if (!est || id !== est.id) mencionesDescartadas.add(id); });
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
