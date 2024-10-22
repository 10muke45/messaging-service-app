const baseURL = "https://tjhn8rgw-8080.inc1.devtunnels.ms"; // Your API base URL
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

let currentUsername; // Declare currentUsername for global use

if (token) {
    currentUsername = parseJwt(token).username; // Extracted username if token exists
}

// Function to make API calls with JWT token
async function apiCall(endpoint, method, body = null) {
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`; // Include the JWT token in the headers if available
    }

    const options = {
        method: method,
        headers: headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseURL}${endpoint}`, options);
    return response;
}

// Event listeners for login and register forms
document.addEventListener("DOMContentLoaded", function() {
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");

    // Registration event handler
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

    // Login event handler
    if (loginForm) {
        loginForm.addEventListener("submit", async function(event) {
            event.preventDefault(); // Prevent the default form submission behavior
            const username = document.getElementById("loginUsername").value;
            const password = document.getElementById("loginPassword").value;

            try {
                const res = await apiCall("/login", "POST", { username, password });

                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    localStorage.setItem("authToken", token);
                    currentUsername = parseJwt(token).username; // Update currentUsername after login
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

    // If the user is already on the chat page, load the chat functionality
    if (window.location.pathname.endsWith("chat.html")) {
        if (!token) {
            alert("You are not authenticated. Please log in.");
            window.location.href = "index.html";
            return;
        }

        const ws = new WebSocket(`wss://tjhn8rgw-8080.inc1.devtunnels.ms/ws?token=${token}`);


        ws.onopen = function() {
            console.log("WebSocket connection established.");
        };

        ws.onmessage = function(event) {
            const chatBox = document.getElementById("chatBox");
            const message = JSON.parse(event.data);

            const messageDiv = document.createElement("div");
            messageDiv.classList.add("message");
            
            if (message.sender === currentUsername) {
                messageDiv.classList.add("self");
            } else {
                messageDiv.classList.add("other");
            }

            messageDiv.innerHTML = `<strong>${message.sender}:</strong> ${message.content}`;
            chatBox.appendChild(messageDiv);
        };

        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
            alert("An error occurred with the WebSocket connection.");
        };

        ws.onclose = function() {
            console.log("WebSocket connection closed.");
            alert("WebSocket connection closed.");
        };

        // Fetch and display the list of users when on the chat page
        async function fetchUsers() {
            const res = await apiCall("/users", "GET");

            if (res.ok) {
                const data = await res.json();
                const userList = document.getElementById("userList");

                if (!userList) {
                    console.error("User list element not found!");
                    return;
                }

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

        // Selecting a user for chat
        async function selectUser(user) {
            localStorage.setItem("selectedUser", user);
            document.getElementById("chatWith").textContent = user;

            const res = await apiCall(`/messages?username=${user}`, "GET");

            if (res.ok) {
                const messages = await res.json();
                const chatBox = document.getElementById("chatBox");
                chatBox.innerHTML = ""; // Clear previous chat

                messages.forEach(message => {
                    const messageDiv = document.createElement("div");
                    messageDiv.classList.add("message");

                    if (message.sender === currentUsername) {
                        messageDiv.classList.add("self");
                    } else {
                        messageDiv.classList.add("other");
                    }

                    messageDiv.innerHTML = `<strong>${message.sender}:</strong> ${message.content}`;
                    chatBox.appendChild(messageDiv);
                });
            } else {
                alert("Failed to load message history.");
            }
        }

        // Handle sending messages via WebSocket
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
                    const messageDiv = document.createElement("div");
                    messageDiv.classList.add("message", "self");
                    messageDiv.innerHTML = `<strong>${currentUsername}:</strong> ${messageContent}`;
                    chatBox.appendChild(messageDiv);

                    document.getElementById("messageInput").value = ""; // Clear the input field
                } else {
                    alert("WebSocket connection is not open.");
                }
            });
        }

        fetchUsers();
    }
});
