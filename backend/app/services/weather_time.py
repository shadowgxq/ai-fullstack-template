from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


def now_shanghai() -> datetime:
    return datetime.now(SHANGHAI)


def day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, SHANGHAI)


def day_end(day: date) -> datetime:
    return day_start(day + timedelta(days=1))
