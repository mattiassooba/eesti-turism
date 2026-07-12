import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LocaleProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LocaleProvider>
  </StrictMode>
);
