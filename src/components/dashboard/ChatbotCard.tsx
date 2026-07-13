
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Loader2, Paperclip, Send, User, X, FileText, AlertCircle, Mic, MicOff, Volume2, Speaker, ThumbsDown, ThumbsUp } from 'lucide-react';
import { ProvideChatbotAdvisoryInput } from '@/ai/flows/provide-chatbot-advisory';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { Message, Conversation, DocumentAttachment } from '@/lib/chat-types';
import { Alert, AlertDescription } from '../ui/alert';


type ChatbotCardProps = {
    conversation: Conversation | null;
    onMessage: (message: Message, attachments: { image?: string | null, document?: DocumentAttachment | null }) => Promise<void>;
    isSending: boolean;
    onTextToSpeech: (text: string, messageId: string) => Promise<void>;
    audioState: {
        isPlaying: boolean,
        isLoading: boolean,
        messageId: string | null,
    }
    onFeedback: (messageId: string, rating: 'helpful' | 'not_helpful') => void;
};

function cleanAssistantText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

export function ChatbotCard({ conversation, onMessage, isSending, onTextToSpeech, audioState, onFeedback }: ChatbotCardProps) {
  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  const { t, language } = useTranslation();
  
  const messages = conversation?.messages || [];

  const handleMicClick = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    speechRecognitionRef.current = new SpeechRecognition();
    speechRecognitionRef.current.continuous = true;
    speechRecognitionRef.current.interimResults = true;
    speechRecognitionRef.current.lang = language;

    speechRecognitionRef.current.onstart = () => setIsListening(true);
    speechRecognitionRef.current.onend = () => setIsListening(false);
    speechRecognitionRef.current.onerror = (event: any) => {
        // 'no-speech' is a common event when the user doesn't say anything.
        // We don't want to show a scary error for that.
        if (event.error !== 'no-speech') {
            console.error("Speech recognition error:", event.error);
            setError(`Speech recognition error: ${event.error}`);
        }
    };

    speechRecognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setInput(input + finalTranscript + interimTranscript);
    };

    speechRecognitionRef.current.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageDataUri && !document) return;

    if(isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: input,
        imagePreview: imagePreview || undefined,
        document: document || undefined,
    };
    
    onMessage(userMessage, { image: imageDataUri, document });

    setInput('');
    clearImage();
    clearDocument();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      clearDocument();
      setError(null);
      if (file.size > 4 * 1024 * 1024) {
        setError("Image must be smaller than 4MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      clearImage();
      setError(null);

      if (!file.type.startsWith('text/plain')) {
        setError("Only .txt files are supported in this prototype.");
        return;
      }
       if (file.size > 10 * 1024 * 1024) {
        setError("File must be smaller than 10MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setDocument({
          name: file.name,
          type: file.type,
          content: reader.result as string,
        });
      };
      reader.readAsText(file);
    }
  };


  const clearImage = () => {
    setImagePreview(null);
    setImageDataUri(null);
    if(imageInputRef.current) imageInputRef.current.value = "";
  }

  const clearDocument = () => {
    setDocument(null);
    if(docInputRef.current) docInputRef.current.value = "";
  }

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
  }, [messages]);
  
  useEffect(() => {
    setInput('');
    clearImage();
    clearDocument();
    setError(null);
  }, [conversation?.id]);

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 p-6 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {messages.length === 0 && (
                 <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground p-4 rounded-lg bg-secondary">
                        <Bot className="mx-auto h-8 w-8 mb-2"/>
                        <p>{t('chatbotCard.empty')}</p>
                    </div>
                </div>
            )}
            {messages.map((message) => {
              const displayText = message.role === 'assistant' ? cleanAssistantText(message.text) : message.text;
              return (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-lg p-3 text-sm relative group',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  )}
                >
                  {message.imagePreview && (
                    <Image src={message.imagePreview} alt="User upload" width={200} height={150} className="rounded-md mb-2" />
                  )}
                  {message.document && (
                    <div className="mb-2 p-2 rounded-md bg-black/10">
                        <div className="flex items-center gap-2">
                           <FileText className="h-5 w-5" />
                           <span className="font-semibold truncate">{message.document.name}</span>
                        </div>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none text-inherit prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-strong:text-inherit">
                    <p className="whitespace-pre-wrap">{displayText}</p>
                  </div>
                  {message.role === 'assistant' && displayText && (
                    <div className='mt-2 flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity'>
                      <Button title="Helpful" size="icon" variant={message.feedback === 'helpful' ? 'secondary' : 'ghost'} className='h-7 w-7' onClick={() => onFeedback(message.id, 'helpful')}>
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button title="Not helpful" size="icon" variant={message.feedback === 'not_helpful' ? 'secondary' : 'ghost'} className='h-7 w-7' onClick={() => onFeedback(message.id, 'not_helpful')}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className='h-7 w-7' onClick={() => onTextToSpeech(displayText, message.id)} disabled={audioState.isLoading}>
                        {audioState.isLoading && audioState.messageId === message.id ? (
                           <Loader2 className="h-4 w-4 animate-spin" />
                        ) : audioState.isPlaying && audioState.messageId === message.id ? (
                           <Speaker className="h-4 w-4" />
                        ) : (
                           <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                 {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><User className="h-5 w-5"/></AvatarFallback>
                  </Avatar>
                )}
              </div>
              );
            })}
            {isSending && (
                <div className="flex items-start gap-3 justify-start">
                    <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                        <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                    </Avatar>
                    <div className="bg-secondary rounded-lg p-3">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 pt-4 border-t">
        {error && (
            <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <div className="flex items-center gap-2 w-full">
        {imagePreview && (
          <div className="relative">
            <Image src={imagePreview} alt="Image preview" width={60} height={60} className="rounded-md" />
             <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
              onClick={clearImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {document && (
            <div className="relative p-2 rounded-md bg-secondary">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    <span className="text-sm font-medium truncate max-w-xs">{document.name}</span>
                </div>
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                    onClick={clearDocument}
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        )}
        </div>
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            ref={imageInputRef}
            type="file"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageChange}
          />
           <Input
            ref={docInputRef}
            type="file"
            className="hidden"
            accept=".txt"
            onChange={handleDocumentChange}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()} disabled={isSending}>
            <Paperclip className="h-5 w-5" />
            <span className="sr-only">Attach Image</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => docInputRef.current?.click()} disabled={isSending}>
            <FileText className="h-5 w-5" />
            <span className="sr-only">Attach Document</span>
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chatbotCard.placeholder')}
            disabled={isSending}
          />
           <Button type="button" variant={isListening ? "destructive" : "ghost"} size="icon" onClick={handleMicClick}>
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="sr-only">{isListening ? "Stop listening" : "Start listening"}</span>
          </Button>
          <Button type="submit" size="icon" disabled={isSending || (!input.trim() && !imageDataUri && !document)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
