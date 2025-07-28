require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto");
const db = require("./database.js");

const app = express();
const port = 3000;

if (!process.env.BOT_TOKEN) {
  console.error(
    "Error: BOT_TOKEN is not defined. Please add it to your .env file."
  );
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Session middleware with SQLiteStore
app.use(
  session({
    store: new SQLiteStore({
      db: "database.sqlite",
      dir: __dirname,
    }),
    secret:
      process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false, // Set to false for login sessions
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public/web")));

// Endpoint to check if user is authenticated
app.get("/check-auth", (req, res) => {
  if (req.session.user) {
    const userId = req.session.user.id;
    const sql = `SELECT SUM(points) AS total_points FROM spins WHERE user_id = ?`;
    db.get(sql, [userId], (err, row) => {
      if (err) {
        console.error("Failed to get total points", err);
        return res
          .status(500)
          .json({ success: false, message: "Error getting your points." });
      }
      const totalPoints = row ? row.total_points : 0;
      res.json({
        loggedIn: true,
        user: { ...req.session.user, total_points: totalPoints },
      });
    });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post("/tg-login-start", (req, res) => {
  const token = crypto.randomBytes(16).toString("hex");
  db.run(
    "INSERT INTO tokens (token, status) VALUES (?, ?)",
    [token, "pending"],
    (err) => {
      if (err) {
        console.error("Failed to create token", err);
        return res
          .status(500)
          .json({ success: false, message: "Could not start login process." });
      }
      res.json({ token });
    }
  );
});

app.post("/tg-login-check", (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Token is required." });
  }

  db.get("SELECT * FROM tokens WHERE token = ?", [token], (err, tokenData) => {
    if (err) {
      console.error("Failed to check token", err);
      return res
        .status(500)
        .json({ success: false, message: "Error checking login status." });
    }

    if (tokenData && tokenData.status === "authenticated") {
      req.session.user = {
        id: tokenData.user_id,
        first_name: tokenData.user_first_name,
        username: tokenData.user_username,
      };
      res.json({ success: true, user: req.session.user });
      // Clean up the used token
      db.run("DELETE FROM tokens WHERE token = ?", [token]);
    } else if (tokenData) {
      res.json({ success: false, message: "Authentication pending." });
    } else {
      res.json({ success: false, message: "Invalid or expired token." });
    }
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

app.post("/spin", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to spin the wheel.",
    });
  }

  const userId = req.session.user.id;
  const today = new Date().toISOString().slice(0, 10); // Get date in YYYY-MM-DD format

  // Check if the user has already spun today
  const sql = `SELECT * FROM spins WHERE user_id = ? AND date(spin_date) = ?`;
  db.get(sql, [userId, today], (err, row) => {
    if (err) {
      console.error("Failed to check spins", err);
      return res
        .status(500)
        .json({ success: false, message: "Error checking your spin history." });
    }

    if (row) {
      return res.status(400).json({
        success: false,
        message: "You have already spun the wheel today.",
      });
    }

    // Corresponds to the slices in index.html
    const pointsOptions = [10, 20, 50, 100, 200, 500, 1000, "JACKPOT"];
    const winningIndex = Math.floor(Math.random() * pointsOptions.length);
    const result = pointsOptions[winningIndex];

    let pointsWon;
    if (result === "JACKPOT") {
      // Award a random amount between 2000 and 5000 for the jackpot
      pointsWon = Math.floor(Math.random() * 3001) + 2000;
    } else {
      pointsWon = result;
    }

    // Save the spin to the database
    const insertSql = `INSERT INTO spins (user_id, points) VALUES (?, ?)`;
    db.run(insertSql, [userId, pointsWon], (insertErr) => {
      if (insertErr) {
        console.error("Failed to save spin", insertErr);
        return res
          .status(500)
          .json({ success: false, message: "Error saving your spin." });
      }

      res.json({ success: true, result, points: pointsWon, winningIndex });
    });
  });
});

app.post("/withdraw", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to make a withdrawal request.",
    });
  }

  const userId = req.session.user.id;
  const { solanaAddress, points } = req.body;

  if (!solanaAddress || !points || points < 100000) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid withdrawal request." });
  }

  // Check if the user has enough points
  const sql = `SELECT SUM(points) AS total_points FROM spins WHERE user_id = ?`;
  db.get(sql, [userId], (err, row) => {
    if (err) {
      console.error("Failed to get total points", err);
      return res
        .status(500)
        .json({ success: false, message: "Error getting your points." });
    }

    const totalPoints = row ? row.total_points : 0;

    if (totalPoints < points) {
      return res.status(400).json({
        success: false,
        message: "You do not have enough points to make this withdrawal.",
      });
    }

    // Create a withdrawal request
    const insertSql = `INSERT INTO withdraw_requests (user_id, points, solana_address) VALUES (?, ?, ?)`;
    db.run(insertSql, [userId, points, solanaAddress], (insertErr) => {
      if (insertErr) {
        console.error("Failed to create withdrawal request", insertErr);
        return res.status(500).json({
          success: false,
          message: "Error creating your withdrawal request.",
        });
      }

      // Deduct the points by adding a negative spin entry
      const deductSql = `INSERT INTO spins (user_id, points) VALUES (?, ?)`;
      db.run(deductSql, [userId, -points], (deductErr) => {
        if (deductErr) {
          console.error("Failed to deduct points", deductErr);
          // Note: This could lead to an inconsistent state. A transaction would be better here.
          return res
            .status(500)
            .json({ success: false, message: "Error updating your points." });
        }

        res.json({
          success: true,
          message: "Withdrawal request submitted successfully.",
        });
      });
    });
  });
});

app.get("/withdraw-history", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to view your withdrawal history.",
    });
  }

  const userId = req.session.user.id;
  const sql = `SELECT * FROM withdraw_requests WHERE user_id = ? ORDER BY request_date DESC`;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Failed to get withdrawal history", err);
      return res.status(500).json({
        success: false,
        message: "Error getting your withdrawal history.",
      });
    }
    res.json({ success: true, history: rows });
  });
});

bot.start((ctx) => {
  const token = ctx.startPayload;
  if (!token) {
    return ctx.reply(
      "Welcome! Please start the login process from our website."
    );
  }

  db.get("SELECT * FROM tokens WHERE token = ?", [token], (err, tokenData) => {
    if (err || !tokenData) {
      return ctx.reply("This login link is invalid or has expired.");
    }

    if (tokenData.status === "pending") {
      const user = {
        id: ctx.from.id.toString(),
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name || null,
        username: ctx.from.username,
      };

      // Upsert user into the users table
      const userSql = `
                INSERT INTO users (id, username, first_name, last_name)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    username = excluded.username,
                    first_name = excluded.first_name,
                    last_name = excluded.last_name;
            `;
      db.run(
        userSql,
        [user.id, user.username, user.first_name, user.last_name],
        (userErr) => {
          if (userErr) {
            console.error("Failed to save user", userErr);
            return ctx.reply("An error occurred. Please try again.");
          }

          // Update the token status
          db.run(
            "UPDATE tokens SET status = ?, user_id = ?, user_first_name = ?, user_username = ? WHERE token = ?",
            ["authenticated", user.id, user.first_name, user.username, token],
            (tokenErr) => {
              if (tokenErr) {
                console.error("Failed to update token", tokenErr);
                return ctx.reply(
                  "An error occurred during login. Please try again."
                );
              }

              ctx.reply(
                "You have successfully logged in!\n\nPlease return to your web browser to continue.\n\n**Important for Mobile Users:** Telegram often opens links in its in-app browser, which may not keep you logged in. For the best experience, please switch to your phone's main browser (like Chrome or Safari) and navigate to https://gift.cogecoin.org/ manually.",
                Markup.inlineKeyboard([
                  Markup.button.url(
                    "Go to Website",
                    "https://gift.cogecoin.org/"
                  ),
                ])
              );
            }
          );
        }
      );
    } else {
      ctx.reply("This login link has already been used.");
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/web/index.html"));
});

bot.launch().then(() => {
  console.log("Telegram bot started");
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  db.close();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  db.close();
});
