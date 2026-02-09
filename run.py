#!/usr/bin/env python3
"""
Entry point for running the dicta2stream application.
This file allows running the app with: python run.py
"""

import uvicorn
from src.backend.main import app

if __name__ == "__main__":
    uvicorn.run(
        "src.backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["src"]
    )
