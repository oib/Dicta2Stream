# dicta2stream

A FastAPI-based audio streaming and upload backend with user registration, quota management, and abuse logging.

## Features
- User registration and magic link login
- Audio upload with music/singing detection
- Per-user storage quota
- Admin stats endpoint
- Abuse/violation logging

## Setup

### Requirements
- Python 3.11+
- PostgreSQL (or compatible DB)

### Installation
```sh
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables
Create a `.env` file in the project root with:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/dictastream
ADMIN_SECRET=your_admin_secret
```

### Running
```sh
uvicorn main:app --reload
```

### Directory Structure
- `main.py` — FastAPI entrypoint
- `register.py`, `magic.py`, `upload.py`, `redirect.py` — routers
- `models.py` — SQLModel ORM models
- `database.py` — DB session/engine
- `static/` — static HTML/JS/CSS assets

### Notes
- By default, audio uploads are stored in `/data`.
- Ollama music/singing detection requires a local Whisper API at `localhost:11434`.
- Abuse logs are written to `abuse.log`.

## License
MIT
