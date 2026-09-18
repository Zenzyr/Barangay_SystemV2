import * as dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from the backend directory regardless of where the process is started
dotenv.config({ path: path.join(__dirname, '.env') });

process.env.TZ = 'Asia/Manila';

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import routes from "./routes/route"
import cors from "cors";

const app = express();
const port = process.env.PORT || 5001;
const mongodb_uri = process.env.MONGODB_URI || "";

app.set('trust proxy', 1);

app.use(express.json({ limit: "3mb" }));

// Restrict CORS to the configured frontend origin(s). Falls back to same-origin
// (no cross-origin) if none is set, instead of allowing every origin.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(routes)

app.get('/', async (request: Request, response: Response) => {
  response.send("working server...........")
});

// 404 handler for unmatched routes
app.use((request: Request, response: Response) => {
  response.status(404).json({ message: "Route not found" });
});

// Centralized error handler: never leak raw stack traces or server internals.
app.use((error: any, _request: Request, response: Response, _next: NextFunction) => {
  // Multer / file upload errors
  if (error && error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? error.field === "backupFile"
          ? "Backup file is too large (max 100MB)"
          : "File is too large (max 10MB)"
        : error.message || "File upload error";
    response.status(400).json({ message });
    return;
  }

  // Custom multer file-filter rejections (invalid file type)
  if (error && error.multerFileField && typeof error.message === "string") {
    response.status(400).json({ message: error.message });
    return;
  }

  // JSON body parse errors
  if (error && error.type === "entity.parse.failed") {
    response.status(400).json({ message: "Malformed JSON body" });
    return;
  }

  if (error && error.type === "entity.too.large") {
    response.status(413).json({ message: "Request body too large" });
    return;
  }

  console.error("[SERVER ERROR]", error);

  response.status(500).json({ message: "Internal server error" });
});

mongoose
  .connect(mongodb_uri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message || err);
    process.exit(1);
  });

app.listen(port, () => {
  const date = new Date()
  console.log(`Server is running on http://localhost:${port} date: ${date}`);
});

/*
sendEmail(
    "jasongallano13@gmail.com",
    "BIMS SMTP Test",
    `
        <h1>BIMS Email Test</h1>
        <p>Your SMTP configuration is working correctly.</p>
    `
)
    .then(() => {
        console.log("Email test successful!");
    })
    .catch((error) => {
        console.error("Email test failed:", error);
    }); 
*/
/*
sendEmail(
    "kenshiackerman009@gmail.com",
    "BIMS Test",
    `
        <h1>BIMS Email Test</h1>
        <p>This is a test email from the BIMS system.</p>
    `
)
    .then(() => console.log("Test completed"))
    .catch(error => console.error("Test failed:", error));
*/