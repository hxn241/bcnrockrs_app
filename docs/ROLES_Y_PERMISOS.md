# Roles, organizadores y permisos

Este documento describe **qué puede hacer cada tipo de actor** según la lógica actual del backend (FastAPI). La fuente de verdad es el código en `backend/app/routes/` y `backend/app/auth.py`.

## Conceptos importantes

### Cuenta en el sistema

En la base de datos solo hay un flag de privilegio global: **`is_admin`** (booleano). No existe un rol separado llamado «organizador» en la tabla de usuarios.

### Organizador de una salida

**Organizador** es quien **publica** una salida en el calendario (`POST /rutas-publicadas`). Ese usuario queda guardado como `organizador_id` en la salida publicada. Cualquier usuario autenticado puede ser organizador de una salida concreta.

### Creador de un grupo

Quien crea un grupo (`POST /grupos`) es su **`creador_id`**. Ese usuario gestiona solicitudes de entrada, puede expulsar miembros (salvo a sí mismo como creador), subir o quitar el logo y **eliminar el grupo**. No es automáticamente administrador de la aplicación.

### Visitante sin sesión

Algunos listados de salidas aceptan petición **sin** cabecera `Authorization`. En ese caso solo se devuelven salidas con **visibilidad abierta**. Las salidas **de grupo** quedan ocultas salvo que el usuario esté autenticado y sea **miembro** del grupo.

---

## Resumen por actor

| Actor | Catálogo de plantillas (`/rutas`) | Salidas publicadas (`/rutas-publicadas`) | Grupos (`/grupos`) | Perfil (`/auth/me`) |
|--------|-----------------------------------|------------------------------------------|--------------------|---------------------|
| **Visitante** | No | Ver listados / calendario / histórico solo salidas **abiertas** | Ver listado público de grupos (sin detalle privado) | No |
| **Usuario** | Crear plantillas (con límite), marcar las propias para eliminación; **no** editar plantillas en catálogo | Publicar (con límite/día salvo admin), editar/despublicar si es organizador o creador del grupo en salidas de grupo; apuntarse; fotos según reglas | Crear grupo, unirse/solicitar/salir; creador gestiona solicitudes y miembros | Ver y actualizar su perfil |
| **Administrador de la app** | Sin límite de plantillas; **editar** y **borrar** plantillas; no usa «marcar para eliminar» (flujo de usuario) | Sin límite de salidas/día; puede editar/despublicar cualquier salida; puede borrar fotos ajenas | Mismas reglas que usuario (el admin **no** hereda poder sobre grupos ajenos salvo lo que cualquier usuario tendría) | Igual que usuario |

---

## Administrador de la aplicación (`is_admin`)

- **Alta**: el **primer usuario** registrado en una base de datos vacía recibe `is_admin = true`. El resto nace como no admin (promover a admin habría que hacerlo en base de datos o con una futura herramienta).
- **Plantillas** (`/rutas`):
  - Puede **editar** cualquier plantilla (`PUT`).
  - Puede **eliminar** del catálogo (`DELETE`) si no hay una salida **activa** que use esa plantilla; si la hay, debe despublicarse antes.
  - **No** debe usar `POST /rutas/{id}/marcar-eliminacion` (reservado a usuarios sobre sus plantillas).
- **Salidas publicadas**:
  - **No** aplica el límite configurable de salidas activas por día y usuario.
  - Puede **editar** y **despublicar** cualquier salida.
  - Puede **eliminar fotos** de una salida aunque no las haya subido él.
- **Grupos**: las reglas de creador/miembro son las mismas que para un usuario normal (ser admin del sitio no convierte automáticamente en creador de todos los grupos).

---

## Usuario autenticado (no admin)

### Catálogo de plantillas

- **Ver** plantillas (incluido `/rutas/para-publicar` con filtros opcionales).
- **Crear** plantillas (`POST /rutas`) hasta **`max_rutas_plantilla_por_usuario`** plantillas activas (las marcadas para eliminación no cuentan como activas en ese cómputo). Los administradores no tienen este tope.
- **No puede** editar plantillas del catálogo (`PUT` solo administrador).
- **Marcar para eliminación** solo sus plantillas (`POST .../marcar-eliminacion`). Un admin del sitio debe borrarlas del catálogo cuando corresponda.
- **Quitar la marca** de eliminación si es el creador o un admin; el creador no puede quitarla si ya tiene el máximo de plantillas activas.

### Salidas en calendario (organizador)

- Al **publicar** (`POST /rutas-publicadas`), el usuario pasa a ser **organizador** de esa salida.
- **Límite**: si `max_publicaciones_salida_por_usuario_dia` es mayor que 0, un no-admin solo puede tener hasta ese número de salidas **activas** el **mismo `dia_ruta`**. Con valor **0** no hay límite. Los administradores no están sujetos a este límite.
- **Salida abierta**: puede editarla y despublicarla el **organizador** (y un admin).
- **Salida de grupo**: debe ser **miembro** del grupo para publicarla. Pueden **editarla y despublicarla** el **organizador** o el **creador del grupo** (además del admin de la app).
- **Cambiar visibilidad / grupo** en una salida existente exige ser quien ya puede editarla y, si aplica, ser miembro del grupo destino.

### Asistentes

- **Apuntarse** y **bajarse** de una salida si puede **ver** esa salida y la fecha de la salida **no ha pasado**.

### Fotos de salidas pasadas

- **Subir** foto solo si la salida ya está en **histórico** (fecha pasada), puede ver la salida, formato JPEG/PNG/WebP y tamaño máximo `max_upload_mb`.
- **Listar** fotos si puede ver la salida.
- **Borrar** solo las **propias** (el admin puede borrar cualquiera).

---

## Creador de grupo (sin ser admin del sitio)

Además de lo que cualquier **miembro** puede hacer:

- **Subir y eliminar** el logo del grupo.
- **Aceptar o rechazar** solicitudes de ingreso.
- **Expulsar** miembros (no puede expulsar al creador del grupo).
- **Eliminar** el grupo (las salidas que apuntaban al grupo dejan de ser de grupo: se les quita `grupo_id` y si eran solo de grupo pasan a **abierta**).

---

## Miembro de grupo (sin ser creador)

- **Solicitar** entrada y **cancelar** solicitud.
- **Salir** del grupo.
- **Publicar** una salida con visibilidad de grupo en ese grupo (debe ser miembro en el momento de publicar).
- Ver en listados las salidas de grupos de los que es miembro.

---

## Visitante (sin token)

- Ve salidas **abiertas** en calendario, histórico y por fecha.
- No ve salidas exclusivas de grupo.
- Puede listar **grupos** en `GET /grupos`, pero el **detalle** con miembros y solicitudes requiere autenticación.

---

## Configuración que afecta a límites

Definidos en `backend/app/config.py` y sobrescribibles por variables de entorno (Pydantic Settings, nombres típicos en mayúsculas):

| Variable (entorno) | Efecto |
|--------------------|--------|
| `MAX_RUTAS_PLANTILLA_POR_USUARIO` | Tope de plantillas **activas** por usuario no admin. |
| `MAX_PUBLICACIONES_SALIDA_POR_USUARIO_DIA` | Tope de salidas **activas** por **día de salida** y **organizador** (no admin). `0` = sin límite. |
| `MAX_UPLOAD_MB` | Tamaño máximo de subida de imágenes (fotos de salida, logos). |

---

## Documentación interactiva de la API

Con el backend en marcha: [OpenAPI / Swagger](http://localhost:8002/docs) (ruta `/docs`).
