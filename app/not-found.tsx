"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-6 text-center">
      <motion.h1
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-8xl font-extrabold text-green-600"
      >
        404
      </motion.h1>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-4 text-2xl font-semibold text-gray-900 md:text-3xl"
      >
        Page Not Found
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-2 max-w-md text-gray-600"
      >
        Oops 👀 The page you&apos;re looking for doesn&apos;t exist or has been
        moved. Don&apos;t worry, we&apos;ll get you back on track.
      </motion.p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/"
          className="rounded-xl bg-green-600 px-6 py-3 text-white shadow-md transition hover:bg-green-700"
        >
          Back Home
        </Link>
        <Link
          href="/contact"
          className="rounded-xl border border-green-600 px-6 py-3 text-green-600 transition hover:bg-green-50"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
