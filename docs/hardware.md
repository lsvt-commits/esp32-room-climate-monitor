# Collegamenti hardware

## Componenti

- ESP32 Dev Module classico, basato su ESP32-WROOM-32.
- Modulo DHT11 a tre pin, marcati `S`, `+` e `−`.
- Breadboard e tre cavetti jumper.
- Cavo USB dati per il caricamento; caricatore USB o power bank per l’uso autonomo.

## Schema usato da STANZA

| DHT11 | ESP32 | Colore del montaggio di riferimento |
|---|---|---|
| `+` / VCC | `3V3` | Rosso |
| `−` / GND | `GND` | Nero |
| `S` / DATA | `D18` / GPIO18 | Giallo |

```text
ESP32                    Modulo DHT11
3V3 ──────────────────── + / VCC
GND ──────────────────── − / GND
D18 ──────────────────── S / DATA
```

Scollega l’alimentazione prima di spostare i fili. Conta la scritta sul pin, non il colore del cavetto. Questo schema riguarda il modulo a tre pin usato nel progetto; per un DHT11 nudo a quattro pin occorre verificare anche il pull-up del segnale.

Non serve un display separato: STANZA mostra le misure nel browser.

## Preparazione del firmware

Nel Board Manager di Arduino IDE installa **esp32 by Espressif Systems 3.3.12** e seleziona **ESP32 Dev Module**. Dal Library Manager installa:

- **DHT sensor library**, versione **1.4.6**, di Adafruit.
- **Adafruit Unified Sensor**, versione **1.1.15**.

In alternativa, con Arduino CLI:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.12 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install "DHT sensor library@1.4.6" "Adafruit Unified Sensor@1.1.15"
```

Il progetto usa la tabella partizioni standard ESP32 da 4 MB, con partizione filesystem da `0x160000` byte all’indirizzo `0x290000`. LittleFS usa questa partizione per il registratore.

Copia il file delle credenziali di esempio, configura Wi-Fi e token e segui i comandi di compilazione del [README](../README.md#3-configura-la-scheda).

## Collocazione del sensore

Tieni il DHT11 lontano dal calore della scheda, dai termosifoni, dal sole diretto e dagli spifferi. Misura l’aria nel punto in cui si trova: la posizione influenza il grafico.

Con l’ESP32 alimentato dal caricatore, il PC non serve alla raccolta dei campioni. Il PC serve per visualizzare la pagina e importare lo storico.

## Diagnosi rapida

| Sintomo | Controllo |
|---|---|
| Scheda non rilevata via USB | Verifica che il cavo trasporti dati e che il driver USB sia installato. |
| Porta occupata | Chiudi il Serial Monitor e gli altri programmi collegati alla stessa porta. |
| Più schede rilevate | Imposta `STANZA_SERIAL_PORT`. |
| Sensore non risponde | Controlla `S → D18`, `+ → 3V3`, `− → GND`. |
| Wi-Fi non disponibile | Controlla rete a 2,4 GHz, credenziali e raggiungibilità dal PC. |
| Diretta presente ma diario non si sincronizza | Controlla `storage/network.json` e che il token coincida con `DEVICE_TOKEN`. |
