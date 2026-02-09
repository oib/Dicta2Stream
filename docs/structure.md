# Dicta2Stream Codebase Structure

## Overview
Dicta2Stream is a FastAPI-based web application for audio file management and streaming. It provides user authentication, file upload/conversion, and streaming capabilities with PostgreSQL backend.

## Project Structure

```
dicta2stream/
├── run.py                      # Application entry point
├── gunicorn.conf.py            # Gunicorn production config
├── dicta2stream.service        # Systemd service file
├── alembic.ini                 # Alembic config
├── requirements.in             # Primary dependencies
├── requirements.txt            # Compiled dependencies
├── .env                        # Environment variables
├── src/
│   ├── backend/                # Python backend modules
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── models.py           # SQLModel database models
│   │   ├── database.py         # Database connection and session management
│   │   ├── auth.py             # Authentication utilities
│   │   ├── auth_router.py      # Authentication endpoints
│   │   ├── account_router.py   # User account management endpoints
│   │   ├── upload.py           # File upload and processing logic
│   │   ├── streams.py          # Streaming functionality
│   │   ├── list_streams.py     # Stream listing and management
│   │   ├── register.py         # User registration logic
│   │   ├── middleware.py       # Custom middleware (rate limiting, logging)
│   │   ├── log.py              # Logging utilities
│   │   ├── magic.py            # Magic link login handler
│   │   ├── concat_opus.py      # Audio file concatenation
│   │   ├── convert_to_opus.py  # Audio conversion to Opus format
│   │   └── range_response.py   # HTTP range response handling
│   └── frontend/
│       └── static/             # CSS, JS, HTML, images
├── alembic/                    # Database migrations
│   ├── versions/               # Migration scripts
│   └── env.py                  # Alembic environment
├── data/                       # User data storage
├── log/                        # Application logs
└── docs/                       # Documentation
```

## Core Components

### API Layer (`src/backend/`)
- **main.py**: Main FastAPI application with all endpoint definitions
- **auth_router.py**: Authentication routes (login, logout, token validation)
- **account_router.py**: Account management routes (profile, quota management)
- **register.py**: User registration endpoint

### Business Logic (`src/backend/`)
- **upload.py**: Handles file uploads, conversion to Opus format, and storage
- **streams.py**: Audio streaming functionality with range request support
- **list_streams.py**: Stream listing, search, and management
- **magic.py**: Magic link login confirmation

### Data Layer (`src/backend/`)
- **models.py**: SQLModel definitions (User, UserQuota, UploadLog)
- **database.py**: PostgreSQL connection and session management
- **alembic/**: Database schema migrations

### Infrastructure
- **src/backend/middleware.py**: Rate limiting with SlowAPI, request logging
- **src/backend/log.py**: Structured logging and violation tracking
- **gunicorn.conf.py**: Production WSGI server configuration

### Audio Processing (`src/backend/`)
- **convert_to_opus.py**: Converts audio files to Opus format using ffmpeg
- **concat_opus.py**: Concatenates multiple Opus files
- **silent.opus**: Silent audio segment for concatenation (project root)

## Key Features

1. **User Management**
   - Email-based registration
   - Token-based authentication
   - Quota management per user

2. **File Handling**
   - Audio file upload and conversion
   - Opus format optimization
   - UUID-based file naming

3. **Streaming**
   - HTTP range request support
   - Direct file streaming
   - Concatenated stream generation

4. **Security**
   - Rate limiting per IP and user
   - Token validation
   - Admin secret protection

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `ADMIN_SECRET`: Secret for admin operations
- `DEBUG`: Enable debug mode (0/1, false/true)
- `DOMAIN`: Application domain (default: dicta2stream.org)

## Database Schema

### Users Table
- email (PK)
- username (unique)
- token
- confirmed
- ip
- token_created

### UserQuota Table
- uid (PK)
- storage_bytes

### UploadLog Table
- id (PK)
- uid
- ip
- filename
- processed_filename
- size_bytes
- created_at

## Deployment

The application is deployed using:
- **Gunicorn**: WSGI server for production
- **Systemd**: Service management via dicta2stream.service
- **PostgreSQL**: Primary database
- **Nginx**: Reverse proxy (recommended)

## Development Notes

- Uses SQLModel for ORM with PostgreSQL
- FastAPI for REST API with automatic OpenAPI generation
- All audio files are converted to Opus format for efficiency
- Implements proper error handling and logging throughout
- Rate limiting prevents abuse (100 requests/minute per IP)
