# Dicta2Stream

**Live Site:** [https://dicta2stream.net](https://dicta2stream.net)

A FastAPI-based audio streaming and upload backend with user registration, quota management, and abuse logging.

## Features

- **User Management**: Email-based registration with magic link authentication
- **Audio Processing**: Upload and automatic conversion to Opus format
- **Streaming**: HTTP range request support for efficient audio streaming
- **Quota Management**: Per-user storage quotas with tracking
- **Security**: Rate limiting, abuse logging, and token-based authentication
- **Admin Tools**: Stats endpoint and user management
- **File Detection**: Music/singing detection using file type analysis

## Tech Stack

- **Backend**: FastAPI with Python 3.11+
- **Database**: PostgreSQL with SQLModel ORM
- **Audio**: FFmpeg for Opus conversion
- **Deployment**: Gunicorn with systemd service
- **Rate Limiting**: SlowAPI for abuse prevention

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 12+
- FFmpeg
- Node.js (for frontend development, optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/oib/Dicta2Stream.git
cd dicta2stream

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dictastream
ADMIN_SECRET=your_secure_admin_secret
DEBUG=0
DOMAIN=dicta2stream.org
```

### Database Setup

```bash
# Initialize database migrations
alembic upgrade head

# Or create tables directly (development only)
python -c "from database import engine; from models import SQLModel; SQLModel.metadata.create_all(engine)"
```

### Running the Application

```bash
# Development mode
python run.py

# Or using uvicorn directly
uvicorn src.backend.main:app --reload

# Production mode
gunicorn -c gunicorn.conf.py src.backend.main:app
```

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /auth/login` - Login with magic link
- `POST /auth/logout` - Logout
- `GET /auth/status` - Check authentication status

### File Management
- `POST /upload` - Upload audio file
- `GET /streams` - List user streams
- `GET /stream/{filename}` - Stream audio file
- `DELETE /stream/{filename}` - Delete stream

### Admin
- `GET /admin/stats` - Get usage statistics (requires admin secret)

## Project Structure

```
dicta2stream/
├── src/                    # Source code
│   ├── backend/           # Backend Python modules
│   │   ├── main.py        # FastAPI application entry point
│   │   ├── models.py      # SQLModel database models
│   │   ├── database.py    # Database connection
│   │   └── ...            # Other backend modules
│   └── frontend/          # Frontend assets
│       └── static/        # CSS, JS, images
├── docs/                  # Documentation
├── alembic/               # Database migrations
├── data/                  # User data storage
└── run.py                 # Application entry point
```

## Configuration

### Storage

- Audio files are stored in `/data` by default
- Each user gets a unique subdirectory based on their UID
- Files are converted to Opus format for efficiency

### Rate Limiting

- 100 requests per minute per IP address
- Additional limits can be configured in `middleware.py`

### Audio Processing

- Supported formats: MP3, WAV, M4A, FLAC, OGG
- All files are converted to Opus at 48kbps
- Metadata is preserved during conversion

## Deployment

### Using systemd

```bash
# Copy service file
sudo cp dicta2stream.service /etc/systemd/system/

# Reload and start
sudo systemctl daemon-reload
sudo systemctl enable dicta2stream
sudo systemctl start dicta2stream
```

### Using Docker (optional)

```dockerfile
FROM python:3.11-slim

# Install dependencies
RUN apt-get update && apt-get install -y ffmpeg postgresql-client

# Setup application
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run application
CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
```

## Monitoring

### Logs

- Application logs: `/var/log/dicta2stream/`
- Access logs: Configured in Gunicorn
- Abuse violations: Logged to database and file

### Health Checks

- `GET /health` - Basic health check
- Database connectivity checked automatically

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

### Code Style

This project follows PEP 8 guidelines. Use:

```bash
pip install black flake8
black .
flake8 .
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](docs/structure.md) for technical details

## Acknowledgments

- FastAPI team for the excellent web framework
- SQLModel for the elegant ORM
- FFmpeg for audio processing capabilities
