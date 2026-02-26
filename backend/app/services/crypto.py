"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

import base64


def encrypt_value(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    return base64.urlsafe_b64decode(value.encode("utf-8")).decode("utf-8")