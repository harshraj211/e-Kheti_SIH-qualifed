
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTransition } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

// This becomes generic, not tied to the page component
export type Transaction = {
  id: string;
  itemId?: string;
  cropId?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: Date;
  description: string;
  currency: 'INR' | 'USD' | 'EUR';
};

const formSchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: "You need to select a transaction type."}),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  currency: z.enum(['INR', 'USD', 'EUR']),
  category: z.string().min(2, 'Category is required.'),
  date: z.date({
    required_error: "A date is required.",
  }),
  description: z.string().optional(),
});

type AddTransactionFormProps = {
    onSubmit: (data: Omit<Transaction, 'id' | 'itemId' | 'cropId'>) => void;
    disabled?: boolean;
}

export function AddTransactionForm({ onSubmit, disabled = false }: AddTransactionFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      amount: 0,
      currency: 'INR',
      category: '',
      date: new Date(),
      description: ''
    },
  });

  function handleFormSubmit(values: z.infer<typeof formSchema>) {
    startTransition(() => {
        onSubmit({
            ...values,
            description: values.description ?? '',
        });
        toast({
            title: t('expenseTrackerPage.addTransaction.toastSuccessTitle'),
            description: t('expenseTrackerPage.addTransaction.toastSuccessDescription', {type: values.type, amount: values.amount, currency: values.currency})
        });
        form.reset();
        form.setValue('currency', 'INR');
        form.setValue('date', new Date());
        form.setValue('type', 'expense');
    });
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>{t('expenseTrackerPage.addTransaction.title')}</CardTitle>
            <CardDescription>{t('expenseTrackerPage.addTransaction.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            <fieldset disabled={disabled || isPending} className="disabled:opacity-75">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>{t('expenseTrackerPage.addTransaction.typeLabel')}</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex space-x-4"
                                    >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="expense" />
                                        </FormControl>
                                        <FormLabel className="font-normal">{t('expenseTrackerPage.addTransaction.expense')}</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="income" />
                                        </FormControl>
                                        <FormLabel className="font-normal">{t('expenseTrackerPage.addTransaction.income')}</FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>{t('expenseTrackerPage.addTransaction.amountLabel')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder={t('expenseTrackerPage.addTransaction.amountPlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <FormItem className="w-1/3">
                                    <FormLabel>{t('expenseTrackerPage.addTransaction.currencyLabel')}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('expenseTrackerPage.addTransaction.currencyPlaceholder')} />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="INR">₹ (INR)</SelectItem>
                                        <SelectItem value="USD">$ (USD)</SelectItem>
                                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('expenseTrackerPage.addTransaction.categoryLabel')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('expenseTrackerPage.addTransaction.categoryPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>{t('expenseTrackerPage.addTransaction.dateLabel')}</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>{t('expenseTrackerPage.addTransaction.datePlaceholder')}</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('expenseTrackerPage.addTransaction.descriptionLabel')}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={t('expenseTrackerPage.addTransaction.descriptionPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full">
                            {isPending ? t('expenseTrackerPage.addTransaction.submitting') : t('expenseTrackerPage.addTransaction.submit')}
                        </Button>
                    </form>
                </Form>
            </fieldset>
        </CardContent>
    </Card>
  );
}
