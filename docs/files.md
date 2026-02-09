# Dicta2Stream File Documentation

## Root Directory Files

### Entry Points and Configuration

| File | Purpose | Status |
|------|---------|--------|
| `run.py` | Application entry point (`python run.py`) | ✅ Active |
| `.env` | Environment variables (DATABASE_URL, ADMIN_SECRET, DEBUG) | ✅ Active |
| `.gitignore` | Git ignore patterns | ✅ Active |
| `alembic.ini` | Alembic database migration configuration | ✅ Active |
| `gunicorn.conf.py` | Gunicorn WSGI server configuration (primary) | ✅ Active |
| `gunicorn_config.py` | Alternative Gunicorn configuration | ⚠️ Duplicate |
| `dicta2stream.service` | systemd service file for production deployment | ✅ Active |
| `silent.opus` | Silent audio segment used by concat_opus | ✅ Active |

### Dependency Files

| File | Purpose | Status |
|------|---------|--------|
| `requirements.in` | Primary Python dependencies | ✅ Active |
| `requirements.txt` | Compiled dependencies with versions | ✅ Active |

### Documentation Files

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Main project documentation | ✅ Active |
| `LICENSE` | MIT License | ✅ Active |
| `DATABASE.md` | Database setup and migration guide | ⚠️ Outdated, should move to docs/ |

### Development/Temporary Files

| File | Purpose | Status |
|------|---------|--------|
| `__RELOAD__` | Development reload indicator | ❌ Should be deleted |
| `__CASCADE_RELOAD__` | Cascade reload indicator | ❌ Should be deleted |

---

## Backend (`src/backend/`)

### Core Application

| File | Purpose | Status |
|------|---------|--------|
| `__init__.py` | Package initializer | ✅ Active |
| `main.py` | FastAPI application entry point, all endpoint definitions, static file serving | ✅ Active |
| `models.py` | SQLModel database models (User, UserQuota, UploadLog, PublicStream, DBSession) | ✅ Active |
| `database.py` | PostgreSQL engine/session management via SQLModel | ✅ Active |

### Authentication and User Management

| File | Purpose | Status |
|------|---------|--------|
| `auth.py` | Authentication utilities, token validation, `get_current_user` dependency | ✅ Active |
| `auth_router.py` | Auth API routes: `/api/login`, `/api/logout`, `/api/status` | ✅ Active |
| `account_router.py` | Account management: `/api/delete-account` | ✅ Active |
| `register.py` | User registration endpoint, user directory initialization | ✅ Active |
| `magic.py` | Magic link login confirmation handler | ✅ Active |

### Audio Processing and Streaming

| File | Purpose | Status |
|------|---------|--------|
| `upload.py` | File upload processing, quota checks, Opus conversion | ✅ Active |
| `streams.py` | Audio streaming endpoint with HTTP range support | ✅ Active |
| `list_streams.py` | Public stream listing via SSE (Server-Sent Events) | ✅ Active |
| `concat_opus.py` | Concatenates user Opus files into `stream.opus` | ✅ Active |
| `convert_to_opus.py` | Converts uploaded audio to Opus format via ffmpeg | ✅ Active |
| `range_response.py` | HTTP range response builder for partial content delivery | ✅ Active |

### Infrastructure

| File | Purpose | Status |
|------|---------|--------|
| `middleware.py` | Rate limiting (SlowAPI) and request logging middleware | ✅ Active |
| `log.py` | Violation/abuse logging to `log/abuse.log` | ✅ Active |

### Legacy/Empty Files (in src/backend/)

| File | Purpose | Status |
|------|---------|--------|
| `redirect.py` | Empty — only a comment, no code | ❌ Should be deleted |
| `streams_cache.py` | Completely empty file | ❌ Should be deleted |

---

## Frontend (`src/frontend/static/`)

### HTML

| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Main single-page application HTML | ✅ Active |
| `footer.html` | Footer HTML component | ✅ Active |

### Stylesheets

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `style.css` | Main stylesheet | ✅ Active |
| `desktop.css` | Desktop-specific responsive styles | ✅ Active |
| `mobile.css` | Mobile-specific responsive styles | ✅ Active |
| `css/` | Additional CSS modules | ✅ Active |

### JavaScript Modules

| File | Purpose | Status |
|------|---------|--------|
| `app.js` | Main application initialization | ✅ Active |
| `auth-manager.js` | Authentication state management | ✅ Active |
| `auth-ui.js` | Authentication UI components | ✅ Active |
| `auth.js` | Authentication utilities | ✅ Active |
| `dashboard.js` | User dashboard functionality | ✅ Active |
| `upload.js` | File upload interface | ✅ Active |
| `streams-ui.js` | Stream listing UI | ✅ Active |
| `audio-player.js` | Audio player functionality | ✅ Active |
| `shared-audio-player.js` | Shared audio player component | ✅ Active |
| `personal-player.js` | Personal stream player | ✅ Active |
| `file-display.js` | File listing and management | ✅ Active |
| `magic-login.js` | Magic link login handler | ✅ Active |
| `nav.js` | Navigation components | ✅ Active |
| `toast.js` | Toast notification system | ✅ Active |
| `logger.js` | Client-side logging | ✅ Active |
| `cleanup-auth.js` | Authentication cleanup utilities | ✅ Active |
| `remove-confirmed-uid.js` | UID removal utilities | ✅ Active |
| `init-personal-stream.js` | Personal stream initialization | ✅ Active |
| `uid-validator.js` | UID validation utilities | ✅ Active |
| `global-audio-manager.js` | Global audio state management | ✅ Active |
| `sound.js` | Sound effect utilities | ✅ Active |

### Assets

| File | Purpose | Status |
|------|---------|--------|
| `favicon.ico` | Website favicon | ✅ Active |

---

## Data Directories

| Directory | Purpose | Status |
|-----------|---------|--------|
| `data/` | User data storage (audio files, per-user subdirectories) | ✅ Active |
| `log/` | Application logs (`abuse.log`, `debug.log`) | ✅ Active |

## Database Migrations (`alembic/`)

| Directory/File | Purpose | Status |
|-----------------|---------|--------|
| `alembic/env.py` | Alembic environment configuration | ✅ Active |
| `alembic/versions/` | Current migration scripts | ✅ Active |
| `alembic/legacy_versions/` | Old migration scripts | ⚠️ Can be cleaned up |

## Documentation (`docs/`)

| File | Purpose | Status |
|------|---------|--------|
| `structure.md` | Codebase structure documentation | ✅ Active |
| `files.md` | This file — detailed file documentation | ✅ Active |

---

## Cleanup Recommendations

### Files to Delete

```bash
# Temporary development files
rm __RELOAD__ __CASCADE_RELOAD__

# Empty legacy backend files
rm src/backend/redirect.py src/backend/streams_cache.py

# Duplicate gunicorn config
rm gunicorn_config.py
```

### Files to Move

- `DATABASE.md` — move to `docs/` and update with correct Alembic commands

### Directories to Clean

- `alembic/legacy_versions/` — remove after confirming DB is up-to-date
- `__pycache__/` — should be in `.gitignore` (already is)
