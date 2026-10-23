import { Component, type ReactNode } from 'react';

/** A render error from odd data shows a message instead of a blank page; fixing the data and reloading recovers. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="banners">
        <div className="banner error">
          <strong>Something in the house data broke the viewer:</strong> {this.state.error.message}
          <div><button className="btn" onClick={() => location.reload()}>Reload</button></div>
        </div>
      </div>
    );
  }
}
