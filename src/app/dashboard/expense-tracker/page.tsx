'use client';

import { AddTransactionForm } from '@/components/dashboard/expense-tracker/AddTransactionForm';
import { ExpenseSummary } from '@/components/dashboard/expense-tracker/ExpenseSummary';
import { TransactionList } from '@/components/dashboard/expense-tracker/TransactionList';
import { generateExpenseReportPDF } from '@/lib/pdf-generator';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export type Transaction = {
  id: string;
  cropId: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: Date;
  description: string;
  currency: 'INR' | 'USD' | 'EUR';
};

export type Crop = {
    id: string;
    name: string;
}

const CROPS_STORAGE_KEY = 'agriVision-crops';
const TRANSACTIONS_STORAGE_KEY = 'agriVision-transactions';


export default function ExpenseTrackerPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [crops, setCrops] = useState<Crop[]>([]);
    const [activeCropId, setActiveCropId] = useState<string | null>(null);
    const [newCropName, setNewCropName] = useState('');
    const { user } = useAuth();
    const { t } = useTranslation();
    const { toast } = useToast();

    // Load data from localStorage on mount
    useEffect(() => {
        const storedCrops = localStorage.getItem(CROPS_STORAGE_KEY);
        if (storedCrops) {
            const loadedCrops: Crop[] = JSON.parse(storedCrops);
            setCrops(loadedCrops);
            if(loadedCrops.length > 0 && !activeCropId) {
                setActiveCropId(loadedCrops[0].id);
            }
        }

        const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
        if(storedTransactions) {
            setTransactions(JSON.parse(storedTransactions).map((t: Transaction) => ({...t, date: new Date(t.date)})));
        }
    }, [activeCropId]);

    const saveCrops = (newCrops: Crop[]) => {
        setCrops(newCrops);
        localStorage.setItem(CROPS_STORAGE_KEY, JSON.stringify(newCrops));
    }

    const saveTransactions = (newTransactions: Transaction[]) => {
        setTransactions(newTransactions);
        localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(newTransactions));
    }

    const handleAddCrop = () => {
        if(!newCropName.trim()){
            toast({ variant: 'destructive', title: 'Crop name cannot be empty.'});
            return;
        }
        const newCrop: Crop = { id: Date.now().toString(), name: newCropName.trim() };
        const updatedCrops = [...crops, newCrop];
        saveCrops(updatedCrops);
        setActiveCropId(newCrop.id);
        setNewCropName('');
        toast({ title: `Crop tracker "${newCrop.name}" created.` });
    }

    const handleDeleteCrop = (cropIdToDelete: string) => {
        const cropToDelete = crops.find(c => c.id === cropIdToDelete);
        if (!cropToDelete) return;

        // Filter out the crop and its transactions
        const updatedCrops = crops.filter(c => c.id !== cropIdToDelete);
        const updatedTransactions = transactions.filter(t => t.cropId !== cropIdToDelete);

        saveCrops(updatedCrops);
        saveTransactions(updatedTransactions);

        // If the deleted crop was the active one, switch to another or to null
        if (activeCropId === cropIdToDelete) {
            setActiveCropId(updatedCrops.length > 0 ? updatedCrops[0].id : null);
        }

        toast({ title: `Crop tracker "${cropToDelete.name}" deleted.`});
    }

    const handleAddTransaction = (transaction: Omit<Transaction, 'id' | 'cropId'>) => {
        if (!activeCropId) {
            toast({ variant: 'destructive', title: 'Please select a crop first.' });
            return;
        }
        const newTransaction: Transaction = {
            id: new Date().toISOString(),
            cropId: activeCropId,
            ...transaction
        };
        saveTransactions([newTransaction, ...transactions]);
    }

    const handleDeleteTransaction = (id: string) => {
        saveTransactions(transactions.filter(t => t.id !== id));
    }
    
    const handleExport = () => {
        if (user && activeCrop) {
            generateExpenseReportPDF(filteredTransactions, `${user.displayName} - ${activeCrop.name}`);
        }
    }

    const activeCrop = useMemo(() => crops.find(c => c.id === activeCropId), [crops, activeCropId]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => t.cropId === activeCropId);
    }, [transactions, activeCropId]);

  return (
    <main>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold">{t('expenseTrackerPage.title')}</h1>
            <p className="text-muted-foreground">
            {t('expenseTrackerPage.description')}
            </p>
        </div>
        <div className="flex items-center gap-4">
             {crops.length > 0 && (
                <Select onValueChange={setActiveCropId} value={activeCropId || ''}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select a crop tracker" />
                    </SelectTrigger>
                    <SelectContent>
                        {crops.map(crop => (
                            <SelectItem key={crop.id} value={crop.id}>{crop.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             )}
            <Button onClick={handleExport} disabled={filteredTransactions.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                {t('expenseTrackerPage.exportPdf')}
            </Button>
        </div>
      </div>

       {crops.length === 0 ? (
         <Card className="max-w-xl mx-auto my-16 text-center p-8">
            <CardHeader>
                <CardTitle>Create Your First Crop Tracker</CardTitle>
                <CardDescription>To start tracking expenses, you need to add a crop first. For example, "Wheat Field 1" or "Summer Vegetables".</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex items-center gap-2 max-w-sm mx-auto">
                    <Input 
                        placeholder="e.g., Wheat - Field A"
                        value={newCropName}
                        onChange={(e) => setNewCropName(e.target.value)}
                    />
                    <Button onClick={handleAddCrop} size="icon">
                        <PlusCircle />
                    </Button>
                </div>
            </CardContent>
         </Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <TransactionList 
                        transactions={filteredTransactions} 
                        onDeleteTransaction={handleDeleteTransaction} 
                        itemName={activeCrop?.name || ''}
                    />
                </div>
                <div className="lg:col-span-1 space-y-6 sticky top-20">
                    <AddTransactionForm onSubmit={handleAddTransaction} disabled={!activeCropId} />
                    <ExpenseSummary transactions={filteredTransactions} />
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Crop Trackers</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-2">
                                <Input 
                                    placeholder="Add new crop tracker..."
                                    value={newCropName}
                                    onChange={(e) => setNewCropName(e.target.value)}
                                />
                                <Button onClick={handleAddCrop} size="icon">
                                    <PlusCircle />
                                </Button>
                            </div>
                             <div className="mt-4 space-y-2">
                                {crops.map(crop => (
                                    <div key={crop.id} className="text-sm p-2 rounded-md bg-secondary flex justify-between items-center">
                                        <span>{crop.name}</span>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the crop tracker for "{crop.name}" and all its associated income and expense records. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteCrop(crop.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}
    </main>
  );
}
