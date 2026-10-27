# Dentro STANZA

## Responsabilità

| Parte | Responsabilità |
|---|---|
| `room_climate.ino` | Legge il DHT11, gestisce Wi-Fi e mDNS, espone misure e storico protetti da token. |
| `stanza_logger.h` | Scrive il registro circolare in flash e recupera la sequenza al riavvio. |
| `server.cjs` | Preferisce il Wi-Fi alla seriale, recupera i campioni, espone API sul solo loopback e invia eventi al browser. |
| `history-store.cjs` | Migra il vecchio storico e conserva i campioni per giorno senza scadenza automatica. |
| `serial-bridge.py` | Rileva la porta seriale e inoltra i pacchetti JSON al server. |
| `public/app.js` | Visualizza le misure, il confronto e il diario con un grafico SVG adattivo. |

## Registrazione sull’ESP32

Una lettura valida viene conservata ogni 30 secondi. Il file `/stanza-log.bin` contiene record binari di 24 byte:

| Campo | Dimensione | Uso |
|---|---:|---|
| `sequence` | 4 byte | Ordine dei campioni, recuperato dalla flash al riavvio. |
| `boot` | 4 byte | Identificatore dell’avvio. |
| `epoch` | 4 byte | Data UTC in secondi, oppure zero se l’ora non è ancora nota. |
| `uptime` | 4 byte | Secondi trascorsi dall’avvio. |
| `temperature` | 2 byte | Temperatura in decimi di grado, con segno. |
| `humidity` | 2 byte | Umidità relativa in decimi di punto percentuale. |
| `crc` | 4 byte | Campo di integrità: il codice usa un checksum FNV-1a a 32 bit, non un CRC crittografico. |

La capacità è di 20.160 record: **483.840 byte**, circa sette giorni di campioni validi. Gli slot vengono riutilizzati in modo circolare. Il checksum consente di scartare un record incompleto dopo un’interruzione; non è una misura di autenticazione.

Un identificatore di generazione, conservato nel filesystem, permette al PC di riconoscere un archivio nuovo rispetto al cursore precedente.

### Ora e riavvii

L’ESP32 riceve l’ora via NTP. Quando STANZA è attivo, può anche sincronizzarla dal PC. I record dello stesso avvio raccolti prima di conoscere l’ora possono essere datati usando il tempo trascorso dall’avvio. I campioni senza data di un boot precedente restano non collocabili e vengono segnalati nell’interfaccia.

Il sistema non possiede un RTC con batteria indipendente. Nessuna misura viene raccolta a scheda spenta.

### Prima inizializzazione della memoria

Il normale avvio usa `LittleFS.begin(false)`: **non formatta automaticamente** la memoria quando il montaggio fallisce.

Se una nuova scheda richiede inizializzazione, prima salva eventuali dati del progetto precedente. Poi usa `POST /api/logger/init` sul dispositivo, con l’header `X-Stanza-Token` contenente il token configurato. Se il filesystem è già montato, la richiesta non lo formatta. Se non è montato, l’inizializzazione formatta la partizione filesystem e prepara il logger.

Esempio PowerShell, dopo aver inserito l’IP corretto:

```powershell
$device = "http://192.168.1.100"
$network = Get-Content storage/network.json | ConvertFrom-Json
Invoke-RestMethod -Method Post -Uri "$device/api/logger/init" -Headers @{ "X-Stanza-Token" = $network.token }
```

Questo passaggio non è necessario a ogni aggiornamento. Non usare `erase_flash` o un caricamento filesystem per aggiornare soltanto l’applicazione.

## Sincronizzazione

1. Il server verifica le letture via Wi-Fi ogni 2,5 secondi.
2. Circa ogni 15 secondi richiede il registro, a pagine da 128 record.
3. Gli identificatori `generazione:sequenza` permettono di riconoscere i duplicati.
4. Il diario viene scritto **prima** di avanzare il cursore `storage/sync.json`.
5. In caso di interruzione, una pagina può essere richiesta di nuovo senza aggiungere una seconda copia dei campioni.

Se una porzione di storico è già uscita dalla memoria circolare, il sito segnala i campioni non più recuperabili. Il firmware non conserva una copia infinita.

## Diario sul PC

I timestamp sono UTC in millisecondi; l’archiviazione giornaliera usa il fuso `Europe/Rome`. Il passaggio tra ora legale e solare è coperto dai test. Ogni giorno viene salvato in un file JSON, tramite file temporaneo e rinomina, con una copia `.bak` del precedente file valido.

Il vecchio `storage/history.json` viene importato senza cancellarlo. Non vengono ricostruite misure precedentemente eliminate dalla vecchia conservazione di 24 ore.

## API locali

| Metodo | Percorso | Contenuto |
|---|---|---|
| GET | `/api/status` | Connessione, lettura, meteo e stato del registratore. |
| GET | `/api/history?from=…&to=…` | Campioni del periodo; massimo 31 giorni per richiesta. |
| GET | `/api/days` | Giorni presenti nell’archivio. |
| GET | `/api/events` | Flusso Server-Sent Events per la pagina. |
| GET | `/api/export?from=…&to=…` | CSV del periodo. |
| GET | `/api/weather` | Meteo della città configurata. |
| GET | `/api/locations?q=…` | Ricerca della città. |
| POST | `/api/settings` | Aggiornamento della città, con controllo Origin e header dedicato. |

L’ESP32 espone `/api/climate`, `/api/history`, `/api/time` e `/api/logger/init`, tutti protetti dal token locale. Il token non viene inviato al browser. Le richieste PC → scheda usano HTTP sulla rete domestica: il progetto è pensato per una rete fidata, senza port forwarding.

## Scelte dell’interfaccia

- Grafico SVG, con tre o cinque etichette temporali a seconda della larghezza.
- Altezza di 240 px anche su telefono, invece di ridurre tutto il disegno desktop.
- Frecce da tastiera e pulsanti alternativi al puntamento sul grafico.
- Layout mobile verificato da 320 px e dialoghi verificati anche in orizzontale.
- Font di sistema come alternativa ai font web; messaggi di stato aggiornati solo quando il contenuto cambia.
- Consigli contestuali separati in `advice.js`, con riferimenti EPA e UKHSA nelle finestre dell’interfaccia.
