const socket = io();
let currentUser = null;
let chatPersistenceEnabled = false;

// DOM refs
const loginSection = document.getElementById("login-section");
const chatSection = document.getElementById("chat-section");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const signupButton = document.getElementById("signup-button");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages");
const persistenceCheckbox = document.getElementById("persistence-checkbox");
const uploadButton = document.getElementById("upload-button");
const fileInput = document.getElementById("file-input");
const chatInputBar = document.getElementById("chat-input-bar");


chatInputBar.style.display = "none";

// Display a message in chat
function displayMessage(username, message, fileContent = "") {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");
    msgDiv.classList.add(username === currentUser.username ? "self" : "other");
  
    let messageContent = `<strong>${username}:</strong> <span>${message}</span>`;
  
    // Append the file content (preview or link) if exists
    if (fileContent) {
        messageContent += `<div class="file-content">${fileContent}</div>`;
    }
  
    msgDiv.innerHTML = messageContent;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a text message
function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg || !currentUser) return;

    socket.emit("sendMessage", { username: currentUser.username, message: msg });
    messageInput.value = "";
}

// Handle file upload and send it to the server
function handleFileUpload() {
    const file = fileInput.files[0];
    if (!file || !currentUser) return;

    const formData = new FormData();
    formData.append("file", file);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            let fileUrl = data.url;
            let fileType = file.type;
            let fileContent = "";

            // File preview based on type
            if (fileType.startsWith("image/")) {
                fileContent = `<img src="${fileUrl}" alt="Image Preview" class="file-preview" />`;
            } else if (fileType.startsWith("video/")) {
                fileContent = `<video controls class="file-preview"><source src="${fileUrl}" type="${fileType}">Your browser does not support the video tag.</video>`;
            } else if (fileType.startsWith("text/") || file.name.endsWith(".txt")) {
                fileContent = `<a href="${fileUrl}" target="_blank">Click to view text file</a>`;
            } else {
                fileContent = `<a href="${fileUrl}" target="_blank">${file.name}</a>`;
            }

            // Send the file info in a message
            socket.emit("sendMessage", {
                username: currentUser.username,
                message: `${currentUser.username} uploaded a file:`,
                fileUrl: fileContent
            });

            fileInput.value = ""; // Reset file input after upload
        } else {
            alert("File upload failed.");
        }
    })
    .catch(() => {
        alert("Error uploading file.");
    });
}

// Handle login
loginButton.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentUser = data.user;
            socket.emit("setUser", currentUser.username);
            loginSection.style.display = "none";
            chatSection.style.display = "block";
            chatInputBar.style.display = "flex"; // <-- show input bar
            socket.emit("requestMessages");
        } else {
            alert(data.message);
        }
    });
});

// Handle signup
signupButton.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Signup successful. Logging in...");
            loginButton.click();
        } else {
            alert(data.message);
        }
    });
});

// Toggle chat persistence
persistenceCheckbox.addEventListener("change", () => {
    chatPersistenceEnabled = persistenceCheckbox.checked;
    socket.emit("toggleChatPersistence", chatPersistenceEnabled);
});

// Send message on button click or Enter key press
sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Trigger file input dialog when upload button is clicked
uploadButton.addEventListener("click", () => {
    fileInput.click();
});

// Listen for file selection and upload it
fileInput.addEventListener("change", handleFileUpload);

// Listen for incoming messages and display them
socket.on("newMessage", (data) => {
    displayMessage(data.username, data.message, data.fileUrl);
});

// Display existing messages from the server when the user logs in
socket.on("existingMessages", (messages) => {
    messages.forEach(m => displayMessage(m.username, m.message, m.fileUrl));
});
