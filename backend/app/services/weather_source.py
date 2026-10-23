"""Fixed official HTTP boundaries and conservative, non-executing HTML parsing."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from html.parser import HTMLParser
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from app.core.exceptions import BusinessException
from app.schemas.weather import FuzzyLocation, RegionView, WeatherFacts, WeatherForecast
from app.services.weather_time import SHANGHAI, day_end


class InvalidWeatherSource(ValueError):
    pass


class SourceUnavailable(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def bounded_get(url: str, timeout: float, max_bytes: int) -> bytes:
    try:
        with build_opener(NoRedirect()).open(
            Request(url, headers={"User-Agent": "WardrobeWeather/1.0"}), timeout=timeout
        ) as response:
            body = response.read(max_bytes + 1)
            if response.status != 200 or len(body) > max_bytes:
                raise SourceUnavailable()
            return body
    except (HTTPError, URLError, TimeoutError, OSError):
        # URL can carry a map key and coordinates; never propagate provider errors.
        raise SourceUnavailable() from None


@dataclass
class Element:
    tag: str
    attrs: dict[str, str | None] = field(default_factory=dict)
    children: list = field(default_factory=list)

    def text(self) -> str:
        return "".join(
            child if isinstance(child, str) else child.text() for child in self.children
        ).strip()

    def find(self, *, tag=None, css=None, element_id=None) -> list:
        result = []
        for child in self.children:
            if isinstance(child, Element):
                if (
                    (tag is None or child.tag == tag)
                    and (css is None or css in (child.attrs.get("class") or "").split())
                    and (element_id is None or child.attrs.get("id") == element_id)
                ):
                    result.append(child)
                result.extend(child.find(tag=tag, css=css, element_id=element_id))
        return result


class SourceHTML(HTMLParser):
    VOID = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }

    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.root = Element("root")
        self.stack = [self.root]
        self.node_count = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.node_count += 1
        if len(self.stack) >= 128 or self.node_count > 50_000:
            raise InvalidWeatherSource("HTML structure limit exceeded")
        node = Element(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.node_count += 1
        if self.node_count > 50_000:
            raise InvalidWeatherSource("HTML structure limit exceeded")
        self.stack[-1].children.append(Element(tag, dict(attrs)))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_weather(
    body: bytes, region: RegionView, fetched_at: datetime
) -> WeatherFacts:
    try:
        tree = SourceHTML(body.decode("utf-8", errors="strict")).root
        (crumbs,) = tree.find(css="crumbs")
        anchors = crumbs.find(tag="a")
        if (
            len(anchors) != 3
            or anchors[1].text() != region.province
            or anchors[2].text() != region.city
        ):
            raise InvalidWeatherSource()
        if not re.fullmatch(
            r"https?://www\.weather\.com\.cn/weather/"
            + re.escape(region.weather_code)
            + r"\.shtml",
            anchors[2].attrs.get("href") or "",
        ):
            raise InvalidWeatherSource()
        district = crumbs.text().split(">")[-1].strip()
        if district != region.district and not (
            district == "城区" and region.district == region.city
        ):
            raise InvalidWeatherSource()
        (update,) = tree.find(element_id="fc_24h_internal_update_time")
        issued_at = datetime.strptime(update.attrs["value"], "%Y-%m-%d %H:%M").replace(
            tzinfo=SHANGHAI
        )
        today = fetched_at.astimezone(SHANGHAI).date()
        if issued_at.date() != today or issued_at > fetched_at:
            raise InvalidWeatherSource()
        (container,) = tree.find(element_id="today")
        sections = {}
        for li in container.find(tag="li"):
            titles = li.find(tag="h1")
            if len(titles) != 1:
                continue
            label = re.fullmatch(r"(\d{1,2})日(白天|夜间)", titles[0].text())
            if label is None:
                continue
            # The day label is interpreted against the independently dated issue time.
            candidates = [
                issued_at.date() + timedelta(days=offset) for offset in range(2)
            ]
            dates = [day for day in candidates if day.day == int(label[1])]
            if len(dates) != 1 or dates[0] != today:
                continue
            summaries = li.find(css="wea")
            if (
                len(summaries) != 1
                or not 1 <= len(summaries[0].text()) <= 80
                or label[2] in sections
            ):
                raise InvalidWeatherSource()
            sections[label[2]] = summaries[0].text()
        if not sections:
            raise InvalidWeatherSource()
        # The frozen official page supports period summaries. Its empty .sk has no
        # observed timestamp; ambiguous period temperatures are not daily extrema.
        return WeatherFacts(
            source="weather.com.cn",
            parser_version="weather1d.v1",
            fetched_at=fetched_at,
            valid_until=day_end(today),
            observation=None,
            forecast=WeatherForecast(
                forecast_date=today,
                issued_at=issued_at,
                day_summary=sections.get("白天"),
                night_summary=sections.get("夜间"),
                high_c=None,
                low_c=None,
            ),
        )
    except (ValueError, TypeError, KeyError, UnicodeError, IndexError):
        raise InvalidWeatherSource(
            "Official weather identity or dated forecast is invalid"
        ) from None


class OfficialWeatherSource:
    def __init__(self, timeout: float, max_bytes: int):
        self.timeout, self.max_bytes = timeout, max_bytes

    def fetch(self, region: RegionView, fetched_at: datetime) -> WeatherFacts:
        if not re.fullmatch(r"101\d{6}", region.weather_code):
            raise InvalidWeatherSource()
        url = f"https://www.weather.com.cn/weather1d/{region.weather_code}.shtml"
        return parse_weather(
            bounded_get(url, self.timeout, self.max_bytes), region, fetched_at
        )


@dataclass(frozen=True)
class GeocodedPlace:
    province: str
    city: str
    district: str


class TencentGeocoder:
    def __init__(self, key: str | None, timeout: float, max_bytes: int):
        self.key, self.timeout, self.max_bytes = key, timeout, max_bytes

    def reverse(self, location: FuzzyLocation) -> GeocodedPlace:
        if not self.key:
            raise BusinessException(50371, "Location service is not configured", 503)
        query = urlencode(
            {
                "key": self.key,
                "location": f"{location.latitude},{location.longitude}",
                "get_poi": "0",
                "output": "json",
            }
        )
        try:
            data = json.loads(
                bounded_get(
                    "https://apis.map.qq.com/ws/geocoder/v1/?" + query,
                    self.timeout,
                    self.max_bytes,
                )
            )
            if type(data["status"]) is not int or data["status"] != 0:
                raise ValueError()
            address = data["result"]["address_component"]
            values = [address[key] for key in ("province", "city", "district")]
            if not all(
                isinstance(value, str) and 1 <= len(value) <= 80 for value in values
            ):
                raise ValueError()
            return GeocodedPlace(*values)
        except (SourceUnavailable, ValueError, KeyError, TypeError):
            raise BusinessException(
                50371, "Location service unavailable", 503
            ) from None
