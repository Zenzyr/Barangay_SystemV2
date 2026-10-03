import * as dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from the backend directory regardless of where the process is started
dotenv.config({ path: path.join(__dirname, '.env') });

process.env.TZ = 'Asia/Manila';

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import routes from "./routes/route"
import cors from "cors";

const port = Number(process.env.PORT) || 5001;
const mongodb_uri = process.env.MONGODB_URI || "";

if (process.env.NODE_ENV === "production") {
  const problems: string[] = [];
  if (!mongodb_uri) problems.push("MONGODB_URI is not set");
  if ((process.env.JWT_SECRET || "").length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  if (problems.length) {
    console.error(`[CONFIG] Refusing to start in production: ${problems.join("; ")}`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: "3mb" }));

// Restrict CORS to the configured frontend origin(s). Falls back to same-origin
// (no cross-origin) if none is set, instead of allowing every origin.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "").toLowerCase();
const allowedOriginSet = new Set(allowedOrigins.map(normalizeOrigin));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOriginSet.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);

app.get('/health', async (_request: Request, response: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;
  let dbOk = false;
  if (dbConnected && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().ping();
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }
  response.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "unavailable",
    database: dbOk ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
  });
});

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

const server = app.listen(port, '0.0.0.0', () => {
  const date = new Date()
  console.log(`Server is listening on port ${port} date: ${date}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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