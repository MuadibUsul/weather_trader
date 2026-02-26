"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

import uvicorn


if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=False)