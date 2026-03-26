'use client';

import React, { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateUserAvatar } from '@/lib/stores/auth';
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
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      console.log('AvatarUpload: File change detected');
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        console.warn('AvatarUpload: No file selected');
        setUploading(false);
        return;
      }

      const file = event.target.files[0];
      
      // Enforce 2MB limit on client side
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File too large. Max size is 2MB');
        setUploading(false);
        return;
      }

      if (!userId) {
        console.error('AvatarUpload: User ID is missing');
        toast.error('Authentication error. Please try again.');
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log(`AvatarUpload: Starting upload for user ${userId} to path ${filePath}`);

      // 1. Create a local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // 2. Upload to Supabase Storage with a timeout
      const uploadPromise = supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      // Add a 15-second timeout to the upload
      const result = await Promise.race([
        uploadPromise,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Upload timed out. Please check your connection.')), 15000);
        })
      ]) as any;

      if (timeoutId) clearTimeout(timeoutId);

      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session at upload time:', session?.user?.id);

      const { error: uploadError } = result;
      if (uploadError) {
        console.error('AvatarUpload: Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('AvatarUpload: Upload successful, getting public URL');

      // 3. Get Public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      const publicUrl = urlData.publicUrl;
      console.log(`AvatarUpload: Public URL: ${publicUrl}`);

      // 4. Update Profile in Database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('AvatarUpload: Profile update error:', updateError);
        throw updateError;
      }

      console.log('AvatarUpload: Profile updated successfully');

      // 5. Sync with global auth store
      updateUserAvatar(publicUrl);

      toast.success('Profile picture updated successfully');
      if (onUploadSuccess) {
        onUploadSuccess(publicUrl);
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('AvatarUpload: Final catch error:', error);
      toast.error(error.message || 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      console.log('AvatarUpload: Done');
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
