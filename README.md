# DirectFarm

DirectFarm is a location-aware marketplace that connects households and bulk buyers with nearby farmers. It includes a responsive React/Vite client and an Express/MongoDB API.

## Current slice

- UPI payment QR at checkout with payment metadata stored on orders
- Passwordless QR sign-in with one-time approval sessions

When the API is configured, marketplace results, authentication, inventory, and orders use the backend. If the API is unavailable, the client displays the local design dataset for browsing, but authenticated checkout requires the API.

For UPI checkout, optionally set `VITE_UPI_VPA` in the frontend environment; it defaults to `directfarm@upi`. For QR sign-in from a phone, set `CLIENT_ORIGIN` to a URL reachable by both devices, such as the computer's LAN address, before starting the API and Vite server.

The current payment button records a demo confirmation after the user scans and pays. A production release must replace that confirmation with a provider such as Razorpay or Cashfree and verify its webhook signature on the server before marking an order as paid.

## Run locally

- `POST /api/auth/qr/session`, `GET /api/auth/qr/session/:id`, `POST /api/auth/qr/session/:id/approve`
```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

The initial Node API is available separately:

```bash
npm run server
```

Check `http://localhost:3000/api/health` to verify that the API is running. During development, use `npm run dev:server` to restart the API automatically when server files change.

## Backend MVP configuration

Copy `.env.example` to `.env`, set `MONGO_URI` and a long random `JWT_SECRET`, then start the API. The frontend expects the API at `http://localhost:3000/api` by default. MongoDB must be running before `npm run server`; use a local MongoDB service or a MongoDB Atlas connection string. The order endpoint uses MongoDB transactions for inventory safety, so MongoDB must run as a replica set (MongoDB Atlas works by default).

If the browser shows `Failed to fetch`, the API is not reachable. Confirm that `npm run server` is running, that `MONGO_URI` is valid, and that `VITE_API_BASE_URL` matches the API port. Restart Vite after changing any `VITE_` variable.

Available API groups:

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id`
- `POST /api/orders`, `GET /api/orders`

Protected endpoints require `Authorization: Bearer <token>`. Product creation and editing require a farmer role; ordering requires a household or bulk-buyer role.

## Remaining production phases

1. Express/MongoDB API with JWT authentication and role authorization.
2. Farmer profiles, product CRUD, inventory reservations, and real order state transitions.
3. GeoJSON farmer/customer locations with MongoDB `2dsphere` queries.
4. Pickup, farmer-drop, and platform-delivery pricing services.
5. Bulk requirements, multi-farmer offers, group orders, reviews, and notifications.
6. AI service interfaces for demand forecasting, matching, and route optimization.
7. Admin verification, moderation, analytics, and deployment configuration.