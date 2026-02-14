'use client';

import { useState, useEffect, useMemo } from 'react';
import { Icons } from '@/constants';
import { createClient } from '@/lib/supabase/client';
import BudgetPlanner from './BudgetPlanner';
import ArticlesLibrary from './ArticlesLibrary';
import { useDailyTip } from './useDailyTip';

const supabase = createClient();

interface Article {
  id: string;
  title: string;
  category: string;
  read_time: string;
  image_color: string;
  summary: string;
}

const WellnessTab = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showBudgetPlanner, setShowBudgetPlanner] = useState(false);
  const [showArticlesLibrary, setShowArticlesLibrary] = useState(false);

  const { tip, loading: tipLoading } = useDailyTip();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch articles
    const { data: articlesData } = await supabase
      .from('wellness_articles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    setArticles(articlesData || []);

    if (user) {
      // Fetch read progress
      const { data: progress } = await supabase
        .from('user_article_progress')
        .select('article_id, completed_at')
        .eq('user_id', user.id);

      setReadArticles(progress?.map((p) => p.article_id) || []);

      // Calculate streak
      if (progress && progress.length > 0) {
        const calculatedStreak = calculateStreak(progress.map((p) => p.completed_at));
        setStreak(calculatedStreak);
      }
    }

    setLoading(false);
  };

  const calculateStreak = (completedDates: string[]): number => {
    const dates = completedDates
      .map((d) => new Date(d).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (dates.includes(today) || dates.includes(yesterday)) {
      streak = 1;
      let currentDate = new Date(dates.includes(today) ? today : yesterday);

      for (let i = 1; i < dates.length; i++) {
        const previousDay = new Date(currentDate.getTime() - 86400000).toDateString();
        if (dates[i] === previousDay) {
          streak++;
          currentDate = new Date(previousDay);
        } else {
          break;
        }
      }
    }

    return streak;
  };

  const markAsRead = async (articleId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_article_progress').upsert({
      user_id: user.id,
      article_id: articleId,
      completed_at: new Date().toISOString(),
    });

    setReadArticles([...readArticles, articleId]);
  };

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchTerm, selectedCategory]);

  const categories = ['All', 'Planning', 'Credit', 'Savings', 'Debt', 'Investing', 'Mindset'];

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Hero */}
        <div className="bg-linear-to-br from-emerald-600 to-green-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
            <Icons.BookOpen size={160} />
          </div>
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
            <div className="flex-1">
              <h3 className="text-3xl font-black mb-4">Financial Wellness Hub</h3>
              <p className="text-emerald-100 max-w-lg mb-8">
                Learn how to make your money work harder for you. Exclusive budgeting tools and tips for EaziWage members.
              </p>

              <div className="flex items-center gap-3 text-sm bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 w-fit border border-white/20">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl">
                  🔥
                </div>
                <div>
                  <div className="font-bold text-lg">{streak} day streak</div>
                  <div className="text-emerald-200 text-xs">
                    {streak === 0 ? 'Read an article to start!' : 'Keep learning!'}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:text-right bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 max-w-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{tipLoading ? '💭' : tip.icon}</span>
                <div className="text-xs uppercase tracking-widest font-bold text-emerald-200">
                  TODAY'S TIP
                </div>
              </div>
              <p className="text-base font-medium leading-relaxed">
                {tipLoading ? 'Loading your personalized tip...' : tip.tip}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-8">
            <button
              onClick={() => setShowArticlesLibrary(true)}
              className="px-8 py-4 bg-white text-emerald-700 font-bold rounded-xl shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Icons.BookOpen size={20} />
              Explore Library
            </button>
            <button
              onClick={() => setShowBudgetPlanner(true)}
              className="px-8 py-4 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all flex items-center gap-2 border-2 border-white/20"
            >
              <Icons.PieChart size={20} />
              Open Budget Planner
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                📚
              </div>
              <Icons.TrendingUp className="text-blue-500" size={24} />
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">{readArticles.length}</div>
            <div className="text-sm text-slate-500 font-medium">Articles Read</div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl">
                🔥
              </div>
              <Icons.Zap className="text-emerald-500" size={24} />
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">{streak}</div>
            <div className="text-sm text-slate-500 font-medium">Day Streak</div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl">
                🎯
              </div>
              <Icons.Award className="text-purple-500" size={24} />
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">
              {Math.round((readArticles.length / (articles.length || 1)) * 100)}%
            </div>
            <div className="text-sm text-slate-500 font-medium">Library Completion</div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'bg-white border border-slate-200 hover:border-emerald-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Articles Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-80 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Search size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No articles found</h3>
            <p className="text-slate-500 mb-6">Try adjusting your search or category filter</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
              }}
              className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => {
                const isRead = readArticles.includes(article.id);
                return (
                  <button
                    key={article.id}
                    onClick={() => {
                      if (!isRead) markAsRead(article.id);
                      setShowArticlesLibrary(true);
                    }}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm group hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer text-left"
                  >
                    <div className={`h-40 ${article.image_color} relative`}>
                      <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                      {isRead && (
                        <div className="absolute top-4 right-4 bg-emerald-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                          <Icons.Check size={12} /> READ
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">
                          {article.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {article.read_time}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </h4>
                      {article.summary && (
                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowArticlesLibrary(true)}
                className="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all inline-flex items-center gap-2"
              >
                View All {articles.length} Articles
                <Icons.ArrowRight size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showBudgetPlanner && <BudgetPlanner onClose={() => setShowBudgetPlanner(false)} />}
      {showArticlesLibrary && <ArticlesLibrary onClose={() => setShowArticlesLibrary(false)} />}
    </>
  );
};

export default WellnessTab;