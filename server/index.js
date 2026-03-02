import cors from "cors";
import Docker from "dockerode";
import dotenv from "dotenv";
import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import containersRouter from "./routes/containers.js";
import imagesRouter from "./routes/images.js";
import networksRouter from "./routes/networks.js";
import systemRouter from "./routes/system.js";
import volumesRouter from "./routes/volumes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Docker connection
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// Middleware
app.use(cors());
app.use(express.json());

// Auth routes (unprotected)
app.use("/api/auth", authRoutes);

// Protected API routes
app.use("/api/containers", authMiddleware, containersRouter(docker));
app.use("/api/images", authMiddleware, imagesRouter(docker));
app.use("/api/volumes", authMiddleware, volumesRouter(docker));
app.use("/api/networks", authMiddleware, networksRouter(docker));
app.use("/api/system", authMiddleware, systemRouter(docker));

// Serve static files in production
const distPath = join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("{*splat}", (req, res) => {
  res.sendFile(join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🐳 DocSee server running on http://localhost:${PORT}`);
});
