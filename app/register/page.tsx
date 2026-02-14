"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Script from "next/script";

type Role = "employer" | "employee";

interface PasswordStrength {
  score: number;
  feedback: string;
  color: string;
}

export default function RegisterPage() {
  const [role, setRole] = useState<Role>("employer");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companySize: "",
    inviteToken: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: "",
    color: "bg-gray-200",
  });
  const router = useRouter();

  // Calculate password strength
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    if (!password) {
      return { score: 0, feedback: "", color: "bg-gray-200" };
    }

    let score = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      longLength: password.length >= 12,
    };

    // Scoring
    if (checks.length) score += 1;
    if (checks.uppercase) score += 1;
    if (checks.lowercase) score += 1;
    if (checks.number) score += 1;
    if (checks.special) score += 1;
    if (checks.longLength) score += 1;

    // Feedback
    const missing: string[] = [];
    if (!checks.length) missing.push("at least 8 characters");
    if (!checks.uppercase) missing.push("an uppercase letter");
    if (!checks.lowercase) missing.push("a lowercase letter");
    if (!checks.number) missing.push("a number");
    if (!checks.special) missing.push("a special character");

    let feedback = "";
    let color = "";

    if (score <= 2) {
      feedback = "Weak password";
      color = "bg-red-500";
    } else if (score <= 4) {
      feedback = "Fair password";
      color = "bg-yellow-500";
    } else if (score === 5) {
      feedback = "Good password";
      color = "bg-blue-500";
    } else {
      feedback = "Strong password";
      color = "bg-green-500";
    }

    if (missing.length > 0 && score < 5) {
      feedback += ` - Add ${missing.join(", ")}`;
    }

    return { score, feedback, color };
  };

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password]);

  // Poll for reCAPTCHA readiness
  useEffect(() => {
    const checkRecaptcha = setInterval(() => {
      if (window.grecaptcha) {
        setRecaptchaLoaded(true);
        clearInterval(checkRecaptcha);
      }
    }, 100);
    return () => clearInterval(checkRecaptcha);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Email domain validation
  const validateEmailDomain = async (email: string): Promise<boolean> => {
    const domain = email.split('@')[1];
    if (!domain) return false;

    // Basic DNS check - you could enhance this with an API call
    const commonDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
      'icloud.com', 'protonmail.com', 'aol.com', 'mail.com'
    ];
    
    // For now, just check format - in production, you'd want to verify DNS MX records
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Enhanced client-side validation with better error messages
    if (!formData.fullName.trim() || formData.fullName.length < 2) {
      setError("Please enter your full name (at least 2 characters)");
      setIsLoading(false);
      return;
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address (e.g., name@company.com)");
      setIsLoading(false);
      return;
    }

    // Email domain validation
    const domainValid = await validateEmailDomain(formData.email);
    if (!domainValid) {
      setError("Please enter a valid email domain");
      setIsLoading(false);
      return;
    }

    // Password validation with specific feedback
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    if (passwordStrength.score < 3) {
      setError("Please choose a stronger password. " + passwordStrength.feedback);
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter your password.");
      setIsLoading(false);
      return;
    }

    if (role === "employer") {
      if (!formData.companyName.trim()) {
        setError("Please enter your company name");
        setIsLoading(false);
        return;
      }
      if (formData.companySize) {
        const size = parseInt(formData.companySize, 10);
        if (isNaN(size) || size < 1) {
          setError("Number of employees must be at least 1");
          setIsLoading(false);
          return;
        }
      }
    }

    if (role === "employee" && !formData.inviteToken.trim()) {
      setError("Please enter your invite token. Contact your employer if you don't have one.");
      setIsLoading(false);
      return;
    }

    // reCAPTCHA check
    if (!window.grecaptcha) {
      setError("Security verification not loaded. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      setError("Security configuration error. Please contact support.");
      setIsLoading(false);
      return;
    }

    let recaptchaToken;
    try {
      recaptchaToken = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => {
          Promise.resolve(window.grecaptcha.execute(siteKey, { action: "register" }))
            .then(resolve)
            .catch(reject);
        });
      });

      if (!recaptchaToken) {
        setError("Security verification failed. Please try again.");
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.error("reCAPTCHA error:", err);
      setError("Security verification error. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        role,
        companySize: formData.companySize
          ? parseInt(formData.companySize, 10)
          : undefined,
        recaptchaToken,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Enhanced error messages from backend
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      if (data.message) {
        setSuccessMessage(data.message);
      }

      // Show rate limit info if available
      if (data.rateLimit) {
        console.log(`Rate limit: ${data.rateLimit.remaining}/${data.rateLimit.limit} remaining`);
      }

      router.push(data.redirectTo || "/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
      />
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        {/* Background */}
        <div className="fixed inset-0 bg-green-600 sm:[clip-path:polygon(0_0,70%_0,100%_100%,0%_100%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 p-8 md:grid-cols-2">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col justify-center text-white"
          >
            <h1 className="font-serif text-4xl font-bold md:text-5xl">
              Join EaziWage
            </h1>
            <p className="mt-4 text-lg text-green-100">
              Instant wage access for modern teams. Built for employers and
              employees.
            </p>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white p-8 shadow-lg"
          >
            <h2 className="mb-6 text-2xl font-semibold text-gray-800">
              Create account
            </h2>

            {/* Role selector */}
            <div className="mb-6 grid grid-cols-2 gap-2">
              {(["employer", "employee"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={clsx(
                    "rounded-lg py-2 font-medium transition",
                    role === r
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {r === "employer" ? "Employer" : "Employee"}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Full name"
                name="fullName"
                placeholder="John Doe"
                onChange={handleChange}
                value={formData.fullName}
                required
              />
              <Input
                label="Work email"
                name="email"
                type="email"
                placeholder="name@company.com"
                onChange={handleChange}
                value={formData.email}
                required
              />

              {role === "employer" && (
                <>
                  <Input
                    label="Company name"
                    name="companyName"
                    placeholder="Your company name"
                    onChange={handleChange}
                    value={formData.companyName}
                    required
                  />
                  <Input
                    label="Number of employees"
                    name="companySize"
                    placeholder="e.g. 25"
                    type="number"
                    min="1"
                    onChange={handleChange}
                    value={formData.companySize}
                  />
                </>
              )}

              {role === "employee" && (
                <Input
                  label="Invite Token"
                  name="inviteToken"
                  placeholder="Your invite token"
                  onChange={handleChange}
                  value={formData.inviteToken}
                  required
                />
              )}

              {/* Password field with show/hide toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    onChange={handleChange}
                    autoComplete="new-password"
                    value={formData.password}
                    required
                    className="w-full rounded-lg border border-green-400 px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                
                {/* Password strength indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={clsx("h-full transition-all duration-300", passwordStrength.color)}
                          style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{passwordStrength.feedback}</p>
                  </div>
                )}
              </div>

              {/* Confirm Password field with show/hide toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <div className="relative mt-1">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    onChange={handleChange}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    required
                    className="w-full rounded-lg border border-green-400 px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {successMessage && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}

              <button
                type="submit"
                className="mt-4 w-full rounded-lg bg-green-600 py-2 font-semibold text-white transition hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading
                  ? "Creating account..."
                  : role === "employer"
                    ? "Create employer account"
                    : "Join as employee"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <a
                href="/"
                className="font-semibold text-green-600 hover:underline"
              >
                Log in
              </a>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-green-400 px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
      />
    </div>
  );
}