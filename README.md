# CollabShell

CollabShell is a real-time collaborative workspace built using FastAPI and WebSockets.

It allows multiple users to:
- Share a live text editor
- Upload and download files
- Paste images directly
- Collaborate over LAN in real time

## Tech Stack
- FastAPI
- WebSockets
- HTML, CSS, JavaScript

## Run Locally

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
