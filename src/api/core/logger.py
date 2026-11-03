import sys

from loguru import logger

logger.remove()

logger.add(
    sys.stdout,
    level="INFO",
    backtrace=False,
    diagnose=False,
    serialize=True,
)


def get_logger():
    return logger
