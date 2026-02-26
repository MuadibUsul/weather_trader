"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

import contextvars
import json
import logging
import sys
import time
import uuid
from typing import Any, Dict


correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")


def set_correlation_id(value: str | None = None) -> str:
    cid = value or str(uuid.uuid4())
    correlation_id_ctx.set(cid)
    return cid


def get_correlation_id() -> str:
    cid = correlation_id_ctx.get()
    if not cid:
        cid = set_correlation_id()
    return cid


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "correlation_id": get_correlation_id(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        extra_keys = [k for k in record.__dict__.keys() if k not in logging.LogRecord("", 0, "", 0, "", (), None).__dict__]
        for key in extra_keys:
            payload[key] = record.__dict__[key]
        return json.dumps(payload, ensure_ascii=True)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)