require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");

const app = express();
const sequelize = require("./connection/dbconnection");
const aiController = require("./controllers/aicontroller");
/* ================= CONTROLLERS ================= */

const sigincontroller = require("./controllers/sigincontroller");
const logincontroller = require("./controllers/logincontroller");
const messagecontroller = require("./controllers/messagecontroller");
const groupcontroller = require("./controllers/groupcontrollers");
const uploadcontroller = require("./controllers/uploadcontroller");

/* ================= MODELS ================= */

const Message = require("./models/message");

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());

/* ================= MULTER ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

/* ================= ROUTES ================= */

// Auth
app.post("/signup", sigincontroller.signup);
app.post("/login", logincontroller.login);
app.post("/checkuser", logincontroller.checkuser);

// Private
app.post("/sendMessage", messagecontroller.sendmessage);
app.get("/getMessages", messagecontroller.getmessage);
app.get("/getChatUsers", messagecontroller.getchatusers);
app.post("/deleteforme", messagecontroller.deleteforme);

// Group
app.post("/addmember", groupcontroller.addmember);
app.post("/createGroup", groupcontroller.creategroup);
app.get("/getusergroups", groupcontroller.getusergroups);
app.get("/group/members/:groupId", groupcontroller.getgroupmembers);

// Upload
app.post("/upload", upload.single("file"), uploadcontroller.uploadfile);
app.post("/ai/predict", aiController.predictTyping);
app.post("/ai/smart-reply", aiController.smartReplies);

/* ================= SOCKET ================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  /* ===== JOIN PRIVATE ROOM ===== */
  socket.on("join", (phone) => {
    socket.join(phone);
  });

  /* ===== SEND PRIVATE MESSAGE ===== */
  socket.on("send-message", async (data) => {

    const { sender, receiver, text, fileUrl, fileType } = data;

    try {

      const savedMessage = await Message.create({
        sender,
        receiver,
        text: text || null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        status: "sent"
      });

      // Send to receiver
      io.to(receiver).emit("receive-message", savedMessage);

      io.to(sender).emit("receive-message", savedMessage);

      // Update to delivered
      await savedMessage.update({ status: "delivered" });

      // Notify sender about delivery
      io.to(sender).emit("message-status-update", {
        id: savedMessage.id,
        status: "delivered"
      });

    } catch (err) {
      console.error("Private message error:", err);
    }
  });

  /* ===== MARK AS READ ===== */
  socket.on("mark-as-read", async ({ sender, receiver }) => {

    try {

      const messages = await Message.findAll({
        where: {
          sender,
          receiver,
          status: "delivered"
        }
      });

      for (let msg of messages) {

        await msg.update({ status: "read" });

        io.to(sender).emit("message-status-update", {
          id: msg.id,
          status: "read"
        });
      }

    } catch (err) {
      console.error("Read update error:", err);
    }
  });

  /* ===== JOIN GROUP ===== */
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
  });

  /* ===== SEND GROUP MESSAGE ===== */
  socket.on("send-group-message", async (data) => {

    const { sender, groupId, text, fileUrl, fileType } = data;

    try {

      const savedMessage = await Message.create({
        sender,
        groupId,
        text: text || null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        status: "sent"
      });

      io.to(groupId).emit("receive-group-message", savedMessage);

    } catch (err) {
      console.error("Group message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

/* ================= DATABASE ================= */

sequelize.sync({ alter: true }).then(() => {
  server.listen(4000, () => {
    console.log("Server running on port 4000");
  });
});
