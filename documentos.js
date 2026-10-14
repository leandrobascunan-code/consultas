/* =====================================================================
   BIBLIOTECA · DOCUMENTOS OFICIALES Y DE REFERENCIA
   ---------------------------------------------------------------------
   Separados de los manuales del SLEP. Enlaces verificados en los sitios
   oficiales en octubre de 2026 (revisar una vez al año).

   Campos:
     id, cat (categoría), titulo, org (institución), anio,
     resumen: puntos clave (una línea por punto, empezando con "- "),
     url:  página oficial,  pdf: copia local para descargar (opcional),
     pdfOficial: PDF en el sitio oficial (opcional)
   ===================================================================== */
const CATEGORIAS_DOC = {
  normativa: { nombre: "Normativa", emoji: "⚖️", color: "#9b59d0" },
  mineduc:   { nombre: "MINEDUC · IA en educación", emoji: "🤖", color: "#0071ea" },
  cpeip:     { nombre: "CPEIP · Marcos profesionales", emoji: "🎓", color: "#4fa61a" },
  curriculo: { nombre: "Currículum", emoji: "📗", color: "#0b8f6a" },
  convivencia: { nombre: "Convivencia, inclusión y asistentes", emoji: "🤝", color: "#d9622b" },
  gestion:   { nombre: "Gestión y liderazgo", emoji: "🧭", color: "#5b4bd1" },
  servicio:  { nombre: "SLEP Andalién Sur", emoji: "🏫", color: "#f0a500" },
  internacional: { nombre: "Internacional", emoji: "🌎", color: "#e0559b" }
};

const DOCUMENTOS = [
  /* ---------------- NORMATIVA ---------------- */
  { id: "ley-21719", cat: "normativa", titulo: "Ley N.º 21.719: protección y tratamiento de datos personales", org: "Biblioteca del Congreso Nacional", anio: "2024",
    resumen: "- Regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales.\n- Publicada el 13 de diciembre de 2024; **plena vigencia desde el 1 de diciembre de 2026**. Última modificación: Ley 21.806 (febrero de 2026).\n- Ocho principios: licitud, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia y confidencialidad.\n- Obligación especial de los establecimientos educacionales con los datos de niños, niñas y adolescentes (art. 16 quáter).\n- Es la base de la regla de los manuales: ningún dato personal entra a plataformas de IA de uso público.",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=1208650", pdf: "Ley-21719.pdf" },
  { id: "guia-gob-digital", cat: "normativa", titulo: "Guía práctica para implementar la nueva Ley de Datos Personales en la Administración", org: "Secretaría de Gobierno Digital", anio: "",
    resumen: "- Orientaciones prácticas para que los organismos públicos cumplan la Ley 21.719.\n- Útil para el inventario de tratamientos, la política de datos y la atención de solicitudes de los titulares.",
    url: "https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales" },
  { id: "ley-21040", cat: "normativa", titulo: "Ley N.º 21.040: crea el Sistema de Educación Pública", org: "Biblioteca del Congreso Nacional", anio: "2017",
    resumen: "- Crea los Servicios Locales de Educación Pública y traspasa la administración de los establecimientos desde los municipios.\n- Define el Plan Estratégico Local y el Plan Anual como instrumentos de gestión.\n- Artículo 2: la educación pública orientada al pleno desarrollo de los estudiantes (base del sello de formación integral).",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=1111237" },
  { id: "ley-19628", cat: "normativa", titulo: "Ley N.º 19.628: protección de la vida privada", org: "Biblioteca del Congreso Nacional", anio: "1999",
    resumen: "- Ley de datos personales vigente hasta la plena entrada en vigencia de la Ley 21.719, que la reforma íntegramente.\n- Define los datos sensibles (salud, situación socioeconómica, entre otros).",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=141599" },
  { id: "ley-20285", cat: "normativa", titulo: "Ley N.º 20.285: acceso a la información pública", org: "Biblioteca del Congreso Nacional", anio: "2008",
    resumen: "- Consagra el principio de transparencia de la función pública.\n- Los documentos institucionales pueden ser requeridos: su trazabilidad y autoría importan, también cuando se elaboran con apoyo de IA.",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=276363" },
  { id: "decreto-12", cat: "normativa", titulo: "Política Nacional de Inteligencia Artificial (actualización, Decreto N.º 12)", org: "Ministerio de Ciencia · BCN", anio: "2025",
    resumen: "- Actualiza la Política Nacional de IA; publicado en el Diario Oficial el 28 de enero de 2025.\n- En educación: desarrollar habilidades de uso, comprensión y análisis crítico de la IA, generar recursos de aprendizaje y fortalecer las bases curriculares en uso ético de la IA.",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=1210664" },

  /* ---------------- MINEDUC · IA ---------------- */
  { id: "potencia", cat: "mineduc", titulo: "PotencIA el aprendizaje: preguntas para la reflexión y práctica de la IA generativa", org: "MINEDUC · Centro de Innovación", anio: "2025",
    resumen: "- Guía oficial lanzada el 12 de marzo de 2025 para docentes y comunidades educativas.\n- No entrega respuestas cerradas: propone preguntas para orientar la reflexión del equipo pedagógico.\n- Principios: potenciar lo humano, herramienta para pensar, creatividad, resguardo ético, equidad e inclusión, aprendizaje activo.",
    url: "https://ciudadaniadigital.mineduc.cl/recurso/nueva-guia-para-docentes-potencia-el-aprendizaje/" },
  { id: "guia-chatgpt", cat: "mineduc", titulo: "Guía para docentes: cómo usar ChatGPT para potenciar el aprendizaje activo", org: "MINEDUC · Centro de Innovación", anio: "2023",
    resumen: "- Marco de acción, recursos y orientaciones para docentes, estudiantes y familias.\n- Incluye preguntas de verificación: ¿es precisa la respuesta?, ¿cómo compruebo su veracidad?, ¿reproduce estereotipos?",
    url: "https://ciudadaniadigital.mineduc.cl/recurso/guia-para-docentes-como-usar-chatgpt-para-potenciar-el-aprendizaje-activo/" },
  { id: "portal-ia", cat: "mineduc", titulo: "Portal de Inteligencia Artificial · Ciudadanía Digital", org: "MINEDUC", anio: "",
    resumen: "- Reúne recursos oficiales: ChatSP (asistente de matemática Sumo Primero, 1° a 6° básico), HumanIA (propuesta para educación media), módulo de IA para educación rural, webinars y guías.",
    url: "https://ciudadaniadigital.mineduc.cl/ia/" },
  { id: "humania", cat: "mineduc", titulo: "HumanIA: propuesta de enseñanza sobre inteligencia artificial", org: "MINEDUC · Ciudadanía Digital", anio: "",
    resumen: "- Recursos didácticos y guías para docentes y estudiantes de educación media.\n- Enfocada en la comprensión y el uso responsable de la IA.",
    url: "https://ciudadaniadigital.mineduc.cl/recurso/humania-propuesta-de-ensenanza-sobre-inteligencia-artificial/" },
  { id: "competencias-digitales", cat: "mineduc", titulo: "Marco Orientador de Competencias Digitales Docentes", org: "MINEDUC · CPEIP · UNESCO Santiago", anio: "",
    resumen: "- Fortalece las competencias digitales de docentes, directivos y otros profesionales, alineado con el Marco para la Buena Enseñanza.\n- Tres dimensiones: compromiso profesional, competencias pedagógicas y ciudadanía digital de los estudiantes.\n- Progresión en cuatro niveles.",
    url: "https://ciudadaniadigital.mineduc.cl/recurso/marco-orientador-de-competencias-digitales-docentes/",
    pdfOficial: "https://ciudadaniadigital.mineduc.cl/wp-content/uploads/2025/06/Marco-Orientador-de-Competencias-Digitales-Docentes-V012026_1.pdf" },

  /* ---------------- CPEIP ---------------- */
  { id: "mbe", cat: "cpeip", titulo: "Marco para la Buena Enseñanza (MBE)", org: "CPEIP · MINEDUC", anio: "2021",
    resumen: "- Estándares de la profesión docente: **4 dominios y 12 estándares**.\n- A: preparación de la enseñanza · B: ambiente propicio · C: enseñanza para el aprendizaje de todos · D: responsabilidades profesionales.",
    url: "https://estandaresdocentes.mineduc.cl/wp-content/uploads/2021/08/MBE-2.pdf", pdfOficial: "https://estandaresdocentes.mineduc.cl/wp-content/uploads/2021/08/MBE-2.pdf" },
  { id: "mbe-parvularia", cat: "cpeip", titulo: "Marco para la Buena Enseñanza de Educación Parvularia", org: "Subsecretaría de Educación Parvularia", anio: "2019",
    resumen: "- Referente para una práctica pedagógica reflexiva y pertinente.\n- Cuatro dominios con 16 criterios; énfasis en el bienestar integral, el juego y la cultura de aprendizaje desafiante y lúdica.",
    url: "https://parvularia.mineduc.cl/wp-content/uploads/2020/05/19-10-30-MBE-EP-Final-para-web-largo-comprimido-1.pdf", pdfOficial: "https://parvularia.mineduc.cl/wp-content/uploads/2020/05/19-10-30-MBE-EP-Final-para-web-largo-comprimido-1.pdf" },
  { id: "mbdle", cat: "cpeip", titulo: "Marco para la Buena Dirección y el Liderazgo Escolar (MBDLE)", org: "CPEIP · MINEDUC", anio: "2015",
    resumen: "- Cinco dimensiones de prácticas: visión estratégica compartida, capacidades profesionales, procesos de enseñanza y aprendizaje, convivencia y participación, gestión del establecimiento.\n- Recursos personales: principios, habilidades y conocimientos profesionales.",
    url: "https://liderazgoeducativo.mineduc.cl/marco-para-la-buena-direccion-y-el-liderazgo-escolar-2/", pdfOficial: "https://liderazgoeducativo.mineduc.cl/wp-content/uploads/sites/55/2016/04/MBDLE_2015.pdf" },
  { id: "cpeip-ia", cat: "cpeip", titulo: "Plan de Formación en Inteligencia Artificial en Educación", org: "CPEIP", anio: "",
    resumen: "- Cursos y talleres gratuitos: introducción a la IA y su uso educativo, IA para la labor docente, IA para evaluar y retroalimentar, comunidades virtuales de aprendizaje y gestión escolar con IA.\n- Las convocatorias cambian cada año: revise las vigentes en Desarrollo Docente en Línea.",
    url: "https://cpeip.cl/cpeip-liderando-la-formacion-docente-en-inteligencia-artificial/" },
  { id: "ddl", cat: "cpeip", titulo: "Desarrollo Docente en Línea (cursos vigentes)", org: "CPEIP", anio: "",
    resumen: "- Plataforma oficial de formación continua gratuita para docentes, educadoras y directivos.",
    url: "https://desarrollodocenteenlinea.cpeip.cl" },

  /* ---------------- CURRÍCULUM ---------------- */
  { id: "bases", cat: "curriculo", titulo: "Bases Curriculares vigentes", org: "MINEDUC · Unidad de Currículum y Evaluación", anio: "",
    resumen: "- Objetivos de Aprendizaje (OA) por nivel y asignatura: Educación Parvularia (vigentes desde 2019), 1° a 6° básico, 7° básico a 2° medio, 3° y 4° medio, Formación Diferenciada TP y Educación de Personas Jóvenes y Adultas (2024).\n- Copie el OA exacto desde aquí antes de pedir material a la IA.",
    url: "https://www.curriculumnacional.cl/Curriculum/Bases_Curriculares" },

  /* ---------------- CONVIVENCIA, INCLUSIÓN Y ASISTENTES ---------------- */
  { id: "ley-21809", cat: "convivencia", titulo: "Orientaciones para la implementación de la Ley N.º 21.809", org: "MINEDUC · Cultura Educativa", anio: "2026",
    resumen: "- Cambios en materia de convivencia educativa, buen trato y bienestar.\n- Orienta su aplicación en gestión institucional, participación, bienestar y salud mental.",
    url: "https://culturaeducativa.mineduc.gob.cl/recursos-convivencia/", pdfOficial: "https://culturaeducativa.mineduc.gob.cl/wp-content/uploads/2026/08/ORIENTACIONES-PARA-LA-IMPLEMENTACION-DE-LA-LEY-21.809.pdf" },
  { id: "plan-convivencia", cat: "convivencia", titulo: "Plan de gestión de convivencia educativa 2026", org: "MINEDUC · Cultura Educativa", anio: "2026",
    resumen: "- Guía para planificar la convivencia de forma estratégica y participativa, alineada con la Ley 21.809 y la Política Nacional de Convivencia Educativa.",
    url: "https://culturaeducativa.mineduc.gob.cl/recursos-convivencia/", pdfOficial: "https://culturaeducativa.mineduc.gob.cl/wp-content/uploads/2026/07/PLAN-DE-GESTION-DE-CONVIVENCIA-EDUCATIVA-2026.pdf" },
  { id: "recursos-convivencia", cat: "convivencia", titulo: "Recursos de convivencia educativa (portal)", org: "MINEDUC · Cultura Educativa", anio: "",
    resumen: "- Reglamentos internos, protocolos, gestión colaborativa de conflictos, aprendizaje socioemocional, bienestar y salud mental.",
    url: "https://culturaeducativa.mineduc.gob.cl/recursos-convivencia/" },
  { id: "pie-asistentes", cat: "convivencia", titulo: "Profesionales asistentes de la educación: rol y funciones en el PIE", org: "MINEDUC · Educación Especial", anio: "2019",
    resumen: "- Tres roles: evaluador, de apoyo y colaborador, en el marco de una educación inclusiva.\n- Trabajo colaborativo entre profesionales PIE y docentes de aula regular.",
    url: "https://especial.mineduc.cl/wp-content/uploads/sites/31/2020/01/Profesionales-asistentes-de-la-educacion-002.pdf", pdfOficial: "https://especial.mineduc.cl/wp-content/uploads/sites/31/2020/01/Profesionales-asistentes-de-la-educacion-002.pdf" },
  { id: "asistentes-reforma", cat: "convivencia", titulo: "Asistentes de la Educación en la Reforma Educativa", org: "MINEDUC", anio: "2007",
    resumen: "- Material de apoyo: participación en la comunidad educativa, PEI, normativa escolar, Consejo Escolar, comunicación, resolución de conflictos, seguridad escolar y prevención.",
    url: "https://www.comunidadescolar.cl/wp-content/uploads/2019/07/AsistentesparaLaeducacion.pdf", pdfOficial: "https://www.comunidadescolar.cl/wp-content/uploads/2019/07/AsistentesparaLaeducacion.pdf" },

  /* ---------------- GESTIÓN Y LIDERAZGO ---------------- */
  { id: "pme", cat: "gestion", titulo: "Orientaciones PME 2026", org: "MINEDUC · Liderazgo Educativo", anio: "2026",
    resumen: "- Orientaciones para el Plan de Mejoramiento Educativo del año.\n- El sitio incluye herramientas PME, set de rúbricas y datos de avance.",
    url: "https://liderazgoeducativo.mineduc.cl/orientaciones-pme-2026-2/" },
  { id: "eid", cat: "gestion", titulo: "Estándares Indicativos de Desempeño", org: "MINEDUC · Liderazgo Educativo", anio: "",
    resumen: "- Referentes para la autoevaluación institucional y la mejora de la gestión escolar.",
    url: "https://liderazgoeducativo.mineduc.cl/estandares-indicativos-de-desempeno/" },
  { id: "normativa-directivos", cat: "gestion", titulo: "Guía sobre normativa vigente para equipos directivos", org: "MINEDUC · Liderazgo Educativo", anio: "",
    resumen: "- Recopilación de la normativa que deben conocer los equipos directivos de los establecimientos.",
    url: "https://liderazgoeducativo.mineduc.cl/guia-sobre-normativa-vigente-para-equipos-directivos-de-establecimientos-educacionales/" },

  /* ---------------- SLEP ANDALIÉN SUR ---------------- */
  { id: "pal-2026", cat: "servicio", titulo: "Plan Anual Local de Educación Pública 2026", org: "SLEP Andalién Sur", anio: "2025",
    resumen: "- Misión, visión y sellos: formación integral, identidad del territorio, multiculturalidad, creatividad e innovación.\n- Estado de avance de los instrumentos de gestión, iniciativas anuales, dotación y fichas de los 80 establecimientos.",
    url: "PAL-2026-SLEP-Andalien-Sur.pdf", pdf: "PAL-2026-SLEP-Andalien-Sur.pdf" },

  /* ---------------- INTERNACIONAL ---------------- */
  { id: "unesco-guia", cat: "internacional", titulo: "Guía para el uso de IA generativa en educación e investigación", org: "UNESCO", anio: "2023",
    resumen: "- Enfoque centrado en el ser humano: proteger la privacidad, establecer límites de edad y validar ética y pedagógicamente las herramientas.",
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000389227_spa" },
  { id: "unesco-competencias", cat: "internacional", titulo: "Marco de competencias en IA para docentes", org: "UNESCO", anio: "2024",
    resumen: "- 15 competencias en 5 dimensiones: mentalidad centrada en el ser humano, ética de la IA, fundamentos y aplicaciones, pedagogía con IA e IA para el desarrollo profesional.\n- Tres niveles: adquirir, profundizar y crear.",
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000393813" }
];
