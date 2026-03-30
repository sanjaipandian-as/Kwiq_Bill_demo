const jwt = require("jsonwebtoken");

exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    console.error("🛡️ Auth Protect: Missing or invalid Authorization header");
    return res.status(401).json({ message: "Unauthorized: Missing token" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_key_123");

    req.user = decoded;
    next();
  } catch (err) {
    console.error("🛡️ Auth Protect: Token verification failed:", err.message);
    res.status(401).json({ message: "Invalid token", error: err.message });
  }
};
