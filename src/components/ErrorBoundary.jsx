import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Rakenduse viga:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <h1>Midagi läks valesti</h1>
          <p>Rakenduse selles osas tekkis ootamatu viga. Proovi lehte uuesti laadida.</p>
          <button onClick={() => window.location.reload()}>Laadi leht uuesti</button>
        </div>
      );
    }
    return this.props.children;
  }
}
