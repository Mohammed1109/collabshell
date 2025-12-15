// ---------- ROOM ----------
let roomId = location.pathname.replace("/", "");
const dropZone = document.getElementById("drop-zone");
if (!roomId) {
  roomId = Math.random().toString(36).slice(2, 8);
  history.replaceState({}, "", `/${roomId}`);
}
document.getElementById("room-id").innerText = roomId;

// ---------- ELEMENTS ----------
const editor = document.getElementById("editor");
const lineNumbers = document.getElementById("line-numbers");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");

// ---------- WEBSOCKET ----------
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/ws/${roomId}`);

let localChange = false;

// ---------- LINE NUMBERS ----------
function updateLineNumbers() {
  const lines = editor.value.split("\n").length;
  let out = "";
  for (let i = 1; i <= lines; i++) out += i + "\n";
  lineNumbers.innerText = out;
}

editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
});

// ---------- SOCKET EVENTS ----------
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "init") {
    localChange = true;
    editor.value = msg.code || "";
    localChange = false;
    updateLineNumbers();
  }

  if (msg.type === "update") {
    localChange = true;
    editor.value = msg.code;
    localChange = false;
    updateLineNumbers();
  }

  if (msg.type === "users") {
    document.getElementById("users").innerText = msg.users;
  }

  if (msg.type === "file") {
    addFileLink(msg.filename);
  }
  if (msg.type === "delete") {
    removeFileFromUI(msg.filename);
  }
};

// ---------- SEND EDITOR CHANGES ----------
editor.addEventListener("input", () => {
  updateLineNumbers();
  if (localChange) return;

  socket.send(JSON.stringify({
    type: "update",
    code: editor.value
  }));
});

// ---------- FILE UPLOAD ----------
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  uploadFile(file);
});

async function uploadFile(file) {
  if (file.size > 50 * 1024 * 1024) {
    alert("File size exceeds 50 MB");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/upload/${roomId}`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (data.status === "ok") {
    addFileLink(data.filename);

    socket.send(JSON.stringify({
      type: "file",
      filename: data.filename
    }));
  } else {
    alert(data.error || "Upload failed");
  }
}

// ---------- FILE LINK ----------
function addFileLink(filename) {
  // prevent duplicates
  if (document.getElementById(`file-${filename}`)) return;

  const wrapper = document.createElement("div");
  wrapper.id = `file-${filename}`;

  const a = document.createElement("a");
  a.href = `/download/${roomId}/${filename}`;
  a.innerText = filename;
  a.target = "_blank";

  const del = document.createElement("button");
  del.innerText = "✕";
  del.style.marginLeft = "8px";
  del.style.background = "transparent";
  del.style.color = "#f87171";
  del.style.border = "none";
  del.style.cursor = "pointer";

  del.onclick = () => deleteFile(filename);

  wrapper.appendChild(a);
  wrapper.appendChild(del);
  fileList.appendChild(wrapper);
}

// ---------- DRAG & DROP ----------
["dragenter", "dragover"].forEach(event => {
  dropZone.addEventListener(event, e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(event => {
  dropZone.addEventListener(event, e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

// ---------- FILE DELETE ----------
async function deleteFile(filename) {
  const res = await fetch(`/delete/${roomId}/${filename}`, {
    method: "DELETE"
  });

  const data = await res.json();
  if (data.status === "ok") {
    removeFileFromUI(filename);

    socket.send(JSON.stringify({
      type: "delete",
      filename
    }));
  }
}
function removeFileFromUI(filename) {
  const el = document.getElementById(`file-${filename}`);
  if (el) el.remove();
}


// ---------- PASTE IMAGE SUPPORT ----------
document.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        uploadFile(file);
      }
      event.preventDefault();
      break;
    }
  }
});

// ---------- INIT ----------
updateLineNumbers();
