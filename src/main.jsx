import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AppStateProvider } from "../prototype/src/state/AppState.jsx";
import App from "../prototype/src/App.jsx";
import "../prototype/src/styles/fonts.css";
import "../prototype/src/styles/tokens.css";
import "../prototype/src/styles/base.css";
import "../prototype/src/styles/layout.css";
import "../prototype/src/styles/components.css";
import "../prototype/src/styles/charts.css";
import "../prototype/src/styles/pages.css";
import "../prototype/src/styles/analytics.css";
import "../prototype/src/styles/embed.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
