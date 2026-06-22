

import { cn } from '../../lib/utils';


interface GradientIconBoxProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}
export const GradientIconBox = ({ icon: Icon, size = 'md', className }: GradientIconBoxProps) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-14 h-14',
    xl: 'w-16 h-16',
  };
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
    xl: 'w-8 h-8',
  };

  return (
    <div className={cn(
      sizes[size],
      "bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-primary/20",
      className
    )}>
      <Icon className={cn(iconSizes[size], "text-white")} />
    </div>
  );
};


interface GradientAvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GradientAvatar = ({ initials, size = 'md', className }: GradientAvatarProps) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  return (
    <div className={cn(
      sizes[size],
      "bg-linear-to-br from-primary to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-primary/20",
      className
    )}>
      <span className="text-white font-bold">{initials}</span>
    </div>
  );
};


interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const GradientButton = ({ children, className, ...props }: GradientButtonProps) => (
  <button 
    className={cn(
      "bg-linear-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90",
      "text-white font-semibold rounded-xl shadow-lg shadow-primary/25",
      "transition-all duration-200 hover:scale-[1.02]",
      className
    )}
    {...props}
  >
    {children}
  </button>
);


export const currencies = [
  { code: 'KES', symbol: 'Ksh', name: 'Kenyan Shilling', country: 'Kenya' },
  { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling', country: 'Uganda' },
  { code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling', country: 'Tanzania' },
  { code: 'RWF', symbol: 'RWF', name: 'Rwandan Franc', country: 'Rwanda' },
];


export const countries = [
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
];

interface CurrencySelectorProps {
    selectedCurrency: string;
    onCurrencyChange: (currencyCode: string) => void;
}

export const CurrencySelector = ({ selectedCurrency, onCurrencyChange }: CurrencySelectorProps) => {
    return (
        <select
            value={selectedCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="bg-linear-to-r from-primary to-emerald-600 text-white font-medium rounded-xl px-3 py-2 shadow-md shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
        >
            {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                    {currency.name} ({currency.symbol})
                </option>
            ))}
        </select>
    );
};


interface FormatCurrencyProps {
    amount: number;
    currencyCode?: string;
}
export const formatCurrencyWithSymbol = ({amount, currencyCode = 'KES'}: FormatCurrencyProps) => {
  const currency = currencies.find(c => c.code === currencyCode) || currencies[0];
  return `${currency.symbol} ${amount?.toLocaleString() || 0}`;
};

