#!/usr/bin/env python3
from __future__ import annotations

import uvicorn
from backend.config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run(
        "backend.api.app:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )
