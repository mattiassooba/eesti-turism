import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";
import { RegionProvider } from "./context/RegionContext.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <RegionProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </RegionProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>
);
