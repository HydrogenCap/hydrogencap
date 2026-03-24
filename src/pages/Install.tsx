import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {installed ? (
            <CheckCircle className="w-8 h-8 text-primary" />
          ) : (
            <Smartphone className="w-8 h-8 text-primary" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          {installed ? "App Installed!" : "Install Tenure IQ"}
        </h1>

        <p className="text-muted-foreground">
          {installed
            ? "You can now launch Tenure IQ from your home screen."
            : "Add Tenure IQ to your home screen for quick access and a more app-like experience."}
        </p>

        {!installed && deferredPrompt && (
          <Button size="lg" onClick={handleInstall} className="gap-2">
            <Download className="w-4 h-4" />
            Install App
          </Button>
        )}

        {!installed && !deferredPrompt && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">To install manually:</p>
            <p>
              <strong>iOS:</strong> Tap the Share icon → "Add to Home Screen"
            </p>
            <p>
              <strong>Android:</strong> Tap the browser menu → "Install app" or "Add to Home Screen"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
