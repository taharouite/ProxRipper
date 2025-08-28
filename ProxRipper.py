import aiohttp
import asyncio
import errno
import ipaddress
import json
import logging
import os
import re
import sys
import time
from aiohttp import ClientTimeout, TCPConnector
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from random import uniform
from typing import List, Dict, Set, Tuple

PROXY_SOURCES: Dict[str, List[str]] = {
    "http": [
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/refs/heads/master/http.txt",
        "https://raw.githubusercontent.com/noctiro/getproxy/refs/heads/master/file/http.txt",
        "https://raw.githubusercontent.com/ALIILAPRO/Proxy/refs/heads/main/http.txt",
        "https://raw.githubusercontent.com/ProxyScraper/ProxyScraper/refs/heads/main/http.txt",
        "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/refs/heads/master/proxies/http.txt",
        "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/refs/heads/master/http.txt",
        "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/http.txt",
        "https://raw.githubusercontent.com/Firmfox/Proxify/refs/heads/main/proxies/http.txt",
        "https://raw.githubusercontent.com/vmheaven/VMHeaven-Free-Proxy-Updated/refs/heads/main/http.txt",
        "https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/http_proxies.txt",
    ],
    "https": [
        "https://raw.githubusercontent.com/roosterkid/openproxylist/refs/heads/main/HTTPS_RAW.txt",
        "https://raw.githubusercontent.com/noctiro/getproxy/refs/heads/master/file/https.txt",
        "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/refs/heads/master/proxies/https.txt",
        "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/refs/heads/master/https.txt",
        "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/https.txt",
        "https://raw.githubusercontent.com/proxifly/free-proxy-list/refs/heads/main/proxies/protocols/https/data.txt",
        "https://raw.githubusercontent.com/Firmfox/Proxify/refs/heads/main/proxies/https.txt",
        "https://raw.githubusercontent.com/vmheaven/VMHeaven-Free-Proxy-Updated/refs/heads/main/https.txt",
    ],
    "socks4": [
        "https://raw.githubusercontent.com/roosterkid/openproxylist/refs/heads/main/SOCKS4_RAW.txt",
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/refs/heads/master/socks4.txt",
        "https://raw.githubusercontent.com/noctiro/getproxy/refs/heads/master/file/socks4.txt",
        "https://raw.githubusercontent.com/ALIILAPRO/Proxy/refs/heads/main/socks4.txt",
        "https://raw.githubusercontent.com/ProxyScraper/ProxyScraper/refs/heads/main/socks4.txt",
        "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/refs/heads/master/proxies/socks4.txt",
        "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/refs/heads/master/socks4.txt",
        "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/socks4.txt",
        "https://raw.githubusercontent.com/proxifly/free-proxy-list/refs/heads/main/proxies/protocols/socks4/data.txt",
        "https://raw.githubusercontent.com/Firmfox/Proxify/refs/heads/main/proxies/socks4.txt",
        "https://raw.githubusercontent.com/vmheaven/VMHeaven-Free-Proxy-Updated/refs/heads/main/socks4.txt",
        "https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/socks4_proxies.txt",
    ],
    "socks5": [
        "https://raw.githubusercontent.com/roosterkid/openproxylist/refs/heads/main/SOCKS5_RAW.txt",
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/refs/heads/master/socks5.txt",
        "https://raw.githubusercontent.com/noctiro/getproxy/refs/heads/master/file/socks5.txt",
        "https://raw.githubusercontent.com/ALIILAPRO/Proxy/refs/heads/main/socks5.txt",
        "https://raw.githubusercontent.com/ProxyScraper/ProxyScraper/refs/heads/main/socks5.txt",
        "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/refs/heads/master/proxies/socks5.txt",
        "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/refs/heads/master/socks5.txt",
        "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/socks5.txt",
        "https://raw.githubusercontent.com/proxifly/free-proxy-list/refs/heads/main/proxies/protocols/socks5/data.txt",
        "https://raw.githubusercontent.com/Firmfox/Proxify/refs/heads/main/proxies/socks5.txt",
        "https://raw.githubusercontent.com/vmheaven/VMHeaven-Free-Proxy-Updated/refs/heads/main/socks5.txt",
        "https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/socks5_proxies.txt",
    ],
}

OUTPUT_DIR = Path("full_proxies")
OUTPUT_DIR.mkdir(exist_ok=True)

SUMMARY_FILE = Path("summary.json")
LOCKFILE = OUTPUT_DIR / ".scraper.lock"

FETCH_CONCURRENCY = 20
PER_HOST_LIMIT = 5
REQUEST_TIMEOUT = 15
MAX_SOURCE_RETRIES = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("proxy-scraper")


def _is_valid_proxy_line(line: str) -> bool:
    if not line or line.startswith("#"):
        return False
    if not re.match(r"^\S+:\d+$", line):
        return False
    host, port = line.split(":", 1)
    try:
        ipaddress.ip_address(host)
        port_i = int(port)
        return 1 <= port_i <= 65535
    except Exception:
        return False


def _is_public_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
        return not (ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_multicast)
    except Exception:
        return False


async def fetch_url(session: aiohttp.ClientSession, url: str) -> str:
    for attempt in range(1, MAX_SOURCE_RETRIES + 1):
        try:
            async with session.get(url, timeout=ClientTimeout(total=REQUEST_TIMEOUT)) as resp:
                if resp.status == 200:
                    return await resp.text()
                else:
                    logger.warning("bad status %s for %s", resp.status, url)
        except Exception as e:
            logger.warning("error fetching %s attempt %d: %s", url, attempt, e)
        if attempt < MAX_SOURCE_RETRIES:
            await asyncio.sleep(uniform(1, 3))
    return ""


def parse_proxies(text: str) -> List[str]:
    proxies = []
    for line in text.splitlines():
        line = line.strip()
        if _is_valid_proxy_line(line):
            host, port = line.split(":", 1)
            if _is_public_ip(host):
                proxies.append(line)
    return proxies


async def gather_all_proxies() -> Dict[str, Set[str]]:
    results = defaultdict(set)
    sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    connector = TCPConnector(limit_per_host=PER_HOST_LIMIT, ssl=False)

    async with aiohttp.ClientSession(connector=connector) as session:
        async def _fetch_and_accumulate(proto: str, url: str):
            async with sem:
                text = await fetch_url(session, url)
                if text:
                    for proxy in parse_proxies(text):
                        results[proto].add(proxy)

        tasks = []
        for proto, urls in PROXY_SOURCES.items():
            for url in urls:
                tasks.append(_fetch_and_accumulate(proto, url))

        await asyncio.gather(*tasks)

    return results


def atomic_write(path: Path, lines: List[str]):
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for line in lines:
            f.write(line + "\n")
    tmp.replace(path)


def load_previous_set(path: Path) -> Set[str]:
    if path.exists():
        try:
            return set(line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
        except Exception:
            return set()
    return set()


def summarize_changes(prev: Set[str], current: Set[str]) -> Tuple[Set[str], Set[str]]:
    return current - prev, prev - current


def write_summary_file(path: Path, summary: Dict, keep_last: int = 120):
    try:
        existing = []
        if path.exists():
            existing = json.loads(path.read_text(encoding="utf-8"))

        existing.append(summary)

        if len(existing) > keep_last:
            existing = existing[-keep_last:]

        path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error("error writing summary: %s", e)


def acquire_lock(lockfile: Path):
    if lockfile.exists():
        try:
            pid = int(lockfile.read_text())
            os.kill(pid, 0)
            logger.error("lockfile exists and process %d alive", pid)
            sys.exit(1)
        except OSError as e:
            if e.errno == errno.ESRCH:
                logger.warning("stale lock found, removing")
                lockfile.unlink()
            else:
                raise
    lockfile.write_text(str(os.getpid()))


def release_lock(lockfile: Path):
    try:
        if lockfile.exists():
            lockfile.unlink()
    except Exception:
        pass


def update_readme(summary_path: Path, readme_path: Path = Path("README.md")):
    """Update README.md with last update time, proxy stats, and download links."""
    DOWNLOAD_LINKS = {
        "http": "https://raw.githubusercontent.com/mohhammedcha/ProxRipper/main/full_proxies/http.txt",
        "https": "https://raw.githubusercontent.com/mohhammedcha/ProxRipper/main/full_proxies/https.txt",
        "socks4": "https://raw.githubusercontent.com/mohhammedcha/ProxRipper/main/full_proxies/socks4.txt",
        "socks5": "https://raw.githubusercontent.com/mohhammedcha/ProxRipper/main/full_proxies/socks5.txt",
    }

    if not summary_path.exists():
        logger.warning("Summary file does not exist, skipping README update.")
        return

    try:
        with summary_path.open("r", encoding="utf-8") as f:
            summaries = json.load(f)
        if not summaries:
            return
        latest = summaries[-1]
        timestamp = latest.get("timestamp", "Unknown")
        results = latest.get("results", {})

        table_lines = [
            "| Proxy Type | Total | Added | Removed | Download |",
            "|------------|-------|-------|---------|----------|"
        ]
        for proto in ["http", "https", "socks4", "socks5"]:
            r = results.get(proto, {"total": 0, "added": 0, "removed": 0})
            link = DOWNLOAD_LINKS.get(proto, "#")
            table_lines.append(f"| {proto.upper()} | {r['total']} | {r['added']} | {r['removed']} | [Download]({link}) |")

        readme_text = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""

        section_start = "<!-- PROXY_STATS_START -->"
        section_end = "<!-- PROXY_STATS_END -->"
        new_section = "\n".join([section_start, f"**Last Update:** {timestamp} UTC", "", *table_lines, section_end])

        import re
        if section_start in readme_text:
            readme_text = re.sub(f"{section_start}.*?{section_end}", new_section, readme_text, flags=re.DOTALL)
        else:
            readme_text = new_section + "\n\n" + readme_text

        readme_path.write_text(readme_text, encoding="utf-8")
        logger.info("README.md updated successfully.")

    except Exception as e:
        logger.error("Failed to update README: %s", e)


async def main():
    acquire_lock(LOCKFILE)
    start = time.time()
    try:
        proxies = await gather_all_proxies()
        summary = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "results": {},
            "duration_seconds": None,
        }

        for proto, new_set in proxies.items():
            out_path = OUTPUT_DIR / f"{proto}.txt"
            prev_set = load_previous_set(out_path)
            added, removed = summarize_changes(prev_set, new_set)

            if new_set:
                atomic_write(out_path, sorted(new_set))
                
            summary["results"][proto] = {
                "total": len(new_set),
                "added": len(added),
                "removed": len(removed),
                "added_list": sorted(list(added))[:50],
                "removed_list": sorted(list(removed))[:50],
            }

        summary["duration_seconds"] = round(time.time() - start, 2)
        write_summary_file(SUMMARY_FILE, summary)
        logger.info("run complete in %.2fs", summary["duration_seconds"])

        update_readme(SUMMARY_FILE)

    finally:
        release_lock(LOCKFILE)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        release_lock(LOCKFILE)
        sys.exit(0)
