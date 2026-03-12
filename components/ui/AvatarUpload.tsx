'use client';

import React, { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface AvatarUploadProps {
  userId: string | undefined;
  currentAvatarUrl?: string | null;
  fullName?: string | null;
  onUploadSuccess?: (url: string) => void;
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  fullName,
  onUploadSuccess,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const initials = (fullName || 'User')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 1. Create a local preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 4. Update Profile in Database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      toast.success('Profile picture updated successfully');
      if (onUploadSuccess) {
        onUploadSuccess(publicUrl);
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-800 shadow-xl">
          <AvatarImage src={previewUrl || currentAvatarUrl || undefined} alt={fullName || 'User'} />
          <AvatarFallback className="bg-linear-to-br from-primary to-emerald-600 text-white text-2xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        
        <button
          onClick={triggerFileInput}
          disabled={uploading}
          className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          title="Change profile picture"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-white">Profile Picture</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          JPG, GIF or PNG. Max size of 2MB
        </p>
      </div>
    </div>
  );
}
