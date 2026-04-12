
  # Gamified Productivity Web App

  This is a code bundle for Gamified Productivity Web App. The original project is available at https://www.figma.com/design/XdDOD1f3gol3DLV4nHgVT3/Gamified-Productivity-Web-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Plan tier (feature flags)

  Each user has a **tier** on their record (`free`, `starter`, `pro`, or `elite`) used only for in-app feature flags (for example, which nav items appear). There is no billing UI or payment flow; `GET /api/billing/status` returns the current tier when authenticated.
