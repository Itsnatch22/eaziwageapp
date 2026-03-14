"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormData } from "@/lib/validations/contact";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

/* ----------------------------- components ----------------------------- */

const FloatingOrb = ({ color, delay, className }: { color: string; delay: number; className?: string }) => (
  <motion.div
    animate={{
      y: [0, -40, 0],
      x: [0, 20, 0],
      scale: [1, 1.1, 1],
    }}
    transition={{
      duration: 10 + Math.random() * 5,
      repeat: Infinity,
      delay,
      ease: "easeInOut",
    }}
    className={`absolute h-125 w-125 rounded-full blur-[120px] opacity-20 ${color} ${className}`}
  />
);

const ContactInfoCard = ({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) => {
  const content = (
    <motion.div
      whileHover={{ y: -5 }}
      className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-colors hover:bg-white/10"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-400">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-green-200/60">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block group">
        {content}
      </a>
    );
  }

  return content;
};

/* ------------------------------ page ----------------------------- */

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    if (data.honeypot) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast.success("Message sent successfully!");
        reset();
        // Reset success state after 10 seconds
        setTimeout(() => setIsSuccess(false), 10000);
      } else {
        toast.error(result.error || "Failed to send message. Please try again.");
      }
    } catch (error) {
      toast.error("Network error. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-b from-green-950/20 to-black" />
        <FloatingOrb color="bg-green-500" delay={0} className="top-[-10%] left-[-5%]" />
        <FloatingOrb color="bg-emerald-600" delay={2} className="bottom-[-10%] right-[-5%]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] invert" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
          
          {/* Left Side: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-32"
          >
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-green-400 backdrop-blur-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Contact Support
              </motion.div>

              <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">
                Let&apos;s Start a <span className="text-green-500">Conversation.</span>
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
                Have questions about EaziWage? Whether you&apos;re an employer looking to 
                empower your team or an employee wanting to learn more, we&apos;re here to help.
              </p>

              <div className="space-y-4 pt-8">
                <ContactInfoCard
                  icon={Mail}
                  label="Email us"
                  value="support@eaziwage.com"
                  href="mailto:support@eaziwage.com"
                />
                <ContactInfoCard
                  icon={Phone}
                  label="Call us"
                  value="+254 723 154900"
                  href="tel:+254723154900"
                />
                <ContactInfoCard
                  icon={MapPin}
                  label="Our HQ"
                  value="Nairobi, Kenya"
                />
              </div>

              <div className="pt-10">
                <div className="flex items-center gap-4 text-sm font-medium text-zinc-500">
                  <span>Trusted by 100+ forward-thinking companies across Africa</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side: Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl shadow-2xl sm:p-12">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="py-12 text-center"
                  >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="mb-4 text-3xl font-bold text-white">Message Received!</h2>
                    <p className="mx-auto max-w-xs text-zinc-400">
                      Thank you for reaching out. Our team will review your message and 
                      get back to you within 24 hours.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-8 border-zinc-700 hover:bg-zinc-800 text-white"
                      onClick={() => setIsSuccess(false)}
                    >
                      Send another message
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="mb-10">
                      <h2 className="text-2xl font-bold text-white">Send a Message</h2>
                      <p className="mt-2 text-zinc-400">
                        Fill out the form and we&apos;ll get back to you shortly.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <input type="text" className="sr-only" {...register("honeypot")} tabIndex={-1} />
                      
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-zinc-400">Full Name</Label>
                          <Input
                            id="name"
                            placeholder="John Doe"
                            {...register("name")}
                            className="h-12 border-zinc-800 bg-zinc-950/50 text-white placeholder:text-zinc-600 focus-visible:ring-green-500/50"
                          />
                          {errors.name && <p className="text-xs font-medium text-red-500">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-zinc-400">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            {...register("email")}
                            className="h-12 border-zinc-800 bg-zinc-950/50 text-white placeholder:text-zinc-600 focus-visible:ring-green-500/50"
                          />
                          {errors.email && <p className="text-xs font-medium text-red-500">{errors.email.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject" className="text-zinc-400">Subject</Label>
                        <Input
                          id="subject"
                          placeholder="How can we help?"
                          {...register("subject")}
                          className="h-12 border-zinc-800 bg-zinc-950/50 text-white placeholder:text-zinc-600 focus-visible:ring-green-500/50"
                        />
                        {errors.subject && <p className="text-xs font-medium text-red-500">{errors.subject.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-zinc-400">Message</Label>
                        <Textarea
                          id="message"
                          rows={5}
                          placeholder="Tell us more about your inquiry..."
                          {...register("message")}
                          className="min-h-[120px] resize-none border-zinc-800 bg-zinc-950/50 text-white placeholder:text-zinc-600 focus-visible:ring-green-500/50"
                        />
                        {errors.message && <p className="text-xs font-medium text-red-500">{errors.message.message}</p>}
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-14 w-full bg-green-600 text-lg font-bold text-white hover:bg-green-500 transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Sending...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Send className="h-5 w-5" />
                            <span>Send Message</span>
                          </div>
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Decoration */}
            <div className="absolute -bottom-6 -right-6 -z-10 h-64 w-64 rounded-full bg-green-500/10 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
