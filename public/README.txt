Použití:

python parse_council_transcript.py ^
  --transcript transcript.txt ^
  --council-members council_members.txt ^
  --board-members board_members.txt ^
  --output session-metadata.json ^
  --session-id zlin-zm-2026-03-26 ^
  --city Zlín ^
  --title "Zasedání Zastupitelstva města Zlín" ^
  --date 2026-03-26 ^
  --video-url "https://bitest.videostream.sk/zlin/archiv/20260326/video/Zl%C3%ADn%2026.3.2026.mp4" ^
  --video-anchor-offset-seconds 470 ^
  --timezone Europe/Prague

Poznámky:
- Transcript je očekáván ve formátu:
  [číslo] - [název kapitoly]
  čas: HH:MM:SS
  [řečník][TAB][volitelná poznámka][TAB]HH:MM:SS[TAB]Předložení|Diskuse
- U řádku "- Diskuse" se číslo kapitoly nastaví na null.
- Pokud je řečník nalezen v seznamu zastupitelů, vede se jako zastupitel.
- Pokud je řečník navíc v seznamu rady města, role se přepíše jeho funkcí v radě.
- Tomáš Lang se vede jako tajemník.
- Neznámý řečník ve kapitole "Vystoupení občanů" se vede jako občan.
- Neznámý řečník mimo tuto kapitolu se vede jako host.
