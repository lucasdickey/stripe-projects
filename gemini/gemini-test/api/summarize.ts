import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { suggestions } = req.body;
  if (!suggestions || !Array.isArray(suggestions)) return res.status(400).send('Invalid suggestions');

  const text = suggestions.map(s => s.message).join('\n---\n');

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ 
        role: "user", 
        content: `Based on these user suggestions for Stripe Projects improvements, identify the Top 5 unique and concise categories. Return ONLY the category names as a comma-separated list:\n\n${text}` 
      }],
    });

    const content = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const categories = content.split(',').map(s => s.trim());
    
    res.status(200).json({ categories });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'AI Summarization failed' });
  }
}