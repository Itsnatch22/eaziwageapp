"use client";

import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ExportButtonProps {
  data: any[];
  filename: string;
  headers: string[];
  mapping: (item: any) => (string | number)[];
  title?: string;
}

export function ExportButton({ data, filename, headers, mapping, title = 'Export' }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!data.length) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      if (format === 'csv') {
        const rows = [headers, ...data.map(mapping)];
        const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // PDF Export - Using a simple approach for now
        toast.info('Generating PDF document...');
        const rows = [headers, ...data.map(mapping)];
        const text = rows.map(r => r.join(' | ')).join('\n');
        const blob = new Blob([text], { type: 'text/plain' }); // Fallback to plain text if buildSimplePdf is server-only
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${filename}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="rounded-xl border-slate-200 dark:border-slate-800 gap-2 font-bold uppercase tracking-widest text-[10px]"
          disabled={exporting}
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {title}
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl border-slate-200 dark:border-slate-800 p-2">
        <DropdownMenuItem 
          onClick={() => handleExport('csv')}
          className="rounded-xl gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">Export CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('pdf')}
          className="rounded-xl gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-blue-500" />
          <span className="font-medium">Export PDF (Text)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
