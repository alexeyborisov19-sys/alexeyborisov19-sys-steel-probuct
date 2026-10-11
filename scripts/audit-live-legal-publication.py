#!/usr/bin/env python3
"""Check that approved public legal page editions really reached production.

Read-only: visits public pages, never sends requests containing customer data.
Source-of-truth edition dates are read from lib/legal.ts in the checked-out commit.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)

    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())


def edition_dates() -> dict[str, str]:
    source = (Path(__file__).resolve().parent.parent / "lib" / "legal.ts").read_text(encoding="utf-8")
    match = re.search(r"export const legalDocumentDisplayDates\s*=\s*\{(.*?)\}\s*as const", source, re.S)
    if not match:
        raise RuntimeError("Legal edition registry missing")
    values = dict(re.findall(r'(\w+):\s*"([^"]+)"', match.group(1)))
    operator = re.search(r'policyVersion:\s*"([^"]+)"', source)
    if not operator or not values:
        raise RuntimeError("Public legal edition registry incomplete")
    values["requisites"] = operator.group(1)
    return values


# The content assertions intentionally contain only non-personal public phrases.
PAGES = {
    "privacy": ("privacy", "Политика обработки персональных данных", "не более 90 дней с даты направления заявки"),
    "personal-data-consent": ("personalDataConsent", "Согласие на обработку персональных данных", "выражаю согласие на обработку моих персональных данных"),
    "analytics-consent": ("analyticsConsent", "Согласие на обработку данных для веб-аналитики", "Ранее переданные сервису сведения не удаляются автоматически"),
    "marketing-consent": ("marketingConsent", "Согласие на получение рекламных и информационных материалов", "Эти сообщения направляет"),
    "cookies": ("cookies", "Политика использования файлов cookie", "Отзыв разрешения на сайте сам по себе не удаляет сведения"),
    "services": ("services", "Сервисы обработки данных", "Уничтожение персональных данных оформляется и подтверждается"),
    "terms": ("terms", "Пользовательское соглашение", "Информация на сайте не является публичной офертой"),
    "requisites": ("requisites", "Реквизиты", "ООО «ЭНЕРГОАЛЬЯНС»"),
}


def verify_page(slug: str, date: str, title: str, phrase: str) -> None:
    run_id = os.environ.get("GITHUB_RUN_ID", "manual")
    url = "https://www.steelprodukt.ru/legal/" + slug + "?" + urlencode({"legal_publication_audit": run_id})
    last_error = "unavailable"
    for attempt in range(4):
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SteelproduktLegalAudit/1.0)",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            })
            with urlopen(req, timeout=25) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                text = response.read(2_000_000).decode("utf-8", errors="replace")
            parser = VisibleText()
            parser.feed(text)
            body = parser.text()
            missing = [item for item in (date, title, phrase) if item not in body]
            if not missing:
                print(f"OK /legal/{slug}: edition and content verified")
                return
            last_error = "expected public edition/content absent"
        except (HTTPError, URLError, TimeoutError, RuntimeError, UnicodeError) as exc:
            last_error = type(exc).__name__  # Do not leak URL, cookies or response body.
        if attempt != 3:
            time.sleep(3)
    raise RuntimeError(f"/legal/{slug}: {last_error}")


def main() -> int:
    dates = edition_dates()
    errors = []
    for slug, (key, title, phrase) in PAGES.items():
        try:
            verify_page(slug, dates[key], title, phrase)
        except (RuntimeError, KeyError) as exc:
            print(f"::error title=Public legal page mismatch::{exc}")
            errors.append(slug)
    print(f"Verified legal pages: {len(PAGES) - len(errors)}/{len(PAGES)}")
    if errors:
        print("::error title=Legal publication check failed::Public pages are missing required text or edition dates.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
