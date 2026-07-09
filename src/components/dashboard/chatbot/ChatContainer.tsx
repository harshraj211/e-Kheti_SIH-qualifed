
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { provideChatbotAdvisory, ProvideChatbotAdvisoryInput } from '@/ai/flows/provide-chatbot-advisory';
import { ChatbotCard } from '../ChatbotCard';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import type { Message, Conversation, DocumentAttachment } from '@/lib/chat-types';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';


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

    const [audioState, setAudioState] = useState({
        isPlaying: false,
        isLoading: false,
        messageId: null as string | null,
    });
    const activeConversation = conversations.find(c => c.id === activeConversationId);

    // Load chat history from localStorage on component mount
    useEffect(() => {
        const userEmail = 'farmer@example.com'; // Hardcoded user
        const storedHistory = localStorage.getItem(`${CHAT_HISTORY_KEY}-${userEmail}`);
        const loadedConversations: Conversation[] = storedHistory ? JSON.parse(storedHistory) : [];
        
        if (loadedConversations.length > 0) {
            setConversations(loadedConversations.map(c => ({...c, createdAt: new Date(c.createdAt)})));
            setActiveConversationId(loadedConversations[0].id);
        } else {
            setConversations([]);
            setActiveConversationId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [CHAT_HISTORY_KEY]);

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        const userEmail = 'farmer@example.com'; // Hardcoded user
        if (conversations.length > 0) {
            localStorage.setItem(`${CHAT_HISTORY_KEY}-${userEmail}`, JSON.stringify(conversations));
        } else {
             localStorage.removeItem(`${CHAT_HISTORY_KEY}-${userEmail}`);
        }
    }, [conversations, CHAT_HISTORY_KEY]);


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

                const payload: ProvideChatbotAdvisoryInput = {
                    query: userMessage.text,
                    managementType: managementType,
                    photoDataUri: attachments.image || undefined,
                    documentContent: attachments.document?.content || undefined,
                    history: history,
                    language: language,
                };

                const { advice } = await provideChatbotAdvisory(payload);
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
                />
            </div>
        </div>
    );
}
