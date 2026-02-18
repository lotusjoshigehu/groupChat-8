/* ================= USER ================= */

const params = new URLSearchParams(window.location.search);

let name = params.get("name") || "User";
let phone = params.get("phone") || "0000000000";


/* ================= DOM ================= */

const chatList = document.querySelector(".chat-list");
const messagesContainer = document.querySelector(".messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatName = document.getElementById("chatName");
const userphoneEl = document.getElementById("userphone");
const deleteBtn = document.getElementById("deleteBtn");
const createGroupBtn = document.getElementById("createGroupBtn");
const addMemberBtn = document.getElementById("addMemberBtn");
const logoutBtn = document.getElementById("logoutBtn");

/* ===== Modal Elements ===== */

const addMemberModal = document.getElementById("addMemberModal");
const memberNameInput = document.getElementById("memberNameInput");
const memberPhoneInput = document.getElementById("memberPhoneInput");
const confirmAddMember = document.getElementById("confirmAddMember");
const closeModal = document.getElementById("closeModal");
const fileInput = document.getElementById("fileInput");
const fileBtn = document.getElementById("fileBtn");

let currentChat = null;
let currentGroup = null;

/* ================= SOCKET ================= */

const socket = io("http://localhost:4000");

socket.on("connect", () => {
  socket.emit("join", phone);
});

/* ================= CONTACTS ================= */

let contacts = JSON.parse(localStorage.getItem("contacts_" + phone)) || [];



localStorage.setItem("contacts_" + phone, JSON.stringify(contacts));


/* ================= CREATE GROUP ================= */

createGroupBtn?.addEventListener("click", async () => {

  const groupName = prompt("Enter group name:");
  if (!groupName) return;

  await fetch("http://localhost:4000/creategroup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupName,
      creatorPhone: phone
    })
  });

  alert("Group Created Successfully!");
  loadGroups();
});

/* ================= LOAD GROUPS ================= */

async function loadGroups() {

  const res = await fetch(
    `http://localhost:4000/getusergroups?phone=${phone}`
  );

  const groups = await res.json();

  // 🔥 REMOVE OLD GROUP ITEMS ONLY
  document.querySelectorAll(".group-item").forEach(el => el.remove());

  groups.forEach(group => {

    const div = document.createElement("div");
    div.classList.add("chat-item", "group-item"); // 👈 add group-item class

    div.innerHTML = `
      <div class="chat-info">
        <h4>${group.groupName} (Group)</h4>
        <p>Open group</p>
      </div>
    `;

    div.addEventListener("click", async () => {

      currentGroup = group.groupId;
      currentChat = null;

      addMemberBtn.style.display = "block";
      deleteBtn.style.display = "none";

      socket.emit("join-group", group.groupId);

      await loadGroupMessages(group.groupId);
      openGroup(group.groupId, group.groupName);
    });

    chatList.appendChild(div);
  });
}

document.getElementById("addBtn").addEventListener("click", async () => {

  const input = document.getElementById("newContact");
  const contactNumber = input.value.trim();

  if (!contactNumber) return;

  if (contactNumber === phone) {
    alert("You cannot add yourself");
    return;
  }

  const res = await fetch("http://localhost:4000/checkuser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: contactNumber })
  });

  const data = await res.json();

  if (data.message === "user not found") {
    alert("User not found");
    return;
  }

  // 🔥 ALWAYS READ FROM STORAGE AGAIN
  let storedContacts = JSON.parse(localStorage.getItem("contacts_" + phone)) || [];

  if (storedContacts.find(c => c.phone === contactNumber)) {
    alert("Contact already added");
    return;
  }

  storedContacts.push({
    name: data.name,
    phone: contactNumber
  });

  localStorage.setItem("contacts_" + phone, JSON.stringify(storedContacts));

  console.log("Saved contacts:", storedContacts);

  input.value = "";

  renderContacts();
});



/* ================= RENDER CONTACTS ================= */

async function renderContacts() {

  chatList.innerHTML = "";

  let contacts = JSON.parse(localStorage.getItem("contacts_" + phone)) || [];

  const displayContacts = [
    { name: name + " (You)", phone: phone },
    ...contacts
  ];


  displayContacts.forEach(contact => {

    const div = document.createElement("div");
    div.classList.add("chat-item");

    div.innerHTML = `
      <div class="chat-info">
        <h4>${contact.name}</h4>
        <p>Open chat</p>
      </div>
    `;

    div.addEventListener("click", async () => {

      currentChat = contact.phone;
      currentGroup = null;

      addMemberBtn.style.display = "none"; // hide for private
      deleteBtn.style.display = "block";
      document.getElementById("groupMembers").textContent = "";


      chatName.textContent = contact.name;
      userphoneEl.textContent = contact.phone;

      await loadMessages();
      
      socket.emit("mark-as-read", {
          sender: currentChat,
          receiver: phone
});

    });

    chatList.appendChild(div);
  });

  await loadGroups();
}

function getNameFromPhone(phoneNumber) {

  if (phoneNumber === phone) {
    return name + " (You)";
  }

  const found = contacts.find(c => c.phone === phoneNumber);

  return found ? found.name : phoneNumber;
}


/* ================= SEND MESSAGE ================= */

function sendMessage() {

  const text = messageInput.value.trim();
  if (!text) return;

  if (currentGroup) {

    socket.emit("send-group-message", {
      sender: phone,
      groupId: currentGroup,
      text
    });

  } else if (currentChat) {

    socket.emit("send-message", {
      sender: phone,
      receiver: currentChat,
      text
    });

  } else {
    alert("Select chat or group first");
  }

  messageInput.value = "";
}

/* ================= RECEIVE PRIVATE MESSAGE ================= */

socket.on("receive-message", (msg) => {

  if (
    (msg.sender === phone && msg.receiver === currentChat) ||
    (msg.sender === currentChat && msg.receiver === phone)
  ) {
    appendMessage(msg);
    moveChatToTop(msg.sender === phone ? msg.receiver : msg.sender);
  }
});

function moveChatToTop(phoneNumber) {
  const items = document.querySelectorAll(".chat-item");
  items.forEach(item => {
    if (item.innerText.includes(phoneNumber)) {
      chatList.prepend(item);
    }
  });
}

socket.on("message-status-update", ({ id, status }) => {

  const msgDiv = document.querySelector(`[data-id='${id}']`);

  if (!msgDiv) return;

  const footer = msgDiv.querySelector(".msg-footer");

  if (!footer) return;

  const oldTick = footer.querySelector(".tick");

  if (oldTick) {
    oldTick.remove();
  }

  footer.insertAdjacentHTML("beforeend", getTickIcon(status));
});


/* ================= RECEIVE GROUP MESSAGE ================= */

socket.on("receive-group-message", (msg) => {

  if (msg.groupId === currentGroup) {
    appendMessage(msg);
  }
});

/* ================= LOAD PRIVATE MESSAGES ================= */

async function loadMessages() {

  if (!currentChat) return;

  const res = await fetch(
    `http://localhost:4000/getMessages?user1=${phone}&user2=${currentChat}`
  );

  const messages = await res.json();

  messagesContainer.innerHTML = "";
  messages.forEach(msg => appendMessage(msg));
}

/* ================= LOAD GROUP MESSAGES ================= */

async function loadGroupMessages(groupId) {

  const res = await fetch(
    `http://localhost:4000/getMessages?groupId=${groupId}`
  );

  const messages = await res.json();

  messagesContainer.innerHTML = "";
  messages.forEach(msg => appendMessage(msg));
}

/* ================= APPEND MESSAGE ================= */

function appendMessage(msg) {

  const div = document.createElement("div");

  div.classList.add("msg");
  div.classList.add(msg.sender === phone ? "sent" : "received");

  // 🔥 IMPORTANT (for tick updates)
  div.setAttribute("data-id", msg.id);

  let content = "";

  if (msg.text) {
    content += `<p>${msg.text}</p>`;
  }

  if (msg.fileUrl) {

    if (msg.fileType.startsWith("image")) {
      content += `
        <img src="${msg.fileUrl}" 
             class="chat-image"
             onclick="openImagePreview('${msg.fileUrl}')">
      `;
    } else {
      content += `
        <a href="${msg.fileUrl}" target="_blank">
          📎 Download File
        </a>
      `;
    }
  }

  div.innerHTML = `
    ${content}
    <div class="msg-footer">
      <span>${new Date(msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}</span>
      ${msg.sender === phone ? getTickIcon(msg.status) : ""}
    </div>
  `;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}



/* ================= DELETE FOR ME ================= */

deleteBtn?.addEventListener("click", async () => {

  if (!currentChat) {
    alert("Delete works only for private chat");
    return;
  }

  await fetch("http://localhost:4000/deleteforme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPhone: phone,
      otherUser: currentChat
    })
  });

  loadMessages();
});

/* ================= ADD MEMBER MODAL ================= */

addMemberBtn?.addEventListener("click", () => {

  if (!currentGroup) return;

  addMemberModal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  addMemberModal.classList.add("hidden");
});

confirmAddMember.addEventListener("click", async () => {

  const memberPhone = memberPhoneInput.value.trim();

  if (!memberName || !memberPhone) {
    alert("Fill all fields");
    return;
  }

  await fetch("http://localhost:4000/addmember", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupId: currentGroup,
      memberPhone
    })
  });

  alert("Member added successfully!");
  memberPhoneInput.value = "";
  addMemberModal.classList.add("hidden");
});

async function openGroup(groupId, groupName) {

  chatName.textContent = groupName;
  userphoneEl.textContent = "";


  try {

    const res = await fetch(
      `http://localhost:4000/group/members/${groupId}`
    );

    const data = await res.json();

    const groupMembersEl = document.getElementById("groupMembers");

    if (!data.members || data.members.length === 0) {
      groupMembersEl.textContent = "No members";
      return;
    }

    const membersText = data.members
      .map(m => `${m.name} (${m.phone})`)
      .join(" | ");

    groupMembersEl.textContent = "Group · " + membersText;

  } catch (err) {
    console.log("Error loading members");
  }
}

fileBtn.addEventListener("click", (e) => {
  e.preventDefault()
  fileInput.click();
});

fileInput.addEventListener("change", async () => {

  if (!currentChat && !currentGroup) {
    alert("Select chat first");
    return;
  }

  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {

    const res = await fetch("http://localhost:4000/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    console.log("UPLOAD RESPONSE:", data);  // 🔥 VERY IMPORTANT

    if (!data.fileUrl) {
      alert("Upload failed");
      return;
    }

    if (currentGroup) {

      socket.emit("send-group-message", {
        sender: phone,
        groupId: currentGroup,
        fileUrl: data.fileUrl,
        fileType: data.fileType
      });

    } else if (currentChat) {

      socket.emit("send-message", {
        sender: phone,
        receiver: currentChat,
        fileUrl: data.fileUrl,
        fileType: data.fileType
      });
    }

  } catch (err) {
    console.log("Upload error:", err);
  }

  fileInput.value = "";
});

function openImagePreview(url) {
  const modal = document.getElementById("imagePreviewModal");
  const img = document.getElementById("previewImage");

  img.src = url;
  modal.style.display = "flex";
}

function closeImagePreview() {
  document.getElementById("imagePreviewModal").style.display = "none";
}



/* ================= EVENTS ================= */

messageInput.addEventListener("keypress", e => {
  if (e.key === "Enter") 
    {
      e.preventDefault()
      sendMessage();
    } 
});

sendBtn.addEventListener("click", function (e) {
  e.preventDefault();
  sendMessage();
});

function getTickIcon(status) {

  if (status === "sent") {
    return `<span class="tick">✓</span>`;
  }

  if (status === "delivered") {
    return `<span class="tick">✓✓</span>`;
  }

  if (status === "read") {
    return `<span class="tick read">✓✓</span>`;
  }

  return "";
}

let typingTimeout;

messageInput.addEventListener("input", () => {

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(async () => {

    const text = messageInput.value.trim();
    if (!text) return;

    const res = await fetch("http://localhost:4000/ai/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await res.json();

    showSuggestions(data.suggestions);

  }, 500); // debounce

});

function showSuggestions(suggestions) {

  const box = document.getElementById("suggestionsBox");
  box.innerHTML = "";

  suggestions.slice(0, 3).forEach(text => {

    const btn = document.createElement("button");
    btn.className = "suggestion-btn";
    btn.textContent = text;

    btn.onclick = () => {
      messageInput.value += " " + text;
      box.innerHTML = "";
    };

    box.appendChild(btn);
  });
}

function showSmartReplies(replies) {

  const box = document.getElementById("smartReplyBox");
  box.innerHTML = "";

  replies.slice(0, 3).forEach(text => {

    const btn = document.createElement("button");
    btn.className = "reply-btn";
    btn.textContent = text;

    btn.onclick = () => {
      messageInput.value = text;
      box.innerHTML = "";
    };

    box.appendChild(btn);
  });
}

/* ================= INIT ================= */

addMemberBtn.style.display = "none";
renderContacts();

logoutBtn.addEventListener("click", () => {

  // Disconnect socket
  socket.disconnect();

  // Clear user session (NOT contacts)
  localStorage.removeItem("phone");
  localStorage.removeItem("name");

  // Redirect to login page
  window.location.href = "login.html";

});

