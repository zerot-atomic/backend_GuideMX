# MXGuide — Documentación de Arquitectura de Backend

**Proyecto:** MXGuide — App de guía turística para México
**Documento:** Arquitectura y planeación de backend
**Uso:** Referencia técnica para todos los integrantes del equipo

---

## 1. Objetivo del proyecto

MXGuide es una aplicación móvil (Flutter) cuyo propósito es que cualquier persona, sin importar en qué parte de México se encuentre, pueda descubrir fácilmente los lugares más **emblemáticos, importantes e históricos** para visitar.

**Diferenciador clave:** MXGuide **no** es un directorio genérico tipo "Maps con marcadores". La app se basa en contenido **curado**: cada lugar que aparece fue seleccionado y descrito editorialmente por el equipo, no simplemente extraído de una base de datos abierta de puntos de interés. Esto tiene una implicación directa en el backend: necesitamos un mecanismo (panel admin o seeds controlados) para cargar y mantener esta curaduría, no solo un CRUD abierto.

---

## 2. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js 24 LTS | Ya está en el entorno de desarrollo del equipo |
| Framework backend | **NestJS** | Estructura modular (controllers/services/modules) obligatoria por convención — importante en un proyecto de equipo para que todos programen de forma consistente. Usa TypeScript por defecto. |
| Base de datos | **PostgreSQL** | Robusta, relacional, soporta extensiones geoespaciales |
| Extensión de BD | **PostGIS** | Necesaria para las consultas de "lugares cercanos a mi ubicación", que son el corazón funcional de la app. Calcular distancias con SQL plano es ineficiente y propenso a errores; PostGIS está diseñado para esto. |
| ORM | **Prisma** | Se integra bien con NestJS + TypeScript, permite versionar el esquema de BD con migraciones (importante para que el equipo no pise el trabajo de los demás) |
| Almacenamiento de imágenes | **Cloudinary** (o S3) | Las fotos de los lugares no deben vivir en el propio servidor del backend |
| Autenticación | **JWT** (`@nestjs/jwt` + `passport-jwt`) | Estándar, stateless, fácil de validar en cada request |
| Frontend consumidor | Flutter 3.47.3 / Dart 3.13.3 | Ya definido por el equipo |

---

## 3. Estructura de carpetas propuesta (NestJS)

```
mxguide-backend/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   ├── places/
│   │   ├── places.controller.ts
│   │   ├── places.service.ts
│   │   ├── places.module.ts
│   │   └── dto/
│   │       ├── create-place.dto.ts
│   │       ├── update-place.dto.ts
│   │       └── nearby-query.dto.ts
│   ├── categories/
│   ├── states/
│   ├── favorites/
│   ├── reviews/
│   ├── users/
│   ├── uploads/            # integración con Cloudinary/S3
│   ├── prisma/
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   ├── common/
│   │   ├── filters/        # excepciones globales
│   │   ├── interceptors/
│   │   └── decorators/
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   ├── migrations/
│   └── seed.ts             # aquí se carga la curaduría inicial de lugares
├── .env.example
└── package.json
```

**Convención de equipo:** cada módulo (`places`, `categories`, `favorites`, etc.) es independiente y solo se comunica con otros módulos a través de sus `service`, nunca accediendo directo a las entidades de otro módulo. Esto evita conflictos de merge cuando varios integrantes trabajan a la vez.

---

## 4. Modelo de datos

### 4.1 `Place` (Lugar)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Nombre del lugar |
| `shortDescription` | String | Descripción breve (para listas/tarjetas) |
| `longDescription` | Text | Descripción histórica/cultural completa |
| `location` | `Geography(Point, 4326)` | Campo PostGIS — coordenadas lat/lng |
| `address` | String | Dirección legible |
| `stateId` | FK → `State` | Estado de México |
| `municipality` | String | Municipio/ciudad |
| `openingHours` | String / JSON | Horario de visita |
| `entryCost` | Decimal (nullable) | Costo de entrada, si aplica |
| `relevanceScore` | Int | Campo editorial: qué tan "emblemático" es (usado para destacar lugares) |
| `isPublished` | Boolean | Permite cargar lugares en borrador antes de publicarlos |
| `createdAt` / `updatedAt` | DateTime | Auditoría |

### 4.2 `Category` (Categoría)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Histórico, Arqueológico, Cultural, Natural, Religioso, etc. |
| `icon` | String | Nombre/clave del ícono para el frontend |

Relación **muchos-a-muchos** con `Place` mediante tabla intermedia `PlaceCategory`.

### 4.3 `PlaceImage` (Imagen)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `placeId` | FK → `Place` | |
| `url` | String | URL en Cloudinary/S3 |
| `order` | Int | Orden de despliegue en la galería |

### 4.4 `State` (Estado)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Las 32 entidades federativas (catálogo fijo, se carga por seed) |

### 4.5 `User` (Usuario)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `email` | String | Único |
| `passwordHash` | String | |
| `name` | String | |
| `createdAt` | DateTime | |

> El registro es **opcional**: la app debe poder mostrar lugares en "modo invitado" sin necesidad de cuenta. El registro solo es necesario para favoritos y reseñas.

### 4.6 `Favorite` (Favorito)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `userId` | FK → `User` | |
| `placeId` | FK → `Place` | |

Restricción única: (`userId`, `placeId`) no se puede repetir.

### 4.7 `Review` (Reseña) — opcional según alcance del equipo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `userId` | FK → `User` | |
| `placeId` | FK → `Place` | |
| `rating` | Int (1–5) | |
| `comment` | Text (nullable) | |
| `createdAt` | DateTime | |

---

## 5. Endpoints principales

### Lugares (`/places`)

| Método | Ruta | Descripción | Query/Body |
|---|---|---|---|
| GET | `/places/nearby` | Lugares cercanos a una ubicación, ordenados por distancia | `lat`, `lng`, `radius` (km, default 25), `limit` |
| GET | `/places/featured` | Lugares emblemáticos destacados a nivel nacional (para cuando no hay GPS o el usuario explora libremente) | `limit` |
| GET | `/places` | Listado con filtros | `category`, `stateId`, `page`, `limit` |
| GET | `/places/:id` | Detalle completo de un lugar (incluye imágenes, categorías) | — |
| POST | `/places` | Crear lugar (requiere rol admin) | DTO completo |
| PATCH | `/places/:id` | Editar lugar (requiere rol admin) | DTO parcial |
| DELETE | `/places/:id` | Eliminar/despublicar lugar (requiere rol admin) | — |

**Ejemplo de respuesta — `GET /places/nearby?lat=19.043&lng=-98.198&radius=15`:**

```json
[
  {
    "id": "c2f1...",
    "name": "Zona Arqueológica de Cholula",
    "shortDescription": "La pirámide más grande del mundo por volumen.",
    "distanceKm": 2.4,
    "relevanceScore": 95,
    "categories": ["Arqueológico", "Histórico"],
    "coverImage": "https://res.cloudinary.com/.../cholula.jpg"
  }
]
```

### Categorías y estados

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categories` | Listado de categorías disponibles |
| GET | `/states` | Listado de las 32 entidades federativas |

### Favoritos (`/favorites`) — requiere autenticación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/favorites` | Favoritos del usuario autenticado |
| POST | `/favorites` | Agregar lugar a favoritos (`{ placeId }`) |
| DELETE | `/favorites/:placeId` | Quitar de favoritos |

### Reseñas (`/reviews`) — requiere autenticación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/places/:id/reviews` | Reseñas de un lugar |
| POST | `/reviews` | Crear reseña (`{ placeId, rating, comment }`) |

### Autenticación (`/auth`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro de usuario |
| POST | `/auth/login` | Login → devuelve JWT |
| GET | `/auth/me` | Datos del usuario autenticado (requiere token) |

---

## 6. Consideraciones geoespaciales (PostGIS)

La consulta de "lugares cercanos" es el requisito funcional más importante del proyecto. Con Prisma + PostGIS, esto se resuelve con una consulta raw tipo:

```sql
SELECT id, name, "shortDescription",
       ST_Distance(location, ST_MakePoint($1, $2)::geography) / 1000 AS "distanceKm"
FROM "Place"
WHERE "isPublished" = true
  AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3 * 1000)
ORDER BY "distanceKm" ASC
LIMIT $4;
```

Esto se encapsula dentro de `places.service.ts` usando `prisma.$queryRaw`, ya que Prisma no soporta funciones geoespaciales de forma nativa en su query builder.

---

## 7. Autenticación y roles

- **Invitado:** puede consultar lugares, categorías, búsqueda por cercanía — sin login.
- **Usuario registrado:** además puede guardar favoritos y dejar reseñas.
- **Admin:** puede crear/editar/despublicar lugares (para mantener la curaduría editorial). Se recomienda un campo `role` en `User` (`user` | `admin`) y un `RolesGuard` en NestJS.

---

## 8. Variables de entorno (`.env.example`)

```
DATABASE_URL=postgresql://usuario:password@host:5432/mxguide
JWT_SECRET=
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=3000
```

---

## 9. Convenciones de trabajo en equipo

- Un módulo NestJS por entidad; nadie edita el `service` de un módulo que no le corresponde sin avisar al resto.
- Todas las migraciones de Prisma se generan con `npx prisma migrate dev --name <descripcion>` y se suben al repositorio — nunca se edita la base de datos a mano.
- La carga inicial de lugares (la curaduría) vive en `prisma/seed.ts`, versionada en Git, para que todo el equipo trabaje con los mismos datos de prueba.
- Nombrar ramas por módulo/feature: `feature/places-nearby`, `feature/auth-jwt`, etc.

---

## 10. Pendientes a definir por el equipo

- [ ] ¿Habrá panel de administración web para cargar lugares, o se cargarán manualmente vía seed/Postman?
- [X] ¿Se requiere soporte multi-idioma (inglés) para turistas extranjeros?
- [ ] ¿El campo `relevanceScore` se define manualmente o se calculará con algún criterio (ej. cantidad de reseñas)?
- [X] Confirmar endpoints finales contra las pantallas del diseño de Figma.