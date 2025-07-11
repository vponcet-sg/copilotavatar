import React from 'react';

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export const ErrorBanner = ({ error, onDismiss }: ErrorBannerProps) => {
  return (
    <div className="error-banner">
      <span>⚠️ {error}</span>
      <button onClick={onDismiss} className="error-close">
        ✕
      </button>
    </div>
  );
};