import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Higher-order component that wraps a component with an ErrorBoundary
 * @param {React.Component} WrappedComponent - The component to wrap
 * @param {Object} errorBoundaryProps - Props to pass to the ErrorBoundary
 * @returns {React.Component} - The wrapped component
 */
const withErrorBoundary = (WrappedComponent, errorBoundaryProps = {}) => {
  const WithErrorBoundaryComponent = (props) => {
    const componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
    
    return (
      <ErrorBoundary 
        fallbackComponent={componentName}
        {...errorBoundaryProps}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${componentName})`;
  
  return WithErrorBoundaryComponent;
};

export default withErrorBoundary;