import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  label?: string;
  /** Toast description shown on success. */
  successMessage?: string;
  /** Hide the textual label and render an icon-only button. */
  iconOnly?: boolean;
}

/**
 * Accessible copy-to-clipboard button with a brief success indicator.
 * Falls back to a manual select+copy when the Clipboard API is unavailable.
 */
export function CopyButton({
  value,
  label = 'Copy',
  successMessage,
  iconOnly = false,
  className,
  size = 'sm',
  variant = 'ghost',
  ...rest
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      toast.success(successMessage ?? 'Copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Unable to copy to clipboard');
    }
  }, [value, successMessage]);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleCopy}
      aria-label={iconOnly ? label : undefined}
      className={cn('gap-1.5', className)}
      {...rest}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {!iconOnly && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  );
}
