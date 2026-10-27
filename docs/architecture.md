# Architecture

## Components

| Component | Responsibility |
|---|---|
| `room_climate.ino` | Reads the DHT11, manages Wi-Fi/mDNS and exposes token-protected readings and history. |
| `climate_logger.h` | Writes the circular flash log and recovers its sequence on startup. |
| `server.cjs` | Selects transport, imports samples, exposes loopback APIs and sends browser events. |
| `history-store.cjs` | Migrates legacy history and stores samples by day without automatic expiration. |
| `serial-bridge.py` | Detects a USB device and forwards JSON packets to the server. |
| `public/app.js` | Renders readings, weather comparisons and an adaptive SVG chart. |
| `public/i18n.js` | English/Italian messages, accessible labels, formatting locale and saved preference. |

## Device recording

The device stores one valid sample every 30 seconds. Each binary record occupies 24 bytes:

| Field | Size | Purpose |
|---|---:|---|
| `sequence` | 4 bytes | Ordering, recovered from flash on startup. |
| `boot` | 4 bytes | Boot identifier. |
| `epoch` | 4 bytes | UTC timestamp in seconds, or zero before clock synchronization. |
| `uptime` | 4 bytes | Seconds since startup. |
| `temperature` | 2 bytes | Signed temperature in tenths of a degree. |
| `humidity` | 2 bytes | Relative humidity in tenths of a percentage point. |
| `crc` | 4 bytes | Integrity field, implemented as a 32-bit FNV-1a checksum. |

Capacity is 20,160 records: **483,840 bytes**, approximately seven days of valid samples. Slots are reused in a circular buffer. The checksum helps reject incomplete records after power interruption; it does not authenticate data.

A generation identifier stored in the filesystem distinguishes a newly initialized log from the computer's previous synchronization cursor.

### Time and restarts

The ESP32 obtains UTC time through NTP or from the computer during synchronization. Current-boot samples recorded before synchronization can be dated using elapsed uptime. Undated samples from a previous boot remain unplaced and are reported in the interface.

The system does not have a battery-backed RTC. No samples are collected while the device is unpowered.

### First-time storage initialization

Normal startup calls `LittleFS.begin(false)`: a mount failure does not automatically format storage.

If a new device requires initialization, first back up data from its previous project. Then send `POST /api/logger/init` to the device with the configured token in `X-Stanza-Token`. The endpoint leaves an already mounted filesystem intact. If mounting failed, it formats the filesystem partition and initializes the logger.

PowerShell example, using the device's actual private IP:

```powershell
$device = "http://192.168.1.100"
$network = Get-Content storage/network.json | ConvertFrom-Json
Invoke-RestMethod -Method Post -Uri "$device/api/logger/init" -Headers @{ "X-Stanza-Token" = $network.token }
```

Initialization is not required for every update. Do not use `erase_flash` or upload a filesystem image when updating only the application.

## History synchronization

1. Live Wi-Fi readings are polled every 2.5 seconds.
2. Approximately every 15 seconds, history is requested in pages of 128 records.
3. Stable `generation:sequence` identifiers identify duplicates.
4. The daily archive is written before advancing `storage/sync.json`.
5. After an interruption, a page can be requested again without duplicating samples.

Samples overwritten in the device's circular buffer are reported as unavailable. Device history is not unlimited.

## Computer archive

Timestamps are UTC milliseconds. Daily files use `Europe/Rome`, including daylight-saving transitions covered by tests. Updates use a temporary file and rename, with a `.bak` copy of the previous valid file.

Legacy `storage/history.json` is imported without deletion. Samples previously removed by its old 24-hour retention policy cannot be reconstructed.

## Local API

| Method | Endpoint | Response or action |
|---|---|---|
| GET | `/api/status` | Connection, reading, weather and logger status. |
| GET | `/api/history?from=…&to=…` | Interval samples; maximum 31 days per request. |
| GET | `/api/days` | Available archive dates. |
| GET | `/api/events` | Server-Sent Events stream. |
| GET | `/api/export?from=…&to=…` | CSV for the selected interval. |
| GET | `/api/weather` | Weather for the configured location. |
| GET | `/api/locations?q=…` | Location search. |
| POST | `/api/settings` | Location update with Origin and action-header checks. |

Device endpoints `/api/climate`, `/api/history`, `/api/time` and `/api/logger/init` require a token. The token is not sent to the browser. Device requests use HTTP on the local network; use a trusted network without port forwarding.

## Interface and localization

English is the default. The EN/IT control changes labels, accessible names, messages, guidance, chart formatting and PNG export without resetting the selected history interval. Its preference is saved under `roomClimate.language` in local storage.

The chart uses three or five time labels according to width and remains 240 px high on mobile. Inspection supports touch, mouse, keyboard arrows and dedicated buttons. State announcements change only when their content changes.

## Compatibility

The hostname `esp32-stanza.local`, header `X-Stanza-Token`, existing flash paths and legacy `STANZA_*` environment variables are retained to keep installed devices and stored samples usable. These are protocol/storage identifiers, not interface labels. New setups should use `CLIMATE_PYTHON`, `CLIMATE_SERIAL_PORT` and `CLIMATE_DISABLE_USB` where needed.
