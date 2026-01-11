'use client';

import { useState, useEffect } from 'react';

interface ReasoningProps {
  content: string;
  duration?: number;
  isComplete?: boolean;
}

export default function Reasoning({ content, duration, isComplete = false }: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(!isComplete);

  // Auto-collapse when reasoning is complete
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 500); // Small delay before collapsing
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%]">
        <button
          onClick={() => isComplete && setIsOpen(!isOpen)}
          disabled={!isComplete}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 border rounded-lg transition-all ${
            isComplete
              ? 'bg-background border-border hover:bg-accent hover:border-accent-foreground/20 cursor-pointer'
              : 'bg-muted/50 border-border cursor-default'
          }`}
        >
          {isComplete && (
            <svg
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                isOpen ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}

          {isComplete ? (
            <div className="flex items-center gap-2 flex-1">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-foreground">
                Thought for {duration || 0} second{duration !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 flex-1">
              <svg className="w-4 h-4 text-[#1e5a8e] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-muted-foreground">Thinking...</span>
            </div>
          )}
        </button>

        {isOpen && (
          <div className="mt-2 px-4 py-3 bg-muted/30 border border-border rounded-lg">
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              {content.split('\n').map((line, idx) => (
                line.trim() && (
                  <p key={idx} className="text-foreground/70">
                    {line}
                  </p>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
