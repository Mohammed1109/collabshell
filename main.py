from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from typing import Dict
import os, socket

app = FastAPI(title="Netziya Shell")

# ---------- LAN IP ----------
def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

LAN_IP = get_lan_ip()
print(f"\n🚀 Netziya Shell running on http://{LAN_IP}:8000\n")

# ---------- STATIC ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
@app.get("/{room_id}")
def serve_ui(room_id: str = ""):
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# ---------- FILE UPLOAD ----------
@app.post("/upload/{room_id}")
async def upload_file(room_id: str, file: UploadFile = File(...)):
    room_dir = os.path.join(UPLOAD_DIR, room_id)
    os.makedirs(room_dir, exist_ok=True)

    path = os.path.join(room_dir, file.filename)
    size = 0

    with open(path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > 50 * 1024 * 1024:
                f.close()
                os.remove(path)
                return JSONResponse({"error": "File too large"}, status_code=400)
            f.write(chunk)

    return {"status": "ok", "filename": file.filename}

# ---------- FILE DOWNLOAD ----------
@app.get("/download/{room_id}/{filename}")
def download_file(room_id: str, filename: str):
    path = os.path.join(UPLOAD_DIR, room_id, filename)
    if not os.path.exists(path):
        return JSONResponse({"error": "Not found"}, status_code=404)

    return FileResponse(path, filename=filename)

@app.delete("/delete/{room_id}/{filename}")
def delete_file(room_id: str, filename: str):
    path = os.path.join(UPLOAD_DIR, room_id, filename)
    if not os.path.exists(path):
        return JSONResponse({"error": "Not found"}, status_code=404)

    os.remove(path)
    return {"status": "ok", "filename": filename}

# ---------- ROOM STATE ----------
rooms: Dict[str, Dict] = {}

@app.websocket("/ws/{room_id}")
async def ws(room_id: str, websocket: WebSocket):
    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = {"code": "", "clients": set()}

    rooms[room_id]["clients"].add(websocket)

    for client in rooms[room_id]["clients"]:
        await client.send_json({
            "type": "users",
            "users": len(rooms[room_id]["clients"])
        })

    await websocket.send_json({
        "type": "init",
        "code": rooms[room_id]["code"]
    })

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "update":
                rooms[room_id]["code"] = data["code"]
                for client in rooms[room_id]["clients"]:
                    if client != websocket:
                        await client.send_json({
                            "type": "update",
                            "code": data["code"]
                        })

            if data["type"] == "file":
                for client in rooms[room_id]["clients"]:
                    await client.send_json({
                        "type": "file",
                        "filename": data["filename"]
                    })
            
            if data["type"] == "delete":
                for client in rooms[room_id]["clients"]:
                    await client.send_json({
                        "type": "delete",
                        "filename": data["filename"]
                    })

    except WebSocketDisconnect:
        rooms[room_id]["clients"].remove(websocket)

        for client in rooms.get(room_id, {}).get("clients", []):
            await client.send_json({
                "type": "users",
                "users": len(rooms[room_id]["clients"])
            })

        if not rooms[room_id]["clients"]:
            del rooms[room_id]
