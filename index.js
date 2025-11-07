require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const { Server } = require("socket.io");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const DynamoDBStore = require("connect-dynamodb")(session);
const winston = require("winston");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8080;

// Setup view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(cors({
    origin: ["*"], // Update with your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session and Flash Messages
app.use(session({
    secret: process.env.SESSION_SECRET || "defaultSecret",
    resave: false,
    saveUninitialized: true,
    store: new DynamoDBStore({
        table: "Sessions", // DynamoDB table for sessions
        AWSConfigJSON: {
            region: process.env.AWS_REGION ,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        createTable: true, // auto-create Sessions table

    }),
}));

app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// Logger
const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "error.log", level: "error" }),
    ],
});

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// })
//     .then(() => console.log("Connected to MongoDB"))
//     .catch((err) => logger.error("Database connection error:", err));

// Routes
const addStudentsRoutes = require("./routes/addStudents");
const viewStudentsRoutes = require("./routes/viewStudents");
const addPapersRoutes = require("./routes/addPapers");
const uploadPapersRoutes = require("./routes/uploadPapers");
const showPapersRoutes = require("./routes/showPapers");
const examinerRoutes = require("./routes/examiner");
const addStudRoutes = require("./routes/addStud");
const createClassRouter = require("./routes/createClass")(io);
const getPaperRouter = require("./routes/getPaper");

app.use("/addStudents", addStudentsRoutes);
app.use("/viewStudents", viewStudentsRoutes);
app.use("/addPapers", addPapersRoutes);
app.use("/uploadPapers", uploadPapersRoutes);
app.use("/showPapers", showPapersRoutes);
app.use("/getPaper", getPaperRouter); 
app.use("/examiner", examinerRoutes);
app.use("/addStud", addStudRoutes);
app.use("/createClass", createClassRouter);

// Socket.IO
// In app.js
let roomLogs = {}; // Global storage for room logs


io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('joinRoom', (roomId) => {
        try {
            socket.join(roomId);
            console.log(`User joined room: ${roomId}`);
    
            // Log the event
            const logData = {
                roomId,
                message: 'User joined the room',
                timestamp: new Date(),
            };
    
            roomLogs[roomId] = roomLogs[roomId] || [];
            roomLogs[roomId].push(logData);
    
            // Emit the log to all clients in the room
            io.to(roomId).emit('newLog', logData);
        } catch (error) {
            console.error(`Error handling joinRoom: ${error.message}`);
        }
    });
    

    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);  // Leave the room
        console.log(`User left room: ${roomId}`);
        
        // Log the event
        const logData = {
            roomId,
            message: 'User left the room',
            timestamp: new Date(),
        };
        roomLogs[roomId] = roomLogs[roomId] || [];
        roomLogs[roomId].push(logData);

        // Emit the log to all clients in the room
        io.to(roomId).emit('newLog', logData);
    });

    socket.on('log', (logData) => {
        const roomId = logData.roomId;
        if (!roomLogs[roomId]) {
            roomLogs[roomId] = [];
        }
        roomLogs[roomId].push(logData);
        
        // Emit the log to all clients in the room
        io.to(roomId).emit('newLog', logData);
    });
});


// Root Route
app.get("/", (req, res) => {
    res.render("home");
});

// Error Handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: "Something went wrong!", details: err.message });
});

// Start Server

server.listen(PORT, '0.0.0.0', () => {
  console.log(`App running on port ${PORT}`);
});
