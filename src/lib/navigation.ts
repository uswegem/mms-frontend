import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Percent,
  QrCode,
  Receipt,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  muted?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Executive Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Merchants',
    items: [
      {
        id: 'merchants',
        label: 'Merchant Management',
        href: '/merchants',
        icon: Building2,
        permission: 'merchant:read',
      },
      {
        id: 'onboarding',
        label: 'Merchant Onboarding',
        href: '/onboarding',
        icon: ClipboardCheck,
        permission: 'onboarding:read',
      },
      {
        id: 'approvals',
        label: 'Checker Inbox',
        href: '/approvals',
        icon: Shield,
        permission: 'approval:task:read',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        id: 'users',
        label: 'User Management',
        href: '/users',
        icon: Users,
        permission: 'user:read',
      },
      {
        id: 'roles',
        label: 'Roles & Permissions',
        href: '/roles',
        icon: Shield,
        permission: 'authz:role:read',
      },
      {
        id: 'fees',
        label: 'Fees & MDR',
        href: '/fees',
        icon: Percent,
        permission: 'fee-schedule:read',
      },
      {
        id: 'maker-checker',
        label: 'Maker-checker Activities',
        href: '/maker-checker',
        icon: ShieldCheck,
        permission: 'config:write',
      },
    ],
  },
  {
    label: 'Coming Soon',
    muted: true,
    items: [
      {
        id: 'qr',
        label: 'QR Management',
        href: '/qr',
        icon: QrCode,
        permission: 'merchant:read',
        badge: 'Soon',
      },
      {
        id: 'transactions',
        label: 'Transactions',
        href: '/transactions',
        icon: Receipt,
        permission: 'merchant:read',
        badge: 'Soon',
      },
      {
        id: 'settlements',
        label: 'Settlements',
        href: '/settlements',
        icon: Wallet,
        permission: 'merchant:read',
        badge: 'Soon',
      },
      {
        id: 'reconciliation',
        label: 'Reconciliation',
        href: '/reconciliation',
        icon: Scale,
        permission: 'merchant:read',
        badge: 'Soon',
      },
      {
        id: 'reports',
        label: 'Reports & Analytics',
        href: '/reports',
        icon: BarChart3,
        permission: 'merchant:read',
        badge: 'Soon',
      },
      {
        id: 'audit',
        label: 'Audit Logs',
        href: '/audit',
        icon: FileText,
        permission: 'user:read',
        badge: 'Soon',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        permission: 'user:read',
        badge: 'Soon',
      },
      {
        id: 'configuration',
        label: 'Configuration',
        href: '/configuration',
        icon: Settings,
        permission: 'user:read',
        badge: 'Soon',
      },
      {
        id: 'monitoring',
        label: 'System Monitoring',
        href: '/monitoring',
        icon: Activity,
        permission: 'user:read',
        badge: 'Soon',
      },
    ],
  },
];

export function filterNavByPermissions(
  sections: NavSection[],
  permissions: string[] = [],
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || permissions.includes(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Home', href: '/dashboard' },
  ];

  const map: Record<string, string> = {
    '/dashboard': 'Executive Dashboard',
    '/merchants': 'Merchant Management',
    '/onboarding': 'Merchant Onboarding',
    '/approvals': 'Checker Inbox',
    '/qr': 'QR Management',
    '/transactions': 'Transactions',
    '/settlements': 'Settlements',
    '/reconciliation': 'Reconciliation',
    '/reports': 'Reports & Analytics',
    '/users': 'User Management',
    '/roles': 'Roles & Permissions',
    '/fees': 'Fees & MDR',
    '/maker-checker': 'Maker-checker Activities',
    '/audit': 'Audit Logs',
    '/notifications': 'Notifications',
    '/configuration': 'Configuration',
    '/monitoring': 'System Monitoring',
  };

  if (pathname.startsWith('/merchants/') && pathname !== '/merchants') {
    crumbs.push({ label: 'Merchant Management', href: '/merchants' });
    crumbs.push({ label: 'Merchant Details' });
    return crumbs;
  }

  const label = map[pathname];
  if (label) crumbs.push({ label });
  return crumbs;
}
