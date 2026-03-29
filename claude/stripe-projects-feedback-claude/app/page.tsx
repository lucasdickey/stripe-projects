'use client';

import { useState } from 'react';
import FeedbackForm from '@/components/FeedbackForm';
import SummarySection from '@/components/SummarySection';
import FeedbackList from '@/components/FeedbackList';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleFeedbackSuccess = () => {
    // Trigger refresh of feedback list and summary
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <main>
      <header>
        <h1>Stripe Projects Feedback</h1>
        <p>
          Help us improve Stripe Projects by sharing your ideas, suggestions,
          and feedback. Chat with others and see the top improvement requests!
        </p>
      </header>

      <SummarySection triggerRefresh={refreshTrigger} />

      <FeedbackForm onSuccess={handleFeedbackSuccess} />

      <ChatInterface />

      <FeedbackList triggerRefresh={refreshTrigger} />
    </main>
  );
}
