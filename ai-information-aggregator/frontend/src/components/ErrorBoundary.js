import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 20px;
`;

const ErrorIcon = styled.div`
  font-size: 64px;
  color: #dc3545;
  margin-bottom: 20px;
`;

const ErrorTitle = styled.h2`
  color: #333;
  margin-bottom: 16px;
  font-size: 24px;
`;

const ErrorMessage = styled.p`
  color: #666;
  margin-bottom: 24px;
  font-size: 16px;
  line-height: 1.5;
  max-width: 500px;
`;

const ErrorDetails = styled.details`
  margin-top: 20px;
  text-align: left;
  max-width: 600px;
  width: 100%;
`;

const ErrorSummary = styled.summary`
  cursor: pointer;
  color: #007bff;
  font-weight: 500;
  margin-bottom: 10px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorStack = styled.pre`
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  color: #495057;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ActionButton = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin: 0 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }

  &.secondary {
    background-color: #6c757d;
    
    &:hover {
      background-color: #545b62;
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report error to monitoring service (if available)
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }

    // Report to Vercel Analytics (if available)
    if (window.va) {
      window.va('track', 'Error Boundary', {
        error: error.message,
        component: this.props.fallbackComponent || 'Unknown'
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      const { fallbackComponent, showDetails = false } = this.props;
      const { error, errorInfo, errorId } = this.state;

      return (
        <ErrorContainer>
          <ErrorIcon>⚠️</ErrorIcon>
          <ErrorTitle>
            {fallbackComponent ? `${fallbackComponent} Error` : 'Something went wrong'}
          </ErrorTitle>
          <ErrorMessage>
            We're sorry, but something unexpected happened. This error has been logged 
            and our team will investigate the issue.
          </ErrorMessage>
          
          {errorId && (
            <ErrorMessage>
              <strong>Error ID:</strong> {errorId}
            </ErrorMessage>
          )}

          <ButtonGroup>
            <ActionButton onClick={this.handleRetry}>
              Try Again
            </ActionButton>
            <ActionButton onClick={this.handleReload} className="secondary">
              Reload Page
            </ActionButton>
            <ActionButton onClick={this.handleGoHome} className="secondary">
              Go to Dashboard
            </ActionButton>
          </ButtonGroup>

          {(showDetails || process.env.NODE_ENV === 'development') && error && (
            <ErrorDetails>
              <ErrorSummary>Technical Details</ErrorSummary>
              <ErrorStack>
                <strong>Error:</strong> {error.toString()}
                {errorInfo && (
                  <>
                    <br /><br />
                    <strong>Component Stack:</strong>
                    {errorInfo.componentStack}
                  </>
                )}
              </ErrorStack>
            </ErrorDetails>
          )}
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;