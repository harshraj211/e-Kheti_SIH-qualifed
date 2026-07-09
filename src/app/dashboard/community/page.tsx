
'use client';

import { useState, useEffect } from 'react';
import { CreatePostForm, Post, Comment } from '@/components/dashboard/community/CreatePostForm';
import { PostCard } from '@/components/dashboard/community/PostCard';
import { useTranslation } from '@/hooks/useTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cropData, fruitData } from '@/lib/item-data';
import { useMemo } from 'react';

const COMMUNITY_POSTS_KEY = 'agriVision-communityPosts';

const hydratePosts = (rawPosts: Post[]): Post[] =>
    rawPosts.map((post: Post) => ({
        ...post,
        timestamp: new Date(post.timestamp),
        comments: (post.comments || []).map((comment: Comment) => ({
            ...comment,
            timestamp: new Date(comment.timestamp),
        })),
    }));

export default function CommunityPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const { t } = useTranslation();
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const storedPosts = localStorage.getItem(COMMUNITY_POSTS_KEY);
        if (storedPosts) {
            setPosts(hydratePosts(JSON.parse(storedPosts)));
        } else {
            // Add some dummy posts if none exist
            const dummyPosts: Post[] = [
                {
                    id: '1',
                    userId: 'farmer-jane@example.com',
                    userName: 'Jane Doe',
                    type: 'crop',
                    cropOrFruitName: 'Wheat',
                    content: 'My wheat leaves are turning yellow. I have already applied fertilizer. What could be the issue?',
                    imageUrl: 'https://picsum.photos/seed/wheat/600/400',
                    timestamp: new Date(Date.now() - 86400000), // 1 day ago
                    likes: 12,
                    comments: [
                        { id: 'c1', userId: 'expert-agri@example.com', userName: 'AgriExpert', comment: 'It could be a nitrogen deficiency or a fungal infection like rust. Can you share a closer image of the leaves?', timestamp: new Date(Date.now() - 72000000) }
                    ]
                },
                 {
                    id: '2',
                    userId: 'farmer-john@example.com',
                    userName: 'John Smith',
                    type: 'fruit',
                    cropOrFruitName: 'Mango',
                    content: 'What is the best time to harvest mangoes for maximum sweetness? I am growing the "Alphonso" variety.',
                    imageUrl: 'https://picsum.photos/seed/mango/600/400',
                    timestamp: new Date(Date.now() - 172800000), // 2 days ago
                    likes: 25,
                    comments: []
                }
            ];
            setPosts(dummyPosts);
            localStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(dummyPosts));
        }
    }, []);

    const savePosts = (newPosts: Post[]) => {
        setPosts(newPosts);
        localStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(newPosts));
    }

    const handleCreatePost = (content: string, cropOrFruitName: string, type: 'crop' | 'fruit', imageUrl?: string) => {
        const newPost: Post = {
            id: Date.now().toString(),
            userId: 'farmer@example.com',
            userName: 'Pro Farmer',
            type: type,
            cropOrFruitName: cropOrFruitName,
            content,
            imageUrl: imageUrl || `https://picsum.photos/seed/${cropOrFruitName}/600/400`,
            timestamp: new Date(),
            likes: 0,
            comments: []
        };
        savePosts([newPost, ...posts]);
    };

    const handleLike = (postId: string) => {
        const newPosts = posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p);
        savePosts(newPosts);
    }

    const handleAddComment = (postId: string, commentText: string) => {
        const newComment: Comment = {
            id: Date.now().toString(),
            userId: 'farmer@example.com',
            userName: 'Pro Farmer',
            comment: commentText,
            timestamp: new Date(),
        };
        const newPosts = posts.map(p => 
            p.id === postId 
                ? { ...p, comments: [...p.comments, newComment] } 
                : p
        );
        savePosts(newPosts);
    }
    
    const allItems = useMemo(() => {
        const crops = Object.values(cropData).map(crop => ({ value: crop.name, label: crop.name }));
        const fruits = Object.values(fruitData).map(fruit => ({ value: fruit.name, label: fruit.name }));
        return [{value: 'all', label: 'All Posts'}, {value: 'crops', label: 'All Crops'}, {value: 'fruits', label: 'All Fruits'}, ...crops, ...fruits].sort((a,b) => a.label.localeCompare(b.label));
    }, []);

    const filteredPosts = useMemo(() => {
        const sortedPosts = [...posts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (filter === 'all') return sortedPosts;
        if (filter === 'crops') return sortedPosts.filter(p => p.type === 'crop');
        if (filter === 'fruits') return sortedPosts.filter(p => p.type === 'fruit');
        return sortedPosts.filter(p => p.cropOrFruitName === filter);
    }, [posts, filter]);


    return (
        <main>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">Community Forum</h1>
                    <p className="text-muted-foreground">
                        Connect with other farmers, ask questions, and share your experiences.
                    </p>
                </div>
                 <Select onValueChange={setFilter} value={filter}>
                    <SelectTrigger className="w-full md:w-[280px]">
                        <SelectValue placeholder="Filter posts..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allItems.map(item => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {filteredPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post}
                            onLike={handleLike}
                            onAddComment={handleAddComment}
                        />
                    ))}
                     {filteredPosts.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            <p>No posts found for this filter.</p>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-1 sticky top-20">
                    <CreatePostForm onSubmit={handleCreatePost} />
                </div>
            </div>
        </main>
    );
}
