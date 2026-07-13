

export interface DocumentAttachment {
    name: string;
    type: string;
    content: string; // For .txt files, this will be the text content
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imagePreview?: string;
  document?: DocumentAttachment;
  feedback?: 'helpful' | 'not_helpful';
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}
