'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Loader2, Bot, User, Volume2, Languages, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { provideChatbotAdvisory, ProvideChatbotAdvisoryInput } from '@/ai/flows/provide-chatbot-advisory';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
    { code: 'mr', name: 'मराठी (Marathi)' },
    { code: 'bn', name: 'বাংলা (Bengali)' },
    { code: 'ta', name: 'தமிழ் (Tamil)' },
    { code: 'te', name: 'తెలుగు (Telugu)' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
];

function cleanAssistantText(text: string) {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\/?think>/gi, '')
        .trim();
}

export default function VoiceAssistantPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replyLanguage, setReplyLanguage] = useState<string>('hi');

    const speechRecognitionRef = useRef<any>(null);
    const { toast } = useToast();

    // Check for browser support on mount
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in your browser. Please try Chrome or Edge.");
        }
    }, []);

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
        if (!SpeechRecognition) return;

        speechRecognitionRef.current = new SpeechRecognition();
        speechRecognitionRef.current.continuous = false;
        speechRecognitionRef.current.interimResults = false;
        speechRecognitionRef.current.lang = 'en-US'; // Set a default, it often auto-detects anyway

        speechRecognitionRef.current.onstart = () => setIsListening(true);
        speechRecognitionRef.current.onend = () => setIsListening(false);
        speechRecognitionRef.current.onerror = (event: any) => {
            if (event.error !== 'no-speech') {
                setError(`Speech recognition error: ${event.error}. Please ensure microphone access is allowed.`);
            }
        };

        speechRecognitionRef.current.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                const userMessage: Message = { id: Date.now().toString(), role: 'user', text: transcript };
                setMessages(prev => [...prev, userMessage]);
                await processQuery(transcript);
            }
        };

        speechRecognitionRef.current.start();
    };

    const processQuery = async (query: string) => {
        setIsProcessing(true);
        try {
            const advisoryInput: ProvideChatbotAdvisoryInput = {
                query,
                managementType: 'Crops', // General context
                language: replyLanguage,
                history: messages.map(m => ({ role: m.role, text: m.text })),
            };

            const advisoryResult = await provideChatbotAdvisory(advisoryInput);
            const assistantText = cleanAssistantText(advisoryResult.advice);
            
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: assistantText,
            };

            setMessages(prev => [...prev, assistantMessage]);
            speakText(assistantText);

        } catch (e: any) {
            console.error("Error processing query:", e);
            toast({ variant: 'destructive', title: "Error", description: `Could not get a response. ${e.message}` });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const speakText = (text: string) => {
        if (!('speechSynthesis' in window)) {
            toast({
                variant: 'destructive',
                title: 'Speech Error',
                description: 'Text-to-speech is not supported in this browser.',
            });
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = replyLanguage;
        window.speechSynthesis.speak(utterance);
    };

    return (
        <main className="h-[calc(100vh-5rem)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold">Smart Voice Advisory</h1>
                    <p className="text-muted-foreground">Ask farming questions with your voice and get spoken replies.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Languages className="h-5 w-5 text-muted-foreground"/>
                    <Select value={replyLanguage} onValueChange={setReplyLanguage}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Reply Language" />
                        </SelectTrigger>
                        <SelectContent>
                             {supportedLanguages.map(lang => (
                                <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="flex-1 flex flex-col">
                <CardContent className="p-4 flex-1 flex flex-col">
                    <ScrollArea className="flex-1 mb-4 pr-4">
                        <div className="space-y-4">
                             {messages.length === 0 && !isProcessing && (
                                <div className="text-center text-muted-foreground py-16">
                                    <Mic className="mx-auto h-12 w-12 mb-4"/>
                                    <p>Click the microphone to start a conversation.</p>
                                </div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} className={cn('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                     {msg.role === 'assistant' && <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>}
                                     <div className={cn("rounded-lg p-3 max-w-xl relative group", msg.role === 'user' ? 'bg-primary/10' : 'bg-secondary')}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        {msg.role === 'assistant' && (
                                            <Button size="icon" variant="ghost" className="absolute -bottom-4 -right-2" onClick={() => speakText(msg.text)}>
                                                <Volume2 className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>
                                    {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5" /></div>}
                                </div>
                            ))}
                             {isProcessing && (
                                <div className="flex items-start gap-3 justify-start">
                                     <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>
                                     <div className="rounded-lg p-3 bg-secondary">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-center items-center pt-4 border-t">
                        <Button
                            size="lg"
                            className={cn("rounded-full h-20 w-20 shadow-lg", isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90')}
                            onClick={handleMicClick}
                            disabled={isProcessing || !!error}
                        >
                            {isListening ? <Square className="h-8 w-8" fill="white" /> : <Mic className="h-10 w-10" />}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
