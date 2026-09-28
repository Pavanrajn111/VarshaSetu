import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import type { SupportedLanguage } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CloudRain,
  User,
  Phone,
  Lock,
  Globe,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  LogIn,
} from "lucide-react";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create Account | Varsha Setu" },
      {
        name: "description",
        content:
          "Register for Varsha Setu agricultural intelligence for personalized crop water and monsoon advisories.",
      },
    ],
  }),
  component: SignupPage,
});

const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string; local: string }[] = [
  { code: "en", label: "English", local: "English" },
  { code: "kn", label: "Kannada", local: "ಕನ್ನಡ" },
  { code: "hi", label: "Hindi", local: "हिन्दी" },
];

function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [role, setRole] = useState<"farmer" | "officer">("farmer");

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side validations
    if (fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name (minimum 2 characters).");
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMsg(
        "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        phone_number: cleanPhone,
        password,
        preferred_language: language,
        role,
      });

      // DO NOT automatically log in or navigate to dashboard.
      // Instead, show the inline success message and prompt manual login.
      setIsSignupSuccess(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Registration failed. Please check your details.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen text-foreground flex flex-col justify-between">
      {/* Shared Unified Header */}
      <AppHeader showProgress={false}>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 border-border/80 bg-glass/80 text-xs"
        >
          <Link to="/dashboard">
            <Sliders className="mr-1.5 size-3.5 text-signal" /> Studio
          </Link>
        </Button>
      </AppHeader>

      {/* Centered Glass Panel */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg">
          <Card className="border border-border/70 bg-card/75 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-1.5 text-center pb-5">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-signal/40 bg-signal/15 text-signal shadow-lg shadow-signal/10">
                <CloudRain className="size-6" />
              </div>
              <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                Join Varsha Setu
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground sm:text-sm">
                Unlock personalized monsoon onset forecasts, customized soil moisture budgets, and
                trilingual voice advisories.
              </CardDescription>
            </CardHeader>

            {isSignupSuccess ? (
              /* Non-blocking beautiful success message */
              <CardContent className="space-y-6 pt-2 pb-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="rounded-xl border border-success/40 bg-success/10 p-6 text-center space-y-4">
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/20 text-success border border-success/30 shadow-lg shadow-success/10">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      ✓ Account created successfully
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Log in to your created account.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      asChild
                      className="w-full bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-11 shadow-lg shadow-signal/20 cursor-pointer"
                    >
                      <Link to="/login">
                        <LogIn className="mr-2 size-4" /> Go to Login
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground">
                  Need to make changes?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignupSuccess(false);
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="font-semibold text-signal hover:underline cursor-pointer"
                  >
                    Back to registration
                  </button>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  {errorMsg && (
                    <Alert
                      variant="destructive"
                      className="border-rose-500/30 bg-rose-500/10 text-rose-300 py-2.5"
                    >
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                      <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                    </Alert>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname" className="text-xs font-medium text-foreground">
                      Full Name
                    </Label>
                    <div className="relative flex items-center rounded-md border border-border/80 bg-background/50 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal">
                      <Input
                        id="fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Gowda"
                        required
                        className="border-0 bg-transparent text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <User className="mr-3 size-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium text-foreground">
                      Mobile Number
                    </Label>
                    <div className="relative flex items-center rounded-md border border-border/80 bg-background/50 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal">
                      <span className="flex items-center px-3 text-xs font-mono text-muted-foreground border-r border-border/60">
                        +91
                      </span>
                      <Input
                        id="phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="98450 12345"
                        maxLength={15}
                        required
                        className="border-0 bg-transparent text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Phone className="mr-3 size-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>

                  {/* Password & Confirm Password Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs font-medium text-foreground">
                        Password (min 6)
                      </Label>
                      <div className="relative flex items-center rounded-md border border-border/80 bg-background/50 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="border-0 bg-transparent text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="mr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="confirm-password"
                        className="text-xs font-medium text-foreground"
                      >
                        Confirm Password
                      </Label>
                      <div className="relative flex items-center rounded-md border border-border/80 bg-background/50 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal">
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="border-0 bg-transparent text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Lock className="mr-3 size-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>

                  {/* Language & Role Selectors Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">
                        Preferred Language
                      </Label>
                      <Select
                        value={language}
                        onValueChange={(val) => setLanguage(val as SupportedLanguage)}
                      >
                        <SelectTrigger className="border-border/80 bg-background/50 text-xs h-9">
                          <Globe className="mr-1.5 size-3.5 text-signal" />
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent className="border-border/80 bg-background/95 backdrop-blur-xl">
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.code} value={opt.code} className="text-xs">
                              {opt.label} ({opt.local})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Primary Role</Label>
                      <Select
                        value={role}
                        onValueChange={(val) => setRole(val as "farmer" | "officer")}
                      >
                        <SelectTrigger className="border-border/80 bg-background/50 text-xs h-9">
                          <Briefcase className="mr-1.5 size-3.5 text-signal" />
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="border-border/80 bg-background/95 backdrop-blur-xl">
                          <SelectItem value="farmer" className="text-xs">
                            Farmer / Krishi Mitra
                          </SelectItem>
                          <SelectItem value="officer" className="text-xs">
                            Agricultural Extension Officer
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-signal text-signal-foreground hover:bg-signal/90 font-medium text-sm h-10 shadow-lg shadow-signal/20 cursor-pointer"
                  >
                    {isSubmitting ? (
                      "Creating Account..."
                    ) : (
                      <>
                        Create Free Account <ArrowRight className="ml-1.5 size-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center text-xs text-muted-foreground">
                    Already registered?{" "}
                    <Link to="/login" className="font-semibold text-signal hover:underline">
                      Sign in here
                    </Link>
                  </div>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 text-center font-mono text-[11px] text-muted-foreground">
          Varsha Setu · Smart India Hackathon 2026 · Ministry of Earth Sciences & Karnataka
          Agriculture
        </div>
      </footer>
    </div>
  );
}
