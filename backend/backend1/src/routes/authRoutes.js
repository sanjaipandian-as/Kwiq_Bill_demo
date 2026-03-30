const express = require("express");
const passport = require("passport");
const generateToken = require("../utils/generateToken"); // Keep this as it's used in /google/callback
const { protect } = require("../middleware/authMiddleware");
const { logoutUser } = require("../controllers/authController");

const router = express.Router();

// Start Google OAuth (includes Drive access)
router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/drive.file"
    ],
    accessType: "offline",
    prompt: "consent", // Force consent to get fresh refresh token
    session: false,
  })
);

// Start Google Drive Connect (Upgrade Permissions)
router.get(
  "/google/drive",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/drive.file"
    ],
    accessType: "offline", // Request refresh token
    prompt: "consent" // Force consent screen to get fresh refresh token
  })
);

// Google callback
router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      if (err) {
        console.error("❌ Passport Auth Error:", err);
        return res.redirect("/auth/google/failure?reason=error");
      }
      if (!user) {
        console.error("❌ Passport Auth Failed: No user returned", info);
        return res.redirect("/auth/google/failure?reason=no_user");
      }

      // ✅ CREATE JWT
      const tokenPayload = {
        name: user.name,
        email: user.email,
        googleSub: String(user.googleSub), // Ensure string
      };
      const token = generateToken(tokenPayload);

      console.log("✅ Auth Success. Generated Token for:", tokenPayload.googleSub);

      // Serve a page that redirects and attempts to close itself
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <p>Authentication successful! Redirecting to app...</p>
            <script>
              // Redirect to the custom scheme
              window.location.href = "billing://auth?token=${token}";
              // Attempt to close the window after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            </script>
          </body>
        </html>
      `;

      // Allow inline script for this specific response (overriding Helmet default)
      res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline'");
      res.send(html);
    })(req, res, next);
  }
);

router.get("/google/failure", (req, res) => {
  const reason = req.query.reason || "unknown";
  console.error("❌ Auth Failure Route Hit. Reason:", reason);
  res.status(401).json({ message: "Google authentication failed", reason });
});

// Get current authenticated user
router.get("/me", protect, (req, res) => {
  // req.user is set by the protect middleware after verifying JWT
  res.json({
    name: req.user.name,
    email: req.user.email,
    googleSub: req.user.googleSub,
  });
});

// @desc    Logout user / clear cookie
// @route   POST /auth/logout
// @access  Public
router.post("/logout", logoutUser);

module.exports = router;
