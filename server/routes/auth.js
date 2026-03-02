import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "docsee-default-secret";
const PASSWORD = process.env.DOCSEE_PASSWORD || "admin";

router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password !== PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ role: "admin", iat: Date.now() }, JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({ token });
});

router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false });
  }
  try {
    jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export default router;
