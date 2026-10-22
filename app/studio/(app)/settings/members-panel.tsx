"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Mono } from "@/components/ui/primitives";
import { inviteMember, removeMember, renameMember, signInLink } from "./actions";

export type MemberRow = { userId: string; name: string; email: string | null; joined: boolean; you: boolean };

/**
 * Everyone in the studio, with invite links instead of emails: create a
 * link, send it however you like, and they set their own password.
 */
export function MembersPanel({ members }: { members: MemberRow[] }) {
  const [link, setLink] = useState<{ who: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <ul className="border-t border-rule">
        {members.map((m) => (
          <MemberItem
            key={m.userId}
            member={m}
            onLink={(url) => setLink({ who: m.name, url })}
            onError={setError}
          />
        ))}
      </ul>
      {error ? (
        <p role="alert" className="-mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {link ? <LinkBox who={link.who} url={link.url} onClose={() => setLink(null)} /> : null}

      <InviteForm onLink={(who, url) => setLink({ who, url })} />
    </div>
  );
}

function MemberItem({
  member,
  onLink,
  onError,
}: {
  member: MemberRow;
  onLink: (url: string) => void;
  onError: (error: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(member.name);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule py-3">
      <div className="min-w-0 flex-1 basis-56">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await renameMember(member.userId, name);
                onError(r.ok ? null : r.error);
                if (r.ok) setRenaming(false);
              });
            }}
          >
            <label htmlFor={`name-${member.userId}`} className="sr-only">
              Name
            </label>
            <Input id={`name-${member.userId}`} value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus />
            <Button size="sm" type="submit" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          <p className="text-[16px]">
            {member.name}
            {member.you ? <span className="ml-2 text-sm text-muted">(you)</span> : null}
          </p>
        )}
        <p className="truncate text-sm text-muted">{member.email}</p>
      </div>
      <Mono className="flex items-center gap-2">
        {!member.joined ? <span aria-hidden className="size-1.5 bg-signal" /> : null}
        {member.joined ? "Joined" : "Invited · not joined yet"}
      </Mono>
      <div className="flex flex-wrap gap-1">
        {!renaming ? (
          <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await signInLink(member.userId);
              onError(r.ok ? null : r.error);
              if (r.ok) onLink(r.link);
            })
          }
        >
          Copy sign-in link
        </Button>
        {!member.you ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            className={confirm ? "text-danger" : undefined}
            onBlur={() => setConfirm(false)}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              start(async () => {
                const r = await removeMember(member.userId);
                onError(r.ok ? null : r.error);
              });
            }}
          >
            {confirm ? "Confirm remove" : "Remove"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function InviteForm({ onLink }: { onLink: (who: string, url: string) => void }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await inviteMember({ name, email });
          setError(r.ok ? null : r.error);
          if (r.ok) {
            onLink(name.trim(), r.link);
            setName("");
            setEmail("");
          }
        });
      }}
    >
      <h3 className="text-[17px] font-medium">Invite someone</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="invite-name" hint="Shown on what they add, like their board imports.">
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="invite-email" hint="They'll sign in with this." error={error ?? undefined}>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </Field>
      </div>
      <Button type="submit" variant="primary" disabled={pending || !name.trim() || !email.trim()} className="self-start">
        {pending ? "Creating…" : "Create invite link"}
      </Button>
    </form>
  );
}

function LinkBox({ who, url, onClose }: { who: string; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-ink p-4">
      <p className="text-[15px]">
        Link for <span className="font-medium">{who}</span>. Send it to them yourself (WhatsApp, email, anything).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="invite-link" className="sr-only">
          Link
        </label>
        <Input id="invite-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 font-mono text-xs" />
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">
        It works once and expires after about an hour. If it runs out, use Copy sign-in link next to their name for a new one.
      </p>
    </div>
  );
}
