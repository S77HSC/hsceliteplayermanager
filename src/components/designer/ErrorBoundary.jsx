import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error("UI crash:", error, info); this.setState({ info }); }
  handleReset = () => { this.setState({ error: null, info: null }); this.props.onReset?.(); };

  render(){
    if (this.state.error) {
      return (
        <div style={{ padding: 16, border: "1px solid #fecaca", background: "#fff1f2",
                      color: "#7f1d1d", borderRadius: 8, margin: 12, fontSize: 14 }}>
          <div style={{fontWeight: 700, marginBottom: 8}}>Something broke while rendering.</div>
          <div style={{whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"}}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{marginTop: 12, display: "flex", gap: 8}}>
            <button onClick={this.handleReset}
              style={{padding: "6px 10px", borderRadius: 6, border: "1px solid #991b1b", background: "#fee2e2"}}>
              Reset view
            </button>
            <button onClick={() => this.setState({ error: null })}
              style={{padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff"}}>
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
