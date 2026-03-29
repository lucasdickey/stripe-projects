'use client';

import { useEffect, useState } from 'react';

interface Category {
  category: string;
  description: string;
  count: number;
  examples: string[];
}

interface SummarySectionProps {
  triggerRefresh?: number;
}

export default function SummarySection({ triggerRefresh }: SummarySectionProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchSummary();
  }, [triggerRefresh]);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      setCategories(data.categories || []);
      setGeneratedAt(data.generatedAt ? new Date(data.generatedAt) : null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load summary. Be sure MongoDB is running.'
      );
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate summary');
      }

      const data = await response.json();
      setCategories(data.categories || []);
      setGeneratedAt(new Date());
    } catch (err) {
      setError('Failed to regenerate summary');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="summary-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Top 10 Feedback Categories</h2>
        <button onClick={handleRegenerate} className="secondary" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh Summary'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {generatedAt && (
        <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '15px' }}>
          Last updated: {new Date(generatedAt).toLocaleString()}
        </p>
      )}

      {isLoading && categories.length === 0 ? (
        <div className="loading">
          Loading summary... (Requires OpenAI API key and MongoDB)
        </div>
      ) : categories.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>
          No feedback categories yet. Submit some feedback to see categories appear!
        </p>
      ) : (
        <div className="summary-grid">
          {categories.slice(0, 10).map((cat, idx) => (
            <div key={idx} className="category-card">
              <h3>{cat.category}</h3>
              <div className="category-count">{cat.count}</div>
              <p className="category-description">{cat.description}</p>
              {cat.examples && cat.examples.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-light)' }}>
                  <strong>Example:</strong> {cat.examples[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
