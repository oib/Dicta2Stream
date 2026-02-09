# Database Setup and Migrations

This document explains how to set up and manage the database for the dicta2stream application.

## Prerequisites

- PostgreSQL database server
- Python 3.8+
- Required Python packages (install with `pip install -r requirements.txt`)

## Initial Setup

1. Create a PostgreSQL database:
   ```bash
   createdb dicta2stream
   ```

2. Set up the database URL in your environment:
   ```bash
   echo "DATABASE_URL=postgresql://username:password@localhost/dicta2stream" > .env
   ```
   Replace `username` and `password` with your PostgreSQL credentials.

3. Initialize the database:
   ```bash
   python init_db.py
   ```

## Running Migrations

After making changes to the database models, you can create and apply migrations:

1. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the migrations:
   ```bash
   python run_migrations.py
   ```

## Database Models

The application uses the following database models:

### User
- Stores user account information
- Fields: username, email, hashed_password, is_active, created_at, updated_at

### Session
- Manages user sessions
- Fields: id, user_id, token, ip_address, user_agent, created_at, expires_at, last_used_at, is_active

### PublicStream
- Tracks publicly available audio streams
- Fields: uid, filename, size, mtime, created_at, updated_at

### UserQuota
- Tracks user storage quotas
- Fields: uid, storage_bytes, updated_at

### UploadLog
- Logs file uploads
- Fields: id, uid, filename, size, ip_address, user_agent, created_at

## Backing Up the Database

To create a backup of your database:

```bash
pg_dump -U username -d dicta2stream -f backup.sql
```

To restore from a backup:

```bash
psql -U username -d dicta2stream -f backup.sql
```

## Troubleshooting

- If you encounter connection issues, verify that:
  - The PostgreSQL server is running
  - The database URL in your .env file is correct
  - The database user has the necessary permissions

- If you need to reset the database:
  ```bash
  dropdb dicta2stream
  createdb dicta2stream
  python init_db.py
  ```
