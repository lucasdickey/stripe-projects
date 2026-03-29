'use client';

import { useState } from 'react';

interface FeedbackFormProps {
  onSuccess: () => void;
}

export default function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const [message, setMessage] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [agent, setAgent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          twitterHandle: twitterHandle || undefined,
          agent: agent || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess('Thank you! Your feedback has been submitted.');
      setMessage('');
      setTwitterHandle('');
      setAgent('');
      onSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-section">
      <h2>Share Your Feedback</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="form-group">
        <label htmlFor="message">
          Your Suggestion *
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share your ideas for improving Stripe Projects..."
          required
        />
      </div>

      <div className="two-column">
        <div className="form-group">
          <label htmlFor="twitter">
            Twitter Handle (optional)
          </label>
          <input
            id="twitter"
            type="text"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            placeholder="@yourhandle"
          />
        </div>

        <div className="form-group">
          <label htmlFor="agent">
            Agent Used (optional)
          </label>
          <select
            id="agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="">None</option>
            <option value="claude">Claude</option>
            <option value="cursor">Cursor</option>
            <option value="codex">Codex</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !message.trim()}
        className="primary"
      >
        {isLoading ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  );
}
