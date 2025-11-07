const express = require("express");
const router = express.Router();
const { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, DeleteItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config({ path: "../.env" });

// DynamoDB client
const ddb = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// DynamoDB Table Names
const ROOM_TABLE = "Rooms";
const DEGREE_TABLE = "Degree";
const STUDENT_TABLE = "Students";

module.exports = (io) => {
    function generateRoomId() {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let roomId = "";
        for (let i = 0; i < 5; i++) {
            roomId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return roomId;
    }

    // Render the create class form
    router.get("/", (req, res) => {
        res.render("Examiner/createClass");
    });

    // Handle room creation
    router.post("/", async (req, res) => {
        const { roomName } = req.body;
        const roomId = generateRoomId();

        try {
            const newRoom = {
                roomId,
                roomName,
                participants: [],
                createdAt: new Date().toISOString(),
            };

            await ddb.send(new PutItemCommand({
                TableName: ROOM_TABLE,
                Item: marshall(newRoom)
            }));

            io.emit("roomCreated", {
                room: newRoom,
                message: `New classroom "${roomName}" has been created`,
            });

            req.flash("success", "Classroom created successfully!");
            res.redirect("/createClass/showRooms");
        } catch (error) {
            console.error("Error creating room:", error);
            req.flash("error", "Failed to create classroom.");
            res.redirect("/createClass");
        }
    });

    // Show all created rooms
    router.get("/showRooms", async (req, res) => {
        try {
            const data = await ddb.send(new ScanCommand({ TableName: ROOM_TABLE }));
            const rooms = data.Items.map(item => unmarshall(item))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            res.render("Examiner/showRooms", { rooms, moment: require("moment") });
        } catch (error) {
            console.error("Error fetching rooms:", error);
            req.flash("error", "Failed to fetch classrooms.");
            res.redirect("/");
        }
    });

    // Join a specific room
    router.get("/room/:roomId", async (req, res) => {
        try {
            const { roomId } = req.params;

            const roomData = await ddb.send(new GetItemCommand({
                TableName: ROOM_TABLE,
                Key: marshall({ roomId })
            }));

            if (!roomData.Item) {
                req.flash("error", "Classroom not found!");
                return res.redirect("/createClass/showRooms");
            }

            const room = unmarshall(roomData.Item);

            // Fetch participants with their degree and live images
            const participantsWithImages = await Promise.all(
                room.participants.map(async (participant) => {
                    const degreeDataRaw = await ddb.send(new GetItemCommand({
                        TableName: DEGREE_TABLE,
                        Key: marshall({ rollno: participant.rollNo })
                    }));
                    const studentDataRaw = await ddb.send(new GetItemCommand({
                        TableName: STUDENT_TABLE,
                        Key: marshall({ rollNumber: participant.rollNo })
                    }));

                    const degreeData = degreeDataRaw.Item ? unmarshall(degreeDataRaw.Item) : null;
                    const studentData = studentDataRaw.Item ? unmarshall(studentDataRaw.Item) : null;

                    return {
                        rollNo: participant.rollNo,
                        joinTime: participant.joinTime,
                        degreeImage: degreeData?.photoUrl || null,
                        liveImage: studentData?.image || null,
                        department: degreeData?.department || "N/A",
                        year: degreeData?.year || "N/A",
                    };
                })
            );

            res.render("Examiner/room", { room, participants: participantsWithImages, moment: require("moment") });
        } catch (error) {
            console.error("Error finding room:", error);
            req.flash("error", "Failed to fetch classroom details.");
            res.redirect("/createClass/showRooms");
        }
    });

    // Room logs and streams storage
    const roomLogs = {};
    const roomStreams = {};

    // Add log entry
    router.post("/logs/:roomId", (req, res) => {
        const { roomId } = req.params;
        const { logMessage, status, rollNumber } = req.body;

        if (!roomLogs[roomId]) roomLogs[roomId] = [];

        const newLog = {
            rollNumber: rollNumber || "Unknown Roll Number",
            message: logMessage || "No logs message provided",
            status: status || "unknown",
            timestamp: new Date(),
        };

        roomLogs[roomId].push(newLog);

        if (roomStreams[roomId]) {
            roomStreams[roomId].forEach(stream => stream.write(`data: ${JSON.stringify(newLog)}\n\n`));
        }

        res.status(200).json({ success: true, message: "Log entry added successfully." });
    });

    // Render logs page
    router.get("/logs/:roomId", (req, res) => {
        const logs = roomLogs[req.params.roomId] || [];
        res.render("Examiner/logs", { roomId: req.params.roomId, logs });
    });

    // Fetch logs as JSON
    router.get("/logs/:roomId/data", (req, res) => {
        res.json(roomLogs[req.params.roomId] || []);
    });

    // SSE for logs
    router.get("/logs/:roomId/stream", (req, res) => {
        const { roomId } = req.params;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        if (!roomStreams[roomId]) roomStreams[roomId] = [];
        roomStreams[roomId].push(res);

        req.on("close", () => {
            roomStreams[roomId] = roomStreams[roomId].filter(stream => stream !== res);
        });
    });

    // Delete room
    router.post("/deleteRoom/:roomId", async (req, res) => {
        const { roomId } = req.params;
        try {
            const deletedRoom = await ddb.send(new DeleteItemCommand({
                TableName: ROOM_TABLE,
                Key: marshall({ roomId })
            }));

            io.emit("roomDeleted", { roomId });
            req.flash("success", `Room deleted successfully.`);
        } catch (error) {
            console.error("Error deleting room:", error);
            req.flash("error", "Failed to delete the room.");
        }
        res.redirect("/createClass/showRooms");
    });

    // Validate room and add participant
    router.post("/validateRoom", async (req, res) => {
        const { rollno, roomId } = req.body;
        const rollNumber = rollno;

        try {
            const roomDataRaw = await ddb.send(new GetItemCommand({
                TableName: ROOM_TABLE,
                Key: marshall({ roomId })
            }));

            if (!roomDataRaw.Item) {
                return res.status(404).json({ success: false, message: "Room not found." });
            }

            const room = unmarshall(roomDataRaw.Item);

            const isValidStudent = await validateStudent(rollNumber);
            if (!isValidStudent) {
                return res.status(400).json({ success: false, message: "Invalid roll number. Student validation failed." });
            }

            const participant = { rollNo: rollNumber, joinTime: new Date().toISOString() };

            room.participants.push(participant);

            await ddb.send(new PutItemCommand({
                TableName: ROOM_TABLE,
                Item: marshall(room)
            }));

            io.emit("participantJoined", { roomId, participant });

            res.status(200).json({ success: true, message: "Participant validated and added successfully." });
        } catch (error) {
            console.error("Error validating room or adding participant:", error);
            res.status(500).json({ success: false, message: "Internal server error." });
        }
    });


    // Validate student function
    async function validateStudent(rollNumber) {
        try {
            const studentRaw = await ddb.send(new GetItemCommand({
                TableName: DEGREE_TABLE,
                Key: marshall({ rollno: rollNumber })
            }));
            return !!studentRaw.Item;
        } catch (error) {
            console.error("Error validating student:", error);
            return false;
        }
    }

    // ✅ Check if room is still active
    router.post("/CheckRoom", async (req, res) => {
        const { roomId } = req.body;

        try {
            const roomData = await ddb.send(new GetItemCommand({
                TableName: ROOM_TABLE,
                Key: marshall({ roomId })
            }));

            // If room does not exist → tell app to unpin & exit
            if (!roomData.Item) {
                return res.json({
                    success: false,
                    action: "unpin_exit",
                    message: "Room has been closed by examiner."
                });
            }

            // Room exists → keep running
            return res.json({ success: true });

        } catch (error) {
            console.error("Error checking room:", error);
            return res.json({
                success: false,
                action: "unpin_exit",
                message: "Server error — closing room visibility."
            });
        }
    });


    return router;
};
