export type ChatFeedback = {
  messageId: string;
  conversationId: string;
  rating: 'helpful' | 'not_helpful';
  question: string;
  answer: string;
  createdAt: string;
};

const FEEDBACK_KEY = 'ekheti-chat-feedback-v1';

export function saveChatFeedback(feedback: ChatFeedback) {
  let items: ChatFeedback[] = [];
  try {
    items = JSON.parse(window.localStorage.getItem(FEEDBACK_KEY) || '[]');
  } catch {
    items = [];
  }
  const withoutExisting = items.filter(item => item.messageId !== feedback.messageId);
  window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify([...withoutExisting, feedback].slice(-500)));
  void fetch('/api/chat-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  }).catch(() => {
    // Browser storage remains the offline fallback until the next user action.
  });
}
