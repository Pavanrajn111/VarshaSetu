import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
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
  CloudRain,
  Lock,
  Phone,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Sliders,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Log In | Varsha Setu" },
      {
        name: "description",
        content:
          "Log in to your Varsha Setu agricultural intelligence account for personalized crop advisories.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, show quick redirect prompt or navigate
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phoneNumber.replace(/[^\d]/g, "");
    if (cleanPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(phoneNumber, password);
      navigate({ to: "/dashboard", search: { setup: "true" } });
    } catch {
      // Backend guarantees a generic 401 message; match exactly
      setErrorMsg("Invalid phone number or password.");
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
          <Link to="/dashboard" search={{ setup: "true" }}>
            <Sliders className="mr-1.5 size-3.5 text-signal" /> Studio
          </Link>
        </Button>
      </AppHeader>

      {/* Centered Glass Panel Floating Over Storm */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Card className="border border-border/70 bg-card/75 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2 text-center pb-6">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-signal/40 bg-signal/15 text-signal shadow-lg shadow-signal/10">
                <CloudRain className="size-6" />
              </div>
              <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                Log In to Varsha Setu
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground sm:text-sm">
                Access your personalized agro-climatic predictions, saved taluks, and last-mile
                advisories.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleLogin}>
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

                {/* Phone Number Field */}
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

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                  </div>
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
                      className="mr-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-signal text-signal-foreground hover:bg-signal/90 font-medium text-sm h-10 shadow-lg shadow-signal/20"
                >
                  {isSubmitting ? (
                    "Signing In..."
                  ) : (
                    <>
                      Sign In to Studio <ArrowRight className="ml-1.5 size-4" />
                    </>
                  )}
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <Link to="/signup" className="font-semibold text-signal hover:underline">
                    Create free account
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 text-center font-mono text-[11px] text-muted-foreground">
          Varsha Setu · Smart India Hackathon 2026 · Personalization & Multi-Model Forecasting
        </div>
      </footer>
    </div>
  );
}
