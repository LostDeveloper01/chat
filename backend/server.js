const express = require("express");
const http = require("http");
const fs = require("fs");
const bcrypt = require("bcrypt");
const socketio = require("socket.io");
const path = require("path");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const USERS_PATH = path.join(__dirname, "data/users.json");
const MESSAGES_PATH = path.join(__dirname, "data/messages.json");

// Setup upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config with file size + type filter
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/gif", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"), false);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handles form data (required for file upload)
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static(uploadDir));

// Helper: Read/write JSON
const readJSON = (filepath) => JSON.parse(fs.readFileSync(filepath, "utf8"));
const writeJSON = (filepath, data) => fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

// Signup
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_PATH);

  if (users.find(u => u.username === username)) {
    return res.json({ success: false, message: "Username already exists." });
  }

  const hashed = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashed, status: "user" });
  writeJSON(USERS_PATH, users);
  res.json({ success: true });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_PATH);
  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.json({ success: false, message: "Invalid credentials." });
  }

  res.json({ success: true, user: { username: user.username, status: user.status } });
});

// File Upload
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    res.json({
      success: true,
      filename: req.file.filename,
      originalname: req.file.originalname,
      url: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Upload failed." });
  }
});

// WebSocket handlers
io.on("connection", socket => {
  let user = null;
  let chatPersistence = false;

  socket.on("setUser", (username) => {
    user = username;
  });

  socket.on("toggleChatPersistence", (enabled) => {
    chatPersistence = enabled;
  });

  socket.on("sendMessage", (data) => {
    const message = {
      username: data.username,
      message: data.message,
      fileUrl: data.fileUrl || "", // File URL may not always exist
      timestamp: new Date().toISOString(),
      persistence: chatPersistence
    };

    io.emit("newMessage", message);

    const messages = readJSON(MESSAGES_PATH);
    messages.push(message);
    writeJSON(MESSAGES_PATH, messages);
  });

  socket.on("requestMessages", () => {
    const messages = readJSON(MESSAGES_PATH).filter(m => m.persistence);
    socket.emit("existingMessages", messages);
  });
});

const PORT = 45984;
const ipSpan = "0.0.0.0";
server.listen(PORT, ipSpan, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
