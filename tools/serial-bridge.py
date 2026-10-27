import json,time,os
import serial
from serial.tools import list_ports
def emit(data):
    print(json.dumps(data),flush=True)
while True:
    connection=None
    try:
        ports=list(list_ports.comports())
        requested=os.environ.get("CLIMATE_SERIAL_PORT") or os.environ.get("STANZA_SERIAL_PORT")
        if requested:
            device=next((p for p in ports if p.device==requested),None)
        else:
            candidates=[p for p in ports if p.vid in (0x0403,0x10C4,0x1A86,0x303A)]
            device=candidates[0] if len(candidates)==1 else None
            if len(candidates)>1:
                emit({"kind":"status","connected":False,"message":"Multiple USB devices found. Set CLIMATE_SERIAL_PORT to select the sensor."})
                time.sleep(2)
                continue
        if device is None:
            emit({"kind":"status","connected":False,"message":"ESP32 not detected. Connect the USB data cable."})
            time.sleep(2)
            continue
        connection=serial.Serial()
        connection.port=device.device
        connection.baudrate=115200
        connection.timeout=.5
        connection.dtr=False
        connection.rts=False
        connection.open()
        emit({"kind":"status","connected":False,"port":device.device,"message":"USB connected. Waiting for DHT11…"})
        buffer=bytearray()
        while True:
            buffer.extend(connection.read_until(b"\n",size=2048))
            while b"\n" in buffer:
                line,_,rest=buffer.partition(b"\n")
                buffer=bytearray(rest)
                try:
                    data=json.loads(line)
                    if isinstance(data,dict) and data.get("protocol")==2 and data.get("type")=="climate":
                        emit({"kind":"packet","port":device.device,"data":data})
                except (ValueError,UnicodeError):
                    pass
            if len(buffer)>8192:buffer.clear()
    except (serial.SerialException,OSError) as error:
        emit({"kind":"status","connected":False,"message":"USB unavailable. Close the Arduino Serial Monitor.","detail":str(error)})
        time.sleep(2)
    finally:
        if connection is not None:connection.close()
