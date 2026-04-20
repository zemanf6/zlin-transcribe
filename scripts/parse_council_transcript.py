
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

TITLE_TOKENS = {
    "ing.", "ing", "mgr.", "mgr", "bc.", "bc", "mudr.", "mudr", "phdr.", "phdr",
    "prof.", "prof", "csc.", "csc", "ph.d.", "phd", "mba", "ll.m.", "llm",
    "mga.", "mga", "msc.", "msc", "et", "rndr.", "rndr", "judr.", "judr",
}

FEMALE_FIRST_NAMES = {
    "Jana", "Kateřina", "Martina", "Michaela", "Zuzana", "Dana", "Lucie", "Monika", "Eva"
}

CHAPTER_RE = re.compile(r"^(?:(?P<number>\d+)\s*-\s*(?P<title>.+)|-\s*(?P<title_only>.+))$")
TIME_RE = re.compile(r"^čas:\s*(\d{2}:\d{2}:\d{2})$", re.IGNORECASE)
SPEECH_RE = re.compile(
    r"^(?P<speaker>.+?)\s+(?:(?P<note>\d+)\s+)?(?P<time>\d{2}:\d{2}:\d{2})\s+(?P<stype>Předložení|Diskuse)\s*$",
    re.IGNORECASE,
)


@dataclass(slots=True)
class CouncilMember:
    canonical_name: str
    display_name: str
    party: str | None
    email: str | None


@dataclass(slots=True)
class BoardMember:
    canonical_name: str
    function: str
    party: str | None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_value = ascii_value.lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return ascii_value or "unknown"


def strip_titles(name: str) -> str:
    name = " ".join(name.replace(",", " , ").split())
    parts = []
    for token in name.split():
        compare = token.lower()
        if compare == ",":
            continue
        if compare in TITLE_TOKENS:
            continue
        parts.append(token)
    cleaned = " ".join(parts).replace(" ,", ",").strip(" ,")
    return cleaned


def canonicalize_name(name: str) -> str:
    clean = strip_titles(name)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean

def make_lookup_key(name: str) -> str:
    clean = canonicalize_name(name)
    normalized = unicodedata.normalize("NFKD", clean)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    ascii_value = re.sub(r"[^a-z0-9]+", " ", ascii_value)
    return re.sub(r"\s+", " ", ascii_value).strip()


def parse_clock_to_seconds(clock: str) -> int:
    hours, minutes, seconds = map(int, clock.split(":"))
    return hours * 3600 + minutes * 60 + seconds


def seconds_to_clock(value: int) -> str:
    hours = (value // 3600) % 24
    minutes = (value % 3600) // 60
    seconds = value % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def guess_generic_council_role(name: str) -> str:
    first_name = canonicalize_name(name).split()[0]
    return "zastupitelka" if first_name in FEMALE_FIRST_NAMES else "zastupitel"


def normalize_party_for_display(party: str | None) -> str | None:
    if party == "ANO":
        return "ANO 2011"
    return party


def parse_board_members(path: Path) -> dict[str, BoardMember]:
    items: dict[str, BoardMember] = {}
    if not path.exists():
        return items

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("členové rady") or line.lower().startswith("jméno a příjmení"):
            continue

        parts = [part.strip() for part in re.split(r"\t+|\s{2,}", line) if part.strip()]
        if len(parts) < 3:
            continue

        raw_name, function, party = parts[0], parts[1], parts[2]
        canonical = canonicalize_name(raw_name)
        lookup_key = make_lookup_key(raw_name)
        items[lookup_key] = BoardMember(
            canonical_name=canonical,
            function=function,
            party=normalize_party_for_display(party),
        )

    return items


def parse_council_members(path: Path) -> dict[str, CouncilMember]:
    text = path.read_text(encoding="utf-8")
    raw_lines = [line.rstrip() for line in text.splitlines()]

    candidates: list[str] = []
    for line in raw_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if "@" in stripped:
            candidates.append(stripped)
            continue
        if stripped.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        if stripped.lower() in {"členové", "zvolení zastupitelé pro volební období 2022 – 2026"}:
            continue
        candidates.append(stripped)

    members: dict[str, CouncilMember] = {}
    i = 0
    valid_parties = {
        "ANO 2011", "ODS", "KDU-ČSL", "Piráti", "STAN", "Zlín 21", "SPD", "NEZAŘAZENÝ"
    }

    while i < len(candidates):
        display_name = candidates[i]
        party = candidates[i + 1] if i + 1 < len(candidates) else None
        email = candidates[i + 2] if i + 2 < len(candidates) and "@" in candidates[i + 2] else None

        if party not in valid_parties:
            i += 1
            continue

        canonical = canonicalize_name(display_name)
        lookup_key = make_lookup_key(display_name)
        members[lookup_key] = CouncilMember(
            canonical_name=canonical,
            display_name=display_name,
            party=party,
            email=email,
        )

        i += 3 if email else 2

    return members


def parse_transcript(text: str) -> tuple[list[dict], list[dict], str]:
    chapters: list[dict] = []
    speeches_flat: list[dict] = []
    session_start_time: str | None = None
    current_chapter: dict | None = None

    speech_counter = 1
    chapter_counter = 1

    lines = [line.rstrip() for line in text.splitlines()]

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue

        chapter_match = CHAPTER_RE.match(line)
        if chapter_match:
            if i >= len(lines):
                raise ValueError(f"Chybí řádek s časem po kapitole: {line}")

            time_line = lines[i].strip()
            time_match = TIME_RE.match(time_line)
            if not time_match:
                raise ValueError(f"Očekáván řádek 'čas:' po kapitole '{line}', ale nalezeno: {time_line}")
            i += 1

            number = chapter_match.group("number")
            title = chapter_match.group("title") or chapter_match.group("title_only")
            absolute_start_time = time_match.group(1)
            if session_start_time is None:
                session_start_time = absolute_start_time

            current_chapter = {
                "id": f"chapter-{number or 'x'}-{chapter_counter}",
                "number": number,
                "title": title,
                "absolute_start_time": absolute_start_time,
                "video_offset_seconds": parse_clock_to_seconds(absolute_start_time) - parse_clock_to_seconds(session_start_time),
                "sort_order": chapter_counter,
                "speeches": [],
            }
            chapters.append(current_chapter)
            chapter_counter += 1
            continue

        speech_match = SPEECH_RE.match(line)
        if speech_match and current_chapter is not None:
            absolute_time = speech_match.group("time")
            speech = {
                "speaker_name_raw": speech_match.group("speaker").strip(),
                "note": speech_match.group("note"),
                "absolute_start_time": absolute_time,
                "video_offset_seconds": parse_clock_to_seconds(absolute_time) - parse_clock_to_seconds(session_start_time),
                "speech_type": speech_match.group("stype"),
                "speech_type_code": "discussion" if speech_match.group("stype").lower() == "diskuse" else "presentation",
                "id": f"speech-{speech_counter}",
                "sequence_in_chapter": len(current_chapter["speeches"]) + 1,
                "chapter_id": current_chapter["id"],
            }
            current_chapter["speeches"].append(speech)
            speeches_flat.append(speech)
            speech_counter += 1
            continue

    if session_start_time is None:
        raise ValueError("Nepodařilo se najít žádnou kapitolu se začátkem jednání.")

    return chapters, speeches_flat, session_start_time


def assign_speaker(
    raw_name: str,
    chapter_title: str,
    council_members: dict[str, CouncilMember],
    board_members: dict[str, BoardMember],
) -> dict:
    canonical = canonicalize_name(raw_name)
    lookup_key = make_lookup_key(raw_name)

    if lookup_key == make_lookup_key("Tomáš Lang"):
        return {
            "id": slugify(canonical),
            "name": canonical,
            "display_name": canonical,
            "party": None,
            "role": "tajemník",
            "speaker_type": "secretary",
            "email": None,
            "is_council_member": False,
        }

    council_member = council_members.get(lookup_key)
    board_member = board_members.get(lookup_key)

    if council_member:
        return {
            "id": slugify(canonical),
            "name": canonical,
            "display_name": council_member.display_name,
            "party": board_member.party if board_member and board_member.party else council_member.party,
            "role": board_member.function if board_member else guess_generic_council_role(canonical),
            "speaker_type": "mayor" if lookup_key == make_lookup_key("Jiří Korec") else "council_member",
            "email": council_member.email,
            "is_council_member": True,
        }

    if "Vystoupení občanů" in chapter_title:
        return {
            "id": f"{slugify(canonical)}-citizen",
            "name": canonical,
            "display_name": canonical,
            "party": None,
            "role": "občan",
            "speaker_type": "citizen",
            "email": None,
            "is_council_member": False,
            "source_name": raw_name,
        }

    return {
        "id": f"{slugify(canonical)}-guest",
        "name": canonical,
        "display_name": canonical,
        "party": None,
        "role": "host",
        "speaker_type": "guest",
        "email": None,
        "is_council_member": False,
        "source_name": raw_name,
    }


def build_metadata(
    transcript_text: str,
    council_members_text_path: Path,
    board_members_text_path: Path,
    *,
    session_id: str,
    city: str,
    title: str,
    date: str,
    video_url: str,
    video_anchor_offset_seconds: int,
    timezone: str,
) -> dict:
    chapters, speeches_flat, session_start_time = parse_transcript(transcript_text)
    council_members = parse_council_members(council_members_text_path)
    board_members = parse_board_members(board_members_text_path)

    speakers_by_id: dict[str, dict] = {}

    for chapter in chapters:
        for speech in chapter["speeches"]:
            speaker = assign_speaker(
                speech["speaker_name_raw"],
                chapter["title"],
                council_members,
                board_members,
            )
            speakers_by_id.setdefault(speaker["id"], speaker)
            speech["session_id"] = session_id
            speech["speaker_id"] = speaker["id"]

    all_speeches_sorted = sorted(
        (speech for chapter in chapters for speech in chapter["speeches"]),
        key=lambda item: item["video_offset_seconds"],
    )

    for index, speech in enumerate(all_speeches_sorted):
        next_speech = all_speeches_sorted[index + 1] if index + 1 < len(all_speeches_sorted) else None
        if next_speech:
            speech["end_offset_seconds"] = next_speech["video_offset_seconds"]
            speech["end_absolute_time"] = next_speech["absolute_start_time"]
        else:
            speech["end_offset_seconds"] = None
            speech["end_absolute_time"] = None

    for index, chapter in enumerate(chapters):
        next_chapter = chapters[index + 1] if index + 1 < len(chapters) else None
        if next_chapter:
            chapter["end_offset_seconds"] = next_chapter["video_offset_seconds"]
            chapter["end_absolute_time"] = next_chapter["absolute_start_time"]
        else:
            chapter["end_offset_seconds"] = None
            chapter["end_absolute_time"] = None

    return {
        "schema_version": "1.0.0",
        "session": {
            "id": session_id,
            "city": city,
            "title": title,
            "date": date,
            "video_url": video_url,
            "video_start_time": session_start_time,
            "video_anchor_offset_seconds": video_anchor_offset_seconds,
            "timezone": timezone,
            "source_note": "Metadata generated from transcript and member lists.",
        },
        "speakers": list(speakers_by_id.values()),
        "chapters": chapters,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Převede transcript zastupitelstva a seznamy členů do metadata JSON."
    )
    parser.add_argument("--transcript", required=True, type=Path, help="TXT soubor s transcriptem.")
    parser.add_argument("--council-members", required=True, type=Path, help="TXT soubor se zastupiteli.")
    parser.add_argument("--board-members", required=True, type=Path, help="TXT soubor s členy rady města.")
    parser.add_argument("--output", required=True, type=Path, help="Výstupní JSON soubor.")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--city", default="Zlín")
    parser.add_argument("--title", default="Zasedání zastupitelstva")
    parser.add_argument("--date", required=True, help="Datum jednání ve formátu YYYY-MM-DD.")
    parser.add_argument("--video-url", required=True)
    parser.add_argument("--video-anchor-offset-seconds", type=int, default=0)
    parser.add_argument("--timezone", default="Europe/Prague")

    args = parser.parse_args()

    transcript_text = args.transcript.read_text(encoding="utf-8")
    metadata = build_metadata(
        transcript_text,
        args.council_members,
        args.board_members,
        session_id=args.session_id,
        city=args.city,
        title=args.title,
        date=args.date,
        video_url=args.video_url,
        video_anchor_offset_seconds=args.video_anchor_offset_seconds,
        timezone=args.timezone,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Hotovo: {args.output}")


if __name__ == "__main__":
    main()
