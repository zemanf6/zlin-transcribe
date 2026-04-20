# Zastupitelstvo Zlín – MVP přehrávač

Webová aplikace pro přehrání záznamu zastupitelstva s časovou osnovou, kapitolami a vystoupeními synchronizovanými podle timestampů.

## Co umí MVP

- přehrát video ze zadané veřejné URL
- vlastní ovládání pod videem
- panel „Právě probíhá“
- seznam kapitol
- seznam vystoupení uvnitř kapitol
- proklik na čas kapitoly i jednotlivého vystoupení
- zvýraznění aktivní kapitoly a aktivního řečníka podle pozice videa

## Spuštění

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Kde jsou data

- metadata: `public/data/session-metadata.json`
- parser: `scripts/parse_session_metadata.py`

## Vstupy pro parser

Parser očekává vedle sebe soubory:

- `transcript.txt`
- `councillors.txt`

a vygeneruje `session-metadata.json`.

## Poznámky

- video je načítané z veřejné URL
- titulky, speech-to-text a AI vrstva zatím nejsou součástí MVP
- datový model je na ně připravený
