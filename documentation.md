# Telegram Login System Documentation

## 1. Project Overview

This project is a web application that demonstrates a secure and persistent user authentication system using a Telegram bot. Users can log in or register on the website by authenticating through their Telegram account.

The system is built with a Node.js and Express.js backend, a simple HTML/CSS/JS frontend, and a SQLite database for persistent data storage. User sessions are managed to keep users logged in even after the server restarts.

## 2. Features

- **Telegram Authentication**: Secure login and registration via a Telegram bot.
- **Persistent Sessions**: Uses `express-session` with a SQLite backend to maintain user sessions across server restarts.
- **Persistent User Data**: Stores user information in a dedicated SQLite `users` table.
- **Reliable Login Flow**: Implements a frontend polling mechanism to reliably detect login completion without depending on unreliable browser events.
- **Clear User Feedback**: The UI dynamically changes to show whether the user is logged in or out.
- **Scalable Backend**: The code is organized to be clean, scalable, and easy to understand.

## 3. Technology Stack

- **Backend**:
    - **Node.js**: JavaScript runtime environment.
    - **Express.js**: Web framework for Node.js.
    - **Telegraf.js**: Library for creating and managing the Telegram bot.
    - **SQLite3**: For the database.
    - **express-session**: For managing user sessions.
    - **connect-sqlite3**: Session store for SQLite.
    - **dotenv**: For managing environment variables (like the bot token).
- **Frontend**:
    - **HTML5**: Standard markup language.
    - **CSS3**: For styling the user interface.
    - **JavaScript (ES6+)**: For client-side logic, including API calls and DOM manipulation.
- **Database**:
    - **SQLite**: A self-contained, serverless, transactional SQL database engine.

## 4. File Structure

```
/
├── public/
│   └── web/
│       ├── css/
│       │   └── style.css       # Frontend styles
│       ├── js/
│       │   └── script.js       # Frontend logic (polling, UI updates)
│       └── index.html          # Main HTML file with login/user views
├── .env                        # Stores secret keys (BOT_TOKEN)
├── database.js                 # Database setup and table creation logic
├── database.sqlite             # The SQLite database file (created on run)
├── documentation.md            # This file
├── index.js                    # Main server file (Express, Telegraf, API endpoints)
├── package.json                # Project dependencies and scripts
└── telegram_login.md           # Initial instructions document
```

## 5. Setup and Installation

Follow these steps to get the project running locally.

### Step 1: Clone the Repository
If this were a git repository, you would clone it. For now, ensure you have the files.

### Step 2: Install Dependencies
Open your terminal in the project root and run:
```bash
npm install
```
This will install all the necessary packages listed in `package.json`.

### Step 3: Create a Telegram Bot
1.  Open Telegram and search for the `@BotFather` bot.
2.  Send the `/newbot` command.
3.  Follow the prompts to set a name and a unique username for your bot (it must end in `bot`).
4.  BotFather will give you a **bot token**. Copy this token.

### Step 4: Configure Environment Variables
1.  In the project root, create a file named `.env`.
2.  Add your bot token to this file:
    ```
    BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    ```
3.  It's also good practice to add a session secret:
    ```
    SESSION_SECRET=a_long_random_string_for_security
    ```

### Step 5: Update the Bot Username in the Frontend
1.  Open `public/web/js/script.js`.
2.  Find the line: `const botUsername = '...';`
3.  Replace the placeholder with your bot's actual username (the one ending in "bot").

### Step 6: Run the Application
Start the server with:
```bash
npm start
```
The server will start, connect to the database, and launch the Telegram bot. You can access the web app at `http://localhost:3000`.

## 6. How It Works: The Login Flow

The authentication process is designed to be robust and user-friendly.

1.  **User Initiates Login**: The user visits the website and clicks the "Login with Telegram" button.
2.  **Token Generation**: The frontend sends a POST request to the `/tg-login-start` endpoint. The server generates a unique, single-use token, stores it in the `tokens` table with a `pending` status, and sends it back to the frontend.
3.  **Redirect to Telegram**: The frontend receives the token and opens a new tab to the Telegram bot's chat, passing the token in the URL (`https://t.me/YOUR_BOT?start=TOKEN`).
4.  **Frontend Polling**: As soon as the Telegram tab is opened, the frontend starts **polling** the `/tg-login-check` endpoint every 2 seconds, sending the token each time to ask, "Has the user logged in yet?"
5.  **User Authenticates in Telegram**: The user clicks the "START" button in the Telegram chat with the bot.
6.  **Bot Authenticates User**:
    - The Telegraf bot running on the server receives the `/start` command along with the token.
    - It looks up the token in the `tokens` table.
    - It saves the user's Telegram info (ID, username, etc.) to the `users` table (inserting or updating as needed).
    - It updates the token's status in the `tokens` table to `authenticated`.
    - It sends a confirmation message ("You have successfully logged in!") back to the user in Telegram.
7.  **Polling Succeeds**: On its next check, the frontend's request to `/tg-login-check` finds that the token's status is now `authenticated`.
8.  **Session Creation**: The backend creates a persistent session for the user using `express-session` and stores their profile in it. It then sends a `success: true` response to the frontend.
9.  **UI Update**: The frontend receives the success response, stops polling, and reloads the page. On page load, the `/check-auth` endpoint confirms the user has a valid session, and the UI updates to show the logged-in user's profile and a "Logout" button.

## 7. Database Schema

The application uses a SQLite database (`database.sqlite`) with three main tables.

### `users`
Stores permanent information about registered users.
- `id` (TEXT, PRIMARY KEY): The user's unique Telegram ID.
- `username` (TEXT): The user's Telegram @username.
- `first_name` (TEXT): The user's first name.
- `last_name` (TEXT): The user's last name.
- `created_at` (DATETIME): Timestamp of when the user was first created.
- `updated_at` (DATETIME): Timestamp of the last update to the user's record (updated automatically by a trigger).

### `tokens`
Stores temporary, single-use tokens for the login process.
- `token` (TEXT, PRIMARY KEY): The unique random token.
- `status` (TEXT): The token's status (`pending` or `authenticated`).
- `user_id`, `user_first_name`, `user_username` (TEXT): User info, populated after authentication.
- `created_at` (DATETIME): Timestamp of when the token was created.

### `sessions`
This table is automatically created and managed by `connect-sqlite3` to store session data.

## 8. API Endpoints

The Express server provides the following endpoints:

- **`GET /check-auth`**:
    - **Description**: Checks if the current user has an active session.
    - **Response (Logged In)**: `{ "loggedIn": true, "user": { "id": "...", "first_name": "...", "username": "..." } }`
    - **Response (Logged Out)**: `{ "loggedIn": false }`

- **`POST /tg-login-start`**:
    - **Description**: Initiates the login process by generating a token.
    - **Response**: `{ "token": "a_unique_hex_token" }`

- **`POST /tg-login-check`**:
    - **Description**: Used by the frontend to poll the status of a login token.
    - **Request Body**: `{ "token": "the_token_to_check" }`
    - **Response (Success)**: `{ "success": true, "user": { ... } }`
    - **Response (Pending)**: `{ "success": false, "message": "Authentication pending." }`
    - **Response (Failure)**: `{ "success": false, "message": "Invalid or expired token." }`

- **`POST /logout`**:
    - **Description**: Destroys the user's current session.
    - **Response**: `{ "success": true }`
