/* =====================================================================
   BASE DE CONOCIMIENTO
   Fuente: Serie de Manuales "Inteligencia Artificial para la Gestión
   Educativa" – SLEP Andalién Sur (2026), que a su vez se fundan en
   documentos del MINEDUC y en la Ley N.º 21.719 (y Leyes 19.628, 21.040,
   20.285).
   Para agregar contenido: copie un bloque { ... } y edítelo.
   - fuente:  manual o norma de origen (se muestra como etiqueta)
   - titulo:  título corto de la ficha
   - claves:  palabras que la gente usaría al preguntar (sin tildes da igual)
   - texto:   respuesta en formato Markdown simple (**negrita**, listas -, 1.)
   ===================================================================== */

const FUENTES = {
  M1: "Manual 1 · Importancia y ventajas de la IA",
  M2: "Manual 2 · Uso ético y tipos de uso",
  M3: "Manual 3 · Herramientas de IA",
  M4: "Manual 4 · Prompts efectivos",
  M5: "Manual 5 · Soporte técnico",
  LEY: "Ley N.º 21.719 · Protección de datos personales",
  MINEDUC: "MINEDUC · PotencIA el aprendizaje (2025)",
  EXT: "Fuentes oficiales externas (MINEDUC, CPEIP, UNESCO)"
};

const CONOCIMIENTO = [
  /* ---------------------------- MANUAL 1 ---------------------------- */
  {
    id: "serie", fuente: "M1", titulo: "¿Qué es la serie de manuales?",
    claves: ["manuales", "serie", "guias", "documentos", "que contiene", "indice", "sobre", "naturaleza"],
    texto: `El SLEP Andalién Sur (Concepción · Chiguayante · Florida · Hualqui) preparó **cinco manuales** para incorporar la IA en la gestión educativa de forma informada, ética y con sentido pedagógico:

1. **Importancia y ventajas** de la IA en el contexto educativo nacional.
2. **Uso ético** de la información y **tipos de uso** de la IA.
3. **Herramientas** de IA y sus usos en el contexto escolar chileno.
4. **Prompts efectivos** para apoyar la gestión educativa.
5. **Soporte técnico**: cómo construir una plataforma propia.

Están dirigidos a directivos, jefaturas de UTP, equipos técnico-pedagógicos, convivencia, PIE, docentes y asistentes de la educación.

**Importante:** la serie es una *propuesta técnica*, no lineamientos vigentes. Debe leerse en modo propositivo y no normativo hasta que el Servicio dicte instrucciones formales.`
  },
  {
    id: "dependencia", fuente: "M1", titulo: "Establecimientos de dependencia pública (no municipal)",
    claves: ["municipal", "dependencia", "sostenedor", "traspaso", "municipio", "servicio local", "educacion publica", "21040", "slep"],
    texto: `Los establecimientos que administra un Servicio Local son de **dependencia pública, no municipal**. Con la entrada en vigencia de la **Ley N.º 21.040**, la administración se traspasó desde los municipios al Servicio Local, que pasó a ser el **sostenedor**.

La distinción no es solo terminológica: cambia **quién responde por la gestión**, quién dicta las instrucciones, ante quién se rinde cuenta y cómo circula la información entre el nivel central y cada establecimiento.

Por eso, al escribir un prompt, conviene decir **"establecimiento de educación pública chileno"** y no "establecimiento municipal". Los ejemplos de la serie no se fijan en una comuna determinada: deben ser reconocibles tanto en un liceo urbano de alta matrícula como en una escuela rural pequeña, porque ambas realidades conviven en el territorio.`
  },
  {
    id: "que-es-ia", fuente: "M1", titulo: "¿Qué es la IA y la IA generativa?",
    claves: ["que es", "inteligencia artificial", "ia generativa", "iagen", "chatgpt", "definicion", "concepto", "modelo de lenguaje"],
    texto: `Según el MINEDUC (2025), la **inteligencia artificial** es la capacidad de las máquinas para realizar tareas propias de la inteligencia humana: resolver problemas, traducir, reconocer voz o tomar decisiones a partir de variables.

La **IA generativa (IAgen)** usa modelos preentrenados que generan **texto, audio, imágenes o video** a partir de lo que se le pide. Es la que hoy está en salas y oficinas: accesible desde un teléfono, con versiones gratuitas y sin conocimientos técnicos.

Ojo: los modelos producen *el texto más probable*, no necesariamente *el verdadero*. Por eso todo lo que generan se verifica.`
  },
  {
    id: "por-que", fuente: "M1", titulo: "¿Por qué usar IA en la gestión educativa?",
    claves: ["por que", "ventajas", "beneficios", "importancia", "argumentos", "para que sirve", "sirve"],
    texto: `Seis argumentos para el territorio Andalién Sur:

1. **Devolver tiempo profesional** a lo que solo puede hacer una persona (acompañar el aula, conversar con familias, retroalimentar).
2. **Mejora continua con datos**, no con impresiones.
3. **Anticiparse en las trayectorias** educativas (lectura de datos agregados; las decisiones sobre cada estudiante siguen siendo humanas).
4. **Ampliar la inclusión sin ampliar la brecha** (conectividad, equipos y tiempo docente primero).
5. **Formar ciudadanía digital**, que ya es contenido curricular.
6. **Gestión sostenible** de un servicio de escala territorial (trazabilidad, síntesis de procesos participativos).

La pregunta no es *si* usar IA, sino **qué cambiar en la práctica** para aprovechar oportunidades y contener riesgos (MINEDUC, 2025).`
  },
  {
    id: "ventajas-ambito", fuente: "M1", titulo: "Ventajas por ámbito de gestión",
    claves: ["ambito", "liderazgo", "gestion pedagogica", "evaluacion", "convivencia", "administracion", "desarrollo profesional", "datos", "ejemplos de uso"],
    texto: `- **Liderazgo institucional:** borradores estructurados de PEI, PME e informes; listas de verificación.
- **Gestión pedagógica:** adaptar textos, variantes de dificultad, ideas de actividades.
- **Evaluación:** rúbricas base desde los objetivos; revisar consistencia de criterios.
- **Convivencia:** simplificar el lenguaje de protocolos; borradores de comunicados informativos.
- **Uso de datos:** ordenar datos agregados, detectar patrones, formular preguntas.
- **Desarrollo profesional:** sintetizar registros de observación anonimizados.
- **Administración:** plantillas, resúmenes, primeras versiones de respuestas.

**Todas suponen validación humana antes de cualquier uso oficial.**`
  },
  {
    id: "riesgos", fuente: "M1", titulo: "Riesgos y tres advertencias clave",
    claves: ["riesgos", "peligros", "advertencias", "sesgo", "alucinacion", "errores", "cuidado", "brecha"],
    texto: `Riesgos documentados: **sesgo algorítmico**, **brecha** entre quienes acceden y quienes no, y **protección de datos**.

**Tres advertencias para equipos directivos**
1. **La IA se equivoca con seguridad.** Puede inventar datos con tono convincente. La validación es responsabilidad de quien firma.
2. **Los datos personales no entran** a plataformas de IA de uso público (no cumplen las condiciones que exige la normativa).
3. **La decisión final es humana.** La IA apoya, no reemplaza el criterio profesional, la empatía ni el liderazgo pedagógico.`
  },
  {
    id: "ruta", fuente: "M1", titulo: "Ruta de instalación sugerida en el Servicio",
    claves: ["ruta", "instalacion", "fases", "implementar", "plan", "como empezar", "diagnostico", "pilotaje", "indicadores"],
    texto: `Cuatro fases (propuesta técnica):

1. **Diagnóstico:** catastro de conectividad y equipos; encuesta de uso actual de IA; experiencias en curso.
2. **Acuerdos:** protocolo territorial participativo; tareas delegables y no delegables; criterios de transparencia y datos.
3. **Capacitación:** uso ético (M2), herramientas (M3), prompts (M4), soporte técnico (M5); comunidades de práctica por comuna.
4. **Pilotaje y monitoreo:** proyectos acotados en establecimientos voluntarios; sistematizar y difundir.

**Indicadores sugeridos:** % de establecimientos con protocolo; % de participación en formación; experiencias sistematizadas; horas liberadas para acompañamiento; incidentes de datos personales (meta: **cero**).`
  },
  {
    id: "autoevaluacion", fuente: "MINEDUC", titulo: "Preguntas de autoevaluación (MINEDUC)",
    claves: ["autoevaluacion", "reflexion", "preguntas", "principios mineduc", "potencia", "pauta"],
    texto: `Adaptadas de *PotencIA el aprendizaje* (MINEDUC, 2025). Respóndalas en equipo:

- **Potenciar lo humano:** ¿usamos la IA para liberar tiempo para la empatía y el vínculo?
- **Herramienta para pensar:** ¿profundizamos el análisis o solo producimos texto más rápido?
- **Creatividad:** ¿desarrollamos lo generado con criterio propio?
- **Resguardo ético:** ¿conocemos los términos y el uso de datos de las herramientas?
- **Equidad e inclusión:** ¿beneficia a todos, incluso a quienes tienen menos acceso?
- **Aprendizaje activo:** ¿agregamos valor pedagógico o solo automatizamos?
- **Transparencia:** ¿informamos cuándo un documento usó IA?`
  },
  {
    id: "marco-normativo", fuente: "M2", titulo: "Marco normativo chileno aplicable",
    claves: ["ley", "leyes", "normativa", "marco legal", "21040", "19628", "20285", "politica nacional", "legal"],
    texto: `- **Ley N.º 19.628** (vida privada): regula datos personales y define datos sensibles.
- **Ley N.º 21.719** (plena vigencia **1 de diciembre de 2026**): reforma la 19.628, crea la **Agencia de Protección de Datos Personales** y un régimen sancionatorio. Exige base de licitud, responsabilidad demostrable, protección desde el diseño, evaluación de impacto y contrato con todo encargado.
- **Ley N.º 21.040** (Sistema de Educación Pública): el uso de IA debe inscribirse en el Plan Estratégico Local y el Plan Anual.
- **Ley N.º 20.285** (acceso a información pública): los documentos pueden ser requeridos; importa su trazabilidad y autoría.
- **Política Nacional de IA**: respalda la adopción con resguardos éticos.

*Este asistente no constituye asesoría jurídica; consulte a la asesoría legal del Servicio.*`
  },

  /* ---------------------------- MANUAL 2: ÉTICA Y LEY ---------------------------- */
  {
    id: "datos-personales-ia", fuente: "M2", titulo: "¿Puedo ingresar datos de estudiantes a la IA?",
    claves: ["datos personales", "datos de estudiantes", "nombres", "rut", "puedo ingresar", "pegar", "subir", "privacidad", "informacion de alumnos", "ficha", "nomina"],
    texto: `**No en plataformas de IA de uso público** (ChatGPT, Gemini, etc. en sus versiones abiertas).

La ley **no prohíbe** que el Servicio trate datos: lo hace legítimamente a diario. El problema es el **destinatario**. Al pegar datos en una plataforma pública:
- se comunican a un tercero **sin el contrato** que exige la ley;
- se pierde el control de la **finalidad** (pueden usarse para entrenar modelos);
- hay **transferencia internacional** sin resguardos;
- **no hay trazabilidad**.

**Regla vigente:** ningún dato personal ingresa a IA de uso público. Solo dos variantes podrían habilitarse, y **no por el establecimiento por su cuenta**:
a) IA integrada en la suite institucional, con cobertura contractual confirmada por el Servicio.
b) Sistemas propios que consumen una API, con las salvaguardas del Anexo del Manual 2.

👉 Alternativa: **anonimice** la consulta (pregunte "¿cómo anonimizo?").`
  },
  {
    id: "dato-personal-def", fuente: "LEY", titulo: "¿Qué es un dato personal? Anonimizar vs. seudonimizar",
    claves: ["dato personal", "definicion", "identificable", "anonimizacion", "seudonimizacion", "diferencia", "articulo 2"],
    texto: `**Dato personal** (art. 2°, letra f): cualquier información vinculada a una persona **identificada o identificable**, directa o indirectamente.

Por eso un listado sin nombres puede seguir siendo dato personal: en una escuela pequeña, *"la estudiante de 7° B que se retiró en abril"* identifica a alguien igual que su nombre.

- **Anonimización** (letra k): irreversible; el dato **deja de ser personal**.
- **Seudonimización** (letra l): reemplaza identificadores pero **es reversible**; el dato **sigue siendo personal** y protegido.`
  },
  {
    id: "principios-ley", fuente: "LEY", titulo: "Los 8 principios de la Ley 21.719 (art. 3°)",
    claves: ["principios", "articulo 3", "licitud", "finalidad", "proporcionalidad", "calidad", "responsabilidad", "seguridad", "transparencia", "confidencialidad"],
    texto: `1. **Licitud y lealtad:** poder acreditar en qué norma se funda tener cada dato.
2. **Finalidad:** los datos de matrícula no se usan para otros fines.
3. **Proporcionalidad:** solo los datos necesarios (si no se necesita el RUT, no se pide).
4. **Calidad:** datos exactos y actualizados.
5. **Responsabilidad:** no se delega en el proveedor ni en quien opera el sistema.
6. **Seguridad:** planillas en cuentas personales o carpetas con enlace abierto son incumplimientos.
7. **Transparencia e información:** política de datos publicada y comprensible.
8. **Confidencialidad:** el deber de reserva sigue aunque el funcionario deje el cargo.`
  },
  {
    id: "consentimiento", fuente: "LEY", titulo: "¿Hay que pedir consentimiento? (art. 20)",
    claves: ["consentimiento", "autorizacion", "permiso", "articulo 20", "fotos", "fotografias", "redes sociales", "apoderados"],
    texto: `Los órganos públicos tratan datos **sin consentimiento** cuando es para cumplir sus funciones legales (art. 20): matrícula, asistencia, calificaciones, antecedentes laborales.

- **No** corresponde pedir autorización para lo que la ley ya habilita (p. ej., registrar asistencia).
- **Sí** corresponde para lo que excede la función legal: **publicar fotos de estudiantes en redes sociales** requiere autorización expresa, revocable y específica de quien ejerce el cuidado personal, con registro de quienes no autorizaron.

La ausencia de consentimiento **no** elimina las demás obligaciones (principios, derechos, seguridad).`
  },
  {
    id: "nna", fuente: "LEY", titulo: "Datos de niños, niñas y adolescentes (art. 16 quáter)",
    claves: ["ninos", "ninas", "adolescentes", "menores", "16 quater", "edad", "14 anos", "interes superior", "tramos"],
    texto: `Se tratan atendiendo al **interés superior** y la **autonomía progresiva**. Es *obligación especial de los establecimientos educacionales* velar por su protección.

| Tramo | Datos comunes | Datos sensibles |
|---|---|---|
| Menores de 14 | Consentimiento de padres/representantes (salvo ley) | Consentimiento de padres/representantes |
| 14 a 15 | Reglas de adultos | Consentimiento de padres/representantes |
| 16 a 17 | Reglas de adultos | Reglas de adultos |

Un mismo curso puede mezclar tramos (un 8.° básico tiene estudiantes de 13 y 14). **Verifique la edad, no el nivel**, antes de recabar un dato sensible.`
  },
  {
    id: "derechos", fuente: "LEY", titulo: "Derechos de las personas y plazos de respuesta",
    claves: ["derechos", "acceso", "rectificacion", "supresion", "oposicion", "portabilidad", "bloqueo", "solicitud", "plazo", "30 dias", "arco"],
    texto: `Seis derechos (arts. 4° a 11): **acceso, rectificación, supresión, oposición, portabilidad y bloqueo**. Son irrenunciables.

**Procedimiento (arts. 11 y 23):**
- Solicitud por escrito, dirigida al jefe superior del servicio.
- Respuesta en **30 días corridos**, prorrogable una vez por 30 más.
- Respuesta escrita, guardando respaldo de envío.
- Si se deniega: fundada, indicando que hay **30 días hábiles** para reclamar ante la Agencia.
- Bloqueo temporal: responder en **2 días hábiles**.

**Preparar antes de dic. 2026:** canal de contacto publicado, procedimiento interno escrito y registro de solicitudes.`
  },
  {
    id: "decisiones-automatizadas", fuente: "LEY", titulo: "Decisiones automatizadas y perfiles (art. 8° bis)",
    claves: ["decisiones automatizadas", "8 bis", "perfiles", "prediccion", "desercion", "algoritmo", "15 ter", "evaluacion de impacto"],
    texto: `El titular puede **oponerse a decisiones basadas en tratamiento automatizado** (incluida la elaboración de perfiles) que le afecten significativamente.

Ejemplos escolares que caen aquí: un modelo que estima la probabilidad de deserción y activa una medida, o uno que clasifica el desempeño docente.

La ley exige garantías: información, **explicación**, **intervención humana**, expresar el punto de vista y pedir revisión. El art. **15 ter** exige **evaluación de impacto** previa en estos casos, en tratamientos masivos y con datos sensibles.

✅ La forma más simple de cumplir: **si siempre decide una persona informada, no hay decisión automatizada.**`
  },
  {
    id: "brechas", fuente: "LEY", titulo: "Seguridad y filtraciones de datos (arts. 14 quinquies y sexies)",
    claves: ["filtracion", "brecha", "seguridad", "incidente", "14 sexies", "reportar", "cifrado", "perdida", "correo equivocado"],
    texto: `**Seguridad (14 quinquies):** medidas técnicas y organizativas adecuadas al riesgo, entre ellas la **seudonimización** y el **cifrado**.

**Reporte de vulneraciones (14 sexies):** reportar a la Agencia sin dilaciones cuando haya riesgo razonable para los titulares. Si afecta **datos sensibles o de menores de 14 años**, hay que comunicarlo además a los titulares en lenguaje claro.

Casos típicos: planilla enviada al destinatario equivocado, carpeta con enlace público, computador extraviado sin cifrar, acceso de un tercero a una cuenta.

👉 Definan desde ya **quién detecta, quién evalúa y quién reporta.**`
  },
  {
    id: "proveedores", fuente: "LEY", titulo: "Plataformas externas y transferencia internacional",
    claves: ["proveedor", "plataforma", "encargado", "15 bis", "contrato", "terminos", "transferencia internacional", "27", "28"],
    texto: `**Art. 15 bis:** toda plataforma externa que procese datos del establecimiento es un **encargado** y requiere un **contrato** (objeto, duración, finalidad, tipo de datos, obligaciones). Aceptar términos con un clic **no** equivale a ese contrato.

**Arts. 27 y 28:** la transferencia internacional es lícita con país de nivel adecuado, cláusulas contractuales o certificación; si no, solo en casos específicos (p. ej., consentimiento expreso).

👉 Levante un **catastro de plataformas** en uso: qué datos maneja cada una y bajo qué instrumento.`
  },
  {
    id: "sitio-web", fuente: "LEY", titulo: "¿Qué debe publicarse en el sitio web? (art. 14 ter)",
    claves: ["sitio web", "publicar", "14 ter", "politica de datos", "transparencia", "pagina web"],
    texto: `Entre otros: política de tratamiento (fecha y versión), responsable y representante legal, **canal de contacto** para solicitudes, categorías de datos y finalidades, medidas de seguridad, derechos del titular, derecho a reclamar ante la Agencia, transferencias internacionales, plazos de conservación, origen de los datos y la **existencia de decisiones automatizadas** con información sobre su lógica.

Además, el **art. 22** exige informar mensualmente los convenios de cesión o transferencia de datos.`
  },
  {
    id: "sanciones", fuente: "LEY", titulo: "Responsabilidades y sanciones (arts. 44 a 47)",
    claves: ["sanciones", "multas", "responsabilidad", "44", "45", "46", "47", "jefe superior", "sumario"],
    texto: `En el sector público la sanción recae **personalmente en el jefe superior** del organismo:
- Multa del **20 % al 50 %** de su remuneración mensual.
- Datos sensibles: **50 %** y suspensión de hasta **30 días**.
- Persistencia: el doble de la sanción.

Además: investigación sumaria de Contraloría si hay responsabilidades individuales (art. 45), **deber de reserva** de funcionarios (art. 46) y **responsabilidad civil** por daños (art. 47).`
  },
  {
    id: "casos-practicos", fuente: "M2", titulo: "Casos prácticos del día a día",
    claves: ["casos", "whatsapp", "correo masivo", "copia oculta", "calificaciones", "notas", "fotos", "pie", "dupla", "encuesta", "camaras", "formularios", "ejemplos"],
    texto: `- **Correo masivo a apoderados:** usar **copia oculta (CCO)**.
- **Calificaciones:** comunicarlas de forma individual, nunca en listados públicos.
- **Fotos en redes:** autorización expresa de quien tiene el cuidado personal.
- **WhatsApp:** canales institucionales o listas de difusión desde cuenta institucional.
- **Informes PIE / dupla psicosocial:** datos sensibles; acceso restringido y registro de accesos.
- **Formularios:** pedir solo lo necesario.
- **Encuesta de clima:** si el análisis es agregado, recoger anónimo desde el origen.
- **Planillas del equipo:** en unidades institucionales, no en cuentas personales.
- **Informe de caso con IA:** anonimizar o usar un entorno autorizado.`
  },
  {
    id: "hoja-ruta-2026", fuente: "LEY", titulo: "Hoja de ruta hacia diciembre de 2026",
    claves: ["diciembre 2026", "vigencia", "preparacion", "hoja de ruta", "pasos", "cumplimiento", "delegado"],
    texto: `1. Inventario de tratamientos.
2. Matriz de licitud (función legal vs. consentimiento).
3. Catastro de plataformas y contratos (art. 15 bis).
4. Publicación de política y contenidos del art. 14 ter.
5. Procedimiento de atención de solicitudes.
6. Plan de seguridad (seudonimización, cifrado, accesos, respaldo).
7. Protocolo de incidentes y reporte de brechas.
8. Evaluaciones de impacto (art. 15 ter).
9. Decisión sobre delegado de protección de datos (facultativo, arts. 49-50).
10. Capacitación de directivos, docentes y asistentes.`
  },
  {
    id: "principios-eticos", fuente: "M2", titulo: "Los cinco principios éticos de uso de IA",
    claves: ["principios eticos", "etica", "uso etico", "transparencia", "equidad", "responsabilidad humana", "veracidad"],
    texto: `1. **Transparencia:** informar cuándo y cómo se usó IA.
2. **Privacidad y protección de datos:** no ingresar datos sensibles en plataformas de IA generativa.
3. **Equidad e inclusión:** que no refuerce sesgos ni omita la realidad rural presente en el territorio.
4. **Responsabilidad humana:** la decisión final siempre es humana.
5. **Veracidad y precisión:** toda cita normativa, cifra o decreto se contrasta con la fuente oficial.

Son coherentes con los seis principios del MINEDUC (2025): potenciar lo humano, herramienta para pensar, creatividad, resguardo ético, equidad e inclusión y aprendizaje activo.`
  },
  {
    id: "cuando-usar", fuente: "M2", titulo: "¿Cuándo usar IA? Cinco preguntas previas",
    claves: ["cuando usar", "deberia usar", "conviene", "criterios", "decidir", "preguntas previas", "alerta"],
    texto: `Antes de usar IA, responda:

1. ¿Requiere **juicio profesional** o sensibilidad humana? → *Alerta alta*: no delegue la decisión.
2. ¿La información es **sensible o confidencial**? → *Alerta crítica*: no la ingrese; anonimice o hágalo sin IA.
3. ¿Tengo **tiempo para revisar**? → Si no, posponga.
4. ¿Puede generar **sesgos**? → Revise representatividad y pertinencia cultural.
5. ¿**Mejora genuinamente** mi gestión? → Si no agrega valor, no se justifica.`
  },
  {
    id: "delegar", fuente: "M2", titulo: "¿Qué se puede delegar en la IA y qué no?",
    claves: ["delegar", "no delegar", "prohibido", "zona prohibida", "permitido", "tareas", "puedo usar ia para"],
    texto: `**✅ Se puede delegar (con supervisión):**
- Borradores de documentos institucionales.
- Estructuración de planes o proyectos.
- Ideas para la toma de decisiones.
- Rúbricas e instrumentos de evaluación.
- Resúmenes de documentos extensos **sin datos personales**.
- Materiales didácticos básicos.

**⛔ No se delega:**
- Evaluación del desempeño de estudiantes o docentes.
- Decisiones disciplinarias o de convivencia.
- Comunicación sensible con familias o la comunidad.
- Análisis de datos personales o confidenciales.
- Diagnóstico o intervención en vulneración de derechos.
- Planificación estratégica institucional completa.

**Zona intermedia:** divida la tarea. Use IA solo para la parte sin datos (estructura, marco, secciones generales) y redacte usted lo identificable.`
  },
  {
    id: "anonimizar", fuente: "M2", titulo: "¿Cómo anonimizar una consulta?",
    claves: ["anonimizar", "anonimizacion", "como anonimizo", "quitar nombres", "eliminar datos", "reemplazar", "estudiante a", "protocolo de anonimizacion"],
    texto: `**Elimine siempre:**
- **Identificadores directos:** nombre, RUT, matrícula, correo → "Estudiante A".
- **Identificadores indirectos:** curso y letra, nombre del establecimiento o del profesor jefe, dirección → "un curso de segundo ciclo", "un establecimiento urbano del territorio".
- **Datos sensibles:** diagnósticos, informes psicológicos, situación socioeconómica o migratoria → omitir.
- **Datos de terceros:** apoderados, funcionarios → "el apoderado".
- **Documentos completos:** extraer solo el fragmento necesario, ya anonimizado.

**❌ Incorrecto:** "Tengo un estudiante, Matías González, de 6° B, con TDAH…"
**✅ Correcto:** "Actúa como jefe de UTP de un establecimiento de educación pública chileno. Necesito la estructura de un informe de derivación a dupla psicosocial para un estudiante de segundo ciclo con dificultades de atención… No inventes datos: deja campos por completar."`
  },
  {
    id: "verificar", fuente: "M2", titulo: "Protocolo de verificación en cuatro pasos",
    claves: ["verificar", "verificacion", "revisar", "comprobar", "alucinacion", "inventa", "errores", "fuente oficial", "bcn"],
    texto: `La IA produce el texto más probable, no el verdadero. Puede inventar decretos, cifras o citas.

1. **Datos y cifras:** contraste con la fuente primaria.
2. **Referencias normativas:** búsquelas en la **Biblioteca del Congreso Nacional** (bcn.cl) o el sitio del Ministerio. *Si la norma no aparece, no existe.*
3. **Pertinencia contextual:** ¿corresponde al sistema chileno?
4. **Sesgos y representatividad:** ¿reproduce estereotipos o invisibiliza la ruralidad?

Preguntas MINEDUC: ¿es precisa? ¿cómo compruebo su veracidad? ¿es correcta en cualquier contexto? ¿reproduce estereotipos?`
  },
  {
    id: "declarar", fuente: "M2", titulo: "Cómo declarar el uso de IA (fórmulas)",
    claves: ["declarar", "declaracion", "transparencia", "nota al pie", "formula", "citar ia", "informar uso"],
    texto: `- **Documento interno:** "Versión preliminar elaborada con apoyo de inteligencia artificial generativa. Contenido revisado, corregido y validado por [cargo]."
- **Material didáctico:** "Material elaborado con apoyo de herramientas de inteligencia artificial y adaptado por el equipo docente de la asignatura."
- **Comunicado a familias:** "Texto redactado por el equipo directivo, con apoyo de herramientas digitales para la revisión de claridad y lenguaje."
- **Instrumento de evaluación:** "Instrumento construido con apoyo de inteligencia artificial y validado por el equipo técnico-pedagógico del establecimiento."
- **Imagen generada:** "Imagen generada mediante inteligencia artificial. Se advierte que estas herramientas pueden reproducir sesgos en la representación de personas."

Declarar **no traslada la responsabilidad**: quien firma responde por todo el contenido.`
  },
  {
    id: "protocolo", fuente: "M2", titulo: "Protocolo institucional de uso de IA",
    claves: ["protocolo institucional", "reglamento", "construir protocolo", "participativo", "contenidos minimos", "consejo escolar"],
    texto: `**Contenidos mínimos:** alcance; herramientas autorizadas y no autorizadas; reglas de datos; tareas delegables/no delegables; obligación de declarar y verificar; reglas de uso estudiantil por nivel; procedimiento ante uso indebido (sin criminalizar el error de buena fe); responsable y revisión periódica.

**Etapas participativas:** diagnóstico sin ánimo sancionatorio → deliberación en Consejo de Profesores → consulta a Centro de Estudiantes y de Padres → redacción por comisión → aprobación e incorporación al Reglamento Interno → revisión anual.`
  },
  {
    id: "uso-estudiantes", fuente: "M2", titulo: "Uso de IA por estudiantes",
    claves: ["estudiantes", "alumnos", "copia", "plagio", "tareas", "uso estudiantil", "trabajos"],
    texto: `La clave es distinguir **usar IA para pensar mejor** de **usarla para evitar pensar**.

**Fortalece:** pedir explicaciones alternativas; generar ideas que luego se desarrollan; contrastar con fuentes y detectar errores; revisar ortografía de un texto propio; analizar sesgos de la herramienta.

**Sustituye:** entregar una tarea generada sin modificar; presentar como propio un texto de la IA; citarla como fuente sin verificar; responder con IA una evaluación de comprensión individual; ingresar datos personales.

Sugerencia: que el reglamento de evaluación pida **declarar** qué herramienta se usó, para qué parte y qué se modificó.`
  },
  {
    id: "seis-tipos", fuente: "M2", titulo: "Los seis tipos de uso de la IA (por nivel de riesgo)",
    claves: ["tipos de uso", "seis tipos", "copiloto", "humano ia humano", "niveles de riesgo", "clasificacion"],
    texto: `Modelo **humano → IA → humano**: la persona define el problema, la IA genera opciones, la persona verifica y decide.

1. **Producción documental** — riesgo *bajo*. Borradores de PEI, PME, actas, informes.
2. **Síntesis y análisis** — *bajo a medio*. Resumir normativa, encuestas anonimizadas.
3. **Diseño pedagógico y evaluativo** — *medio*. Planificaciones, guías, rúbricas, ítems.
4. **Comunicación institucional** — *medio*. Adaptar lenguaje; **nunca** comunicación sensible.
5. **Apoyo al uso de datos** — *medio a alto*. Solo datos agregados; interpretación humana.
6. **Reflexión y liderazgo** — *alto*. IA como interlocutor crítico; no reemplaza la deliberación colectiva.

Conviene empezar por los primeros e ir avanzando a medida que se consolida criterio.`
  },
  {
    id: "diseno-pedagogico", fuente: "M2", titulo: "Diseñar material pedagógico con IA",
    claves: ["material", "disenar material", "crear material", "planificacion", "guia", "actividad", "clase", "diversificar", "adaptar texto", "didactico", "recurso"],
    texto: `Aplicaciones del **tipo 3 (diseño pedagógico)**:
- **Planificación:** secuencia de una clase de 90 min alineada al OA.
- **Diversificación:** tres versiones de una guía con distinto andamiaje.
- **Rúbricas:** criterios y niveles de logro.
- **Ítems:** preguntas con distractores plausibles.
- **Adaptación de textos:** bajar complejidad léxica sin bajar exigencia cognitiva.
- **Contextualización local:** situaciones con referencias reconocibles en el entorno del establecimiento: el río Biobío, el comercio del sector, la actividad agrícola o forestal de la zona.
- **Retroalimentación:** formulaciones descriptivas desde la rúbrica.

**Límites:** la IA no conoce con precisión las **Bases Curriculares** → verifique todo OA en el currículum oficial. Generar la rúbrica es delegable; **evaluar con ella no**.

💡 Escriba **"crear prompt"** y le ayudo a armar uno paso a paso.`
  },
  {
    id: "comunicacion", fuente: "M2", titulo: "Comunicación institucional con IA",
    claves: ["comunicado", "circular", "comunicacion", "familias", "apoderados", "carta", "lenguaje claro", "cuenta publica"],
    texto: `**Apropiado:** traducir protocolos a lenguaje claro; difundir la admisión escolar; tres versiones de una circular (apoderados, docentes, estudiantes); preguntas frecuentes de un reglamento; convocatorias; estructurar la Cuenta Pública.

**⛔ No corresponde:** comunicar una medida disciplinaria o la activación de un protocolo de vulneración; responder reclamos; notificar observaciones de desempeño; duelo, emergencias o crisis. Ahí el vínculo con la persona **es** el mensaje.`
  },
  {
    id: "uso-datos", fuente: "M2", titulo: "Usar IA para analizar datos del establecimiento",
    claves: ["datos", "asistencia", "resultados", "analisis de datos", "planilla", "simce", "indicadores", "desercion", "trayectorias"],
    texto: `Siempre con **datos agregados y anonimizados**, e interpretación humana:
- **Asistencia:** patrones por curso, mes, jornada (nunca nóminas individuales).
- **Resultados:** por objetivo de aprendizaje, sin identificar estudiantes ni docentes.
- **Trayectorias:** tendencias de repitencia y retiro por nivel.
- **Convivencia:** tipos de situación, sin relato de casos.
- **Acompañamiento:** focos recurrentes en registros anonimizados.

⚠️ Los sistemas predictivos sobre estudiantes individuales arriesgan **etiquetamiento** y **profecía autocumplida**. La IA lee tendencias; la identificación de un estudiante en riesgo y qué hacer corresponde al equipo.`
  },
  {
    id: "reflexion", fuente: "M2", titulo: "La IA como interlocutor crítico (liderazgo)",
    claves: ["reflexion", "liderazgo", "critico", "decision", "supuestos", "riesgos de una medida", "directivo", "puntos ciegos"],
    texto: `Úsela para **pensar mejor**, no para que piense por usted:
- Someter una decisión a análisis de riesgos.
- Pedir que argumente **en contra** de su propuesta.
- Ver una medida desde un apoderado, un docente y un estudiante.
- Contrastar con los estándares indicativos de desempeño.

**Ejemplo:** *"Actúa como asesor crítico en gestión escolar chilena. Estoy considerando [medida]. No me des tu opinión favorable: (1) tres supuestos no verificados; (2) condiciones institucionales necesarias; (3) tres formas probables de fracaso; (4) cinco preguntas antes de proponerla al Consejo de Profesores."*

Límite: no reemplaza la deliberación colectiva.`
  },
  {
    id: "anexo-api", fuente: "M2", titulo: "Sistemas propios con API de IA (Anexo)",
    claves: ["api", "sistema propio", "plataforma propia", "seudonimizar", "diccionario", "marcadores", "instruccion de sistema", "anexo"],
    texto: `Enviar datos a una API **sí es comunicarlos a un tercero**, pero es **mejor** que una plataforma pública: los términos comerciales suelen excluir el entrenamiento, tienen retención acotada y la institución **controla qué sale**.

**Seudonimización en 7 pasos:** clasificar campos → calcular localmente conteos y totales → diccionario temporal en memoria ([DOCENTE_1], [CURSO_1]) → sustituir → enviar solo el texto sustituido → reponer identificadores → descartar diccionario y registrar en bitácora sin contenido.

**Instrucción de sistema:** no agregar información, no emitir juicios de desempeño, conservar los marcadores, no cambiar datos ni fechas.

**Antes de autorizar:** cuenta institucional, términos sin entrenamiento, retención, transferencia, seudonimización, control de accesos, bitácora, información a titulares y validación jurídica.`
  },

  /* ---------------------------- MANUAL 3 ---------------------------- */
  {
    id: "evaluar-herramienta", fuente: "M3", titulo: "¿Cómo evaluar una herramienta de IA antes de usarla?",
    claves: ["evaluar herramienta", "elegir herramienta", "es segura", "autorizar", "pauta", "terminos de uso", "edad minima", "app"],
    texto: `Pauta de 7 dimensiones:
- **Datos:** ¿qué hace con lo ingresado? ¿entrena con ello? *Alerta:* términos ambiguos o sin español.
- **Edad mínima:** ¿exige autorización adulta? *Alerta:* uso con estudiantes bajo la edad declarada.
- **Costo real:** ¿la versión gratuita sirve? *Alerta:* dependencia de algo que luego se cobra.
- **Transparencia:** ¿indica fuentes y limitaciones?
- **Sesgo:** ¿es pertinente para Chile?
- **Accesibilidad:** ¿funciona con conexión intermitente?
- **Continuidad:** ¿es consolidada o experimental?

**Equidad territorial:** ninguna práctica evaluada debe depender de una herramienta que no esté disponible para **todos** los estudiantes del curso.`
  },
  {
    id: "familias-herramientas", fuente: "M3", titulo: "Las seis familias de herramientas de IA",
    claves: ["herramientas", "familias", "cual usar", "que herramienta", "aplicaciones", "lista de herramientas", "recomienda"],
    texto: `1. **Asistentes conversacionales** (ChatGPT, Claude, Gemini, Copilot, Meta AI, DeepSeek): versátiles; no citan fuentes por defecto.
2. **Asistentes con fuentes visibles** (p. ej., Perplexity): ideales para enseñar verificación.
3. **Trabajo sobre documentos propios** (p. ej., NotebookLM): responden solo desde lo que usted carga.
4. **Diseño y producción visual** (Canva con IA, Gamma): afiches, infografías, presentaciones.
5. **Dominio específico** (iNaturalist, Machine Learning for Kids, transcripción).
6. **IA integrada en plataformas de gestión** (suites ofimáticas, correo).

*Nombrar una herramienta no implica recomendación institucional ni convenio del Servicio.*`
  },
  {
    id: "conversacionales", fuente: "M3", titulo: "Asistentes conversacionales: usos y precauciones",
    claves: ["chatgpt", "gemini", "claude", "copilot", "chat", "asistente conversacional", "deepseek"],
    texto: `**Usos:** estructura de un informe anual; tres versiones de una guía de comprensión lectora; rúbrica de exposición oral; simplificar el protocolo de acoso escolar; preguntas para una jornada de reflexión; análisis crítico de una reorganización horaria.

**Precauciones:**
- No indican fuentes: **verifique** toda cifra o norma.
- Guardan historial: **nunca** datos personales.
- Tienden a marcos de otros países: explicite **"sistema escolar chileno"**.`
  },
  {
    id: "notebooklm", fuente: "M3", titulo: "Herramientas sobre documentos propios (NotebookLM)",
    claves: ["notebooklm", "documentos propios", "cargar documentos", "reglamento interno", "pei", "pme", "resumir documentos", "subir archivos"],
    texto: `Trabajan **solo** sobre los documentos que usted carga, lo que reduce mezclar información de otros sistemas.

**Ejemplos:** Reglamento Interno y protocolos (¿qué plazos fija?, ¿hay contradicciones?); PEI/PME de años anteriores (¿qué acciones se repiten sin cumplirse?); orientaciones ministeriales del año; actas de Consejo (¿qué acuerdos quedaron pendientes?).

⚠️ **Cargar un documento es tratar datos.** Verifique que no contenga nóminas, datos de estudiantes, informes psicosociales ni antecedentes de funcionarios. **En caso de duda, no se carga.**`
  },
  {
    id: "imagenes", fuente: "M3", titulo: "Diseño visual e imágenes generadas con IA",
    claves: ["canva", "gamma", "imagenes", "afiche", "infografia", "presentacion", "logo", "diseno grafico", "derechos de autor"],
    texto: `**Usos:** afiche de admisión, presentación de la Cuenta Pública, infografías curriculares, productos estudiantiles, procesos participativos (p. ej., logo del Centro de Estudiantes).

**Precauciones:**
- **Sesgos de representación:** revise toda imagen con personas.
- **Declárelas** como generadas con IA.
- **Derechos de autor** en desarrollo: no usar con fines comerciales ni reclamar autoría exclusiva.
- Si el objetivo de aprendizaje es la creación visual, generarla automáticamente elimina lo que se quería evaluar.`
  },
  {
    id: "seleccion-minima", fuente: "M3", titulo: "Selección mínima de herramientas por perfil",
    claves: ["por donde empezar", "perfil", "docente", "utp", "director", "convivencia", "empezar", "seleccion minima"],
    texto: `Mejor dominar tres que conocer diez:
- **Equipo directivo:** asistente conversacional + asistente sobre documentos propios.
- **Jefatura de UTP:** conversacional + diseño con IA (rúbricas, presentaciones).
- **Docentes de aula:** conversacional + diseño (guías diversificadas, ítems).
- **Trabajo con estudiantes:** asistente con fuentes visibles + diseño.
- **Convivencia:** conversacional (lenguaje de protocolos, material informativo).

**Condiciones previas:** diagnóstico de equipos y conectividad, protocolo aprobado, listado de herramientas autorizadas, formación en prompts y un responsable institucional.`
  },
  {
    id: "suite", fuente: "M3", titulo: "IA integrada en la suite institucional (Google/Microsoft)",
    claves: ["google workspace", "microsoft", "suite", "correo institucional", "integrada", "gemini en docs", "copilot en word"],
    texto: `Ventaja: el tratamiento de datos **puede** quedar cubierto por el contrato vigente del organismo.

Pero esa cobertura **no se presume**: debe confirmarla formalmente el área competente del Servicio (que el proveedor sea encargado según la Ley 21.719, que excluya entrenamiento y qué seguridad contempla). **El establecimiento no la verifica por su cuenta.**

Mientras no exista confirmación: **ningún dato personal** ingresa a esas funciones.`
  },

  /* ---------------------------- MANUAL 4 ---------------------------- */
  {
    id: "que-es-prompt", fuente: "M4", titulo: "¿Qué es un prompt y por qué importa?",
    claves: ["prompt", "que es un prompt", "instruccion", "consulta", "pedirle a la ia", "como preguntar"],
    texto: `Un **prompt** es la instrucción que se da a un modelo de lenguaje. La calidad de la respuesta depende directamente de su calidad.

**Genérico:** "Hazme una clase de lenguaje."
**Específico:** "Diseña una clase para 3° básico en lenguaje, enfocada en comprensión lectora con inferencias simples."

**Genérico:** "Dame información sobre evaluación."
**Específico:** "Crea una rúbrica para evaluar exposiciones orales en 6° básico, con tres niveles de logro y cuatro criterios."

Escribir un buen prompt obliga a explicitar para qué, para quién, con qué límites y en qué formato… y eso también aclara el propio pensamiento.`
  },
  {
    id: "seis-pasos", fuente: "M4", titulo: "Método de seis pasos para formular prompts",
    claves: ["metodo", "seis pasos", "pasos", "como escribir un prompt", "mejorar prompt", "tecnica"],
    texto: `1. **Defina el objetivo.** Empiece con un verbo: *Diseña, Crea, Analiza, Sugiere.*
2. **Use lenguaje específico y contextual:** nivel, asignatura, características del grupo, audiencia, formato.
3. **Pida iteraciones:** "hazlo más breve", "agrega ejemplos", "incluye el contexto chileno".
4. **Ajuste tono y nivel:** no es lo mismo el Comité Directivo Local que apoderados de un jardín.
5. **Evalúe la utilidad** con el protocolo de verificación.
6. **Experimente** con dos o tres variantes antes de usar el resultado.`
  },
  {
    id: "estructura-prompt", fuente: "M4", titulo: "Estructura de un prompt profesional (6 componentes)",
    claves: ["estructura", "componentes", "rol", "tarea", "contexto", "formato", "restricciones", "criterio de calidad", "plantilla"],
    texto: `| Componente | Ejemplo |
|---|---|
| **Rol** | "Actúa como jefe de UTP de un establecimiento de educación pública chileno…" |
| **Tarea** | "…diseña una rúbrica analítica…" |
| **Contexto** | "…para 6.° básico, Lenguaje, curso de 32 estudiantes heterogéneo en escritura…" |
| **Formato** | "…en tabla, cuatro criterios y tres niveles de logro." |
| **Restricciones** | "Lenguaje sencillo, máx. 25 palabras por descriptor, no inventes OA." |
| **Criterio de calidad** | "Cada descriptor debe ser observable en un producto del estudiante." |

Los prompts que fallan suelen carecer de alguno de los **primeros cuatro**. Organícelos en bloques rotulados.

💡 Escriba **"crear prompt"** y lo armamos juntos.`
  },
  {
    id: "ajustes", fuente: "M4", titulo: "Frases para ajustar la respuesta de la IA",
    claves: ["ajustar", "iterar", "respuesta mala", "muy largo", "generico", "muy tecnico", "corregir respuesta", "refinar"],
    texto: `- **Muy extenso:** "Redúcelo a la mitad conservando las ideas principales."
- **Genérico:** "Agrega ejemplos concretos referidos a [contexto]."
- **Muy técnico:** "Explícalo de manera más simple, para alguien sin formación en el tema."
- **No es chileno:** "Incluye referencias al contexto chileno y elimina terminología de otros sistemas."
- **Formato inútil:** "Reorganiza la información en una tabla con las columnas [X, Y, Z]."
- **Poco profundo:** "Amplía la sección sobre [tema] y reduce el resto."
- **Obvio:** "Elimina lo evidente para un profesional y concéntrate en lo no evidente."
- **Artificial:** "Usa un tono sobrio y profesional. Elimina los adjetivos valorativos."`
  },
  {
    id: "tecnicas", fuente: "M4", titulo: "Técnicas avanzadas de refinamiento",
    claves: ["tecnicas", "avanzado", "razonamiento", "alternativas", "limitaciones", "restricciones negativas"],
    texto: `- **Razonamiento antes del producto:** "Antes de redactar, explícame en tres puntos cómo vas a estructurar esta tarea. Espera mi confirmación."
- **Alternativas contrastantes:** "Entrégame tres versiones con enfoques distintos y explica qué prioriza y qué sacrifica cada una."
- **Identificar limitaciones:** "Al final, indica qué partes requieren verificación y en qué podrías estar equivocada."
- **Restricciones negativas** (suelen funcionar mejor): "No inventes objetivos de aprendizaje", "No cites normativa: yo la verificaré", "No completes datos faltantes: márcalos como pendientes".`
  },
  {
    id: "errores-prompt", fuente: "M4", titulo: "Errores frecuentes al escribir prompts",
    claves: ["errores", "equivocaciones", "fallas", "no funciona", "mala respuesta", "por que responde mal"],
    texto: `- **Sin objetivo** → empiece con un verbo y diga para qué se usará.
- **Sin nivel ni asignatura** → material desajustado.
- **Sin país** → normativa extranjera; escriba "sistema escolar chileno".
- **Aceptar la primera respuesta** → itere al menos una vez.
- **Pedir que cite normativa o datos** → referencias inventadas; prohíbalo y verifique usted.
- **Ingresar datos personales "para dar contexto"** → incumplimiento; anonimice.
- **Pedir evaluar un desempeño** → tarea no delegable.
- **Prompts largos sin estructura** → use bloques ROL, TAREA, CONTEXTO, FORMATO, RESTRICCIONES.`
  },
  {
    id: "prompts-estudiantes", fuente: "M4", titulo: "Enseñar a formular prompts a estudiantes",
    claves: ["ensenar", "estudiantes prompts", "ciudadania digital", "por ciclo", "primer ciclo", "media", "actividad"],
    texto: `- **Primer ciclo básico — "La IA no siempre tiene razón":** detectar un error evidente y verificarlo.
- **Segundo ciclo — "Preguntar bien cambia la respuesta":** comparar una pregunta vaga y una específica.
- **Educación media — "Verificar y contrastar":** misma pregunta a dos herramientas, contrastar con fuentes primarias.
- **Media avanzada — "Pensar, no responder":** usar la IA como contraparte crítica de un argumento propio.

El objetivo: estudiantes **creadores y críticos**, no solo consumidores (MINEDUC, 2025).`
  },

  /* ---------------------------- MANUAL 5 ---------------------------- */
  {
    id: "plataforma-propia", fuente: "M5", titulo: "Construir una plataforma propia (arquitectura)",
    claves: ["plataforma propia", "arquitectura", "github", "github pages", "apps script", "google sheets", "pagina web", "construir", "hosting"],
    texto: `Arquitectura recomendada, gratuita en su nivel básico:
- **Frontend** (HTML, CSS, JS) → publicado en **GitHub Pages**.
- **Backend / API** → **Google Apps Script**.
- **Base de datos** → **Google Sheets**.

Flujo: el navegador envía datos a la API de Apps Script → valida y escribe en la planilla → responde → la página muestra la confirmación.

**Regla que nunca se rompe:** *nada secreto en el frontend* (ni claves de API, ni contraseñas, ni IDs de planillas sensibles). En GitHub el historial conserva todo: si se publica una clave por error, **revóquela** y genere otra.

*Este mismo asistente está construido así.*`
  },
  {
    id: "github-pages", fuente: "M5", titulo: "Publicar un sitio en GitHub Pages paso a paso",
    claves: ["publicar", "github pages", "repositorio", "subir archivos", "index.html", "settings pages", "pasos github"],
    texto: `1. Cree una cuenta (ideal: **organización institucional** con al menos dos administradores).
2. **New** → repositorio sin espacios ni tildes, **Público**, con README.
3. **Add file → Upload files**. El archivo principal debe llamarse **index.html** y estar en la raíz.
4. **Settings → Pages** → *Deploy from a branch* → rama **main**, carpeta raíz → Save.
5. Espere 1–3 minutos: \`https://organizacion.github.io/repositorio/\`
6. Marque **Enforce HTTPS**.

**Dominio:** lo recomendable es un subdominio institucional (registro **CNAME**), no un dominio a nombre de un funcionario.`
  },
  {
    id: "sheets-bd", fuente: "M5", titulo: "Google Sheets como base de datos",
    claves: ["google sheets", "planilla", "base de datos", "hoja", "columnas", "reglas de diseno"],
    texto: `- **Una hoja por entidad.**
- Fila 1 = nombres de columna sin espacios ni tildes; sin celdas combinadas.
- Una fila = un registro; sin filas en blanco ni totales.
- Primera columna = **identificador único**.
- Fechas en formato **ISO** (2026-10-13).
- Sin fórmulas en hojas que escribe el sistema.
- **Separar** la hoja de registros (con códigos) de la de correspondencia código-nombre (más restringida).

⚠️ La planilla **no se comparte** con usuarios ni con enlace público.`
  },
  {
    id: "apps-script", fuente: "M5", titulo: "Crear la API con Google Apps Script",
    claves: ["apps script", "api", "doget", "dopost", "implementar", "propiedades del script", "lockservice", "cors"],
    texto: `1. Desde la planilla: **Extensiones → Apps Script**.
2. Defina \`doGet\` (lectura) y \`doPost\` (escritura); use **LockService** para evitar escrituras simultáneas.
3. Credenciales en **Configuración del proyecto → Propiedades del script** (nunca en el código).
4. **Implementar → Nueva implementación → Aplicación web**. *Ejecutar como:* Yo. *Quién tiene acceso:* cuentas de la organización si hay datos personales.
5. Copie la URL \`https://script.google.com/macros/s/…/exec\`.

**Truco CORS:** envíe el POST con \`Content-Type: text/plain;charset=utf-8\`.
Cada cambio de código requiere **nueva versión** de la implementación.`
  },
  {
    id: "problemas", fuente: "M5", titulo: "Solución de problemas frecuentes",
    claves: ["error", "404", "no funciona", "cors", "no se actualiza", "problema", "falla", "soporte", "ayuda tecnica"],
    texto: `- **Error 404 en Pages:** el archivo no se llama exactamente \`index.html\` o no está en la raíz.
- **Cambios no se ven:** espere 2 min y recargue con **Ctrl + F5**; revise la pestaña *Actions*.
- **Error CORS:** use \`text/plain;charset=utf-8\` en el POST.
- **La API devuelve HTML:** acceso restringido; inicie sesión con la cuenta institucional.
- **Código nuevo sin efecto:** *Administrar implementaciones* → editar → nueva versión.
- **Registros perdidos al guardar a la vez:** falta LockService.
- **Error de autorización:** ejecute una función a mano y vuelva a autorizar.
- **Dominio no carga:** espere hasta 24 h y verifique el archivo CNAME.
- **Planilla lenta:** archive registros antiguos y quite fórmulas.

La consola del navegador se abre con **F12**.`
  },
  {
    id: "seguridad-plataforma", fuente: "M5", titulo: "Seguridad, respaldo y continuidad de una plataforma",
    claves: ["seguridad", "respaldo", "backup", "continuidad", "perfiles", "permisos", "lista de verificacion", "traspaso"],
    texto: `**Seguridad:** ninguna credencial en el repositorio; planilla no pública; app web restringida a la organización; operaciones de escritura verifican perfil; HTTPS forzado; bitácora sin contenido sensible; dos administradores.

**Respaldo:** copia semanal automática (activador de Apps Script) en una **unidad compartida institucional**, conservando los últimos 12.

**Continuidad:** organización de GitHub, planilla y Apps Script con al menos dos responsables; subdominio institucional; clave de IA institucional; \`docs/MANUAL.md\` actualizado.

**Cuándo NO usar esta arquitectura:** si ya existe un sistema institucional, si el volumen es territorial, si los datos son especialmente sensibles (salud, vulneración) o si no hay quién la mantenga.`
  },

  /* ------------------- FUENTES OFICIALES EXTERNAS -------------------
     Verificadas en los sitios oficiales en octubre de 2026.
     Revise los enlaces al menos una vez al año. */
  {
    id: "ext-potencia", fuente: "EXT", titulo: "Guía MINEDUC «PotencIA el aprendizaje» (2025)",
    claves: ["potencia", "potencia el aprendizaje", "guia mineduc", "mineduc", "centro de innovacion", "orientaciones mineduc", "guia oficial"],
    texto: `El **Ministerio de Educación** lanzó el 12 de marzo de 2025 la guía **«PotencIA el aprendizaje: Preguntas para la reflexión y práctica de la Inteligencia Artificial generativa en contextos educativos»**, elaborada por el **Centro de Innovación**.

- No entrega respuestas cerradas: propone **preguntas para orientar la reflexión del equipo pedagógico** sobre cómo usar la IA de forma **creativa, crítica y responsable**.
- Se basa en potenciar lo que nos hace humanos y en un uso seguro de la IA.
- Junto con ella se anunciaron **webinars y talleres regionales**, un **curso para directivos** sobre IA en la gestión educativa (con Fundación Chile y CENIA), un espacio temático de IA en **educarchile** y cursos del **CPEIP**.

🔗 [Guía en Ciudadanía Digital](https://ciudadaniadigital.mineduc.cl/recurso/nueva-guia-para-docentes-potencia-el-aprendizaje/)
🔗 [Portal de IA del MINEDUC](https://ciudadaniadigital.mineduc.cl/ia/)
🔗 [Noticia oficial (mineduc.cl)](https://www.mineduc.cl/mineduc-lanza-guia-para-potenciar-el-aprendizaje-integrando-el-uso-de-la-inteligencia-artificial-en-contextos-educativos/)`
  },
  {
    id: "ext-chatgpt", fuente: "EXT", titulo: "Guía MINEDUC: Cómo usar ChatGPT para el aprendizaje activo (2023)",
    claves: ["guia chatgpt", "aprendizaje activo", "chatgpt mineduc", "2023", "guia para docentes"],
    texto: `Publicada por el MINEDUC en **2023**, entrega un marco de acción, recursos y orientaciones para equipos docentes, estudiantes y familias sobre el uso de ChatGPT para **potenciar el aprendizaje activo**, en el marco de la **Ciudadanía Digital**.

Sus preguntas de verificación se usan en el Manual 2: ¿la respuesta es precisa?, ¿cómo compruebo su veracidad?, ¿es correcta en cualquier contexto?, ¿reproduce estereotipos?

🔗 [Guía en Ciudadanía Digital](https://ciudadaniadigital.mineduc.cl/recurso/guia-para-docentes-como-usar-chatgpt-para-potenciar-el-aprendizaje-activo/)`
  },
  {
    id: "ext-cpeip", fuente: "EXT", titulo: "Cursos de IA del CPEIP para docentes y directivos",
    claves: ["cpeip", "curso", "cursos", "capacitacion", "formacion", "taller", "talleres", "perfeccionamiento", "desarrollo profesional", "gratis", "postular"],
    texto: `El **CPEIP** (Centro de Perfeccionamiento, Experimentación e Investigaciones Pedagógicas del MINEDUC) desarrolla un **Plan de Formación en Inteligencia Artificial en Educación**, en concordancia con el Marco de Competencias Digitales elaborado con UNESCO. Entre sus acciones formativas:

- **Introducción a la Inteligencia Artificial y su uso educativo:** qué es la IA, oportunidades y desafíos, herramientas y cómo escribir buenas instrucciones (prompts).
- **Talleres para incorporar IA a la labor docente** (ChatGPT, MagicSchool, Gemini).
- **Talleres de IA para evaluar y retroalimentar** aprendizajes (evaluación formativa).
- **Comunidades Virtuales de Aprendizaje:** uso de la IA para la preparación de la enseñanza (Dominio A del Marco para la Buena Enseñanza).
- **Mejorando la gestión escolar con IA:** análisis de datos y toma de decisiones, para equipos directivos.

Las convocatorias cambian cada año: revise las vigentes en la plataforma oficial.
🔗 [Desarrollo Docente en Línea (CPEIP)](https://desarrollodocenteenlinea.cpeip.cl)
🔗 [Plan de formación en IA del CPEIP](https://cpeip.cl/cpeip-liderando-la-formacion-docente-en-inteligencia-artificial/)`
  },
  {
    id: "ext-competencias-digitales", fuente: "EXT", titulo: "Marco Orientador de Competencias Digitales Docentes (MINEDUC–UNESCO)",
    claves: ["competencias digitales", "marco orientador", "competencias docentes", "marco competencias", "buena ensenanza", "unesco santiago"],
    texto: `Elaborado por el **MINEDUC** (Centro de Innovación y CPEIP) con apoyo de **UNESCO Santiago**, busca fortalecer las competencias digitales de docentes, directivos y otros profesionales de la educación, **alineado con el Marco para la Buena Enseñanza**.

- **Dimensiones:** compromiso profesional, competencias pedagógicas y ciudadanía digital de los estudiantes.
- **Progresión en cuatro niveles**, formativa, gradual y contextualizada.

🔗 [Marco Orientador (Ciudadanía Digital)](https://ciudadaniadigital.mineduc.cl/recurso/marco-orientador-de-competencias-digitales-docentes/)`
  },
  {
    id: "ext-recursos-mineduc", fuente: "EXT", titulo: "Recursos MINEDUC de IA para el aula y las familias",
    claves: ["recursos", "chatsp", "sumo primero", "matematica", "humania", "rural", "familias", "kit", "alfabetizacion digital", "clic a clic", "ensena chile"],
    texto: `- **ChatSP:** asistente con IA generativa para docentes de **1° a 6° básico**, experto en los textos **Sumo Primero** de matemática (planificación, secuencias, estrategias). Plan Nacional Sumo Primero con el Centro de Modelamiento Matemático de la U. de Chile. 🔗 [chat.sumoprimero.cl](https://chat.sumoprimero.cl/)
- **HumanIA:** propuesta de enseñanza sobre IA con guías para docentes y estudiantes de **educación media**. 🔗 [Ver recurso](https://ciudadaniadigital.mineduc.cl/recurso/humania-propuesta-de-ensenanza-sobre-inteligencia-artificial/)
- **«Tejiendo redes de aprendizaje», módulo IA:** recursos abiertos MINEDUC–Enseña Chile con enfoque **territorial**, pensados para la educación **rural**. 🔗 [Ver recurso](https://ciudadaniadigital.mineduc.cl/recurso/alfabetizacion-digital-en-la-educacion-rural-inteligencia-artificial/)
- **Kit de Ciudadanía Digital para familias:** videos, cartillas y módulos sobre uso responsable de la tecnología. 🔗 [Ver kit](https://ciudadaniadigital.mineduc.cl/recurso/recursos-para-trabajar-con-familias-en-el-desarrollo-de-la-ciudadania-digital/)
- **Clic a Clic:** set de alfabetización digital para la trayectoria escolar. 🔗 [Ver set](https://ciudadaniadigital.mineduc.cl/recurso/clic-a-clic-set-de-alfabetizacion-digital/)`
  },
  {
    id: "ext-unesco-guia", fuente: "EXT", titulo: "UNESCO: Guía para el uso de IA generativa en educación e investigación",
    claves: ["unesco", "guia unesco", "ia generativa", "regulacion", "edad", "limite de edad", "internacional", "centrado en el ser humano"],
    texto: `Primera guía mundial de la **UNESCO** sobre IA generativa en educación (2023). Propone un enfoque **centrado en el ser humano** y recomienda, entre otras medidas:

- **Proteger la privacidad de los datos** de los usuarios.
- Establecer un **límite de edad** para las conversaciones independientes de estudiantes con plataformas de IA generativa, con un enfoque adecuado a la edad.
- Que las instituciones **validen ética y pedagógicamente** las herramientas antes de usarlas.
- Resguardar la **agencia humana**: la IA apoya, no reemplaza, el juicio de docentes y estudiantes.

Es coherente con la pauta de evaluación de herramientas del Manual 3 (edad mínima, datos, transparencia).
🔗 [Guía en español (UNESDOC)](https://unesdoc.unesco.org/ark:/48223/pf0000389227_spa)`
  },
  {
    id: "ext-unesco-competencias", fuente: "EXT", titulo: "UNESCO: Marcos de competencias en IA para docentes y estudiantes",
    claves: ["competencias ia", "marco unesco", "competencias docentes ia", "competencias estudiantes", "dimensiones", "adquirir profundizar crear"],
    texto: `**Para docentes (UNESCO, 2024):** 15 competencias en **5 dimensiones**:
1. Mentalidad centrada en el ser humano.
2. Ética de la IA.
3. Fundamentos y aplicaciones de la IA.
4. Pedagogía con IA.
5. IA para el desarrollo profesional.

Con **tres niveles de progresión: adquirir, profundizar y crear**. Se funda en proteger los derechos de los docentes, potenciar la agencia humana y promover la sostenibilidad.

**Para estudiantes:** 4 dimensiones: mentalidad centrada en el ser humano, ética de la IA, técnicas y aplicaciones de la IA, y diseño de sistemas de IA. UNESCO advierte no usar la IA para "resolver" problemas estructurales como la falta de docentes o de infraestructura.

🔗 [Marco para docentes (en español)](https://unesdoc.unesco.org/ark:/48223/pf0000393813)
🔗 [Resumen de ambos marcos](https://www.unesco.org/en/articles/what-you-need-know-about-unescos-new-ai-competency-frameworks-students-and-teachers)`
  },
  {
    id: "ext-politica-nacional", fuente: "EXT", titulo: "Política Nacional de Inteligencia Artificial de Chile (actualización 2024)",
    claves: ["politica nacional", "decreto 12", "minciencia", "politica de ia", "estrategia nacional", "chile ia", "gobierno"],
    texto: `La **Política Nacional de IA** (Ministerio de Ciencia, 2021) fue actualizada mediante el **Decreto N.º 12**, publicado en el Diario Oficial el **28 de enero de 2025**.

En el ámbito escolar plantea, entre otros objetivos:
- Promover habilidades para el **uso, desarrollo, comprensión y análisis crítico** de la IA en el sistema escolar.
- Generar **recursos de aprendizaje** sobre IA para el contexto educativo.
- Fortalecer los conocimientos TIC en las **bases curriculares**, incluido el uso ético de la IA.
- Formar a docentes en pensamiento computacional, programación y robótica.

🔗 [Decreto 12 en LeyChile (BCN)](https://www.bcn.cl/leychile/navegar?idNorma=1210664)`
  },
  {
    id: "ext-donde-buscar", fuente: "EXT", titulo: "¿Dónde buscar información confiable sobre IA en educación?",
    claves: ["fuentes confiables", "donde buscar", "enlaces", "sitios oficiales", "recursos oficiales", "informacion oficial", "links", "bibliografia"],
    texto: `**Fuentes oficiales recomendadas:**
- **MINEDUC · Ciudadanía Digital (IA):** 🔗 [ciudadaniadigital.mineduc.cl/ia](https://ciudadaniadigital.mineduc.cl/ia/)
- **CPEIP · cursos gratuitos:** 🔗 [desarrollodocenteenlinea.cpeip.cl](https://desarrollodocenteenlinea.cpeip.cl)
- **Biblioteca del Congreso Nacional (leyes):** 🔗 [bcn.cl/leychile](https://www.bcn.cl/leychile)
- **Ley 21.719 de datos personales:** 🔗 [Texto en LeyChile](https://www.bcn.cl/leychile/navegar?idNorma=1208650)
- **Guía de la Secretaría de Gobierno Digital sobre la nueva ley de datos:** 🔗 [wikiguias.digital.gob.cl](https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales)
- **UNESCO · IA en educación:** 🔗 [unesco.org](https://www.unesco.org/en/digital-education/artificial-intelligence)

**Regla práctica:** si una norma, cifra o recurso no aparece en un sitio oficial, no se usa en un documento institucional.`
  }
];

/* =====================================================================
   ASISTENTE DE PROMPTS (flujo guiado dentro del chat)
   ===================================================================== */
const TIPOS_MATERIAL = [
  { id: "guia",        nombre: "Guía de trabajo",           rol: "docente con experiencia en diversificación de la enseñanza en el sistema escolar chileno", tarea: "diseña una guía de trabajo", formato: "título, objetivo en lenguaje para estudiantes, instrucciones paso a paso, 3 a 5 actividades de dificultad progresiva y una pregunta de cierre metacognitiva" },
  { id: "rubrica",     nombre: "Rúbrica de evaluación",     rol: "jefe de UTP de un establecimiento de educación pública chileno con experiencia en evaluación formativa", tarea: "diseña una rúbrica analítica", formato: "tabla con cuatro criterios y tres niveles de logro (Logrado, En desarrollo, Por lograr), más una columna con sugerencia de retroalimentación para el nivel más bajo" },
  { id: "prueba",      nombre: "Prueba / banco de ítems",   rol: "especialista en evaluación educativa del sistema escolar chileno", tarea: "genera 10 preguntas de selección múltiple de cuatro alternativas", formato: "cada pregunta con sus alternativas y, al lado, qué error conceptual frecuente representa cada distractor; alternativas de extensión similar y sin 'todas/ninguna de las anteriores'" },
  { id: "clase",       nombre: "Planificación de clase",    rol: "docente experimentado del sistema escolar chileno", tarea: "diseña la secuencia de una clase de 90 minutos", formato: "inicio, desarrollo y cierre con tiempos, actividades, preguntas clave y evidencia de aprendizaje; al menos 60 % de trabajo activo de los estudiantes" },
  { id: "diversificar",nombre: "Diversificar un material",  rol: "docente con experiencia en diversificación de la enseñanza (DUA) en el sistema escolar chileno", tarea: "genera tres versiones del material que pegaré al final", formato: "VERSIÓN A con mayor andamiaje (pasos desglosados, ejemplo resuelto, vocabulario clave); VERSIÓN B estándar; VERSIÓN C con mayor demanda cognitiva. Las tres evalúan el mismo aprendizaje y se ven similares entre sí" },
  { id: "texto",       nombre: "Adaptar un texto",          rol: "docente especialista en comprensión lectora del sistema escolar chileno", tarea: "adapta la complejidad léxica del texto que pegaré al final", formato: "texto adaptado, glosario de 5 palabras clave y 4 preguntas de comprensión (literal, inferencial y crítica)" },
  { id: "comunicado",  nombre: "Comunicado a familias",     rol: "especialista en comunicación institucional para comunidades escolares chilenas", tarea: "redacta un comunicado informativo", formato: "asunto, saludo, mensaje en frases cortas, qué deben hacer las familias, a quién dirigirse y despedida; máximo 200 palabras" },
  { id: "infografia",  nombre: "Infografía / afiche",       rol: "diseñador instruccional del sistema escolar chileno", tarea: "propón el contenido y la estructura de una infografía", formato: "título atractivo, 4 a 6 bloques breves (máx. 25 palabras c/u), sugerencia de íconos o imágenes y una llamada a la acción; texto listo para pegar en Canva" }
];

const NIVELES = ["Educación Parvularia", "1° a 4° básico", "5° a 8° básico", "1° a 2° medio", "3° a 4° medio", "Técnico-Profesional", "Educación de adultos"];

/* Referencias locales SUGERIDAS para contextualizar material por comuna.
   Son puntos de partida: cada docente puede reemplazarlas por las del
   entorno real de su establecimiento. Edite o agregue según necesidad. */
const COMUNAS = {
  "Concepción": {
    descripcion: "capital regional, con barrios residenciales, comercio, servicios, universidades y también sectores periurbanos",
    referencias: ["el río Biobío y el río Andalién", "el cerro Caracol y el Parque Ecuador", "la laguna Las Tres Pascualas", "el comercio del centro y las ferias", "el transporte público y el Biotrén", "las universidades y la vida de barrio"]
  },
  "Chiguayante": {
    descripcion: "comuna ribereña del Biobío, entre cerros de la cordillera de la Costa, con barrios residenciales y tradición textil",
    referencias: ["la ribera del río Biobío", "los cerros y quebradas con bosque", "el Biotrén y la conexión con Concepción", "su historia textil", "el comercio local y las ferias", "la vida de barrio"]
  },
  "Florida": {
    descripcion: "comuna del secano interior de la cordillera de la Costa, con sectores rurales, agricultura familiar y actividad forestal",
    referencias: ["la agricultura familiar y las huertas", "la actividad forestal y el cuidado del bosque nativo", "los sectores rurales como Copiulemu", "los caminos rurales y el transporte interurbano", "las ferias y productos locales", "la prevención de incendios forestales"]
  },
  "Hualqui": {
    descripcion: "comuna ribereña del Biobío de origen histórico, con zona urbana y extensos sectores rurales, agrícolas y forestales",
    referencias: ["la ribera del río Biobío", "los sectores rurales como Talcamávida y Quilacoya", "la agricultura y la actividad forestal", "su historia colonial y patrimonio local", "el tren y la conexión con Concepción", "la vida de pueblo y sus tradiciones"]
  }
};

const ENTORNOS = ["Urbano", "Rural", "Mixto (urbano y rural)"];

const RECURSOS_AULA = [
  "Proyector e internet estable",
  "Internet intermitente",
  "Sin internet: solo impresión",
  "Computadores o tablets para estudiantes"
];
