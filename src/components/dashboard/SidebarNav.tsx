'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/Logo';
import { BotMessageSquare, LayoutDashboard, Leaf, TrendingUp, Wallet, Bell, CalendarDays, Newspaper, Home, Calculator, Users, Sun, Mic, BarChart, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect, useState } from 'react';

type MenuItem = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  isGeneric?: boolean; // Flag for pages that are not type-specific
}

const baseMenuItems: Omit<MenuItem, 'href'>[] = [
  { labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { labelKey: 'sidebar.marketPrices', icon: TrendingUp, isGeneric: true },
  { labelKey: 'sidebar.khetiSamachar', icon: Newspaper, isGeneric: true },
  { labelKey: 'sidebar.communityForum', icon: Users, isGeneric: true },
  { labelKey: 'sidebar.weather', icon: Sun, isGeneric: true },
  { labelKey: 'sidebar.voiceAssistant', icon: Mic, isGeneric: true },
  { labelKey: 'sidebar.cropSimulation', icon: BarChart, isGeneric: true },
  { labelKey: 'sidebar.expenseTracker', icon: Wallet },
  { labelKey: 'sidebar.diseaseDetection', icon: Leaf },
  { labelKey: 'sidebar.chatbot', icon: BotMessageSquare },
  { labelKey: 'sidebar.cropCalendar', icon: CalendarDays },
  { labelKey: 'sidebar.calculators', icon: Calculator },
  { labelKey: 'sidebar.notifications', icon: Bell },
];

export function SidebarNav({ managementType }: { managementType: 'crops' | 'fruits' | 'default' }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLinkClick = () => {
    setOpenMobile(false);
  };
  
  const filteredMenuItems = baseMenuItems.filter(item => {
    if (!isClient) return false; // Render nothing on the server for dynamic items
    // Hide non-generic items on the main dashboard selection screen
    if (managementType === 'default' && !item.isGeneric) {
       return false;
    }
    // Hide market prices for fruits
    if (managementType === 'fruits' && (item.labelKey === 'sidebar.marketPrices' || item.labelKey === 'sidebar.cropSimulation')) {
        return false;
    }
    return true;
  });

  const menuItems: MenuItem[] = filteredMenuItems.map(item => {
    const isCalendar = item.labelKey === 'sidebar.cropCalendar';
    let labelKey = item.labelKey;
    let pageSlug = labelKey.split('.')[1].replace(/([A-Z])/g, '-$1').toLowerCase();

    if (isCalendar) {
        labelKey = managementType === 'fruits' ? 'sidebar.fruitCalendar' : 'sidebar.cropCalendar';
        pageSlug = managementType === 'fruits' ? 'fruit-calendar' : 'crop-calendar';
    }

    let href = '';
    
    if (item.isGeneric) {
        href = `/dashboard/${pageSlug}`;
    } else {
        if (pageSlug === 'dashboard') {
            href = `/dashboard/${managementType}`;
        } else {
            href = `/dashboard/${managementType}/${pageSlug}`;
        }
    }


    return {
      ...item,
      href,
      labelKey,
    };
  }).filter(item => item.href);


  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                onClick={handleLinkClick}
                tooltip={t('sidebar.backToSelection')}
                isActive={isClient && pathname === '/dashboard'}
              >
                <Link href="/dashboard">
                  <Home />
                  <span>{t('sidebar.home')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild onClick={handleLinkClick} tooltip="Farm Profile" isActive={isClient && pathname === '/dashboard/farm-profile'}>
                <Link href="/dashboard/farm-profile">
                  <UserRound />
                  <span>Farm Profile</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                    asChild
                    onClick={handleLinkClick}
                    tooltip={t(item.labelKey)}
                    isActive={isClient && pathname.startsWith(item.href) && (item.href !== `/dashboard/${managementType}` || pathname === `/dashboard/${managementType}`)}
                >
                    <Link href={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
