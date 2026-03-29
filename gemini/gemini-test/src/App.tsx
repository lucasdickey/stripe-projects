import React, { useState, useEffect } from 'react';
import { Send, Twitter, User, MessageSquare, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Suggestion {
  id: string;
  message: string;
  twitter?: string;
  agent?: string;
  timestamp: string;
}

export default function App() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState('');
  const [twitter, setTwitter] = useState('');
  const [agent, setAgent] = useState('');
  const [summary, setSummary] = useState<string[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatQuery, setChatQuery] = useState('');

  // Initial load
  useEffect(() => {
    // Mock data for initial visual render
    const mock: Suggestion[] = [
      { id: '1', message: 'Add better database visualization tools', twitter: '@lucasdickey', agent: 'Gemini', timestamp: new Date().toISOString() },
      { id: '2', message: 'Improve the CLI error messages for plugins', agent: 'Claude', timestamp: new Date().toISOString() },
    ];
    setSuggestions(mock);
    generateSummary(mock);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newSuggestion: Suggestion = {
      id: Date.now().toString(),
      message,
      twitter,
      agent,
      timestamp: new Date().toISOString(),
    };

    const updated = [newSuggestion, ...suggestions];
    setSuggestions(updated);
    setMessage('');
    setTwitter('');
    setAgent('');
    generateSummary(updated);
  };

  const generateSummary = async (data: Suggestion[]) => {
    setIsSummarizing(true);
    // This would typically call the Anthropic API via a serverless function
    // For now, we simulate the top categories
    setTimeout(() => {
      setSummary([
        'CLI Plugin Stability',
        'Database Visualization',
        'Multi-Agent Coordination',
        'Environment Variable Management',
        'Project Scaffolding Speed'
      ]);
      setIsSummarizing(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header & Summary */}
        <header className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="text-blue-600" />
            Stripe Projects Feedback
          </h1>
          
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Top Categories (AI Summarized)</h2>
            <div className="flex flex-wrap gap-2">
              {isSummarizing ? (
                <div className="animate-pulse flex gap-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-8 w-24 bg-gray-200 rounded-full" />)}
                </div>
              ) : (
                summary.map((cat, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                    {cat}
                  </span>
                ))
              )}
            </div>
          </div>
        </header>

        {/* Input Form */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              placeholder="How can we improve Stripe Projects?"
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[100px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Twitter Handle (Optional)"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Agent Used (Optional)"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Suggestion
            </button>
          </form>
        </section>

        {/* Chat & List */}
        <section className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Chat with the suggestions..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            {suggestions.map((s) => (
              <div key={s.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all group">
                <p className="text-lg text-gray-800 mb-4 leading-relaxed">{s.message}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {s.twitter && (
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md">
                      <Twitter className="w-3 h-3" /> {s.twitter}
                    </span>
                  )}
                  {s.agent && (
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md">
                      <User className="w-3 h-3" /> {s.agent}
                    </span>
                  )}
                  <span className="ml-auto text-xs opacity-50">
                    {new Date(s.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}