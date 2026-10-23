import base64
import hashlib
import hmac
import json
import re

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.weather_region import WeatherRegion
from app.repositories.region_repository import RegionRepository
from app.schemas.weather import CityList, RegionView
from app.core.weather_catalog import MAPPING_VERSION


def region_view(row: WeatherRegion) -> RegionView:
    return RegionView(
        city_id=row.region_id,
        region_id=row.region_id,
        weather_code=row.weather_code,
        province=row.province,
        city=row.city,
        district=row.district,
        display_name=row.display_name,
        mapping_version=row.mapping_version,
    )


class RegionService:
    PAGE_SIZE = 20

    def __init__(self, repo: RegionRepository, secret: str) -> None:
        self.repo, self.secret = repo, secret.encode()

    def _encode(self, payload: dict) -> str:
        body = (
            base64.urlsafe_b64encode(
                json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
            )
            .decode()
            .rstrip("=")
        )
        signature = hmac.new(
            self.secret, ("cities:v1:" + body).encode(), hashlib.sha256
        ).hexdigest()
        return body + "." + signature

    def _after(self, cursor: str, query: str) -> str:
        try:
            body, signature = cursor.split(".")
            expected = hmac.new(
                self.secret, ("cities:v1:" + body).encode(), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError()
            payload = json.loads(
                base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
            )
            if (
                set(payload) != {"q", "v", "after"}
                or payload["q"] != query
                or not re.fullmatch(r"cn-101\d{6}", payload["after"])
            ):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise BusinessException(42272, "Invalid city cursor", 422) from None
        if payload["v"] != MAPPING_VERSION:
            raise BusinessException(40970, "City directory version changed", 409)
        return payload["after"]

    def search(self, query: str, cursor: str | None) -> CityList:
        query = "".join(query.casefold().split())
        if not 1 <= len(query) <= 80:
            raise BusinessException(
                42272, "City query must contain 1 to 80 characters", 422
            )
        after = self._after(cursor, query) if cursor else None
        with transaction(self.repo.db):
            rows = self.repo.search(query, after, self.PAGE_SIZE + 1)
            items = [region_view(row) for row in rows[: self.PAGE_SIZE]]
        next_cursor = (
            self._encode(
                {"q": query, "v": MAPPING_VERSION, "after": items[-1].region_id}
            )
            if len(rows) > self.PAGE_SIZE
            else None
        )
        return CityList(
            items=items, next_cursor=next_cursor, mapping_version=MAPPING_VERSION
        )

    def resolve_hierarchy(self, province: str, city: str, district: str) -> RegionView:
        def name(value: str) -> str:
            return re.sub(
                r"(?:壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市|区|县)$",
                "",
                value.strip(),
            )

        if not all((province, city, district)):
            raise BusinessException(
                42271, "Location does not identify a verified district", 422
            )
        target = tuple(map(name, (province, city, district)))
        with transaction(self.repo.db):
            matches = [
                row
                for row in self.repo.all_current()
                if tuple(map(name, (row.province, row.city, row.district))) == target
            ]
            if len(matches) != 1:
                raise BusinessException(
                    42271, "Location does not identify a unique verified district", 422
                )
            return region_view(matches[0])
