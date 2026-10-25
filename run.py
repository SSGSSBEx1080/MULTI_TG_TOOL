#!/usr/bin/env python3
from __future__ import annotations

import logging
import os

for _env_key in (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "NUMEXPR_NUM_THREADS",
):
    os.environ.setdefault(_env_key, "1")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%y/%m/%d %H:%M:%S",
)
for _noisy_logger in ("httpx", "httpcore"):
    logging.getLogger(_noisy_logger).setLevel(logging.WARNING)

import uvicorn
from backend.config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run(
        "backend.api.app:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
        access_log=False,
        timeout_keep_alive=15,
        limit_concurrency=120,
    )
