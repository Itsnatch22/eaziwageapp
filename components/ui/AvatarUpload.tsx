'use client';

import React, { useState, useRef } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { updateUserAvatar } from '@/lib/stores/auth';
import { toast } from 'sonner';

interface AvatarUploadProps {
  userId?: string;
  currentAvatarUrl?: string | null;
  onUploadSuccess?: (url: string) => void;
  fullName?: string | null;
}

export function AvatarUpload({ 
  userId, 
  currentAvatarUrl, 
  onUploadSuccess,
  fullName 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!userId) {
        toast.error('User ID is missing');
        return;
      }


      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }


      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }

      setUploading(true);


      const fileExt = file.name.split('.').pop();
      // Must be stored under a folder named after userId to satisfy RLS foldername() policy
      const filePath = `${userId}/avatar.${fileExt}`;


      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload image');
      }


      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);


      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;


      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: cacheBustedUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error('Failed to update profile');
      }


      updateUserAvatar(cacheBustedUrl);


      if (onUploadSuccess) {
        onUploadSuccess(cacheBustedUrl);
      }

      toast.success('Profile picture updated');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="relative group">
      <Avatar className="w-24 h-24 border-2 border-slate-200 dark:border-slate-800">
        <AvatarImage src={currentAvatarUrl || undefined} />
        <AvatarFallback className="text-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
          {fullName ? initials : <User className="w-8 h-8" />}
        </AvatarFallback>
      </Avatar>

      <div 
        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Camera className="w-6 h-6 text-white" />
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      
      {uploading && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm border border-slate-200 dark:border-slate-800">
          Uploading...
        </div>
      )}
    </div>
  );
}
