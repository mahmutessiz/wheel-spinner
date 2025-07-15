# Telegram Login/Registration Flow

This document outlines the process of user login and registration using Telegram on this website.

## Overview

The Telegram login process is a seamless way for users to sign up or log in to their accounts by authenticating through their Telegram account. The process involves a combination of client-side and server-side logic.

## Client-Side Logic

The client-side logic is primarily handled by the JavaScript file located at `Public/web/js/script.js`.

### 1. User Initiates Login

- The user clicks on either the "Telegram ile Kayıt Ol" (Register with Telegram) or "Telegram ile Giriş Yap" (Login with Telegram) button. These buttons have the CSS class `tg-login`.

### 2. Start of the Login Process

- A click event on the button triggers an AJAX POST request to the `/tg-login-start` endpoint on the server.
- The server responds with a unique `token`.

### 3. Redirection to Telegram Bot

- The client-side script receives the `token` from the server.
- It then opens a new window, redirecting the user to the Telegram bot associated with the website: `https://t.me/daysdicebot?start=<token>`.
- The `token` is passed as a parameter in the URL, which is used to identify the user's login attempt.

### 4. Checking the Login Status

- After the user authenticates with the Telegram bot, they are redirected back to the website.
- When the website's window regains focus, a `focus` event is triggered.
- This event triggers another AJAX POST request, this time to the `/tg-login-check` endpoint, sending the `token` back to the server.

### 5. Completing the Login

- The server verifies the `token`.
- If the token is valid, the server logs the user in (or creates a new account if it's their first time).
- The server returns a success status to the client.
- The client-side script then reloads the page, and the user is now logged in.

## Server-Side Logic (Inferred)

The server-side logic consists of two main endpoints:

### `/tg-login-start`

- **Purpose:** To initiate the Telegram login process.
- **Functionality:**
    - Generates a unique, single-use token.
    - Stores the token in the server's session or a temporary database, associated with the user's current session.
    - Returns the token to the client in a JSON response.

### `/tg-login-check`

- **Purpose:** To verify the Telegram login and complete the authentication.
- **Functionality:**
    - Receives the `token` from the client.
    - Verifies the token against the one stored in the session/database.
    - It's likely that the Telegram bot also communicates with the server to confirm that the user has authenticated. This could be done via a webhook or by the server making a request to the Telegram Bot API.
    - If the token is valid and the user has authenticated with the bot:
        - If the user's Telegram ID is new, a new user account is created.
        - If the user's Telegram ID already exists, the user is logged in.
        - A success status is returned to the client.

## Summary

The Telegram login process is a secure and user-friendly authentication method that leverages the Telegram Bot API. The client-side script orchestrates the process by communicating with the server and redirecting the user to the Telegram bot, while the server-side handles the token generation, verification, and user authentication.
