const baseURL = "http://localhost:8080"; // Your API base URL
let token = localStorage.getItem("authToken"); // Token for authenticated requests

// Function to extract the username from the JWT token
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
    );
    return JSON.parse(jsonPayload);
}

const currentUsername = parseJwt(token).username; // Extracted username

// Function to make API calls with JWT token
async function apiCall(endpoint, method, body = null) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // Include the JWT token in the headers
    };

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseURL}${endpoint}`, options);
    return response;
}

document.addEventListener("DOMContentLoaded", function() {
    async function fetchUsers() {
        const res = await apiCall("/users", "GET");

        if (res.ok) {
            const data = await res.json();
            const userList = document.getElementById("userList");

            data.data.forEach(user => {
                const li = document.createElement("li");
                li.textContent = user;
                li.addEventListener("click", () => {
                    selectUser(user);
                });
                userList.appendChild(li);
            });
        } else {
            alert("Failed to load user list.");
        }
    }

    async function selectUser(user) {
        localStorage.setItem("selectedUser", user);
        document.getElementById("chatWith").textContent = user;

        const res = await apiCall(`/messages?username=${user}`, "GET");

        if (res.ok) {
            const messages = await res.json();
            const chatBox = document.getElementById("chatBox");
            chatBox.innerHTML = ""; // Clear previous chat

            messages.forEach(message => {
                chatBox.innerHTML += `<div><strong>${message.sender}:</strong> ${message.content}</div>`;
            });
        } else {
            alert("Failed to load message history.");
        }
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            const username = document.getElementById("registerUsername").value;
            const password = document.getElementById("registerPassword").value;

            try {
                const res = await apiCall("/register", "POST", { username, password });

                if (res.ok) {
                    alert("Registration successful. You can now log in.");
                } else {
                    const errorData = await res.json();
                    alert(`Registration failed: ${errorData.message}`);
                }
            } catch (error) {
                console.error("Error during registration:", error);
                alert("An error occurred during registration.");
            }
        });
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            const username = document.getElementById("loginUsername").value;
            const password = document.getElementById("loginPassword").value;

            try {
                const res = await apiCall("/login", "POST", { username, password });

                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    localStorage.setItem("authToken", token);
                    window.location.href = "chat.html"; // Redirect to chat
                } else {
                    const errorData = await res.json();
                    alert(`Login failed: ${errorData.message}`);
                }
            } catch (error) {
                console.error("Error during login:", error);
                alert("An error occurred during login.");
            }
        });
    }

    if (window.location.pathname.endsWith("chat.html")) {
        if (!token) {
            alert("You are not authenticated. Please log in.");
            window.location.href = "index.html";
            return;
        }

        const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

        ws.onopen = function() {
            console.log("WebSocket connection established.");
        };

        ws.onmessage = function(event) {
            const chatBox = document.getElementById("chatBox");
            const message = JSON.parse(event.data);

            // Display messages without using "You"
            chatBox.innerHTML += `<div><strong>${message.sender}:</strong> ${message.content}</div>`;
        };

        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
            alert("An error occurred with the WebSocket connection.");
        };

        ws.onclose = function() {
            console.log("WebSocket connection closed.");
            alert("WebSocket connection closed.");
        };

        const messageForm = document.getElementById("messageForm");
        if (messageForm) {
            messageForm.addEventListener("submit", function(event) {
                event.preventDefault();
                const receiver = localStorage.getItem("selectedUser");
                const messageContent = document.getElementById("messageInput").value;

                if (ws.readyState === WebSocket.OPEN) {
                    const message = {
                        sender: currentUsername, // Sender is the current user
                        receiver: receiver,
                        content: messageContent
                    };

                    ws.send(JSON.stringify(message));

                    // Display sent message immediately in the chatbox
                    const chatBox = document.getElementById("chatBox");
                    chatBox.innerHTML += `<div><strong>${currentUsername}:</strong> ${messageContent}</div>`;
                    document.getElementById("messageInput").value = ""; // Clear the input field
                } else {
                    alert("WebSocket connection is not open.");
                }
            });
        }

        fetchUsers();
    }
});
