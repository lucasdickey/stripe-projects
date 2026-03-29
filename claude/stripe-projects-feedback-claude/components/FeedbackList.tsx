'use client';

import { useEffect, useState } from 'react';

interface FeedbackItem {
  id: string;
  message: string;
  twitterHandle?: string;
  agent?: string;
  category?: string;
  createdAt: string;
}

interface FeedbackListProps {
  triggerRefresh?: number;
}

export default function FeedbackList({ triggerRefresh }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchFeedback(currentPage);
  }, [currentPage, triggerRefresh]);

  const fetchFeedback = async (page: number) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/feedback?page=${page}`);
      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      setFeedback(data.items || []);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load feedback. Be sure MongoDB is running.'
      );
      setFeedback([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="feedback-section">
      <h2>
        All Feedback{' '}
        {total > 0 && (
          <span style={{ fontSize: '14px', color: 'var(--text-light)' }}>
            ({total} total)
          </span>
        )}
      </h2>

      {error && <div className="error">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading feedback...</div>
      ) : feedback.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>
          No feedback yet. Be the first to share your suggestions!
        </p>
      ) : (
        <>
          <div className="feedback-list">
            {feedback.map((item) => (
              <div key={item.id} className="feedback-item">
                <div className="feedback-header">
                  <div className="feedback-message">{item.message}</div>
                  {item.category && (
                    <span className="badge agent">{item.category}</span>
                  )}
                </div>

                <div className="feedback-meta">
                  {item.twitterHandle && (
                    <div className="feedback-meta-item">
                      <span>🐦</span>
                      <span>{item.twitterHandle}</span>
                    </div>
                  )}
                  {item.agent && (
                    <div className="feedback-meta-item">
                      <span>🤖</span>
                      <span>{item.agent}</span>
                    </div>
                  )}
                  <div className="feedback-meta-item">
                    <span>📅</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="secondary"
              >
                ← Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={currentPage === page ? 'active' : 'secondary'}
                  style={{
                    minWidth: '40px',
                  }}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="secondary"
              >
                Next →
              </button>

              <span style={{ marginLeft: '20px', color: 'var(--text-light)' }}>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
