import { Component } from "react";
import { LocaleContext } from "../i18n/LocaleContext.jsx";

export default class ErrorBoundary extends Component {
  static contextType = LocaleContext;

  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Application error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      // Context may be unavailable if LocaleProvider itself is what threw —
      // fall back to Estonian rather than crashing the crash screen.
      const t = this.context?.t ?? ((key) => ({
        "crash.heading": "Midagi läks valesti",
        "crash.body": "Rakenduse selles osas tekkis ootamatu viga. Proovi lehte uuesti laadida.",
        "crash.reload": "Laadi leht uuesti",
      })[key] ?? key);
      return (
        <div className="app-crash">
          <h1>{t("crash.heading")}</h1>
          <p>{t("crash.body")}</p>
          <button onClick={() => window.location.reload()}>{t("crash.reload")}</button>
        </div>
      );
    }
    return this.props.children;
  }
}
