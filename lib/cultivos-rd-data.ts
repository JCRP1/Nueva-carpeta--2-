// cosecha = días de etapa de cosecha
// rendimiento_kg_m2 = estimado ideal de producción por metro²

export const cultivosRDData = [
  {
    categoria: "Cereales",
    cultivos: [
      {
        nombre: "Arroz",
        variedad: "Indica",
        duracion: 150,
        germinacion: 7,
        crecimiento: 100,
        cosecha: 43,
        rendimiento_kg_m2: 0.6,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 85, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 100, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 43, umbral_humedad: 70, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Maíz",
        variedad: "Híbrido amarillo",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 0.8,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 75, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 1.6, umbral_tds: 800 },
          cosecha: { dias: 40, umbral_humedad: 55, umbral_ph: 6.3, umbral_ec: 1.8, umbral_tds: 900 }
        }
      },
      {
        nombre: "Sorgo",
        variedad: "Granífero",
        duracion: 130,
        germinacion: 5,
        crecimiento: 85,
        cosecha: 40,
        rendimiento_kg_m2: 0.5,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 85, umbral_humedad: 55, umbral_ph: 6.0, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 40, umbral_humedad: 45, umbral_ph: 6.2, umbral_ec: 1.7, umbral_tds: 850 }
        }
      }
    ]
  },
  {
    categoria: "Oleaginosas",
    cultivos: [
      {
        nombre: "Maní",
        variedad: "Valencia",
        duracion: 110,
        germinacion: 7,
        crecimiento: 70,
        cosecha: 33,
        rendimiento_kg_m2: 0.4,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 70, umbral_humedad: 55, umbral_ph: 6.2, umbral_ec: 1.3, umbral_tds: 650 },
          cosecha: { dias: 33, umbral_humedad: 45, umbral_ph: 6.3, umbral_ec: 1.5, umbral_tds: 750 }
        }
      },
      {
        nombre: "Coco",
        variedad: "Alto del Caribe",
        duracion: 2555,
        germinacion: 90,
        crecimiento: 2000,
        cosecha: 465,
        rendimiento_kg_m2: 1.5,
        etapas: {
          germinacion: { dias: 90, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 2000, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 465, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      }
    ]
  },
  {
    categoria: "Leguminosas",
    cultivos: [
      {
        nombre: "Habichuela roja",
        variedad: "Criolla",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 0.5,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 75, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 1.4, umbral_tds: 700 },
          cosecha: { dias: 40, umbral_humedad: 50, umbral_ph: 6.4, umbral_ec: 1.6, umbral_tds: 800 }
        }
      },
      {
        nombre: "Habichuela negra",
        variedad: "Criolla",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 0.5,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 75, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 1.4, umbral_tds: 700 },
          cosecha: { dias: 40, umbral_humedad: 50, umbral_ph: 6.4, umbral_ec: 1.6, umbral_tds: 800 }
        }
      },
      {
        nombre: "Habichuela blanca",
        variedad: "Blanca",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 0.5,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 75, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 1.4, umbral_tds: 700 },
          cosecha: { dias: 40, umbral_humedad: 50, umbral_ph: 6.4, umbral_ec: 1.6, umbral_tds: 800 }
        }
      },
      {
        nombre: "Guandul",
        variedad: "Enano",
        duracion: 150,
        germinacion: 7,
        crecimiento: 100,
        cosecha: 43,
        rendimiento_kg_m2: 0.7,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 72, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 100, umbral_humedad: 58, umbral_ph: 6.2, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 43, umbral_humedad: 50, umbral_ph: 6.4, umbral_ec: 1.7, umbral_tds: 850 }
        }
      }
    ]
  },
  {
    categoria: "Raíces y Tubérculos",
    cultivos: [
      {
        nombre: "Batata",
        variedad: "Criolla",
        duracion: 140,
        germinacion: 10,
        crecimiento: 90,
        cosecha: 40,
        rendimiento_kg_m2: 2.5,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 75, umbral_ph: 5.8, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 90, umbral_humedad: 65, umbral_ph: 5.8, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 40, umbral_humedad: 55, umbral_ph: 6.0, umbral_ec: 1.7, umbral_tds: 850 }
        }
      },
      {
        nombre: "Ñame",
        variedad: "Espino",
        duracion: 360,
        germinacion: 30,
        crecimiento: 250,
        cosecha: 80,
        rendimiento_kg_m2: 3.5,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 250, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.6, umbral_tds: 800 },
          cosecha: { dias: 80, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 }
        }
      },
      {
        nombre: "Papa",
        variedad: "Granola",
        duracion: 110,
        germinacion: 10,
        crecimiento: 70,
        cosecha: 30,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 80, umbral_ph: 5.5, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 70, umbral_humedad: 70, umbral_ph: 5.5, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 30, umbral_humedad: 60, umbral_ph: 5.8, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Yautía",
        variedad: "Blanca",
        duracion: 450,
        germinacion: 30,
        crecimiento: 320,
        cosecha: 100,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 85, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 320, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.6, umbral_tds: 800 },
          cosecha: { dias: 100, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 }
        }
      },
      {
        nombre: "Yuca",
        variedad: "Valencia",
        duracion: 300,
        germinacion: 14,
        crecimiento: 220,
        cosecha: 66,
        rendimiento_kg_m2: 3.5,
        etapas: {
          germinacion: { dias: 14, umbral_humedad: 70, umbral_ph: 5.8, umbral_ec: 1.0, umbral_tds: 500 },
          crecimiento: { dias: 220, umbral_humedad: 55, umbral_ph: 5.8, umbral_ec: 1.3, umbral_tds: 650 },
          cosecha: { dias: 66, umbral_humedad: 45, umbral_ph: 6.0, umbral_ec: 1.5, umbral_tds: 750 }
        }
      },
      {
        nombre: "Mapuey",
        variedad: "Amarillo",
        duracion: 480,
        germinacion: 30,
        crecimiento: 350,
        cosecha: 100,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 350, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 100, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 1.7, umbral_tds: 850 }
        }
      }
    ]
  },
  {
    categoria: "Musáceas",
    cultivos: [
      {
        nombre: "Plátano",
        variedad: "Barraganete",
        duracion: 360,
        germinacion: 30,
        crecimiento: 250,
        cosecha: 80,
        rendimiento_kg_m2: 3.5,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 85, umbral_ph: 6.0, umbral_ec: 1.5, umbral_tds: 750 },
          crecimiento: { dias: 250, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 80, umbral_humedad: 70, umbral_ph: 6.2, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Guineo (Banano)",
        variedad: "Cavendish",
        duracion: 330,
        germinacion: 30,
        crecimiento: 230,
        cosecha: 70,
        rendimiento_kg_m2: 4.0,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 85, umbral_ph: 6.0, umbral_ec: 1.6, umbral_tds: 800 },
          crecimiento: { dias: 230, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 2.1, umbral_tds: 1050 },
          cosecha: { dias: 70, umbral_humedad: 70, umbral_ph: 6.2, umbral_ec: 2.3, umbral_tds: 1150 }
        }
      }
    ]
  },
  {
    categoria: "Hortalizas",
    cultivos: [
      {
        nombre: "Ajíes",
        variedad: "Cubanelle",
        duracion: 150,
        germinacion: 10,
        crecimiento: 90,
        cosecha: 50,
        rendimiento_kg_m2: 4.0,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 90, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 50, umbral_humedad: 60, umbral_ph: 6.5, umbral_ec: 2.5, umbral_tds: 1250 }
        }
      },
      {
        nombre: "Ajo",
        variedad: "Criollo",
        duracion: 120,
        germinacion: 10,
        crecimiento: 80,
        cosecha: 30,
        rendimiento_kg_m2: 1.2,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 70, umbral_ph: 6.2, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 80, umbral_humedad: 55, umbral_ph: 6.5, umbral_ec: 1.6, umbral_tds: 800 },
          cosecha: { dias: 30, umbral_humedad: 45, umbral_ph: 6.5, umbral_ec: 1.8, umbral_tds: 900 }
        }
      },
      {
        nombre: "Auyama",
        variedad: "Criolla",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 75, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 40, umbral_humedad: 55, umbral_ph: 6.3, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Berenjena",
        variedad: "Black Beauty",
        duracion: 140,
        germinacion: 8,
        crecimiento: 90,
        cosecha: 42,
        rendimiento_kg_m2: 5.0,
        etapas: {
          germinacion: { dias: 8, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 90, umbral_humedad: 65, umbral_ph: 6.0, umbral_ec: 2.2, umbral_tds: 1100 },
          cosecha: { dias: 42, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 2.5, umbral_tds: 1250 }
        }
      },
      {
        nombre: "Cebolla roja",
        variedad: "Roja",
        duracion: 150,
        germinacion: 10,
        crecimiento: 100,
        cosecha: 40,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 100, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 40, umbral_humedad: 50, umbral_ph: 6.5, umbral_ec: 1.7, umbral_tds: 850 }
        }
      },
      {
        nombre: "Pepino",
        variedad: "Slice",
        duracion: 100,
        germinacion: 4,
        crecimiento: 60,
        cosecha: 36,
        rendimiento_kg_m2: 8.0,
        etapas: {
          germinacion: { dias: 4, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 60, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 36, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Molondrón (Okra)",
        variedad: "Clemson",
        duracion: 100,
        germinacion: 5,
        crecimiento: 65,
        cosecha: 30,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 65, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 30, umbral_humedad: 55, umbral_ph: 6.4, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Orégano",
        variedad: "Dominicano",
        duracion: 180,
        germinacion: 10,
        crecimiento: 120,
        cosecha: 50,
        rendimiento_kg_m2: 1.5,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 0.9, umbral_tds: 450 },
          crecimiento: { dias: 120, umbral_humedad: 45, umbral_ph: 6.5, umbral_ec: 1.2, umbral_tds: 600 },
          cosecha: { dias: 50, umbral_humedad: 40, umbral_ph: 6.8, umbral_ec: 1.4, umbral_tds: 700 }
        }
      },
      {
        nombre: "Rábano",
        variedad: "Red Globe",
        duracion: 30,
        germinacion: 3,
        crecimiento: 20,
        cosecha: 7,
        rendimiento_kg_m2: 2.0,
        etapas: {
          germinacion: { dias: 3, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.0, umbral_tds: 500 },
          crecimiento: { dias: 20, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 1.4, umbral_tds: 700 },
          cosecha: { dias: 7, umbral_humedad: 55, umbral_ph: 6.3, umbral_ec: 1.6, umbral_tds: 800 }
        }
      },
      {
        nombre: "Lechuga",
        variedad: "Romana",
        duracion: 60,
        germinacion: 3,
        crecimiento: 40,
        cosecha: 17,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 3, umbral_humedad: 85, umbral_ph: 6.0, umbral_ec: 0.8, umbral_tds: 400 },
          crecimiento: { dias: 40, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          cosecha: { dias: 17, umbral_humedad: 70, umbral_ph: 6.2, umbral_ec: 1.4, umbral_tds: 700 }
        }
      },
      {
        nombre: "Repollo",
        variedad: "Green",
        duracion: 90,
        germinacion: 5,
        crecimiento: 60,
        cosecha: 25,
        rendimiento_kg_m2: 4.0,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 60, umbral_humedad: 70, umbral_ph: 6.3, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 25, umbral_humedad: 65, umbral_ph: 6.5, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Tayota",
        variedad: "Verde",
        duracion: 150,
        germinacion: 15,
        crecimiento: 100,
        cosecha: 35,
        rendimiento_kg_m2: 5.0,
        etapas: {
          germinacion: { dias: 15, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 100, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 35, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Tomate de ensalada",
        variedad: "Roma",
        duracion: 120,
        germinacion: 7,
        crecimiento: 70,
        cosecha: 43,
        rendimiento_kg_m2: 7.0,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.4, umbral_tds: 700 },
          crecimiento: { dias: 70, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.5, umbral_tds: 1250 },
          cosecha: { dias: 43, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 3.0, umbral_tds: 1500 }
        }
      },
      {
        nombre: "Tomate industria",
        variedad: "Industrial",
        duracion: 110,
        germinacion: 7,
        crecimiento: 65,
        cosecha: 38,
        rendimiento_kg_m2: 6.0,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.4, umbral_tds: 700 },
          crecimiento: { dias: 65, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.5, umbral_tds: 1250 },
          cosecha: { dias: 38, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 3.0, umbral_tds: 1500 }
        }
      },
      {
        nombre: "Calabacín",
        variedad: "Zucchini",
        duracion: 50,
        germinacion: 4,
        crecimiento: 30,
        cosecha: 16,
        rendimiento_kg_m2: 4.5,
        etapas: {
          germinacion: { dias: 4, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 30, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 16, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Zanahoria",
        variedad: "Nantes",
        duracion: 120,
        germinacion: 10,
        crecimiento: 80,
        cosecha: 30,
        rendimiento_kg_m2: 3.5,
        etapas: {
          germinacion: { dias: 10, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 80, umbral_humedad: 60, umbral_ph: 6.3, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 30, umbral_humedad: 55, umbral_ph: 6.5, umbral_ec: 1.7, umbral_tds: 850 }
        }
      },
      {
        nombre: "Remolacha",
        variedad: "Detroit",
        duracion: 90,
        germinacion: 7,
        crecimiento: 60,
        cosecha: 23,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 75, umbral_ph: 6.2, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 60, umbral_humedad: 65, umbral_ph: 6.5, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 23, umbral_humedad: 60, umbral_ph: 6.5, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Coliflor",
        variedad: "Snowball",
        duracion: 150,
        germinacion: 7,
        crecimiento: 100,
        cosecha: 43,
        rendimiento_kg_m2: 3.5,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 100, umbral_humedad: 70, umbral_ph: 6.5, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 43, umbral_humedad: 65, umbral_ph: 6.5, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Brócoli",
        variedad: "Calabrese",
        duracion: 150,
        germinacion: 7,
        crecimiento: 100,
        cosecha: 43,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 7, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 100, umbral_humedad: 70, umbral_ph: 6.5, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 43, umbral_humedad: 65, umbral_ph: 6.5, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      }
    ]
  },
  {
    categoria: "Frutales",
    cultivos: [
      {
        nombre: "Aguacate",
        variedad: "Hass",
        duracion: 1825,
        germinacion: 30,
        crecimiento: 1500,
        cosecha: 295,
        rendimiento_kg_m2: 2.5,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 1500, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 295, umbral_humedad: 60, umbral_ph: 6.5, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Lechosa (Papaya)",
        variedad: "Maradol",
        duracion: 720,
        germinacion: 15,
        crecimiento: 500,
        cosecha: 205,
        rendimiento_kg_m2: 5.0,
        etapas: {
          germinacion: { dias: 15, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 500, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.8, umbral_tds: 900 },
          cosecha: { dias: 205, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 }
        }
      },
      {
        nombre: "Limón",
        variedad: "Criollo",
        duracion: 1460,
        germinacion: 20,
        crecimiento: 1200,
        cosecha: 240,
        rendimiento_kg_m2: 2.5,
        etapas: {
          germinacion: { dias: 20, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 1200, umbral_humedad: 60, umbral_ph: 6.0, umbral_ec: 1.7, umbral_tds: 850 },
          cosecha: { dias: 240, umbral_humedad: 55, umbral_ph: 6.2, umbral_ec: 1.9, umbral_tds: 950 }
        }
      },
      {
        nombre: "Melón",
        variedad: "Cantaloupe",
        duracion: 90,
        germinacion: 5,
        crecimiento: 55,
        cosecha: 30,
        rendimiento_kg_m2: 4.0,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 55, umbral_humedad: 60, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 30, umbral_humedad: 55, umbral_ph: 6.3, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Naranja",
        variedad: "Valencia",
        duracion: 1825,
        germinacion: 25,
        crecimiento: 1500,
        cosecha: 300,
        rendimiento_kg_m2: 2.5,
        etapas: {
          germinacion: { dias: 25, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 1500, umbral_humedad: 60, umbral_ph: 6.0, umbral_ec: 1.7, umbral_tds: 850 },
          cosecha: { dias: 300, umbral_humedad: 55, umbral_ph: 6.2, umbral_ec: 1.9, umbral_tds: 950 }
        }
      },
      {
        nombre: "Piña",
        variedad: "MD2",
        duracion: 450,
        germinacion: 30,
        crecimiento: 300,
        cosecha: 120,
        rendimiento_kg_m2: 5.0,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 70, umbral_ph: 5.0, umbral_ec: 1.1, umbral_tds: 550 },
          crecimiento: { dias: 300, umbral_humedad: 60, umbral_ph: 5.5, umbral_ec: 1.6, umbral_tds: 800 },
          cosecha: { dias: 120, umbral_humedad: 55, umbral_ph: 5.8, umbral_ec: 1.8, umbral_tds: 900 }
        }
      },
      {
        nombre: "Sandía",
        variedad: "Crimson Sweet",
        duracion: 120,
        germinacion: 5,
        crecimiento: 75,
        cosecha: 40,
        rendimiento_kg_m2: 4.5,
        etapas: {
          germinacion: { dias: 5, umbral_humedad: 75, umbral_ph: 6.0, umbral_ec: 1.3, umbral_tds: 650 },
          crecimiento: { dias: 75, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 2.0, umbral_tds: 1000 },
          cosecha: { dias: 40, umbral_humedad: 55, umbral_ph: 6.3, umbral_ec: 2.2, umbral_tds: 1100 }
        }
      },
      {
        nombre: "Chinola (Maracuyá)",
        variedad: "Amarilla",
        duracion: 720,
        germinacion: 20,
        crecimiento: 500,
        cosecha: 200,
        rendimiento_kg_m2: 3.0,
        etapas: {
          germinacion: { dias: 20, umbral_humedad: 80, umbral_ph: 6.0, umbral_ec: 1.2, umbral_tds: 600 },
          crecimiento: { dias: 500, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.7, umbral_tds: 850 },
          cosecha: { dias: 200, umbral_humedad: 65, umbral_ph: 6.2, umbral_ec: 1.9, umbral_tds: 950 }
        }
      },
      {
        nombre: "Mango",
        variedad: "Criollo",
        duracion: 1825,
        germinacion: 30,
        crecimiento: 1500,
        cosecha: 295,
        rendimiento_kg_m2: 2.5,
        etapas: {
          germinacion: { dias: 30, umbral_humedad: 70, umbral_ph: 6.0, umbral_ec: 1.0, umbral_tds: 500 },
          crecimiento: { dias: 1500, umbral_humedad: 60, umbral_ph: 6.0, umbral_ec: 1.5, umbral_tds: 750 },
          cosecha: { dias: 295, umbral_humedad: 55, umbral_ph: 6.2, umbral_ec: 1.7, umbral_tds: 850 }
        }
      }
    ]
  }
]

export function getAllCultivos() {
  return cultivosRDData.flatMap(cat => cat.cultivos)
}

export type EtapaCultivoRD = "germinacion" | "crecimiento" | "cosecha"

export interface PerfilAgronomicoCultivo {
  densidadPlantasM2: string
  sustratoSuelo: string
  aguaAproximada: string
  fertilizantes: string[]
  abonos: string[]
  rendimientoPorMata: string
  plagas: string[]
  mesesRecomendados: string[]
  fertilizacion: Record<EtapaCultivoRD, string>
  sanidad: string[]
  manejo: Record<EtapaCultivoRD, string>
}

const perfilBasePorCategoria: Record<string, PerfilAgronomicoCultivo> = {
  Cereales: {
    densidadPlantasM2: "Variable por marco de siembra; validar población por tarea o hectárea.",
    sustratoSuelo: "Suelo franco a franco-arcilloso, bien nivelado y con buen manejo de humedad.",
    aguaAproximada: "4-8 L/m2/dia segun etapa, textura del suelo y clima.",
    fertilizantes: ["NPK balanceado", "Fuente de nitrogeno fraccionada", "Fuente de potasio"],
    abonos: ["Compost maduro", "Estiercol bien curado antes de siembra"],
    rendimientoPorMata: "Variable por cultivo; usar rendimiento por m2 y densidad real para estimar por planta.",
    plagas: ["Gusano cogollero", "Gusanos cortadores", "Chinches", "Hongos foliares"],
    mesesRecomendados: ["Abril", "Mayo", "Junio", "Octubre", "Noviembre"],
    fertilizacion: {
      germinacion: "Arranque suave con fósforo y materia orgánica bien incorporada.",
      crecimiento: "Aporte fraccionado de nitrógeno y potasio según vigor y análisis de suelo.",
      cosecha: "Reducir nitrógeno tardío y evitar exceso de agua para mejorar llenado y secado.",
    },
    sanidad: ["Monitorear manchas foliares", "Revisar gusanos cortadores", "Evitar malezas tempranas"],
    manejo: {
      germinacion: "Mantener humedad uniforme hasta emergencia.",
      crecimiento: "Controlar malezas y sostener nutrición sin encharcar.",
      cosecha: "Programar corte cuando el grano alcance madurez y humedad adecuada.",
    },
  },
  Oleaginosas: {
    densidadPlantasM2: "Variable por especie; priorizar buena aireación entre plantas.",
    sustratoSuelo: "Suelo franco, profundo, con drenaje y buen contenido de materia orgánica.",
    aguaAproximada: "3-6 L/m2/dia; evitar estres hidrico en floracion y llenado.",
    fertilizantes: ["Fosforo de arranque", "Potasio", "Calcio", "Magnesio"],
    abonos: ["Compost", "Humus de lombriz", "Materia organica incorporada"],
    rendimientoPorMata: "Variable; calcular segun marco de siembra y rendimiento por m2.",
    plagas: ["Acaros", "Trips", "Gusanos defoliadores", "Hongos de raiz"],
    mesesRecomendados: ["Marzo", "Abril", "Mayo", "Septiembre", "Octubre"],
    fertilizacion: {
      germinacion: "Fósforo moderado para raíces y establecimiento.",
      crecimiento: "Potasio y calcio para estructura, floración y llenado.",
      cosecha: "Mantener potasio; evitar exceso de nitrógeno al final.",
    },
    sanidad: ["Revisar ácaros", "Monitorear hongos de raíz", "Evitar estrés hídrico prolongado"],
    manejo: {
      germinacion: "Evitar costra superficial y saturación.",
      crecimiento: "Mantener balance entre vegetación y floración.",
      cosecha: "Cosechar con madurez uniforme y baja humedad.",
    },
  },
  Leguminosas: {
    densidadPlantasM2: "8-15 plantas/m² según variedad y conducción.",
    sustratoSuelo: "Suelo franco, drenado, pH cercano a neutro y baja salinidad.",
    aguaAproximada: "2-5 L/m2/dia; sostener humedad en floracion y llenado de vainas.",
    fertilizantes: ["Fosforo", "Potasio", "Calcio", "Micronutrientes", "Inoculante si aplica"],
    abonos: ["Compost bajo en nitrogeno", "Humus de lombriz"],
    rendimientoPorMata: "0.03-0.12 kg/planta segun variedad, manejo y cosecha.",
    plagas: ["Mosca blanca", "Afidos", "Trips", "Minadores", "Roya", "Antracnosis"],
    mesesRecomendados: ["Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    fertilizacion: {
      germinacion: "Arranque bajo en nitrógeno; favorecer raíces y nodulación.",
      crecimiento: "Fósforo, potasio y micronutrientes; evitar exceso de nitrógeno.",
      cosecha: "Potasio y calcio para llenado de vainas y calidad.",
    },
    sanidad: ["Monitorear mosca blanca", "Revisar áfidos", "Prevenir roya y antracnosis"],
    manejo: {
      germinacion: "Humedad constante sin encharcar.",
      crecimiento: "Guiar o tutorizar si aplica y revisar floración.",
      cosecha: "Cosechar vainas en punto comercial para sostener producción.",
    },
  },
  "Raíces y Tubérculos": {
    densidadPlantasM2: "3-8 plantas/m² según especie y tamaño de raíz esperado.",
    sustratoSuelo: "Suelo suelto, profundo, sin compactación y con drenaje alto.",
    aguaAproximada: "3-7 L/m2/dia; evitar encharcamiento y reducir antes de cosecha.",
    fertilizantes: ["Fosforo", "Potasio alto", "Calcio", "Magnesio"],
    abonos: ["Compost maduro", "Bocashi bien estabilizado", "Materia organica descompuesta"],
    rendimientoPorMata: "0.4-2.5 kg/planta segun cultivo, variedad y ciclo.",
    plagas: ["Nematodos", "Gusanos de suelo", "Pudriciones", "Barrenadores"],
    mesesRecomendados: ["Marzo", "Abril", "Mayo", "Junio", "Septiembre", "Octubre"],
    fertilizacion: {
      germinacion: "Fósforo y materia orgánica madura para emisión de raíces.",
      crecimiento: "Potasio alto; nitrógeno moderado para evitar exceso de follaje.",
      cosecha: "Reducir riego previo al arranque y sostener potasio.",
    },
    sanidad: ["Revisar pudriciones", "Controlar nematodos", "Evitar encharcamiento"],
    manejo: {
      germinacion: "Mantener cama húmeda y aireada.",
      crecimiento: "Aporcar si aplica y evitar compactación.",
      cosecha: "Cosechar con suelo ligeramente seco para reducir daño.",
    },
  },
  Musáceas: {
    densidadPlantasM2: "0.2-0.5 plantas/m² según marco de plantación.",
    sustratoSuelo: "Suelo profundo, fértil, húmedo y bien drenado.",
    aguaAproximada: "8-15 L/planta/dia en establecimiento; mayor demanda en crecimiento y llenado.",
    fertilizantes: ["NPK alto en potasio", "Magnesio", "Calcio", "Micronutrientes"],
    abonos: ["Compost", "Estiercol curado", "Cobertura organica"],
    rendimientoPorMata: "12-30 kg/planta segun variedad, racimo y manejo.",
    plagas: ["Picudo negro", "Sigatoka", "Nematodos", "Cochinillas"],
    mesesRecomendados: ["Marzo", "Abril", "Mayo", "Septiembre", "Octubre", "Noviembre"],
    fertilizacion: {
      germinacion: "Enraizador con fósforo, materia orgánica y calcio.",
      crecimiento: "Alta demanda de potasio, nitrógeno y magnesio.",
      cosecha: "Potasio sostenido para llenado de racimo y calidad.",
    },
    sanidad: ["Monitorear sigatoka", "Revisar picudo", "Eliminar hojas enfermas"],
    manejo: {
      germinacion: "Proteger plantas jóvenes de estrés hídrico.",
      crecimiento: "Deshije, deshoje sanitario y soporte nutricional.",
      cosecha: "Apuntalar racimos y cosechar por grado de llenado.",
    },
  },
  Hortalizas: {
    densidadPlantasM2: "2-10 plantas/m² según cultivo, variedad y conducción.",
    sustratoSuelo: "Sustrato o suelo franco, drenado, con pH 5.8-6.8 y baja salinidad.",
    aguaAproximada: "1-4 L/planta/dia o 3-8 L/m2/dia segun cultivo, etapa y clima.",
    fertilizantes: ["NPK soluble", "Nitrato de calcio", "Sulfato de magnesio", "Micronutrientes"],
    abonos: ["Compost maduro", "Humus de lombriz", "Bocashi estabilizado"],
    rendimientoPorMata: "0.25-6 kg/planta segun especie, variedad y manejo.",
    plagas: ["Mosca blanca", "Trips", "Acaros", "Afidos", "Minadores", "Botrytis", "Mildiu"],
    mesesRecomendados: ["Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    fertilizacion: {
      germinacion: "Solución suave, fósforo para raíces y EC baja.",
      crecimiento: "Nitrógeno balanceado con calcio, magnesio y micronutrientes.",
      cosecha: "Potasio y calcio altos; controlar salinidad para calidad de fruto/hoja.",
    },
    sanidad: ["Monitorear mosca blanca", "Revisar trips y ácaros", "Prevenir hongos por humedad alta"],
    manejo: {
      germinacion: "Evitar golpes de agua y cambios bruscos de temperatura.",
      crecimiento: "Podar, tutorizar o ralear según cultivo.",
      cosecha: "Cosechar frecuente y retirar frutos/hojas dañadas.",
    },
  },
  Frutales: {
    densidadPlantasM2: "Variable; manejar por marco de plantación y tamaño adulto.",
    sustratoSuelo: "Suelo profundo, drenado, con materia orgánica y baja compactación.",
    aguaAproximada: "10-60 L/planta/dia segun edad, especie, copa y clima.",
    fertilizantes: ["NPK segun etapa", "Potasio", "Calcio", "Magnesio", "Micronutrientes"],
    abonos: ["Compost", "Estiercol curado", "Mulch organico"],
    rendimientoPorMata: "Variable por edad y especie; registrar por planta o por lote.",
    plagas: ["Acaros", "Cochinillas", "Mosca de la fruta", "Antracnosis", "Trips"],
    mesesRecomendados: ["Marzo", "Abril", "Mayo", "Septiembre", "Octubre"],
    fertilizacion: {
      germinacion: "Fósforo, materia orgánica y bioestimulación radicular.",
      crecimiento: "Nitrógeno moderado, potasio, calcio y magnesio.",
      cosecha: "Potasio y calcio para llenado, firmeza y grados brix.",
    },
    sanidad: ["Monitorear ácaros y cochinillas", "Prevenir antracnosis", "Eliminar material enfermo"],
    manejo: {
      germinacion: "Proteger plantas jóvenes y sostener humedad constante.",
      crecimiento: "Formación, poda sanitaria y nutrición equilibrada.",
      cosecha: "Cosechar por índice de madurez y evitar daño mecánico.",
    },
  },
}

const perfilPorCultivo: Record<string, Partial<PerfilAgronomicoCultivo>> = {
  "Tomate de ensalada": {
    densidadPlantasM2: "2-3 plantas/m² en invernadero con tutorado.",
    aguaAproximada: "1.5-3.0 L/planta/dia; subir en floracion y llenado.",
    fertilizantes: ["Nitrato de calcio", "NPK 15-5-30 o similar", "Sulfato de magnesio", "Micronutrientes"],
    abonos: ["Compost maduro", "Humus de lombriz"],
    rendimientoPorMata: "3-6 kg/planta en invernadero bien manejado.",
    plagas: ["Mosca blanca", "Tuta absoluta", "Trips", "Acaros", "Botrytis"],
    mesesRecomendados: ["Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    sanidad: ["Mosca blanca", "Tuta absoluta", "Trips", "Botrytis por humedad alta"],
  },
  Pepino: {
    densidadPlantasM2: "1.5-2.5 plantas/m² con tutorado.",
    aguaAproximada: "2-4 L/planta/dia; mantener humedad estable en cosecha.",
    fertilizantes: ["NPK soluble", "Nitrato de calcio", "Potasio", "Magnesio"],
    abonos: ["Compost maduro", "Humus de lombriz"],
    rendimientoPorMata: "4-8 kg/planta segun variedad y cortes.",
    plagas: ["Trips", "Acaros", "Mosca blanca", "Mildiu", "Oidio"],
    mesesRecomendados: ["Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    sanidad: ["Mildiu", "Oídio", "Ácaros", "Trips"],
  },
  Lechuga: {
    densidadPlantasM2: "10-16 plantas/m² según tamaño comercial.",
    sustratoSuelo: "Sustrato fresco, drenado y con EC baja.",
    aguaAproximada: "0.2-0.6 L/planta/dia; evitar exceso de calor y salinidad.",
    fertilizantes: ["NPK suave", "Calcio", "Magnesio", "Micronutrientes"],
    abonos: ["Compost fino y maduro", "Humus de lombriz"],
    rendimientoPorMata: "0.2-0.5 kg/planta segun tipo y tamano.",
    plagas: ["Mildiu", "Afidos", "Trips", "Babosas", "Pudricion basal"],
    mesesRecomendados: ["Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    sanidad: ["Pudrición basal", "Mildiu", "Babosas si hay humedad excesiva"],
  },
  Ajíes: {
    densidadPlantasM2: "2-4 plantas/m² según variedad y poda.",
    aguaAproximada: "1-2.5 L/planta/dia; evitar estres en floracion.",
    fertilizantes: ["NPK balanceado", "Calcio", "Potasio", "Magnesio"],
    abonos: ["Compost maduro", "Bocashi estabilizado"],
    rendimientoPorMata: "1-4 kg/planta segun variedad y ciclo.",
    plagas: ["Trips", "Acaros", "Mosca blanca", "Afidos", "Antracnosis"],
    mesesRecomendados: ["Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    sanidad: ["Trips", "Ácaros", "Antracnosis", "Mosca blanca"],
  },
  Berenjena: {
    densidadPlantasM2: "1.5-2.5 plantas/m² con buena ventilación.",
    aguaAproximada: "1.5-3 L/planta/dia; subir durante floracion y cosecha.",
    fertilizantes: ["NPK balanceado", "Potasio", "Calcio", "Magnesio"],
    abonos: ["Compost maduro", "Humus de lombriz"],
    rendimientoPorMata: "3-7 kg/planta segun manejo y cortes.",
    plagas: ["Acaros", "Mosca blanca", "Trips", "Minadores", "Marchitez bacteriana"],
    mesesRecomendados: ["Octubre", "Noviembre", "Diciembre", "Enero", "Febrero", "Marzo"],
    sanidad: ["Ácaros", "Mosca blanca", "Marchitez bacteriana"],
  },
}

function getCategoriaByCropName(cropName: string) {
  const normalized = cropName.trim().toLowerCase()
  return cultivosRDData.find((categoria) =>
    categoria.cultivos.some((cultivo) => cultivo.nombre.toLowerCase() === normalized)
  )
}

export function getPerfilAgronomico(cropName: string): PerfilAgronomicoCultivo | null {
  const categoria = getCategoriaByCropName(cropName)
  if (!categoria) return null

  const base = perfilBasePorCategoria[categoria.categoria]
  if (!base) return null

  const override = perfilPorCultivo[cropName] || {}
  return {
    ...base,
    ...override,
    fertilizantes: override.fertilizantes || base.fertilizantes,
    abonos: override.abonos || base.abonos,
    plagas: override.plagas || base.plagas,
    mesesRecomendados: override.mesesRecomendados || base.mesesRecomendados,
    fertilizacion: {
      ...base.fertilizacion,
      ...(override.fertilizacion || {}),
    },
    manejo: {
      ...base.manejo,
      ...(override.manejo || {}),
    },
    sanidad: override.sanidad || base.sanidad,
  }
}

export function obtenerEtapaActual(cultivo: any, diasDesdeSiembra: number) {
  if (diasDesdeSiembra <= cultivo.etapas.germinacion.dias) {
    return {
      etapa: "germinacion",
      ...cultivo.etapas.germinacion
    }
  }

  if (
    diasDesdeSiembra <=
    cultivo.etapas.germinacion.dias + cultivo.etapas.crecimiento.dias
  ) {
    return {
      etapa: "crecimiento",
      ...cultivo.etapas.crecimiento
    }
  }

  return {
    etapa: "cosecha",
    ...cultivo.etapas.cosecha
  }
}
