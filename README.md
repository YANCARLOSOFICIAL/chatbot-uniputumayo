# Chatbot Uniputumayo- Institución Universitaria del Putumayo

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/YANCARLOSOFICIAL/chatbot-uniputumayo)

**Guaca** es el asistente virtual basado en **RAG (Retrieval-Augmented Generation)** y **LLM** de la Institución Universitaria del Putumayo. Responde preguntas sobre programas académicos, sedes, requisitos de admisión y más, basándose únicamente en los documentos institucionales cargados.

Soporta interacción por **texto y voz**, respuestas en **streaming (SSE)**, autenticación con **JWT** (usuarios registrados e invitados), un **panel de administración** completo, y permite alternar entre **Ollama (local)** y **OpenAI (nube)** como proveedores de IA.

---

## Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Ejecución](#ejecución)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Configuración](#configuración)
- [Pipeline RAG y Caché](#pipeline-rag-y-caché)
- [Solución de Problemas](#solución-de-problemas)

---

## Arquitectura

El sistema utiliza una **Arquitectura Orientada a Servicios (SOA)** implementada como un monolito modular. Cada servicio se expone como un router independiente dentro de un único proceso FastAPI, lo que mantiene la separación lógica SOA sin la complejidad operacional de múltiples microservicios.

```
  [Next.js 16 Frontend :3001]
            |
  [Nginx reverse proxy :80]
            |
  [FastAPI Gateway :8000]
            |
  +------+------+------+---------+--------+-------+-----------+
  |      |      |      |         |        |       |           |
[Auth] [Chat] [RAG] [LLM] [Documents] [Config] [Audio] [Analytics]
  |      |      |      |         |
  |  [chat_   [rag_  [llm_  [document_
  |  service] service] service] service]
  |                      |
  |              [Provider Factory]
  |              /              \
  |        [Ollama]          [OpenAI]
  |
  +──────────────┬──────────────────┐
                 ▼                  ▼
      [PostgreSQL + pgvector]   [Redis]
       (datos, embeddings)   (caché RAG/respuestas)
```

### Servicios

| Servicio | Responsabilidad |
|----------|----------------|
| **Auth Service** | Registro/login con JWT, gestión de roles (user/admin) |
| **Chat Service** | Orquestación del flujo: recibe mensaje → caché de respuestas → RAG → LLM → almacena → responde (soporta streaming SSE) |
| **RAG Service** | Búsqueda híbrida: similitud vectorial (pgvector/HNSW) + full-text keyword (Postgres FTS), con HyDE y diversidad de resultados |
| **LLM Service** | Capa de abstracción sobre Ollama y OpenAI (generación + embeddings) |
| **Document Service** | Ingesta de documentos: upload → extracción → chunking → embedding → almacenamiento; invalida cachés al subir/borrar |
| **Config Service** | Configuración runtime del proveedor LLM activo, persistida en BD (solo admin) |
| **Audio Service** | Text-to-Speech y Speech-to-Text |
| **Analytics Service** | Métricas de uso para el panel admin |
| **Health** | Monitoreo de salud del sistema (`/health`, `/metrics`) |

---

## Tecnologías

### Backend
| Tecnología | Uso |
|------------|-----|
| Python 3.11 | Lenguaje principal |
| FastAPI | Framework web async |
| SQLAlchemy 2 (async) | ORM |
| PostgreSQL 16 + pgvector | Base de datos relacional + búsqueda vectorial (índice HNSW) |
| Redis 7 | Caché persistente de RAG y de respuestas (opcional, con fallback en memoria) |
| Alembic | Migraciones de base de datos |
| Ollama | LLM local (`qwen3:8b`), embeddings (`nomic-embed-text`), visión (`gemma4:e4b`) |
| OpenAI SDK | LLM en la nube (`gpt-5.4-mini` y otros) |
| PyJWT + bcrypt | Autenticación JWT y hashing de contraseñas |
| slowapi | Rate limiting por IP |
| PyMuPDF / python-docx | Extracción de texto de PDF / DOCX |
| tiktoken | Conteo de tokens |

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16 (App Router) | Framework React |
| React | 19 | UI |
| TypeScript | 5+ | Tipado estático |
| Tailwind CSS | 4 | Estilos utilitarios |
| lucide-react | — | Iconos |
| react-markdown + remark-gfm | — | Renderizado de respuestas del bot |
| next-themes | — | Modo claro/oscuro |
| Web Speech API | nativa | Reconocimiento y síntesis de voz (es-CO) |

### Infraestructura
| Tecnología | Uso |
|------------|-----|
| Docker Compose | Orquestación completa (6 servicios: PostgreSQL, Redis, Ollama, Backend, Frontend, Nginx) |
| pgvector/pgvector:pg16 | Imagen Docker de PostgreSQL con pgvector |
| ollama/ollama | Imagen Docker de Ollama |
| redis:7-alpine | Caché en memoria compartida, LRU, 256 MB |
| Nginx | Reverse proxy unificando frontend y backend en puerto 80, con soporte SSE |

---

## Requisitos Previos

- **Docker Desktop** (con Docker Compose)
- **Git**
- (Opcional) **Python 3.11+** y **Node.js 20+** para desarrollo local sin Docker
- (Opcional) **API key de OpenAI** para usar el proveedor en la nube

---

## Instalación y Ejecución

### Opción 1: Docker Compose (Recomendada)

Todo el proyecto está dockerizado. Un solo comando levanta todos los servicios:

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd chatbot-uniputumayo

# 2. (Opcional) Configurar variables de entorno
cp backend/.env.example .env
# Editar .env: OPENAI_API_KEY, JWT_SECRET y ADMIN_PASSWORD son las más importantes

# 3. Levantar todo
docker compose up --build -d

# 4. (Opcional) Descargar modelos de Ollama manualmente
# El backend ya los descarga automáticamente en segundo plano al iniciar,
# pero puedes forzarlo/verificarlo así:
docker exec iup-chatbot-ollama ollama pull qwen3:8b
docker exec iup-chatbot-ollama ollama pull nomic-embed-text
docker exec iup-chatbot-ollama ollama pull embeddinggemma
```

Esto levanta **6 servicios**:
- **PostgreSQL 16** con pgvector (puerto `5433`)
- **Redis** para caché de RAG y respuestas (puerto `6379`)
- **Ollama** para LLM local (puerto `11434`)
- **Backend FastAPI** con migraciones automáticas (puerto `8000`)
- **Frontend Next.js** (puerto `3001`)
- **Nginx** reverse proxy (puerto `80`)

> **Nota:** El backend descarga automáticamente los modelos de Ollama al iniciar (`qwen3:8b`, `nomic-embed-text`, `gemma4:e4b`, `embeddinggemma`) si detecta que no están disponibles, sin bloquear el arranque.
>
> **⚠️ Importante para producción:** `JWT_SECRET` y `ADMIN_PASSWORD` tienen valores por defecto inseguros pensados solo para desarrollo local. Cámbialos siempre en `.env` antes de exponer el servicio fuera de tu máquina.

#### URLs de acceso (Docker)

| Servicio | URL |
|----------|-----|
| Aplicación completa (Nginx) | http://localhost |
| Frontend directo | http://localhost:3001 |
| Backend API directo | http://localhost:8000 |
| Swagger/OpenAPI Docs | http://localhost/docs |
| Health Check | http://localhost/api/v1/health |

#### Comandos útiles

```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend

# Reiniciar un servicio
docker compose restart backend

# Detener todo
docker compose down

# Detener todo y eliminar volúmenes (reset completo, borra BD/caché/modelos)
docker compose down -v
```

---

### Opción 2: Desarrollo Local (sin Docker para backend/frontend)

Para desarrollo con hot-reload, puedes correr solo la infraestructura en Docker:

```bash
# Levantar PostgreSQL + Redis + Ollama con el compose de la raíz
docker compose up -d postgres redis ollama
```

#### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows Git Bash
# source venv/bin/activate    # Linux/macOS
pip install -r requirements.txt
cp .env.example .env          # Editar si es necesario
alembic upgrade head          # Aplicar migraciones
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev -- --port 3001
```

#### URLs de acceso (Desarrollo Local)

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| Health Check | http://localhost:8000/api/v1/health |

---

## Uso

### 1. Autenticación

- **Invitados**: el chat funciona sin cuenta (`/chat`). Las conversaciones de invitado se guardan solo en el navegador y se limpian automáticamente del servidor tras 2 horas de inactividad.
- **Usuarios registrados**: `/login` para crear cuenta o iniciar sesión; el historial de conversaciones se guarda de forma persistente.
- **Administradores**: `/admin/login`. Se crea automáticamente un usuario admin al primer arranque con `ADMIN_EMAIL`/`ADMIN_PASSWORD` (ver [Configuración](#configuración)).

### 2. Subir documentos (Panel Admin)

1. Ir a `/admin/documents`
2. Seleccionar un archivo PDF, DOCX o TXT con información académica
3. Completar los campos: **Título**, **Facultad**, **Programa**, **Tipo** (pensum, perfil, misión, reglamento, admisión, general)
4. Clic en "Subir Documento"
5. El sistema procesa automáticamente: extrae texto → limpia → divide en chunks → genera embeddings → almacena en pgvector. Subir o borrar un documento invalida la caché de respuestas para evitar servir información desactualizada.

### 3. Chatear

1. Ir a `/chat`
2. Crear una nueva conversación o escribir directamente
3. Preguntar, por ejemplo:
   - "¿Cuáles son los programas de ingeniería que ofrece la IUP?"
   - "¿Cuál es el perfil profesional del ingeniero de sistemas?"
   - "¿Cuáles son los requisitos de admisión?"
4. La respuesta llega en streaming (token a token) y se basa **únicamente** en los documentos cargados, citando las fuentes consultadas

### 4. Usar voz

1. Clic en el botón del micrófono (requiere Chrome/Edge)
2. Hablar tu pregunta
3. El avatar cambia de estado: escuchando → pensando → hablando
4. La respuesta se reproduce por voz automáticamente (es-CO)

### 5. Configurar proveedor de IA (solo admin)

1. Ir a `/admin/config`
2. Ver el estado de los proveedores (Ollama / OpenAI) y configurar la API key de OpenAI
3. Cambiar el proveedor/modelo activo — esta configuración es **exclusiva del panel admin**; el chat de usuario nunca muestra un selector de modelo

---

## API Endpoints

### Health
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/health` | Estado de salud del sistema (BD, Ollama, OpenAI) |
| GET | `/api/v1/metrics` | Métricas básicas de uso |

### Auth
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registrar usuario (rate limit: 5/hora) |
| POST | `/api/v1/auth/login` | Iniciar sesión, devuelve JWT (rate limit: 10/5min) |
| GET | `/api/v1/auth/me` | Usuario autenticado actual |
| GET | `/api/v1/auth/users` | Listar usuarios (admin) |
| PUT | `/api/v1/auth/users/{id}/role` | Cambiar rol de un usuario (admin) |

### Chat
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/chat/conversations` | Crear conversación |
| GET | `/api/v1/chat/conversations` | Listar conversaciones |
| GET | `/api/v1/chat/conversations/{id}` | Obtener conversación |
| PATCH | `/api/v1/chat/conversations/{id}` | Renombrar conversación |
| DELETE | `/api/v1/chat/conversations/{id}` | Eliminar conversación |
| POST | `/api/v1/chat/conversations/{id}/guest-close` | Hard-delete de conversación de invitado al cerrar pestaña |
| POST | `/api/v1/chat/conversations/{id}/messages` | Enviar mensaje (orquesta caché + RAG + LLM) |
| POST | `/api/v1/chat/conversations/{id}/messages/stream` | Enviar mensaje con respuesta en streaming (SSE) |
| GET | `/api/v1/chat/conversations/{id}/messages` | Obtener mensajes |

### RAG
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/rag/search` | Búsqueda híbrida vectorial + full-text (solo admin) |

### LLM
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/llm/generate` | Generar texto con LLM (admin) |
| POST | `/api/v1/llm/embed` | Generar embeddings (admin) |
| GET | `/api/v1/llm/providers` | Listar proveedores disponibles |
| PUT | `/api/v1/llm/config` | Actualizar proveedor/modelo por defecto (admin) |
| POST | `/api/v1/llm/api-key` | Configurar API key de OpenAI (admin) |
| GET | `/api/v1/llm/api-key-status` | Ver si hay API key configurada (admin) |

### Documentos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/documents/upload` | Subir documento (multipart/form-data) |
| GET | `/api/v1/documents/` | Listar documentos |
| GET | `/api/v1/documents/{id}` | Obtener documento |
| DELETE | `/api/v1/documents/{id}` | Eliminar documento y sus chunks (invalida caché) |
| GET | `/api/v1/documents/{id}/chunks` | Ver chunks de un documento |
| POST | `/api/v1/documents/{id}/reindex` | Re-procesar documento |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/config/llm` | Ver configuración LLM actual (admin) |

### Audio
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/audio/tts` | Texto a voz |
| POST | `/api/v1/audio/stt` | Voz a texto |

### Analytics
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/analytics/overview` | Métricas de uso para el panel admin |

---

## Estructura del Proyecto

```
chatbot-uniputumayo/
├── .gitignore
├── README.md
├── docker-compose.yml               # Orquestación completa (6 servicios)
├── docker-compose.prod.yml          # Variante de producción
│
├── nginx/
│   └── nginx.conf                   # Reverse proxy (incluye config SSE para streaming)
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh                # Migraciones + uvicorn
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/versions/            # Migraciones
│   │
│   └── app/
│       ├── main.py                  # Gateway FastAPI - monta routers, seed de admin, índices
│       ├── config.py                # Pydantic Settings - carga .env
│       ├── database.py              # SQLAlchemy async engine + session
│       ├── auth.py                  # JWT, hashing, dependencias require_auth/require_admin
│       ├── runtime_config.py        # Configuración LLM mutable en runtime
│       │
│       ├── models/                  # Modelos SQLAlchemy (ORM)
│       │   ├── user.py
│       │   ├── conversation.py
│       │   ├── message.py
│       │   ├── document.py
│       │   ├── document_chunk.py    # Chunks con embeddings (pgvector)
│       │   ├── retrieval_log.py
│       │   └── llm_configuration.py
│       │
│       ├── schemas/                 # Pydantic schemas (request/response)
│       ├── services/
│       │   ├── chat_service.py      # Orquestación: caché → RAG → prompt → LLM → store
│       │   ├── rag_service.py       # Búsqueda híbrida vectorial + full-text
│       │   ├── llm_service.py       # Abstracción sobre providers
│       │   ├── document_service.py  # Pipeline de ingesta + invalidación de caché
│       │   └── llm_config_store.py  # Persistencia de config LLM en BD
│       │
│       ├── providers/               # Implementaciones de LLM (Ollama, OpenAI) + factory
│       │
│       ├── routers/                 # Endpoints REST
│       │   ├── health.py, auth.py, chat.py, rag.py, llm.py
│       │   └── documents.py, config.py, audio.py, analytics.py
│       │
│       ├── middleware/error_handler.py
│       │
│       └── utils/
│           ├── file_parsers.py      # Extracción: PDF, DOCX, TXT
│           ├── text_processing.py
│           ├── chunking.py
│           ├── query_utils.py
│           ├── prompts.py
│           ├── rate_limit.py        # slowapi por IP (respeta trusted_proxy_count)
│           └── cache.py             # Caché de RAG y de respuestas (Redis o memoria)
│
└── frontend/
    ├── package.json
    ├── next.config.ts               # Rewrite de /api/* hacia INTERNAL_API_URL
    │
    └── src/
        ├── app/
        │   ├── layout.tsx, page.tsx (landing), globals.css
        │   ├── chat/[conversationId]/page.tsx
        │   └── admin/
        │       ├── login/, documents/, config/, users/, conversations/, analytics/
        │
        ├── components/
        │   ├── chat/  # ChatContainer, MessageList, MessageBubble, ChatInput,
        │   │          # ConversationSidebar, TypingIndicator, SourceCard,
        │   │          # QuickReplies, MarkdownContent, GuacamayaAvatar
        │   ├── admin/ # AdminSidebar, AdminHeader
        │   └── ui/    # Toast, ThemeProvider, ThemeToggle, SiteFooter
        │
        ├── hooks/     # useChat, useSpeechRecognition, useSpeechSynthesis
        ├── context/   # ChatContext (useReducer)
        ├── lib/       # api/client.ts, auth.ts, utils/cn.ts
        └── types/     # chat.ts, avatar.ts
```

---

## Configuración

### Variables de Entorno del Backend (`backend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://chatbot_user:chatbot_password@localhost:5433/chatbot_db` | Conexión a PostgreSQL |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL del servidor Ollama |
| `OLLAMA_DEFAULT_MODEL` | `qwen3:8b` | Modelo de chat en Ollama |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Modelo de embeddings para RAG (768 dims) |
| `OLLAMA_VISION_MODEL` | `gemma4:e4b` | Modelo de visión/documentos |
| `OPENAI_API_KEY` | _(vacío)_ | API key de OpenAI (opcional) |
| `OPENAI_DEFAULT_MODEL` | `gpt-5.4-mini` | Modelo de chat en OpenAI |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo de embeddings en OpenAI (1536 dims) |
| `DEFAULT_LLM_PROVIDER` | `ollama` | Proveedor por defecto: `ollama` u `openai` |
| `DEFAULT_TEMPERATURE` | `0.05` | Casi determinista, para respuestas RAG factuales |
| `DEFAULT_MAX_TOKENS` | `2048` | Máximo de tokens en la respuesta |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `512` / `77` | Tamaño y solapamiento de chunks (tokens) |
| `RAG_TOP_K` | `5` | Chunks a recuperar |
| `RAG_SCORE_THRESHOLD` | `0.35` | Umbral de similitud (nomic-embed-text puntúa ~0.4-0.65 en docs en español) |
| `RAG_CANDIDATES_MULTIPLIER` | `3` | Candidatos = top_k × multiplier, filtrados luego por diversidad |
| `RAG_HYDE_ENABLED` | `true` | HyDE: embeder respuesta hipotética en vez de la query cruda |
| `RAG_DIVERSITY_ENABLED` | `true` | Máx. 2 chunks por documento fuente |
| `EMBEDDING_PROVIDER` | `ollama` | Proveedor de embeddings (independiente de `DEFAULT_LLM_PROVIDER`) |
| `EMBEDDING_DIMENSIONS` | `768` | 768 con nomic-embed-text, 1536 con text-embedding-3-small — no cambiar sin migrar |
| `ANSWER_CACHE_ENABLED` | `true` | Caché de respuestas completas por similitud semántica de preguntas |
| `ANSWER_CACHE_EMBEDDING_MODEL` | `embeddinggemma` | Modelo dedicado para distinguir parafraseos (separado del embedding de RAG) |
| `ANSWER_CACHE_SIMILARITY_THRESHOLD` | `0.65` | Umbral coseno para considerar un acierto de caché |
| `ANSWER_CACHE_TTL_SECONDS` | `2592000` (30 días) | La invalidación real ocurre al subir/borrar documentos |
| `ANSWER_CACHE_MAX_ENTRIES` | `1000` | Límite de entradas en caché |
| `REDIS_URL` | _(vacío)_ | Si se define, habilita caché persistente en Redis; si no, cae a memoria |
| `JWT_SECRET` | ⚠️ inseguro por defecto | **Cambiar siempre en producción** |
| `JWT_ALGORITHM` | `HS256` | Algoritmo de firma JWT |
| `JWT_EXPIRE_MINUTES` | `480` | Expiración del token (8 horas) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@iup.edu.co` / ⚠️ inseguro por defecto | Credenciales del admin sembrado al primer arranque — **cambiar siempre en producción** |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Orígenes permitidos (separados por coma) |
| `TRUSTED_PROXY_COUNT` | `1` | Saltos de reverse proxy confiables (nginx) para rate limiting por IP real |
| `MAX_UPLOAD_SIZE_MB` | `50` | Tamaño máximo de archivo para upload |
| `LOG_LEVEL` | `info` | debug, info, warning, error |

### Variables de Entorno del Frontend

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL pública del backend (vacío en Docker → usa rutas relativas `/api/*`) |
| `INTERNAL_API_URL` | URL server-side que Next.js usa para el rewrite de `/api/*` (`http://backend:8000` en Docker) |

---

## Pipeline RAG y Caché

### Flujo de Ingesta de Documentos

```
Documento (PDF/DOCX/TXT)
    │
    ▼
1. Extracción de texto (PyMuPDF / python-docx / lectura directa)
    │
    ▼
2. Limpieza y normalización (Unicode, headers/footers repetitivos)
    │
    ▼
3. Chunking recursivo — 512 tokens, 15% de solapamiento
    │
    ▼
4. Embeddings — nomic-embed-text (768d) u OpenAI (1536d), en lotes paralelos
    │
    ▼
5. Almacenamiento en pgvector (índice HNSW, cosine similarity)
    │
    ▼
6. Invalidación de la caché de respuestas (para no servir contestaciones desactualizadas)
```

### Flujo de Consulta (Chat)

```
Pregunta del usuario
    │
    ▼
1. Answer cache: ¿hay una respuesta previa semánticamente similar (≥0.65 coseno,
   con embeddinggemma)? → si hay acierto, responde al instante sin tocar RAG/LLM
    │ (si no hay acierto)
    ▼
2. RAG Service: búsqueda híbrida
   - HyDE: genera una respuesta hipotética y la embede para buscar
   - Similitud vectorial (pgvector/HNSW) + full-text keyword search (Postgres FTS)
   - Filtra por score_threshold, aplica diversidad (máx. 2 chunks/doc)
   - Retorna top_k chunks relevantes
    │
    ▼
3. Construcción del prompt (system prompt anti-alucinación + contexto + historial)
    │
    ▼
4. LLM Service genera la respuesta (Ollama o OpenAI), en streaming si se usa /messages/stream
    │
    ▼
5. Almacenamiento del mensaje + metadata (tokens, provider, tiempo de respuesta)
   y guardado en la answer cache para futuras preguntas similares
    │
    ▼
6. Respuesta al frontend con las fuentes consultadas
```

---

## Base de Datos

### Diagrama de Tablas

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   users      │────▶│  conversations   │────▶│   messages    │
│              │     │                  │     │               │
│ id (UUID PK) │     │ id (UUID PK)     │     │ id (UUID PK)  │
│ email        │     │ user_id (FK, ∅)  │     │ conv_id (FK)  │
│ password_hash│     │ title            │     │ role          │
│ display_name │     │ language         │     │ content       │
│ role         │     │ is_active        │     │ input_type    │
│ is_active    │     │ created_at       │     │ tokens_used   │
│ created_at   │     └──────────────────┘     │ llm_provider  │
└──────┬───────┘                              │ llm_model     │
       │                                       │ response_time │
       │             ┌──────────────────┐     └───────────────┘
       └────────────▶│   documents      │
                     │                  │     ┌──────────────────┐
                     │ id (UUID PK)     │────▶│ document_chunks  │
                     │ title            │     │                  │
                     │ file_name        │     │ id (UUID PK)     │
                     │ file_type        │     │ document_id (FK) │
                     │ faculty          │     │ chunk_index      │
                     │ program          │     │ content          │
                     │ document_type    │     │ token_count      │
                     │ ingestion_status │     │ embedding (768/  │
                     │ total_chunks     │     │  1536, HNSW idx) │
                     └──────────────────┘     └──────────────────┘
```

`conversations.user_id` es nullable — las conversaciones de invitado no tienen usuario asociado y se limpian automáticamente 2 horas después de creadas.

---

## Solución de Problemas

### Puerto 5432 ocupado

El proyecto ya usa el puerto `5433` para PostgreSQL (ver `docker-compose.yml`). Asegúrate de que `DATABASE_URL` use ese puerto en desarrollo local.

### Puerto 3000 ocupado

```bash
npm run dev -- --port 3001
```

### Ollama no responde

```bash
docker ps --filter "name=iup-chatbot-ollama"
docker logs iup-chatbot-ollama
docker exec iup-chatbot-ollama ollama list
docker exec iup-chatbot-ollama ollama pull qwen3:8b
```

En Docker Desktop para Windows, el contenedor de Ollama necesita DNS explícito (`8.8.8.8`, `8.8.4.4`, ya configurado en `docker-compose.yml`) para poder alcanzar el registro de modelos.

### Redis no disponible

Si `REDIS_URL` está vacío o Redis no responde, el sistema cae automáticamente a caché en memoria (RAG y respuestas), sin persistencia entre reinicios — no es un error fatal.

### Error de migración "pgvector not defined"

```python
# Agregar al inicio del archivo de migración:
import pgvector.sqlalchemy

# Y antes de crear tablas:
op.execute('CREATE EXTENSION IF NOT EXISTS vector')
op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
```

### "different vector dimensions" al hacer una consulta

Ocurre si `EMBEDDING_PROVIDER`/`EMBEDDING_DIMENSIONS` cambió sin migrar la columna `embedding` existente. El backend registra un error explícito en el arranque (`EMBEDDING DIMENSION MISMATCH`) cuando detecta este desajuste — revisa los logs y re-embebe los documentos o revierte la configuración.

### El chat no responde

1. Verificar que el backend está corriendo: http://localhost:8000/api/v1/health
2. Verificar que hay documentos subidos: http://localhost:8000/docs → GET `/api/v1/documents/`
3. Verificar el proveedor LLM: http://localhost:8000/api/v1/llm/providers
4. Ver logs del backend (`docker compose logs -f backend`)

### Voz no funciona

- El reconocimiento de voz requiere **Chrome o Edge** (no funciona en Firefox)
- Se necesita permiso del micrófono en el navegador
- El idioma configurado es **es-CO** (español colombiano)

---

## Licencia

Proyecto académico de la Institución Universitaria del Putumayo.
