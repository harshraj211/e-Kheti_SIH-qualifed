
'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { provideChatbotAdvisory, ProvideChatbotAdvisoryInput } from '@/ai/flows/provide-chatbot-advisory';
import { ChatbotCard } from '../ChatbotCard';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import type { Message, Conversation, DocumentAttachment } from '@/lib/chat-types';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { loadFarmProfile } from '@/lib/farm-profile';
import { consumeDiseaseChatContext, diseaseContextToText } from '@/lib/disease-context';
import { saveChatFeedback } from '@/lib/chat-feedback';
import { useAuth } from '@/hooks/useAuth';


const CHAT_HISTORY_KEY_PREFIX = 'agriVision-chatHistory';

type ChatContainerProps = {
    managementType: 'Crops' | 'Fruits';
}

export function ChatContainer({ managementType }: ChatContainerProps) {
    const CHAT_HISTORY_KEY = `${CHAT_HISTORY_KEY_PREFIX}-${managementType.toLowerCase()}`;
    
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isSending, startSending] = useTransition();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const { toast } = useToast();
    const { language } = useTranslation();
    const { user } = useAuth();
    const pendingDiseaseContext = useRef<string>('');

    const [audioState, setAudioState] = useState({
        isPlaying: false,
        isLoading: false,
        messageId: null as string | null,
    });
    const activeConversation = conversations.find(c => c.id === activeConversationId);

    // Load chat history from localStorage on component mount
    useEffect(() => {
        if (!user) return;
        const diseaseContext = consumeDiseaseChatContext();
        if (diseaseContext) {
            pendingDiseaseContext.current = diseaseContextToText(diseaseContext);
            toast({
                title: 'Disease result attached',
                description: 'Ask a follow-up question and the assistant will use the prediction and confidence.',
            });
        }
        const storedHistory = localStorage.getItem(`${CHAT_HISTORY_KEY}-${user.id}`);
        const loadedConversations: Conversation[] = storedHistory ? JSON.parse(storedHistory) : [];
        
        if (loadedConversations.length > 0) {
            setConversations(loadedConversations.map(c => ({...c, createdAt: new Date(c.createdAt)})));
            setActiveConversationId(loadedConversations[0].id);
        } else {
            setConversations([]);
            setActiveConversationId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [CHAT_HISTORY_KEY, toast, user]);

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        if (!user) return;
        if (conversations.length > 0) {
            localStorage.setItem(`${CHAT_HISTORY_KEY}-${user.id}`, JSON.stringify(conversations));
        } else {
             localStorage.removeItem(`${CHAT_HISTORY_KEY}-${user.id}`);
        }
    }, [conversations, CHAT_HISTORY_KEY, user]);


    const handleNewChat = () => {
        const newConversation: Conversation = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
        setIsSheetOpen(false);
    }
    
    const handleDeleteChat = (conversationId: string) => {
        setConversations(prev => {
            const updatedConversations = prev.filter(c => c.id !== conversationId);
            if (activeConversationId === conversationId) {
                setActiveConversationId(updatedConversations.length > 0 ? updatedConversations[0].id : null);
            }
            return updatedConversations;
        });
    }
    
    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
        setIsSheetOpen(false);
    }

    const handleFeedback = (messageId: string, rating: 'helpful' | 'not_helpful') => {
        if (!activeConversation) return;
        const messageIndex = activeConversation.messages.findIndex(message => message.id === messageId);
        const answer = activeConversation.messages[messageIndex];
        const question = [...activeConversation.messages.slice(0, messageIndex)].reverse().find(message => message.role === 'user');
        if (!answer || !question) return;

        saveChatFeedback({
            messageId,
            conversationId: activeConversation.id,
            rating,
            question: question.text,
            answer: answer.text,
            createdAt: new Date().toISOString(),
        });
        setConversations(current => current.map(conversation => ({
            ...conversation,
            messages: conversation.messages.map(message => message.id === messageId ? { ...message, feedback: rating } : message),
        })));
        toast({ title: 'Feedback saved', description: rating === 'helpful' ? 'Thanks, this answer was marked helpful.' : 'Thanks, this answer was marked for review.' });
    };

    const handleTextToSpeech = async (text: string, messageId: string) => {
        if (audioState.isPlaying && audioState.messageId === messageId) {
            window.speechSynthesis.cancel();
            setAudioState({ isPlaying: false, isLoading: false, messageId: null });
            return;
        }

        if (!('speechSynthesis' in window)) {
            toast({
                variant: 'destructive',
                title: "Speech Error",
                description: "Text-to-speech is not supported in this browser."
            });
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.onstart = () => setAudioState({ isPlaying: true, isLoading: false, messageId });
        utterance.onend = () => setAudioState({ isPlaying: false, isLoading: false, messageId: null });
        utterance.onerror = () => {
            setAudioState({ isPlaying: false, isLoading: false, messageId: null });
            toast({
                variant: 'destructive',
                title: "Speech Error",
                description: "Could not play audio for this message."
            });
        };

        setAudioState({ isPlaying: false, isLoading: true, messageId });
        window.speechSynthesis.speak(utterance);
    };


    const handleSendMessage = async (userMessage: Message, attachments: { image?: string | null, document?: DocumentAttachment | null }) => {
        let conversationId = activeConversationId;
        let conversationForHistory = activeConversation;
        
        if (!conversationId) {
            const newConversation: Conversation = {
                id: Date.now().toString(),
                title: userMessage.text.substring(0, 30) || 'New Chat',
                messages: [],
                createdAt: new Date(),
            };
            setConversations(prev => [newConversation, ...prev]);
            conversationId = newConversation.id;
            setActiveConversationId(conversationId);
            conversationForHistory = newConversation;
        }
        
        const currentConversationId = conversationId;

        setConversations(prev => prev.map(c => {
            if (c.id === currentConversationId) {
                const updatedMessages = [...c.messages, userMessage];
                return { 
                    ...c,
                    title: c.messages.length === 0 ? userMessage.document?.name || userMessage.text.substring(0, 30) || 'New Chat' : c.title,
                    messages: updatedMessages
                };
            }
            return c;
        }));


        startSending(async () => {
            try {
                // Pass the full conversation history to the AI.
                const history = conversationForHistory?.messages.map(m => ({
                    role: m.role,
                    text: m.text,
                })) || [];

                const diseaseContext = pendingDiseaseContext.current;
                const documentContext = [attachments.document?.content, diseaseContext].filter(Boolean).join('\n\n');
                const payload: ProvideChatbotAdvisoryInput = {
                    query: userMessage.text,
                    managementType: managementType,
                    photoDataUri: attachments.image || undefined,
                    documentContent: documentContext || undefined,
                    history: history,
                    language: language,
                    farmProfile: loadFarmProfile(),
                };

                const { advice } = await provideChatbotAdvisory(payload);
                pendingDiseaseContext.current = '';
                const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: advice };

                setConversations(prev => prev.map(c => {
                    if (c.id === currentConversationId) {
                        return { ...c, messages: [...c.messages, assistantMessage] };
                    }
                    return c;
                }));

            } catch (err) {
                console.error("Error calling chatbot advisory flow:", err);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not get a response from the assistant. Please try again."
                });
                // Rollback the user's message on error
                setConversations(prev => prev.map(c => {
                     if (c.id === currentConversationId) {
                        return { ...c, messages: c.messages.filter(m => m.id !== userMessage.id) };
                    }
                    return c;
                }));
            }
        });
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-4 h-full relative">
            <div className="absolute top-2 left-2 z-10 md:hidden">
                 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <PanelLeft className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-full max-w-sm">
                        <ChatHistorySidebar
                            conversations={conversations}
                            activeConversationId={activeConversationId}
                            onSelectConversation={handleSelectConversation}
                            onNewChat={handleNewChat}
                            onDeleteChat={handleDeleteChat}
                        />
                    </SheetContent>
                </Sheet>
            </div>
            <ChatHistorySidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
                className="hidden md:flex"
            />
            <div className="h-full">
                <ChatbotCard
                    conversation={activeConversation || null}
                    onMessage={handleSendMessage}
                    isSending={isSending}
                    onTextToSpeech={handleTextToSpeech}
                    audioState={audioState}
                    onFeedback={handleFeedback}
                />
            </div>
        </div>
    );
}
