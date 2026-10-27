# Hardware setup

## Components

- Classic ESP32 Dev Module based on ESP32-WROOM-32.
- Three-pin DHT11 module labeled `S`, `+` and `−`.
- Breadboard and three jumper wires.
- USB data cable for uploading; USB power adapter or power bank for autonomous operation.

## Wiring

| DHT11 pin | ESP32 pin | Reference wire color |
|---|---|---|
| `+` / VCC | `3V3` | Red |
| `−` / GND | `GND` | Black |
| `S` / DATA | `D18` / GPIO18 | Yellow |

```text
ESP32                    DHT11 module
3V3 ──────────────────── + / VCC
GND ──────────────────── − / GND
D18 ──────────────────── S / DATA
```

Disconnect power before changing wiring. Follow pin labels rather than wire colors. This diagram applies to the three-pin module used by the project. A bare four-pin DHT11 also requires checking the data-line pull-up arrangement.

A separate display is not required; readings are shown in the browser.

## Firmware prerequisites

In Arduino IDE's Boards Manager, install **esp32 by Espressif Systems 3.3.12** and select **ESP32 Dev Module**. Install these libraries:

- **DHT sensor library 1.4.6**, by Adafruit.
- **Adafruit Unified Sensor 1.1.15**.

Alternatively, use Arduino CLI:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.12 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install "DHT sensor library@1.4.6" "Adafruit Unified Sensor@1.1.15"
```

The firmware uses the standard 4 MB ESP32 partition layout, with a `0x160000`-byte filesystem partition at `0x290000`. LittleFS stores the circular log there.

Copy the example secrets file, configure Wi-Fi and the device token, then follow the [firmware upload instructions](../README.md#2-configure-and-upload-the-firmware).

## Sensor placement

Keep the DHT11 away from direct sunlight, radiators, drafts and heat from the ESP32. It measures air at its location, so placement affects the recorded trend.

With the ESP32 powered from a USB adapter, the computer is not required for recording. It is required to display the dashboard and import samples.

## Troubleshooting

| Symptom | Check |
|---|---|
| Device not detected over USB | Use a data cable and verify the USB serial driver. |
| Port busy | Close the Arduino Serial Monitor and other programs using the port. |
| Multiple USB boards detected | Set `CLIMATE_SERIAL_PORT`. |
| Sensor not responding | Check `S → D18`, `+ → 3V3`, `− → GND`. |
| Wi-Fi unavailable | Check the 2.4 GHz network, credentials and reachability from the computer. |
| Live readings work but history does not sync | Check `storage/network.json` and confirm its token matches `DEVICE_TOKEN`. |
