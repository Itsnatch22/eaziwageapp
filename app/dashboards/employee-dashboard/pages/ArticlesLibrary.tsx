'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/constants';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  read_time: string;
  image_color: string;
  author: string;
  created_at: string;
  url?: string;
}

interface ArticlesLibraryProps {
  onClose: () => void;
  preselectedCategory?: string;
}

const ArticlesLibrary: React.FC<ArticlesLibraryProps> = ({ onClose, preselectedCategory }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(preselectedCategory || 'All');
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'Planning', 'Credit', 'Savings', 'Debt', 'Investing', 'Mindset'];

  useEffect(() => {
    fetchArticles();
    fetchReadProgress();
  }, []);

  useEffect(() => {
    filterArticles();
  }, [articles, searchTerm, selectedCategory]);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('wellness_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setArticles(data);
    }
    setLoading(false);
  };

  const fetchReadProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_article_progress')
      .select('article_id')
      .eq('user_id', user.id);

    if (data) {
      setReadArticles(data.map((p) => p.article_id));
    }
  };

  const filterArticles = () => {
    let filtered = articles;

    if (searchTerm) {
      filtered = filtered.filter((article) =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((article) => article.category === selectedCategory);
    }

    setFilteredArticles(filtered);
  };

  const markAsRead = async (articleId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_article_progress')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        completed_at: new Date().toISOString(),
      });

    if (!error) {
      setReadArticles([...readArticles, articleId]);
    }
  };

  const openArticle = (article: Article) => {
    setSelectedArticle(article);
    if (!readArticles.includes(article.id)) {
      markAsRead(article.id);
    }
  };

  if (selectedArticle) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                  {selectedArticle.category}
                </span>
                <span className="text-xs text-slate-500">{selectedArticle.read_time}</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">{selectedArticle.author}</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight">{selectedArticle.title}</h2>
            </div>
            <button
              onClick={() => setSelectedArticle(null)}
              className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors ml-4"
            >
              <Icons.X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className={`w-full h-64 ${selectedArticle.image_color} rounded-2xl mb-8 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
            </div>

            <div className="prose prose-slate max-w-none">
              <div className="text-lg leading-relaxed whitespace-pre-wrap text-slate-700">
                {selectedArticle.content}
              </div>
            </div>

            <div className="mt-12 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-2xl">
                  💡
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Key Takeaway</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedArticle.summary}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-6 bg-slate-50">
            <button
              onClick={() => setSelectedArticle(null)}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
            >
              Back to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Articles Library</h2>
            <p className="text-sm text-slate-500 mt-1">
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="border-b border-slate-200 p-6 space-y-4">
          <div className="relative">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search articles by title, summary, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-slate-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Search size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No articles found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => {
                const isRead = readArticles.includes(article.id);
                return (
                  <button
                    key={article.id}
                    onClick={() => openArticle(article)}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all cursor-pointer text-left group"
                  >
                    <div className={`h-40 ${article.image_color} relative`}>
                      <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                      {isRead && (
                        <div className="absolute top-4 right-4 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1">
                          <Icons.Check size={12} /> READ
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 right-4">
                        <h4 className="font-bold text-white text-lg line-clamp-2 drop-shadow-lg">
                          {article.title}
                        </h4>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">
                          {article.category}
                        </span>
                        <span className="text-xs text-slate-500">{article.read_time}</span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticlesLibrary;