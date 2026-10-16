# MXGuide Backend

API REST para **MXGuide**, la app de guía turística de México. Construida
con **NestJS + Prisma + PostgreSQL (extensión PostGIS)**. Expone lugares
turísticos, categorías, estados, favoritos, reseñas, miniaturas de lugares
y autenticación con roles (`user` / `admin`), pensada para que el front
(Flutter) consuma todo vía JSON. La autenticación funciona con correo y
contraseña o con **Google (OAuth 2.0)**.

---

## Índice

1. [Stack](#stack)
2. [Cómo levantarlo en local](#cómo-levantarlo-en-local)
3. [Variables de entorno](#variables-de-entorno)
4. [Arquitectura y estructura de carpetas](#arquitectura-y-estructura-de-carpetas)
5. [Modelo de datos](#modelo-de-datos)
6. [Autenticación y roles](#autenticación-y-roles)
7. [Autenticación con Google (OAuth 2.0)](#autenticación-con-google-oauth-20)
8. [Referencia de Endpoints](#referencia-de-endpoints)
9. [Seguridad](#seguridad)
10. [Nota sobre PostGIS](#nota-sobre-postgis)
11. [Problemas comunes](#problemas-comunes)
12. [Pendientes del equipo](#pendientes-del-equipo)

---

## Stack

- **NestJS 10** (Node + TypeScript)
- **Prisma 5** como ORM, con **PostgreSQL** + extensión **PostGIS** (búsquedas por cercanía)
- **JWT** (`@nestjs/jwt` + `passport-jwt`) para autenticación
- **Google OAuth 2.0** (`passport-google-oauth20`) para iniciar sesión con Google
- **Cloudinary** para almacenamiento de las imágenes que sube un admin
- **Wikipedia / Wikimedia Commons** (APIs públicas) para las miniaturas de los lugares, guardadas en la base de datos como texto Base32
- **class-validator / class-transformer** para validar el body de cada request
- **Helmet** + **@nestjs/throttler** (rate limiting) para seguridad básica

---

## Cómo levantarlo en local

1. Tener PostgreSQL corriendo con la extensión PostGIS disponible (local,
   Docker, o un proveedor tipo Supabase/Neon con PostGIS habilitado).
2. Copiar las variables de entorno y llenarlas:
   ```bash
   cp .env.example .env
   ```
   ó
   ```bash
   copy .env.example .env
   ```
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Habilitar PostGIS en la base (una sola vez):
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
5. Generar el cliente de Prisma y correr las migraciones:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma migrate dev --name add_place_thumbnail
   npx prisma migrate dev --name add_google_auth
   ```
   > Si `migrate dev` avisa de *drift* y pide resetear la base, **responde `no`** (borraría todos los datos) y consulta [Problemas comunes](#problemas-comunes).
6. Cargar la curaduría inicial (estados, categorías y lugares de ejemplo, incluyendo las ciudades más importantes de México):
   ```bash
   npx prisma db seed
   ```
7. Levantar el servidor en modo desarrollo:
   ```bash
   npm run start:dev
   ```
   Queda escuchando en `http://localhost:3000` (sin prefijo `/api`, las rutas van directo: `http://localhost:3000/auth/login`).
8. Cargar las miniaturas de los lugares (una vez por cada base de datos, necesita internet y **no** requiere cuenta de admin):
   ```bash
   npm run sync-images
   ```
   Al terminar imprime cuántos lugares quedaron con miniatura y cuáles no. Si no existe el script en tu `package.json`, agrégalo con:
   ```bash
   npm pkg set scripts.sync-images="ts-node prisma/sync-images.ts"
   ```
   Alternativa: llamar a `POST /place-images/sync` con un token de admin (ver [Miniaturas de lugares](#miniaturas-de-lugares-place-images)).
9. *(Opcional)* Configurar el login con Google: ver [Autenticación con Google](#autenticación-con-google-oauth-20). Sin credenciales de Google el servidor arranca igual; solo `/auth/google` no funcionará.

> **Importante:** todos los comandos de esta guía se corren dentro de la carpeta `backend`, no en la raíz del repo. Si aparece `Could not read package.json`, estás en la carpeta equivocada.

> **Cada quien tiene su propia base de datos.** Mientras el backend no esté en un servidor, cada integrante lo corre local. Las miniaturas y la cuenta de admin no se comparten: hay que repetir los pasos 5 a 8 en cada compu, y volver a correr `npm run sync-images` cuando se agreguen lugares nuevos.

Para probar los endpoints usa **Thunder Client** (extensión de VS Code) o Postman — el navegador solo sirve para los `GET` públicos y para el flujo de Google (`/auth/google`), no para `POST`/`PATCH`/`DELETE`.

### Si ya tenías el proyecto corriendo y haces `git pull` del cambio de Google

```bash
npm install
npx prisma migrate dev --name add_google_auth   # o: npx prisma db push (ver Problemas comunes)
npx prisma generate
npm run start:dev
```

Después, agrega las 3 variables de Google a tu `.env` (pueden quedar vacías si no vas a probar el login con Google).

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a Postgres, ej. `postgresql://usuario:password@host:5432/mxguide` |
| `JWT_SECRET` | Secreto para firmar los tokens. Mínimo 16 caracteres — el server **no arranca** si falta o es muy corto |
| `JWT_EXPIRES_IN` | Duración del token, default `7d` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales de tu cuenta de Cloudinary (plan gratuito alcanza de sobra) |
| `GOOGLE_CLIENT_ID` | *(Opcional)* Client ID de OAuth de Google Cloud Console. Puede ir vacío si no usas el login con Google |
| `GOOGLE_CLIENT_SECRET` | *(Opcional)* Client Secret de OAuth de Google. Puede ir vacío. **Nunca lo subas al repo** |
| `GOOGLE_CALLBACK_URL` | *(Opcional)* URL de retorno de Google, debe coincidir exactamente con la registrada en Google Cloud. Local: `http://localhost:3000/auth/google/callback` |
| `PORT` | Puerto del servidor, default `3000` |

Todas se validan al arrancar (`app.module.ts`, con Joi). Si falta una obligatoria, el servidor rehúsa arrancar en vez de fallar a medias más adelante. Las variables de Google son opcionales (se permiten vacías) para que quien no tenga credenciales pueda levantar el backend sin problema.

---

## Arquitectura y estructura de carpetas

Un módulo por entidad, cada uno con su `controller` / `service` / `module` — nadie del equipo toca el `service` de un módulo ajeno.

```
src/
├── auth/            # registro, login, Google OAuth, JWT, guards de roles
│   ├── google.strategy.ts      # estrategia de Passport para Google
│   └── google-auth.guard.ts    # guard que dispara el flujo de Google
├── places/          # CRUD de lugares + búsqueda por cercanía (PostGIS)
├── categories/       # catálogo de categorías (solo lectura)
├── states/           # catálogo de estados de México (solo lectura)
├── favorites/         # favoritos del usuario logueado
├── reviews/           # reseñas de un lugar
├── uploads/           # subida de imágenes a Cloudinary (solo admin)
├── place-images/      # miniaturas de lugares en Base32 guardadas en la BD (Wikipedia / Commons)
├── prisma/            # PrismaService (cliente de base de datos)
├── common/            # decorador @Roles, filtro global de excepciones
└── main.ts            # bootstrap: Helmet, ValidationPipe, CORS
```

---

## Modelo de datos

Entidades principales (ver `prisma/schema.prisma` para el detalle completo):

- **State** — los 32 estados de México.
- **Category** — categorías de lugares (Histórico, Cultural, Natural, Religioso, Arqueológico).
- **Place** — un lugar turístico: nombre, descripciones, coordenadas (`latitude`/`longitude`), dirección, estado, municipio, costo de entrada, `relevanceScore` (para destacados), `isPublished`.
- **PlaceImage** — imágenes de un lugar (URL de Cloudinary + orden).
- **PlaceThumbnail** — miniatura (320 px) de un lugar guardada como texto **Base32** (`data`) junto con su tipo (`mime`). Relación 1 a 1 con `Place`. Se llena sola la primera vez que se pide, o en lote con `POST /place-images/sync`.
- **PlaceCategory** — tabla intermedia lugar↔categoría (muchos a muchos).
- **User** — email, `passwordHash` (bcrypt, **opcional**: es `null` para quien solo entra con Google), `googleId` (opcional, único), nombre, `role` (`user` | `admin`).
- **Favorite** — relación usuario↔lugar (un usuario no puede repetir el mismo lugar).
- **Review** — reseña de un usuario sobre un lugar (rating 1-5 + comentario opcional).

> **Nota:** las coordenadas se guardan como `Float` normales (no como tipo `geography` nativo), porque Prisma no lo modela de forma directa. La búsqueda por cercanía se calcula al vuelo con `ST_MakePoint`/`ST_DWithin` en una consulta raw (`places.service.ts`, método `findNearby`). Ver la sección [Nota sobre PostGIS](#nota-sobre-postgis).

---

## Autenticación y roles

- Login/registro (tradicional o con Google) regresan `{ "accessToken": "..." }` (JWT).
- Mándalo en cada request protegida como header:
  ```
  Authorization: Bearer <accessToken>
  ```
- Hay dos roles: `user` (default al registrarse) y `admin`. El registro **no** deja elegir rol — para volver admin a un usuario hay que cambiarlo directo en la base de datos (Prisma Studio: `npx prisma studio`, tabla `User`, campo `role`) o con SQL:
  ```sql
  UPDATE "User" SET role = 'admin' WHERE email = 'correo@ejemplo.com';
  ```
  Después del cambio, ese usuario debe volver a hacer login para obtener un token nuevo con el rol actualizado (el token viejo no se actualiza solo).
- Rutas de solo-admin: crear/editar/borrar lugares, ambos endpoints de `uploads` y `POST /place-images/sync`.

---

## Autenticación con Google (OAuth 2.0)

### Descripción general

Flujo híbrido: el usuario puede registrarse o iniciar sesión con su cuenta de Google (Passport.js + Google OAuth 2.0) y el backend le entrega **el mismo JWT** que el login tradicional, así que todas las rutas protegidas funcionan igual.

### Componentes

| Archivo | Responsabilidad |
|---|---|
| `src/auth/google.strategy.ts` | Estrategia de Passport (`passport-google-oauth20`). Pide los scopes `email` y `profile` y entrega al backend `googleId`, correo, si el correo está verificado y el nombre |
| `src/auth/google-auth.guard.ts` | Guard (`AuthGuard('google')`) que dispara el flujo |
| `src/auth/auth.service.ts` → `googleLogin` | Lógica de negocio (ver abajo) |
| `src/auth/auth.controller.ts` | Endpoints `GET /auth/google` y `GET /auth/google/callback` |
| `src/auth/auth.module.ts` | Registra `GoogleStrategy` en `providers` |
| `prisma/schema.prisma` | `User.googleId String? @unique` y `User.passwordHash String?` |

### Lógica de `googleLogin`

1. Rechaza (401) si Google no marca el correo como verificado.
2. Busca al usuario por `googleId`.
3. Si no existe, lo busca por correo (sin distinguir mayúsculas):
   - **Ya existía** (se registró con contraseña) → se **vincula** su cuenta guardando el `googleId`.
   - **No existe** → se crea con `googleId` y `passwordHash = null`.
4. Genera el JWT estándar con `buildTokenResponse`.

Los usuarios que solo entran con Google tienen `passwordHash = null`, por lo que `POST /auth/login` los rechaza con `401 Credenciales inválidas` (en vez de fallar con un error 500).

### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/auth/google` | Público | Redirige (302) a la pantalla de consentimiento de Google |
| GET | `/auth/google/callback` | Público | Retorno de Google: procesa al usuario y responde `200` `{ "accessToken": "..." }` |

> Usa la ruta en minúsculas: `/auth/google`.

### Configuración (Google Cloud Console, una sola vez)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) → **APIs y servicios** → **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth** → tipo **Aplicación web**.
2. En **URI de redireccionamiento autorizados** agrega, exactamente: `http://localhost:3000/auth/google/callback`
3. En la **Pantalla de consentimiento**, si está en modo *Testing*, agrega los correos del equipo como **Test users** (si no, Google responde 403 / "app no verificada").
4. Copia el Client ID y el Client Secret a tu `.env`:
   ```env
   GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tu_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ```
5. Reinicia el servidor.

### Comandos usados para implementarlo

```bash
git checkout -b feature/google-auth
npm i passport-google-oauth20
npm i -D @types/passport-google-oauth20
npx prisma migrate dev --name add_google_auth
npx prisma generate
npm run start:dev
```

### Guía rápida de pruebas

1. Abre en el navegador: `http://localhost:3000/auth/google`.
2. Elige tu cuenta de Google y concede los permisos.
3. El navegador muestra un JSON con tu `accessToken`.
4. En Postman / Thunder Client: `GET http://localhost:3000/auth/me` con el token en **Authorization → Bearer Token**. Debe regresar tu usuario.
5. Verifica que `POST /auth/register` y `POST /auth/login` sigan funcionando igual.

### Limitación para la app Flutter

El flujo actual (redirección + JSON en el navegador) sirve para probar y para clientes web. En la app móvil lo recomendable es usar el paquete `google_sign_in` para obtener un `idToken` y enviarlo al backend, que lo verificaría con `google-auth-library` y reutilizaría `googleLogin`. Está en [Pendientes del equipo](#pendientes-del-equipo).

---

## Referencia de Endpoints

**Base URL:** `http://localhost:3000`. Errores siempre con esta forma: `{ statusCode, path, timestamp, message }`. El `ValidationPipe` global rechaza (400) cualquier campo que mandes y no esté en el DTO — solo manda los campos exactos.

### Auth (`/auth`)

| Método | Ruta | Acceso | Body |
|---|---|---|---|
| POST | `/auth/register` | Público | `{ email, password (mín. 6), name }` → `{ accessToken }` |
| POST | `/auth/login` | Público | `{ email, password }` → `{ accessToken }` |
| GET | `/auth/google` | Público | Redirige a Google (302). Ver [Autenticación con Google](#autenticación-con-google-oauth-20) |
| GET | `/auth/google/callback` | Público | Retorno de Google → `{ accessToken }` |
| GET | `/auth/me` | Logueado | — → `{ id, email, name, role, createdAt }` |

### Lugares (`/places`)

| Método | Ruta | Acceso | Detalle |
|---|---|---|---|
| GET | `/places/nearby?lat=&lng=&radius=&limit=` | Público | `lat`/`lng` obligatorios; `radius` en km (default 25); `limit` (default 20). Regresa `distanceKm` |
| GET | `/places/featured?limit=` | Público | Los de mayor `relevanceScore` |
| GET | `/places?category=&stateId=&page=&limit=` | Público | Filtros opcionales; `page` default 1, `limit` default 20 (sin metadata de paginación) |
| GET | `/places/:id` | Público | Incluye `images`, `categories`, `state` |
| POST | `/places` | Admin | `{ name, shortDescription, longDescription, latitude, longitude, address, stateId, municipality, openingHours?, entryCost?, relevanceScore?, isPublished?, categoryIds? }` |
| PATCH | `/places/:id` | Admin | Mismo body, todo opcional |
| DELETE | `/places/:id` | Admin | — |

### Categorías (`/categories`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/categories` | Público — `[{ id, name, icon }]` |

### Estados (`/states`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/states` | Público — `[{ id, name }]`, orden alfabético |

### Favoritos (`/favorites`) — todas requieren estar logueado

| Método | Ruta | Detalle |
|---|---|---|
| GET | `/favorites` | Array de favoritos con su `place` (incluye `images`) |
| POST | `/favorites` | Body `{ placeId }` — 409 si ya existía |
| DELETE | `/favorites/:placeId` | — |

### Reseñas

| Método | Ruta | Acceso | Detalle |
|---|---|---|---|
| GET | `/places/:id/reviews` | Público | Más reciente primero, incluye `user { id, name }` |
| POST | `/reviews` | Logueado | Body `{ placeId, rating (1-5), comment? }` |

### Subida de imágenes (`/uploads`) — todas requieren rol `admin`

Van como **`multipart/form-data`** (no JSON), con el archivo en un campo llamado exactamente **`file`**.

| Método | Ruta | Detalle |
|---|---|---|
| POST | `/uploads/image` | Sube una imagen suelta a Cloudinary, regresa su URL |
| POST | `/uploads/places/:placeId/image` | Sube la imagen y crea el `PlaceImage` asociado a ese lugar |

### Miniaturas de lugares (`/place-images`)

Las miniaturas se guardan en la base de datos como texto Base32 (no como archivos) y no dependen de Cloudinary. Al pedir una que aún no existe, el backend la busca con el nombre del lugar: primero en **Wikipedia en español** y, si no hay resultado, en **Wikimedia Commons**. La app Flutter descarga el listado y lo guarda en su base de datos local para mostrar las imágenes sin internet.

| Método | Ruta | Acceso | Detalle |
|---|---|---|---|
| GET | `/place-images` | Público | Todas las miniaturas guardadas: `[{ placeId, mime, data (Base32), updatedAt }]` |
| GET | `/place-images/:id/encoded` | Público | Una miniatura codificada: `{ mime, data }`. `:id` es el id del lugar (UUID). 404 si no se encuentra imagen |
| GET | `/place-images/:id` | Público | La misma miniatura ya decodificada, como imagen (`Content-Type` según `mime`) |
| POST | `/place-images/sync` | Admin | Busca y guarda la miniatura de todos los lugares existentes. Regresa `{ total, conImagen, sinImagen[] }`. Tarda un rato (pausa de 0.3 s entre lugares) |

> Las imágenes de Wikipedia y Commons suelen requerir dar crédito al autor; si la app se publica, conviene mostrar la fuente.

**Cómo usarlas desde Flutter**
- Prueba rápida (solo con internet): `Image.network('<API>/place-images/<id del lugar>')`.
- Versión sin internet: la app llama a `GET /place-images`, guarda la respuesta en el celular, decodifica el Base32 a bytes y los muestra con `Image.memory`.
- `<API>` es `http://10.0.2.2:3000` en el emulador de Android, o `http://<IP de tu PC>:3000` en un celular real (misma red Wi-Fi).
- El `<id>` debe ser el UUID que regresa `GET /places`, no un id de datos de ejemplo (si no, responde 400).
- En desarrollo con `http`, Android puede exigir `android:usesCleartextTraffic="true"` en `AndroidManifest.xml`.

---

## Seguridad

Pensando en que la app de Flutter que consume esto puede pasar por revisión de tiendas (Google Play/App Store) — el backend no lo escanean directo, pero un backend inseguro sí puede ser motivo de rechazo o reporte después:

- **Helmet** — cabeceras HTTP de seguridad estándar.
- **Rate limiting** (`@nestjs/throttler`) — 100 requests por IP cada 60 segundos por default (ajustable en `app.module.ts`).
- **Filtro global de excepciones** — cualquier error no controlado regresa un mensaje genérico (sin stack traces ni detalles internos). Los errores esperados (400/401/403/404/409) sí regresan su mensaje normal.
- **Validación de variables de entorno al arrancar** — si falta `DATABASE_URL` o `JWT_SECRET` (o es muy corto), el servidor no arranca.
- **`whitelist` + `forbidNonWhitelisted`** — cualquier campo extra en el body rechaza el request completo.
- **Passwords con bcrypt** — nunca se guardan en texto plano.
- **Google OAuth** — solo se vincula o crea una cuenta si Google marca el correo como verificado, para evitar que alguien tome una cuenta ajena con un correo sin verificar.

Fuera del alcance de este repo (depende de dónde lo despliegues):
- Servir por **HTTPS** en producción (Railway, Render, Fly.io lo dan gratis con certificado automático).
- Usar un `JWT_SECRET` largo y aleatorio real en producción (no el de `.env.example`).
- En producción, registrar en Google Cloud la URL de callback con HTTPS y actualizar `GOOGLE_CALLBACK_URL`.
- Confirmar que `.env` esté en `.gitignore` (ya lo está) y nunca se suba por accidente; esto incluye `GOOGLE_CLIENT_SECRET`.

---

## Nota sobre PostGIS

El diseño original proponía un campo `location Geography(Point, 4326)`. Prisma no mapea nativamente el tipo `geography`, así que aquí se guardan `latitude`/`longitude` como columnas `Float` normales, y la distancia se calcula al vuelo con `ST_MakePoint(...)` / `ST_DWithin(...)` dentro de una consulta raw en `places.service.ts` (`findNearby`). Funciona igual, pero si el equipo quiere una columna `geography` real generada/indexada, hay que agregar una migración manual (columna calculada + índice `GIST`) después de `prisma migrate dev`.

---

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `Could not read package.json` o `Missing script` | Estás en la carpeta equivocada. Entra a `backend` |
| El editor marca error en `placeThumbnail` o en `googleId` | Falta regenerar el cliente: `npx prisma generate` y reiniciar el servidor TypeScript del editor |
| `The relation field ... is missing an opposite relation field` | Falta la línea `thumbnail PlaceThumbnail?` dentro de `model Place` en `schema.prisma` |
| `GET /place-images` regresa `[]` | Aún no se han cargado las miniaturas: corre `npm run sync-images` |
| Un lugar sale en la lista de "sin miniatura" | Las APIs no encontraron imagen con ese nombre; hay que ajustar el nombre de búsqueda |
| `git push` falla con `port 443` | Problema de conexión a GitHub (red, VPN o proxy), no del código |
| `migrate dev` dice `Drift detected` y pide resetear la base | La base tiene cambios que no están en `prisma/migrations`. **No aceptes el reset** (borra todos los datos). Usa `npx prisma db push` y luego `npx prisma generate` |
| `db push` avisa de una *unique constraint* en `googleId` | Es inofensivo: la columna es nueva y los usuarios existentes quedan en `NULL`. Acepta la advertencia |
| `Config validation error: "GOOGLE_CLIENT_ID" is not allowed to be empty` | En `app.module.ts` las variables de Google deben ser `Joi.string().allow('').optional()` |
| `OAuth2Strategy requires a clientID option` | `google.strategy.ts` debe usar valores de respaldo cuando `GOOGLE_CLIENT_ID` / `SECRET` vienen vacíos |
| Google muestra `redirect_uri_mismatch` | La URI registrada en Google Cloud no es idéntica a `GOOGLE_CALLBACK_URL` |
| Google muestra 403 / "app no verificada" | La pantalla de consentimiento está en *Testing*: agrega tu correo como **Test user** |
| `POST /auth/login` da 401 con un usuario de Google | Esperado: esa cuenta no tiene contraseña. Debe entrar por `/auth/google` |
| `EPERM` al correr `prisma generate` en Windows | El servidor sigue corriendo y bloquea el cliente de Prisma. Detenlo (Ctrl+C), corre `generate` y vuelve a arrancar |

---

## Pendientes del equipo

- Definir si `relevanceScore` se captura a mano o se calcula.
- Decidir si habrá panel admin web o la carga se sigue haciendo solo vía `prisma/seed.ts` / Thunder Client.
- Terminar de subir las fotos restantes de los lugares del seed vía `POST /uploads/places/:placeId/image`.
- Correr la migración `add_place_thumbnail` y `npm run sync-images` en cada entorno (la PC de cada integrante y, a futuro, producción).
- Evaluar subir el backend a un servidor compartido (Railway, Render o similar) para que todos usen la misma base de datos y no repetir la carga manual en cada PC.
- Implementar en la app Flutter la copia local de `GET /place-images` (decodificar Base32 y mostrar con `Image.memory`).
- Revisar que cada lugar del seed obtenga una imagen correcta (`sinImagen` en la respuesta de `sync`) y mostrar el crédito de la fuente.
- Implementar el login con Google para Flutter: `google_sign_in` en la app + endpoint `POST /auth/google/token` que verifique el `idToken` y reutilice `googleLogin`.
- Generar y subir al repo una migración para `add_google_auth` (si la base se sincronizó con `db push`, no queda archivo de migración en `prisma/migrations`).