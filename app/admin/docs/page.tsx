'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, Shield, Building2, Users, 
  AlertTriangle, Settings, Wifi, ChevronRight, Search,
  DollarSign, Eye, 
   Clock, TrendingUp, Home, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Documentation structure
const docSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    description: 'New to admin? Start here',
    articles: [
      {
        title: 'Admin Dashboard Overview',
        description: 'Complete guide to the admin dashboard interface and navigation',
        path: '#dashboard-overview',
        difficulty: 'beginner'
      },
      {
        title: 'Understanding Your Role',
        description: 'Admin permissions, responsibilities, and access levels',
        path: '#admin-roles',
        difficulty: 'beginner'
      },
      {
        title: 'Platform Architecture',
        description: 'How EaziWage works under the hood',
        path: '#architecture',
        difficulty: 'intermediate'
      }
    ]
  },
  {
    id: 'employer-management',
    title: 'Employer Management',
    icon: Building2,
    description: 'Manage partner companies',
    articles: [
      {
        title: 'Employer Onboarding Process',
        description: 'Review and approve new employer applications',
        path: '#employer-onboarding',
        difficulty: 'beginner'
      },
      {
        title: 'KYC Verification Guide',
        description: 'Verify employer documents and compliance',
        path: '#kyc-verification',
        difficulty: 'intermediate'
      },
      {
        title: 'Risk Assessment Framework',
        description: 'Understanding employer risk scoring and factors',
        path: '#risk-assessment',
        difficulty: 'advanced'
      },
      {
        title: 'Employer Status Management',
        description: 'Approve, suspend, or reject employer accounts',
        path: '#status-management',
        difficulty: 'beginner'
      }
    ]
  },
  {
    id: 'employee-oversight',
    title: 'Employee Oversight',
    icon: Users,
    description: 'Monitor workforce across all employers',
    articles: [
      {
        title: 'Employee Profile Management',
        description: 'View and manage employee information across organizations',
        path: '#employee-profiles',
        difficulty: 'beginner'
      },
      {
        title: 'Employee KYC Review',
        description: 'Review employee verification documents',
        path: '#employee-kyc',
        difficulty: 'intermediate'
      },
      {
        title: 'Employee Status Controls',
        description: 'Activate, suspend, or terminate employee accounts',
        path: '#employee-status',
        difficulty: 'intermediate'
      }
    ]
  },
  {
    id: 'financial-operations',
    title: 'Financial Operations',
    icon: DollarSign,
    description: 'Manage money flow and compliance',
    articles: [
      {
        title: 'Advance Processing Workflow',
        description: 'From request to disbursement - complete advance lifecycle',
        path: '#advance-workflow',
        difficulty: 'intermediate'
      },
      {
        title: 'Disbursement Management',
        description: 'Approve and process advance payouts',
        path: '#disbursements',
        difficulty: 'beginner'
      },
      {
        title: 'Fee Structure Overview',
        description: 'Understanding platform fees and revenue sharing',
        path: '#fee-structure',
        difficulty: 'intermediate'
      },
      {
        title: 'Financial Reconciliation',
        description: 'Match transactions and resolve discrepancies',
        path: '#reconciliation',
        difficulty: 'advanced'
      },
      {
        title: 'Billing & Revenue Analytics',
        description: 'Track platform revenue and financial performance',
        path: '#billing-analytics',
        difficulty: 'intermediate'
      }
    ]
  },
  {
    id: 'risk-fraud',
    title: 'Risk & Fraud Management',
    icon: Shield,
    description: 'Protect the platform and users',
    articles: [
      {
        title: 'Risk Scoring System',
        description: 'How employer and employee risk scores are calculated',
        path: '#risk-scoring',
        difficulty: 'advanced'
      },
      {
        title: 'Fraud Detection Alerts',
        description: 'Monitor and respond to suspicious activities',
        path: '#fraud-detection',
        difficulty: 'intermediate'
      },
      {
        title: 'Compliance Monitoring',
        description: 'Regulatory compliance and reporting requirements',
        path: '#compliance',
        difficulty: 'advanced'
      },
      {
        title: 'Audit Trail Management',
        description: 'Track all admin actions and system changes',
        path: '#audit-trail',
        difficulty: 'intermediate'
      }
    ]
  },
  {
    id: 'system-administration',
    title: 'System Administration',
    icon: Settings,
    description: 'Platform configuration and maintenance',
    articles: [
      {
        title: 'Global Settings Configuration',
        description: 'Configure platform-wide rules and limits',
        path: '#global-settings',
        difficulty: 'advanced'
      },
      {
        title: 'API Health Monitoring',
        description: 'Monitor system performance and uptime',
        path: '#api-health',
        difficulty: 'intermediate'
      },
      {
        title: 'User Access Management',
        description: 'Manage admin accounts and permissions',
        path: '#access-management',
        difficulty: 'advanced'
      },
      {
        title: 'System Maintenance',
        description: 'Scheduled maintenance and updates',
        path: '#maintenance',
        difficulty: 'advanced'
      }
    ]
  },
  {
    id: 'notifications-communication',
    title: 'Notifications & Communication',
    icon: Bell,
    description: 'Stay informed and coordinate',
    articles: [
      {
        title: 'Admin Notifications',
        description: 'Understanding and managing admin alerts',
        path: '#notifications',
        difficulty: 'beginner'
      },
      {
        title: 'Communication Channels',
        description: 'Internal chat and support systems',
        path: '#communication',
        difficulty: 'beginner'
      },
      {
        title: 'Alert Configuration',
        description: 'Set up custom alerts and automations',
        path: '#alert-config',
        difficulty: 'intermediate'
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: AlertTriangle,
    description: 'Common issues and solutions',
    articles: [
      {
        title: 'Common Login Issues',
        description: 'Resolve authentication and access problems',
        path: '#login-issues',
        difficulty: 'beginner'
      },
      {
        title: 'Data Sync Problems',
        description: 'Fix database synchronization issues',
        path: '#sync-issues',
        difficulty: 'intermediate'
      },
      {
        title: 'Performance Optimization',
        description: 'Improve dashboard loading and responsiveness',
        path: '#performance',
        difficulty: 'advanced'
      },
      {
        title: 'Emergency Procedures',
        description: 'Critical issues and escalation protocols',
        path: '#emergency',
        difficulty: 'advanced'
      }
    ]
  }
];

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
};

export default function AdminDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  const filteredSections = docSections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.articles.length > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Documentation</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Complete guide to managing the EaziWage platform
          </p>
        </div>
        <Link 
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {docSections.reduce((acc, section) => acc + section.articles.length, 0)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Articles</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">8</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Categories</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">3</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Difficulty Levels</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">24/7</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Sections */}
      <div className="space-y-6">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;
          
          return (
            <div key={section.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {section.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {section.description} ({section.articles.length} articles)
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 text-slate-400 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </button>
              
              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {section.articles.map((article, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {article.title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {article.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              difficultyColors[article.difficulty as keyof typeof difficultyColors]
                            )}>
                              {article.difficulty}
                            </span>
                          </div>
                        </div>
                        <button className="flex-shrink-0 p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl p-6 border border-green-200 dark:border-green-700/30">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Links</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/admin" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Home className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Admin Dashboard</span>
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Settings className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform Settings</span>
          </Link>
          <Link href="/admin/api-health" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-shadow">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">System Health</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
