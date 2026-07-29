"use client";

// Requirements: CAP-0004 AC1
import { Button } from "@/components/ui/button";
import type { Contact, ContactInput, ResolveMatch } from "@/lib/api/contacts.types";

interface DuplicateReviewProps {
  resolution: Extract<ResolveMatch, "phone_match" | "email_match">;
  matched: Contact;
  incoming: ContactInput;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

// SRS §6.3's exact copy names "phone number"; adapted for the email case
// per CAP-0004 AC1 ("adapted for the matched field").
const MESSAGE: Record<"phone_match" | "email_match", string> = {
  phone_match:
    "A contact with this phone number already exists. Review the existing and incoming values before continuing.",
  email_match:
    "A contact with this email address already exists. Review the existing and incoming values before continuing.",
};

const FIELD_ROWS: Array<{ label: string; key: keyof Contact & keyof ContactInput }> = [
  { label: "First name", key: "first_name" },
  { label: "Last name", key: "last_name" },
  { label: "Company", key: "company" },
  { label: "Position", key: "position" },
  { label: "Phone", key: "phone" },
  { label: "Email", key: "email" },
  { label: "Website", key: "website" },
  { label: "Address", key: "address" },
];

export function DuplicateReview({
  resolution,
  matched,
  incoming,
  onConfirm,
  onCancel,
  confirming = false,
}: DuplicateReviewProps) {
  return (
    <div className="space-y-4" data-testid="duplicate-review">
      <p role="alert" className="text-sm">
        {MESSAGE[resolution]}
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="font-normal">
              Field
            </th>
            <th scope="col" className="font-normal">
              Existing
            </th>
            <th scope="col" className="font-normal">
              Incoming
            </th>
          </tr>
        </thead>
        <tbody>
          {FIELD_ROWS.map(({ label, key }) => (
            <tr key={key}>
              <td className="pr-2.5 py-1 font-medium">{label}</td>
              <td className="pr-2.5 py-1">{matched[key] || "—"}</td>
              <td className="py-1">{incoming[key] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <Button type="button" onClick={onConfirm} disabled={confirming}>
          {confirming ? "Saving..." : "Confirm and Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
          Back to Form
        </Button>
      </div>
    </div>
  );
}
