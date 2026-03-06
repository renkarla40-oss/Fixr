import React from 'react';
import { View } from 'react-native';

/**
 * HARD ERROR BOUNDARY
 * 
 * Catches ALL uncaught errors and renders a blank fallback.
 * NEVER shows any error to the user.
 * Logs to console only in development.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state so next render shows blank fallback
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console in dev only - NEVER show to user
    if (__DEV__) {
      console.warn('[ErrorBoundary] Caught error:', error.message);
    }
    // Could send to error reporting service here
  }

  render() {
    if (this.state.hasError) {
      // Render BLANK fallback - no text, no toast, no banner
      return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
