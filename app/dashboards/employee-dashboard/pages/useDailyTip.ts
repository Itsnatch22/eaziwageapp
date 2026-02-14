import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface TipData {
  tip: string;
  category: string;
  icon: string;
}

export const useDailyTip = () => {
  const [tip, setTip] = useState<TipData>({
    tip: 'Loading your personalized tip...',
    category: 'general',
    icon: '💡',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generatePersonalizedTip();
  }, []);

  const generatePersonalizedTip = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTip(getGenericTip());
        setLoading(false);
        return;
      }

      // Fetch user's recent activity
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: budget } = await supabase
        .from('user_budgets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: readArticles } = await supabase
        .from('user_article_progress')
        .select('*')
        .eq('user_id', user.id);

      // Generate tip based on user behavior
      const personalizedTip = analyzeBehaviorAndGenerateTip(
        transactions || [],
        budget,
        readArticles || []
      );

      setTip(personalizedTip);
      setLoading(false);
    } catch (error) {
      console.error('Error generating tip:', error);
      setTip(getGenericTip());
      setLoading(false);
    }
  };

  const analyzeBehaviorAndGenerateTip = (
    transactions: any[],
    budget: any,
    readArticles: any[]
  ): TipData => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count advances in last 30 days
    const recentAdvances = transactions.filter(
      (t) => t.type === 'Withdrawal' && new Date(t.created_at) > thirtyDaysAgo
    );

    // Check if user has a budget
    const hasBudget = budget !== null;

    // Check reading streak
    const hasReadRecently = readArticles.some(
      (a) => new Date(a.completed_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    );

    // Analyze spending patterns
    const withdrawalAmounts = recentAdvances.map((t) => t.amount);
    const totalWithdrawn = withdrawalAmounts.reduce((sum, amt) => sum + amt, 0);
    const avgWithdrawal = withdrawalAmounts.length > 0 ? totalWithdrawn / withdrawalAmounts.length : 0;

    // Generate contextual tips
    if (recentAdvances.length >= 5) {
      return {
        tip: `You've accessed your salary ${recentAdvances.length} times this month. Consider the 50/30/20 budgeting rule to reduce dependency on advances.`,
        category: 'budgeting',
        icon: '📊',
      };
    }

    if (!hasBudget) {
      return {
        tip: 'Create a budget plan today! Studies show people who budget save 20% more each month.',
        category: 'planning',
        icon: '🎯',
      };
    }

    if (budget && budget.categories) {
      const needsCategory = budget.categories.find((c: any) => c.category.includes('Needs'));
      if (needsCategory && needsCategory.spent > needsCategory.allocated) {
        return {
          tip: `Your 'Needs' spending is ${((needsCategory.spent / needsCategory.allocated - 1) * 100).toFixed(0)}% over budget. Review your essential expenses.`,
          category: 'spending',
          icon: '⚠️',
        };
      }
    }

    if (!hasReadRecently) {
      return {
        tip: 'Financial literacy increases earning potential by 10%. Read an article in the library today!',
        category: 'education',
        icon: '📚',
      };
    }

    if (avgWithdrawal > 0 && recentAdvances.length > 0) {
      const suggestedBuffer = avgWithdrawal * 1.5;
      return {
        tip: `Your average advance is $${avgWithdrawal.toFixed(0)}. Try building a $${suggestedBuffer.toFixed(0)} emergency buffer.`,
        category: 'savings',
        icon: '🛡️',
      };
    }

    // Positive reinforcement tips
    if (recentAdvances.length <= 2) {
      return {
        tip: "Great job! You're managing your finances well this month. Keep it up! 🎉",
        category: 'achievement',
        icon: '⭐',
      };
    }

    return getGenericTip();
  };

  const getGenericTip = (): TipData => {
    const tips: TipData[] = [
      {
        tip: 'Start small: Saving just $5 a day adds up to $1,825 a year.',
        category: 'savings',
        icon: '💰',
      },
      {
        tip: 'The 24-hour rule: Wait 24 hours before making non-essential purchases over $50.',
        category: 'spending',
        icon: '⏰',
      },
      {
        tip: 'Track your spending for one week to identify where your money actually goes.',
        category: 'awareness',
        icon: '🔍',
      },
      {
        tip: 'Automate your savings! Set aside money before you have a chance to spend it.',
        category: 'automation',
        icon: '🤖',
      },
      {
        tip: 'Build an emergency fund covering 3-6 months of expenses to avoid financial stress.',
        category: 'planning',
        icon: '🛡️',
      },
    ];

    // Return tip based on day of month for consistency
    const dayOfMonth = new Date().getDate();
    return tips[dayOfMonth % tips.length];
  };

  return { tip, loading };
};