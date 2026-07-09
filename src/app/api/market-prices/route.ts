import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketPricesFromApi } from '@/lib/market-prices';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || '';
  const crop = searchParams.get('crop') || 'All';

  try {
    const result = await fetchMarketPricesFromApi({ location, crop });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch market prices.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
