
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelect } from '@/components/ui/multi-select';
import { getMarketPrices, type GetMarketPricesOutput } from '@/ai/flows/get-market-prices';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type MarketPrice = GetMarketPricesOutput['prices'][0];
type ChartDatum = {
    date: string;
    [crop: string]: string | number | undefined;
};

const cropOptions = [
    { value: 'Wheat', label: 'Wheat' },
    { value: 'Paddy', label: 'Paddy' },
    { value: 'Cotton', label: 'Cotton' },
    { value: 'Maize', label: 'Maize' },
    { value: 'Sugarcane', label: 'Sugarcane' },
    { value: 'Potato', label: 'Potato' },
    { value: 'Tomato', label: 'Tomato' },
    { value: 'Onion', label: 'Onion' },
    { value: 'Mustard', label: 'Mustard' },
    { value: 'Soybean', label: 'Soybean' },
].sort((a, b) => a.label.localeCompare(b.label));

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#00c49f", "#ffbb28", "#ff8042"];

// Helper to parse dd/mm/yyyy dates
const parseDate = (dateString: string) => {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    }
    return new Date(dateString).getTime();
};


export function HistoricalPriceChart({ location }: { location: string }) {
    const [selectedCrops, setSelectedCrops] = useState<string[]>(['Wheat', 'Paddy']);
    const [chartData, setChartData] = useState<ChartDatum[]>([]);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (selectedCrops.length === 0 || !location) return;

        const fetchAllCropData = async () => {
            setError(null);
            startTransition(async () => {
                try {
                    const allPricesPromises = selectedCrops.map(crop => getMarketPrices({ location, crop }));
                    const allPricesResponses = await Promise.all(allPricesPromises);
                    
                    const processedData: Record<string, ChartDatum> = {};
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

                    allPricesResponses.forEach((response, index) => {
                        const cropName = selectedCrops[index];
                        response.prices.forEach(price => {
                            const arrivalDate = new Date(parseDate(price.arrivalDate));
                            if (arrivalDate >= oneMonthAgo) {
                                const dateStr = arrivalDate.toISOString().split('T')[0];
                                if (!processedData[dateStr]) {
                                    processedData[dateStr] = { date: dateStr };
                                }
                                // Average if multiple prices for same day, though unlikely with this data structure
                                if (!processedData[dateStr][cropName]) {
                                    processedData[dateStr][cropName] = price.modalPrice;
                                }
                            }
                        });
                    });
                    
                    const finalChartData = Object.values(processedData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    setChartData(finalChartData);

                } catch (e) {
                    console.error(e);
                    setError('Failed to fetch historical price data. Please try again.');
                    setChartData([]);
                }
            });
        };

        fetchAllCropData();
    }, [selectedCrops, location]);
    
    const chartConfig = useMemo(() => {
        const config: any = {};
        selectedCrops.forEach((crop, index) => {
            config[crop] = {
                label: crop,
                color: COLORS[index % COLORS.length],
            };
        });
        return config;
    }, [selectedCrops]);


    return (
        <Card>
            <CardHeader>
                <CardTitle>Historical Price Trends in {location}</CardTitle>
                <CardDescription>Compare modal prices (₹ per Quintal) for different crops over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-1 block">Select Crops to Compare</label>
                    <MultiSelect
                        options={cropOptions}
                        value={selectedCrops}
                        onChange={setSelectedCrops}
                        placeholder="Select up to 8 crops..."
                        className="w-full"
                    />
                </div>
                <div className="h-[400px] w-full">
                    {isPending ? (
                        <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                         <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : chartData.length > 0 ? (
                        <ChartContainer config={chartConfig}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(str) => new Date(str).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                                        angle={-45}
                                        textAnchor='end'
                                        height={60}
                                    />
                                    <YAxis 
                                        tickFormatter={(value) => `₹${value}`}
                                        width={80}
                                    />
                                    <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                                    <Legend />
                                    {selectedCrops.map((crop, index) => (
                                        <Line 
                                            key={crop}
                                            type="monotone" 
                                            dataKey={crop} 
                                            stroke={COLORS[index % COLORS.length]} 
                                            strokeWidth={2}
                                            dot={false}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <p>No data to display for the last 30 days. Select crops and a location to see the chart.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
