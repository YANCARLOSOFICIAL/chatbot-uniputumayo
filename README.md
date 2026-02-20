# Chatbot Uniputumayo- Institución Universitaria del Putumayo

Chatbot interactivo basado en **RAG (Retrieval-Augmented Generation)** y **LLM (Large Language Models)** que brinda información precisa y accesible sobre los programas académicos de la Institución Universitaria del Putumayo.

Soporta interacción por **texto y voz**, cuenta con un **avatar animado 2D** y permite alternar entre **Ollama (local)** y **OpenAI (nube)** como proveedores de IA.

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
- [Pipeline RAG](#pipeline-rag)
- [Solución de Problemas](#solución-de-problemas)

---

## Arquitectura

El sistema utiliza una **Arquitectura Orientada a Servicios (SOA)** implementada como un monolito modular. Cada servicio se expone como un router independiente dentro de un único proceso FastAPI, lo que mantiene la separación lógica SOA sin la complejidad operacional de múltiples microservicios.

```
  [Next.js 15 Frontend :3001]
            |
  [FastAPI Gateway :8000]
            |
  +---------+---------+-----------+--------------+
  |         |         |           |              |
[Chat]   [RAG]    [LLM]    [Documents]    [Health/Config]
Router   Router   Router     Router          Router
  |         |         |           |
[chat_    [rag_    [llm_     [document_
service]  service] service]   service]
                    |
            [Provider Factory]
            /              \
    [Ollama]          [OpenAI]
            \              /
        [PostgreSQL + pgvector]
```

### Servicios

| Servicio | Responsabilidad |
|----------|----------------|
| **Chat Service** | Orquestación del flujo: recibe mensaje → RAG → LLM → almacena → responde |
| **RAG Service** | Búsqueda vectorial por similitud coseno en pgvector |
| **LLM Service** | Capa de abstracción sobre Ollama y OpenAI (generación + embeddings) |
| **Document Service** | Ingesta de documentos: upload → extracción → chunking → embedding → almacenamiento |
| **Health/Config** | Monitoreo de salud del sistema y configuración de proveedores LLM |

---

## Tecnologías

### Backend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Python | 3.11+ | Lenguaje principal |
| FastAPI | 0.115.6 | Framework web async |
| SQLAlchemy | 2.0.36 | ORM async |
| PostgreSQL | 16 | Base de datos relacional |
| pgvector | 0.3.6 | Extensión para búsqueda vectorial |
| Alembic | 1.14.1 | Migraciones de base de datos |
| Ollama | latest | LLM local |
| OpenAI SDK | 1.59.3 | LLM en la nube |
| PyMuPDF | 1.25.1 | Extracción de texto de PDFs |
| python-docx | 1.1.2 | Extracción de texto de DOCX |
| tiktoken | 0.8.0 | Conteo de tokens |

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 15+ (App Router) | Framework React |
| TypeScript | 5+ | Tipado estático |
| Tailwind CSS | 4+ | Estilos utilitarios |
| lottie-react | 2.4+ | Animaciones del avatar |
| Web Speech API | nativa | Reconocimiento y síntesis de voz |

### Infraestructura
| Tecnología | Uso |
|------------|-----|
| Docker Compose | Orquestación completa (PostgreSQL + Ollama + Backend + Frontend + Nginx) |
| pgvector/pgvector:pg16 | Imagen Docker de PostgreSQL con pgvector |
| ollama/ollama | Imagen Docker de Ollama |
| Nginx | Reverse proxy unificando frontend y backend en puerto 80 |

---

## Requisitos Previos

- **Docker Desktop** (con Docker Compose)
- **Git**
- (Opcional) **Python 3.11+** y **Node.js 20+** para desarrollo local sin Docker
- (Opcional) **API key de OpenAI** para usar el proveedor en la nube

---

## Instalación y Ejecución

### Opción 1: Docker Compose (Recomendada)

Todo el proyecto esta dockerizado. Un solo comando levanta todos los servicios:

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd chatbot-uniputumayo

# 2. (Opcional) Configurar OpenAI si lo necesitas
cp .env.example .env
# Editar .env con tu OPENAI_API_KEY

# 3. Levantar todo
docker compose up --build -d

# 4. Descargar modelos de Ollama (primera vez)
docker exec iup-chatbot-ollama ollama pull llama3.1:8b
docker exec iup-chatbot-ollama ollama pull nomic-embed-text
```

Esto levanta **5 servicios**:
- **PostgreSQL 16** con pgvector (puerto `5433`)
- **Ollama** para LLM local (puerto `11434`)
- **Backend FastAPI** con migraciones automaticas (puerto `8000`)
- **Frontend Next.js** (puerto `3000`)
- **Nginx** reverse proxy (puerto `80`)

> **Nota:** El backend descarga automaticamente los modelos de Ollama al iniciar si detecta que no estan disponibles.

#### URLs de acceso (Docker)

| Servicio | URL |
|----------|-----|
| Aplicacion completa (Nginx) | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend API directo | http://localhost:8000 |
| Swagger/OpenAPI Docs | http://localhost/docs |
| Health Check | http://localhost/api/v1/health |

#### Comandos utiles

```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio especifico
docker compose logs -f backend

# Reiniciar un servicio
docker compose restart backend

# Detener todo
docker compose down

# Detener todo y eliminar volumenes (reset completo)
docker compose down -v
```

---

### Opcion 2: Desarrollo Local (sin Docker para backend/frontend)

Para desarrollo con hot-reload, puedes correr solo la infraestructura en Docker:

```bash
# 1. Levantar solo PostgreSQL + Ollama
cd backend
docker compose up -d

# 2. Descargar modelos
docker exec iup-chatbot-ollama ollama pull llama3.1:8b
docker exec iup-chatbot-ollama ollama pull nomic-embed-text
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

### 1. Subir documentos (Panel Admin)

1. Ir a http://localhost:3001/admin/documents
2. Seleccionar un archivo PDF, DOCX o TXT con información académica
3. Completar los campos:
   - **Título**: Nombre descriptivo del documento
   - **Facultad**: Ej. "Ingeniería", "Educación", "Ciencias de la Salud"
   - **Programa**: Ej. "Ingeniería de Sistemas", "Licenciatura en Matemáticas"
   - **Tipo**: pensum, perfil, misión, reglamento, admisión, general
4. Clic en "Subir Documento"
5. El sistema procesará automáticamente: extrae texto → divide en chunks → genera embeddings → almacena en pgvector

### 2. Chatear (Interfaz de Chat)

1. Ir a http://localhost:3001/chat
2. Crear una nueva conversación con el botón "Nueva conversación"
3. Escribir tu pregunta en el campo de texto, por ejemplo:
   - "¿Cuáles son los programas de ingeniería que ofrece la IUP?"
   - "¿Cuál es el perfil profesional del ingeniero de sistemas?"
   - "¿Cuáles son los requisitos de admisión?"
4. El bot responderá basándose **únicamente** en los documentos que hayas subido

### 3. Usar voz

1. Clic en el botón del micrófono (requiere Chrome/Edge)
2. Hablar tu pregunta
3. El avatar cambiará de estado: escuchando → pensando → hablando
4. La respuesta se reproducirá por voz automáticamente

### 4. Configurar proveedor de IA

1. Ir a http://localhost:3001/admin/config
2. Ver el estado de los proveedores (Ollama / OpenAI)
3. Cambiar el proveedor activo según necesidad

---

## API Endpoints

### Health
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/health` | Estado de salud del sistema |

### Chat
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/chat/conversations` | Crear conversación |
| GET | `/api/v1/chat/conversations` | Listar conversaciones |
| GET | `/api/v1/chat/conversations/{id}` | Obtener conversación |
| DELETE | `/api/v1/chat/conversations/{id}` | Eliminar conversación |
| POST | `/api/v1/chat/conversations/{id}/messages` | Enviar mensaje (orquesta RAG + LLM) |
| GET | `/api/v1/chat/conversations/{id}/messages` | Obtener mensajes |

### RAG
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/rag/search` | Búsqueda vectorial por similitud |

### LLM
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/llm/generate` | Generar texto con LLM |
| POST | `/api/v1/llm/embed` | Generar embeddings |
| GET | `/api/v1/llm/providers` | Listar proveedores disponibles |
| PUT | `/api/v1/llm/config` | Actualizar configuración |

### Documentos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/documents/upload` | Subir documento (multipart/form-data) |
| GET | `/api/v1/documents/` | Listar documentos |
| GET | `/api/v1/documents/{id}` | Obtener documento |
| DELETE | `/api/v1/documents/{id}` | Eliminar documento y sus chunks |
| GET | `/api/v1/documents/{id}/chunks` | Ver chunks de un documento |
| POST | `/api/v1/documents/{id}/reindex` | Re-procesar documento |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/config/llm` | Ver configuración LLM actual |
| PUT | `/api/v1/config/llm` | Actualizar configuración LLM |

---

## Estructura del Proyecto

```
chatbot-uniputumayo/
├── .gitignore
├── README.md
├── .env.example                     # Variables para Docker Compose
├── docker-compose.yml               # Orquestación completa (5 servicios)
│
├── nginx/
│   └── nginx.conf                   # Configuración del reverse proxy
│
├── backend/
│   ├── Dockerfile                   # Imagen Docker del backend
│   ├── entrypoint.sh                # Script de inicio (migraciones + uvicorn)
│   ├── .dockerignore
│   ├── docker-compose.yml          # PostgreSQL + pgvector + Ollama (dev local)
│   ├── requirements.txt            # Dependencias Python
│   ├── .env                        # Variables de entorno (no versionado)
│   ├── .env.example                # Plantilla de variables
│   ├── alembic.ini                 # Config de migraciones
│   │
│   ├── alembic/
│   │   ├── env.py                  # Config async de Alembic
│   │   ├── script.py.mako          # Template de migración
│   │   └── versions/               # Archivos de migración
│   │
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # Gateway FastAPI - monta todos los routers
│       ├── config.py               # Pydantic Settings - carga .env
│       ├── database.py             # SQLAlchemy async engine + session
│       │
│       ├── models/                 # Modelos SQLAlchemy (ORM)
│       │   ├── user.py             # Usuarios
│       │   ├── conversation.py     # Conversaciones
│       │   ├── message.py          # Mensajes de chat
│       │   ├── document.py         # Documentos subidos
│       │   ├── document_chunk.py   # Chunks con embeddings (pgvector)
│       │   ├── retrieval_log.py    # Logs de búsqueda RAG
│       │   ├── llm_configuration.py # Config de proveedores LLM
│       │   └── prompt_template.py  # Templates de prompts del sistema
│       │
│       ├── schemas/                # Pydantic schemas (request/response)
│       │   ├── common.py           # PaginatedResponse, HealthResponse
│       │   ├── chat.py             # Conversation, Message, ChatResponse
│       │   ├── rag.py              # SearchRequest, SearchResponse
│       │   ├── llm.py              # GenerateRequest, EmbedRequest
│       │   └── document.py         # DocumentUpload, DocumentResponse
│       │
│       ├── services/               # Lógica de negocio
│       │   ├── chat_service.py     # Orquestación: RAG → prompt → LLM → store
│       │   ├── rag_service.py      # Búsqueda vectorial en pgvector
│       │   ├── llm_service.py      # Abstracción sobre providers
│       │   └── document_service.py # Pipeline de ingesta de documentos
│       │
│       ├── providers/              # Implementaciones de LLM
│       │   ├── base.py             # Clase abstracta BaseLLMProvider
│       │   ├── ollama_provider.py  # Cliente HTTP para Ollama
│       │   ├── openai_provider.py  # Cliente OpenAI SDK
│       │   └── provider_factory.py # Factory pattern para providers
│       │
│       ├── routers/                # Endpoints REST (routers FastAPI)
│       │   ├── health.py           # GET /api/v1/health
│       │   ├── chat.py             # /api/v1/chat/*
│       │   ├── rag.py              # /api/v1/rag/*
│       │   ├── llm.py              # /api/v1/llm/*
│       │   ├── documents.py        # /api/v1/documents/*
│       │   └── config.py           # /api/v1/config/*
│       │
│       ├── middleware/
│       │   └── error_handler.py    # Manejador global de excepciones
│       │
│       └── utils/
│           ├── file_parsers.py     # Extracción: PDF, DOCX, TXT
│           ├── text_processing.py  # Limpieza y normalización de texto
│           ├── chunking.py         # Recursive Character Splitter
│           └── prompts.py          # Template del prompt del sistema
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── .env.local                  # NEXT_PUBLIC_API_URL
    │
    └── src/
        ├── app/
        │   ├── layout.tsx          # Root layout (metadata, fonts)
        │   ├── page.tsx            # Landing page
        │   ├── globals.css         # Estilos globales + Tailwind
        │   │
        │   ├── chat/
        │   │   ├── layout.tsx      # Chat layout (ChatProvider + Header)
        │   │   ├── page.tsx        # Página de chat nueva
        │   │   └── [conversationId]/
        │   │       └── page.tsx    # Conversación activa
        │   │
        │   └── admin/
        │       ├── layout.tsx      # Admin layout
        │       ├── page.tsx        # Dashboard admin
        │       ├── documents/
        │       │   └── page.tsx    # Gestión de documentos
        │       └── config/
        │           └── page.tsx    # Configuración LLM
        │
        ├── components/
        │   ├── chat/
        │   │   ├── ChatContainer.tsx       # Componente principal del chat
        │   │   ├── MessageList.tsx         # Lista scrollable de mensajes
        │   │   ├── MessageBubble.tsx       # Burbuja de mensaje (user/bot)
        │   │   ├── ChatInput.tsx           # Input de texto + botón voz
        │   │   ├── ConversationSidebar.tsx # Sidebar de conversaciones
        │   │   ├── TypingIndicator.tsx     # Indicador "escribiendo..."
        │   │   └── SourceCard.tsx          # Fuentes consultadas
        │   │
        │   ├── avatar/
        │   │   └── AvatarDisplay.tsx       # Avatar animado 2D (4 estados)
        │   │
        │   ├── ui/
        │   │   ├── Button.tsx              # Botón reutilizable
        │   │   └── Spinner.tsx             # Indicador de carga
        │   │
        │   └── layout/
        │       └── Header.tsx              # Header con navegación
        │
        ├── hooks/
        │   ├── useChat.ts                  # Lógica de chat (CRUD + envío)
        │   ├── useSpeechRecognition.ts     # Web Speech API STT (es-CO)
        │   ├── useSpeechSynthesis.ts       # Web Speech API TTS (es-CO)
        │   ├── useAvatarState.ts           # Máquina de estados del avatar
        │   └── useAutoScroll.ts            # Auto-scroll al último mensaje
        │
        ├── context/
        │   └── ChatContext.tsx              # Estado global con useReducer
        │
        ├── lib/
        │   ├── api/
        │   │   └── client.ts               # API client tipado (fetch)
        │   └── utils/
        │       └── cn.ts                   # Utilidad clsx + tailwind-merge
        │
        └── types/
            ├── chat.ts                     # Tipos: Conversation, Message, etc.
            └── avatar.ts                   # Tipo: AvatarState
```

---

## Configuración

### Variables de Entorno del Backend (`backend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://chatbot_user:chatbot_password@localhost:5433/chatbot_db` | URL de conexión a PostgreSQL |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL del servidor Ollama |
| `OLLAMA_DEFAULT_MODEL` | `llama3.1:8b` | Modelo de generación en Ollama |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Modelo de embeddings en Ollama |
| `OPENAI_API_KEY` | `sk-your-key-here` | API key de OpenAI (opcional) |
| `OPENAI_DEFAULT_MODEL` | `gpt-4o-mini` | Modelo de generación en OpenAI |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo de embeddings en OpenAI |
| `DEFAULT_LLM_PROVIDER` | `ollama` | Proveedor por defecto: `ollama` o `openai` |
| `DEFAULT_TEMPERATURE` | `0.3` | Temperatura de generación (0.0 - 1.0) |
| `DEFAULT_MAX_TOKENS` | `1024` | Máximo de tokens en la respuesta |
| `CHUNK_SIZE` | `512` | Tamaño de chunks en tokens |
| `CHUNK_OVERLAP` | `77` | Solapamiento entre chunks en tokens |
| `RAG_TOP_K` | `5` | Número de chunks a recuperar |
| `RAG_SCORE_THRESHOLD` | `0.7` | Umbral mínimo de similitud (0.0 - 1.0) |
| `EMBEDDING_DIMENSIONS` | `1536` | Dimensiones del vector de embedding |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Orígenes permitidos (separados por coma) |
| `MAX_UPLOAD_SIZE_MB` | `50` | Tamaño máximo de archivo para upload |
| `LOG_LEVEL` | `info` | Nivel de logging: debug, info, warning, error |

### Variables de Entorno del Frontend (`frontend/.env.local`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL del backend FastAPI |

---

## Pipeline RAG

### Flujo de Ingesta de Documentos

```
Documento (PDF/DOCX/TXT)
    │
    ▼
1. Extracción de texto
   - PDF: PyMuPDF (fitz)
   - DOCX: python-docx
   - TXT: lectura directa
    │
    ▼
2. Limpieza de texto
   - Normalización Unicode (caracteres españoles: ñ, á, é, í, ó, ú)
   - Eliminación de números de página
   - Eliminación de headers/footers repetitivos
    │
    ▼
3. Chunking (Recursive Character Splitter)
   - Tamaño: 512 tokens (~2000 caracteres)
   - Solapamiento: 15% (~77 tokens)
   - Separadores: \n\n\n → \n\n → \n → ". " → " "
    │
    ▼
4. Generación de Embeddings
   - Modelo: text-embedding-3-small (OpenAI) o nomic-embed-text (Ollama)
   - Dimensiones: 1536
   - Procesamiento en lotes de 20
    │
    ▼
5. Almacenamiento en pgvector
   - Tabla: document_chunks
   - Columna: embedding vector(1536)
   - Índice: IVFFlat con cosine similarity
```

### Flujo de Consulta (Chat)

```
Pregunta del usuario
    │
    ▼
1. Chat Service recibe el mensaje
    │
    ▼
2. RAG Service: Búsqueda vectorial
   - Embede la pregunta
   - Búsqueda por similitud coseno en pgvector
   - Filtra por score_threshold (0.7)
   - Retorna top_k (5) chunks relevantes
    │
    ▼
3. Construcción del prompt
   - System prompt: instrucciones del bot IUP
   - Contexto: chunks recuperados
   - Historial: últimos 10 mensajes
   - Pregunta del usuario
    │
    ▼
4. LLM Service: Generación de respuesta
   - Ollama (local) o OpenAI (nube)
   - Temperatura: 0.3 (respuestas precisas)
    │
    ▼
5. Almacenamiento
   - Guarda mensaje del usuario y respuesta del bot
   - Registra metadata: tokens, provider, tiempo
    │
    ▼
6. Respuesta al frontend
   - Contenido de la respuesta
   - Fuentes consultadas (documentos y scores)
```

---

## Base de Datos

### Diagrama de Tablas

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   users      │────▶│  conversations   │────▶│   messages    │
│              │     │                  │     │               │
│ id (UUID PK) │     │ id (UUID PK)     │     │ id (UUID PK)  │
│ email        │     │ user_id (FK)     │     │ conv_id (FK)  │
│ display_name │     │ title            │     │ role          │
│ role         │     │ language         │     │ content       │
│ is_active    │     │ is_active        │     │ input_type    │
│ created_at   │     │ created_at       │     │ tokens_used   │
└──────┬───────┘     └──────────────────┘     │ llm_provider  │
       │                                       │ llm_model     │
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
                     │ ingestion_status │     │ embedding (1536) │
                     │ total_chunks     │     │ metadata (JSONB) │
                     └──────────────────┘     └──────────────────┘
```

---

## Solución de Problemas

### Puerto 5432 ocupado

Si PostgreSQL no arranca porque el puerto 5432 está en uso:

```bash
# El proyecto ya usa el puerto 5433. Verificar en docker-compose.yml:
ports:
  - "5433:5432"

# Asegurarse de que DATABASE_URL en .env use el puerto 5433
```

### Puerto 3000 ocupado

```bash
# Iniciar el frontend en otro puerto
npm run dev -- --port 3001
```

### Ollama no responde

```bash
# Verificar que el contenedor está corriendo
docker ps --filter "name=iup-chatbot-ollama"

# Ver logs
docker logs iup-chatbot-ollama

# Verificar que el modelo está descargado
docker exec iup-chatbot-ollama ollama list

# Descargar modelo si falta
docker exec iup-chatbot-ollama ollama pull llama3.1:8b
```

### Error de migración "pgvector not defined"

Si Alembic genera una migración sin importar pgvector:

```python
# Agregar al inicio del archivo de migración:
import pgvector.sqlalchemy

# Y antes de crear tablas, agregar:
op.execute('CREATE EXTENSION IF NOT EXISTS vector')
op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
```

### El chat no responde

1. Verificar que el backend está corriendo: http://localhost:8000/api/v1/health
2. Verificar que hay documentos subidos: http://localhost:8000/docs → GET /api/v1/documents/
3. Verificar el proveedor LLM: http://localhost:8000/api/v1/llm/providers
4. Ver logs del backend en la terminal donde corre uvicorn

### Voz no funciona

- El reconocimiento de voz requiere **Chrome o Edge** (no funciona en Firefox)
- Se necesita permiso del micrófono en el navegador
- El idioma configurado es **es-CO** (español colombiano)

---

## Licencia

Proyecto académico de la Institución Universitaria del Putumayo.
