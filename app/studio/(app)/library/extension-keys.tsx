"use client";

import { useState } from "react";
import { Button, Mono } from "@/components/ui/primitives";
import { createExtensionKey, revokeExtensionKey } from "./actions";

export type MemberKey = {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "never";

export function ExtensionKeys({ keys }: { keys: MemberKey[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-[17px] font-medium">Chrome extension</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <a href="/amplifier-extension.zip" download className="text-ink underline">
              Download the extension
            </a>{" "}
            and unzip it.
          </li>
          <li>
            In Chrome, open <code className="font-mono text-sm">chrome://extensions</code>, turn on Developer mode, choose
            Load unpacked and pick the unzipped folder.
          </li>
          <li>Create a key below and paste it into the extension&apos;s settings, with this site&apos;s address.</li>
          <li>Right-click any image on any site and choose Add to Amplifier library.</li>
        </ol>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[17px] font-medium">Your extension keys</h3>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await createExtensionKey();
              if (result.ok) {
                setNewKey(result.key);
                setCopied(false);
              } else setError(result.error);
              setBusy(false);
            }}
          >
            Create key
          </Button>
        </div>

        {newKey ? (
          <div className="mt-3 border border-signal p-4">
            <p className="text-sm">Copy this key now. It won&apos;t be shown again.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all bg-panel px-2 py-1.5 font-mono text-sm">{newKey}</code>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  await navigator.clipboard.writeText(newKey);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        {keys.length ? (
          <ul className="mt-3 border-t border-rule">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-rule py-3">
                <code className="font-mono text-sm">{key.key_prefix}…</code>
                <Mono suppressHydrationWarning>Created {date(key.created_at)}</Mono>
                <Mono suppressHydrationWarning>Last used {date(key.last_used_at)}</Mono>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={async () => {
                    const result = await revokeExtensionKey(key.id);
                    if (!result.ok) setError(result.error);
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No keys yet.</p>
        )}
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-[17px] font-medium">From your phone (Android)</h3>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
          Open this studio in Chrome on Android and choose Add to home screen. Amplifier then appears in the share
          sheet: share an image or a Pinterest pin to it. iPhones don&apos;t allow web apps in the share sheet, so on an
          iPhone copy the link and paste it into the field above.
        </p>
      </div>
    </div>
  );
}
