# Billing Software Backend

This is the Node.js/Express backend for the Billing Software application.

## Prerequisites
- Node.js (v14+)
- MongoDB (Running locally or URI)

## Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment:
    - Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
    - Update `MONGO_URI` and `JWT_SECRET` in `.env` if needed. Default assumes local MongoDB.

## Running the Server

-   Start in development mode (with nodemon):
    ```bash
    npm run dev
    ```

-   Start in production mode:
    ```bash
    npm start
    ```

The server will run on `http://localhost:5000` (or defined PORT).

## API Documentation
See `backend_contract.md` for endpoint details.

## Features
-   **Auth**: JWT-based authentication.
-   **Modules**: Customers, Products, Invoices, Expenses, Reports, Settings.
-   **Security**: Helmet, CORS, Input Validation (Joi).
-   **Validation**: Server-side stock checking and invoice total recalculation.
