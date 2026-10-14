/* =====================================================================
   ESTABLECIMIENTOS DEL SLEP ANDALIÉN SUR (base local)
   ---------------------------------------------------------------------
   Fuente prevista: Plan Anual Local (PAL) del Servicio.
   Esta lista se completa de dos formas:
     1. Aquí, como base (requiere volver a publicar en GitHub).
     2. Desde el PANEL DE CONFIGURACIÓN (admin.html), sin tocar código:
        lo que se agrega allí se suma o reemplaza a esta base.

   Formato de cada establecimiento:
   {
     id: "identificador-unico",
     nombre: "Nombre oficial",
     alias: "otros nombres con que se le conoce (opcional)",
     comuna: "Concepción | Chiguayante | Florida | Hualqui",
     entorno: "Urbano | Rural | Mixto (urbano y rural)",
     niveles: "Ej.: Parvularia a 8° básico",
     caracteristicas: "Rasgos del PAL útiles para sugerir (sellos, desafíos, programas)",
     enlaces: [{ titulo: "Sitio web", url: "https://..." }]
   }

   ⚠️ Solo datos institucionales: nunca nombres de estudiantes ni
      información personal de funcionarios.
   ===================================================================== */
const ESTABLECIMIENTOS = [];
