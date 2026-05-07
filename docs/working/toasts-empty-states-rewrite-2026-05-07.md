# Toast + Empty-State Rewrite Working File — 2026-05-07

Source: `docs/release/ai-slop-audit-2026-04-29.md` §(g) toasts + §(h) empty states.

Constraints:
- Toast titles + descriptions ≤60 chars each
- Empty-state titles ≤40 chars, descriptions ≤120 chars
- Use **TenureIQ** (no space) where the brand appears
- Two candidates each: **A = terse**, **B = warm**

Format: `current → A | B`. Picks recorded inline once chosen.

---

## BATCH 1 — Passport (14 strings)

### `src/components/passport/PassportForm.tsx`
1. L121 ✅ title `Passport saved` / desc `Property passport has been updated.`
   - A: `Passport updated` / `Changes saved to the property passport.`
   - B: `Passport saved` / `Your changes are now part of this property's passport.`
2. L128 ❌ title `Error` / desc `Failed to save passport.`
   - A: `Couldn't save passport` / `Try again, or refresh if the issue persists.`
   - B: `Passport didn't save` / `Something blocked the save — try once more.`
3. L159 ❌ title `Error` / desc *dynamic* (`Failed to generate suggestions`)
   - A: `Couldn't generate suggestions` / *dynamic*
   - B: `AI suggestions unavailable` / *dynamic*
4. L178 ✅ title `Construction period estimated` / desc `AI suggests ~${year} (${conf} confidence)`
   - A: `Construction year estimated` / *dynamic kept*
   - B: `Build period inferred` / *dynamic kept*
5. L184 ❌ title `Estimation failed` / desc *dynamic*
   - A: `Couldn't estimate build year` / *dynamic*
   - B: `Estimate didn't run` / *dynamic*

### `src/components/passport/PassportRowEditor.tsx`
6. L97 ✅ `Saved` / `Property identity and passport updated successfully.`
   - A: `Property updated` / `Identity and passport saved.`
   - B: `All saved` / `Property identity and passport are up to date.`
7. L99 ❌ `Error` / `Failed to save changes.`
   - A: `Couldn't save changes` / `Try again in a moment.`
   - B: `Changes didn't save` / `Give it another go — your edits are still here.`
8. L111 ❌ `Error` / `Failed to add title number.`
   - A: `Couldn't add title number` / `Check the format and retry.`
   - B: `Title number didn't add` / `Try again — Land Registry didn't accept it.`
9. L119 ❌ `Error` / `Failed to remove title number.`
   - A: `Couldn't remove title number` / `Try again in a moment.`
   - B: `Title number didn't remove` / `Give it another go.`

### `src/components/passport/MultiTitleNumberInput.tsx`
10. L29 ❌ `Duplicate title number` / `This title number has already been added.`
    - A: `Already on file` / `That title number is already linked to this property.`
    - B: `Duplicate title number` / `You've already added this one.`
11. L41 ✅ `Title number added` / `${trimmed} has been added.`
    - A: `Title number added` / *dynamic kept*
    - B: `Linked to property` / *dynamic kept*
12. L47 ❌ `Error` / `Failed to add title number.`
    - A: `Couldn't add title number` / `Try again in a moment.`
    - B: `Didn't add` / `Give it another go.`
13. L58 ✅ `Title number removed` / `${titleNumber} has been removed.`
    - A: `Title number removed` / *dynamic kept*
    - B: `Unlinked` / *dynamic kept*
14. L64 ❌ `Error` / `Failed to remove title number.`
    - A: `Couldn't remove title number` / `Try again in a moment.`
    - B: `Didn't remove` / `Give it another go.`

---

## BATCH 2 — Tenants V2 (12 strings)

### `src/components/tenants-v2/AddTenantModal.tsx`
15. L71 ✅ `Tenant created` / `${first} ${last} added.`
    - A: `Tenant added` / *dynamic kept*
    - B: `Welcome aboard` / `${name} is now in your tenant list.`
16. L76 ❌ `Error` / *dynamic*
    - A: `Couldn't add tenant` / *dynamic*
    - B: `Tenant didn't save` / *dynamic*

### `src/components/tenants-v2/EndTenancyModal.tsx`
17. L74 ✅ `Tenancy ended`
    - A: `Tenancy ended`
    - B: `Tenancy closed out`
18. L77 ❌ `Error` / *dynamic*
    - A: `Couldn't end tenancy` / *dynamic*
    - B: `End date didn't save` / *dynamic*

### `src/components/tenants-v2/CreateTenancyAgreementModal.tsx`
19. L156 ✅ `Tenancy agreement created`
    - A: `Agreement created`
    - B: `Tenancy agreement is live`
20. L160 ❌ `Error` / *dynamic*
    - A: `Couldn't create agreement` / *dynamic*
    - B: `Agreement didn't save` / *dynamic*

### `src/components/tenants-v2/ServeNoticeModal.tsx`
21. L80 ✅ `Notice served`
    - A: `Notice served`
    - B: `Notice on the record`
22. L83 ❌ `Error` / *dynamic*
    - A: `Couldn't serve notice` / *dynamic*
    - B: `Notice didn't send` / *dynamic*

### `src/components/tenants-v2/RightToRentCard.tsx`
23. L147 ✅ `Right to Rent record updated`
    - A: `Right to Rent updated`
    - B: `Right to Rent on file`
24. L150 ❌ `Error` / `Failed to update Right to Rent record`
    - A: `Couldn't save Right to Rent` / `Try again in a moment.`
    - B: `Right to Rent didn't save` / `Give it another go.`
25. L157 ✅ `Right to Rent check cleared`
    - A: `Check cleared`
    - B: `Right to Rent record cleared`
26. L159 ❌ `Error` / `Failed to clear check`
    - A: `Couldn't clear check` / `Try again in a moment.`
    - B: `Didn't clear` / `Give it another go.`

### `src/components/tenants-v2/DepositProtectionCard.tsx`
(included in BATCH 3)

---

## BATCH 3 — Tenants V2 deposit + Companies (12 strings)

27. `DepositProtectionCard.tsx:102` ✅ `Deposit protection updated`
    - A: `Deposit protection updated`
    - B: `Deposit details on file`
28. `DepositProtectionCard.tsx:105` ❌ `Error` / `Failed to update deposit protection`
    - A: `Couldn't save deposit details` / `Try again in a moment.`
    - B: `Deposit details didn't save` / `Give it another go.`

### `src/components/companies/CreateCompanyDialog.tsx`
29. L88 ❌ `Error` / `Company name is required`
    - A: `Name required` / `Add a company name to continue.`
    - B: `Missing company name` / `Pop a name in before saving.`
30. L102 ✅ `Company created` / `${legalName} has been added`
    - A: `Company added` / *dynamic kept*
    - B: `Company is live` / `${legalName} is now in your portfolio.`
31. L107 ❌ `Error` / *dynamic* (`Failed to create company`)
    - A: `Couldn't create company` / *dynamic*
    - B: `Company didn't save` / *dynamic*

### `src/components/companies/ShareCapitalCard.tsx`
32. L41 ❌ `Invalid` / `Enter a valid number of shares`
    - A: `Invalid share count` / `Enter a whole number greater than zero.`
    - B: `Check the share count` / `Needs to be a positive whole number.`
33. L50 ✅ `Share capital updated`
    - A: `Share capital updated`
    - B: `Share capital on file`
34. L54 ❌ `Error` / *dynamic* (`Failed to update share capital`)
    - A: `Couldn't update share capital` / *dynamic*
    - B: `Share capital didn't save` / *dynamic*

### `src/components/companies/CompanySecretsCard.tsx`
35. L47 ❌ `Error` / *dynamic*
    - A: `Couldn't save secret` / *dynamic*
    - B: `Encrypted store didn't update` / *dynamic*
36. L59 ✅ `Copied to clipboard`
    - A: `Copied`
    - B: `Copied to clipboard`
37. L80 ❌ `Error` / *dynamic*
    - A: `Couldn't reveal secret` / *dynamic*
    - B: `Decryption didn't run` / *dynamic*

### `src/components/companies/ShareholdingEditor.tsx`
38. L93 ❌ `Error` / `Name is required`
    - A: `Name required` / `Add a party name to continue.`
    - B: `Missing name` / `Add a name before saving.`

---

## BATCH 4 — Companies + Shareholders (13 strings)

39. `ShareholdingEditor.tsx:104` ✅ `Party created` / `${newPartyName} has been added`
    - A: `Party added` / *dynamic kept*
    - B: `New party on file` / `${name} can now hold shares.`
40. `ShareholdingEditor.tsx:107` ❌ `Error` / *dynamic*
    - A: `Couldn't add party` / *dynamic*
    - B: `Party didn't save` / *dynamic*
41. `ShareholdingEditor.tsx:113` ❌ `Error` / `Please select a shareholder`
    - A: `Pick a shareholder` / `Select someone to assign these shares to.`
    - B: `Shareholder needed` / `Choose who'll hold these shares.`
42. `ShareholdingEditor.tsx:118` ❌ `Error` / `Please select a share class`
    - A: `Pick a share class` / `Select which class these shares belong to.`
    - B: `Share class needed` / `Choose the class before saving.`
43. `ShareholdingEditor.tsx:124` ❌ `Error` / `Shares held must be a positive number`
    - A: `Invalid share count` / `Enter a whole number greater than zero.`
    - B: `Check the share count` / `Needs to be a positive whole number.`
44. `ShareholdingEditor.tsx:138` ✅ `Shareholding updated`
    - A: `Shareholding updated`
    - B: `Shareholding on file`
45. `ShareholdingEditor.tsx:147` ✅ `Shareholder added`
    - A: `Shareholder added`
    - B: `Shareholder on the cap table`
46. `ShareholdingEditor.tsx:153` ❌ `Error` / *dynamic* (`Failed to save shareholding`)
    - A: `Couldn't save shareholding` / *dynamic*
    - B: `Cap table didn't update` / *dynamic*

### `src/components/entities/ShareholderFormModal.tsx`
47. L102 ❌ `Error` / `Shareholder name is required`
    - A: `Name required` / `Add a shareholder name to continue.`
    - B: `Missing name` / `Add a name before saving.`
48. L106 ❌ `Error` / `Share class is required`
    - A: `Share class required` / `Pick a class for these shares.`
    - B: `Share class needed` / `Choose the class before saving.`
49. L111 ❌ `Error` / `Shares held must be a positive number`
    - A: `Invalid share count` / `Enter a whole number greater than zero.`
    - B: `Check the share count` / `Needs to be a positive whole number.`
50. L115 ❌ `Error` / `Effective date is required`
    - A: `Effective date required` / `When did this holding take effect?`
    - B: `Date needed` / `Pick when these shares were issued.`
51. L119 ❌ `Error` / `Cannot exceed issued shares for this class`
    - A: `Over-allocation` / `That's more shares than this class has issued.`
    - B: `Too many shares` / `You're over the issued total for this class.`

---

## BATCH 5 — Shareholders + ShareClass + Entities (13 strings)

52. `ShareholderFormModal.tsx:140` ✅ `Shareholder updated`
    - A: `Shareholder updated`
    - B: `Cap table updated`
53. `ShareholderFormModal.tsx:143` ✅ `Shareholder added`
    - A: `Shareholder added`
    - B: `Shareholder on the cap table`
54. `ShareholderFormModal.tsx:148` ❌ `Error` / *dynamic*
    - A: `Couldn't save shareholder` / *dynamic*
    - B: `Cap table didn't update` / *dynamic*

### `src/components/entities/ShareClassFormModal.tsx`
55. L55 ❌ `Error` / `Class name is required`
    - A: `Class name required` / `Add a name (e.g. Ordinary, A, Preference).`
    - B: `Missing class name` / `Give it a label like Ordinary or Preference.`
56. L60 ❌ `Error` / `Issued shares must be at least 1`
    - A: `Issue at least one share` / `Issued shares must be 1 or more.`
    - B: `At least one share` / `A class needs at least one issued share.`
57. L76 ✅ `Share class updated`
    - A: `Share class updated`
    - B: `Share class on file`
58. L79 ✅ `Share class created`
    - A: `Share class created`
    - B: `New share class added`
59. L84 ❌ `Error` / *dynamic*
    - A: `Couldn't save share class` / *dynamic*
    - B: `Share class didn't save` / *dynamic*

### `src/components/entities/EntityFormModal.tsx`
60. L131 ❌ `Error` / `Entity name is required`
    - A: `Entity name required` / `Add a legal name to continue.`
    - B: `Missing entity name` / `Pop the legal name in before saving.`
61. L138 ❌ `Error` / `Issued shares must be a positive number`
    - A: `Invalid share count` / `Enter a whole number greater than zero.`
    - B: `Check the share count` / `Needs to be a positive whole number.`
62. L160 ✅ `Entity updated`
    - A: `Entity updated`
    - B: `Entity details saved`
63. L163 ✅ `Entity created`
    - A: `Entity created`
    - B: `New entity on file`
64. L168 ❌ `Error` / *dynamic*
    - A: `Couldn't save entity` / *dynamic*
    - B: `Entity didn't save` / *dynamic*

---

## BATCH 6 — CHData + Loans + Snapshots (13 strings)

### `src/components/entities/CHDataPanel.tsx`
65. L97 ✅ `Updated ${field}`
    - A: *dynamic kept*
    - B: `${field} updated from Companies House`
66. L99 ❌ `Error` / *dynamic*
    - A: `Couldn't update field` / *dynamic*
    - B: `Field didn't save` / *dynamic*
67. L120 ❌ `Error` / *dynamic*
    - A: `Couldn't import officer` / *dynamic*
    - B: `Officer import failed` / *dynamic*
68. L124 ✅ `Imported ${n} officer(s)` | `All officers already in local records`
    - A: `${n} officer(s) imported` | `Officers already on file`
    - B: `${n} officer(s) added from Companies House` | `Already up to date — every officer's on file`
69. L143 ✅ `All company data imported from Companies House`
    - A: `Companies House data imported`
    - B: `Synced from Companies House`
70. L145 ❌ `Error` / *dynamic*
    - A: `Couldn't sync Companies House` / *dynamic*
    - B: `Sync didn't complete` / *dynamic*

### `src/components/entities/IntercompanyLoanTracker.tsx`
71. L141 ✅ `Loan updated`
    - A: `Loan updated`
    - B: `Loan terms saved`
72. L144 ✅ `Intercompany loan created`
    - A: `Loan created`
    - B: `Intercompany loan on file`
73. L148 ❌ `Error` / *dynamic* (`Failed to save`)
    - A: `Couldn't save loan` / *dynamic*
    - B: `Loan didn't save` / *dynamic*
74. L218 ✅ `Loan removed`
    - A: `Loan removed`
    - B: `Loan deleted from the register`

### `src/components/financials/SnapshotEntryModal.tsx`
75. L210 ✅ `Month locked` / `Month unlocked`
    - A: `Month locked` / `Month unlocked`
    - B: `Month locked for edits` / `Month open for edits`
76. L314 ✅ `Saved for ${address}`
    - A: *dynamic kept*
    - B: `Snapshot saved · ${address}`
77. L315 ❌ `Error` / *dynamic*
    - A: `Couldn't save snapshot` / *dynamic*
    - B: `Snapshot didn't save` / *dynamic*

---

## BATCH 7 — Snapshots + Photos + Activity + Compliance + Comms + Tax (15 strings)

78. `SnapshotEntryModal.tsx:494` ✅ `Saved ${n} snapshots`
    - A: *dynamic kept*
    - B: `${n} snapshots on file`
79. `SnapshotEntryModal.tsx:495` ❌ `Error` / *dynamic*
    - A: `Couldn't save snapshots` / *dynamic*
    - B: `Bulk save didn't complete` / *dynamic*

### `src/components/photos/PhotoGallery.tsx`
80. L47 ❌ `Invalid file type` / `Please upload image files (JPEG, PNG, WebP, GIF)`
    - A: `Image files only` / `Use JPEG, PNG, WebP, or GIF.`
    - B: `That's not an image` / `Photos need to be JPEG, PNG, WebP, or GIF.`
81. L59 ❌ `Upload failed` / *dynamic*
    - A: `Photo didn't upload` / *dynamic*
    - B: `Upload didn't complete` / *dynamic*
82. L68 ✅ `Upload complete` / `${n} photo(s) uploaded successfully`
    - A: `${n} photo(s) added` / *dynamic kept*
    - B: `Photos uploaded` / `${n} photo(s) are now in the gallery.`
83. L100 ✅ `Cover photo updated` / `This photo is now the cover image`
    - A: `Cover photo set` / `This is now the property's cover image.`
    - B: `New cover photo` / `This shot leads the property listing.`
84. L105 ❌ `Error` / `Failed to set cover photo`
    - A: `Couldn't set cover` / `Try again in a moment.`
    - B: `Cover didn't update` / `Give it another go.`
85. L122 ✅ `Photo deleted` / `The photo has been removed`
    - A: `Photo deleted` / `Removed from the gallery.`
    - B: `Photo removed` / `Gone from the gallery.`
86. L128 ❌ `Error` / `Failed to delete photo`
    - A: `Couldn't delete photo` / `Try again in a moment.`
    - B: `Photo didn't delete` / `Give it another go.`

### `src/components/activity/AddNoteForm.tsx`
87. L29 ✅ `Note added` / `Your note has been added to the timeline.`
    - A: `Note added` / `It's now on the property timeline.`
    - B: `Note on the timeline` / `Your note is logged against this property.`
88. L38 ❌ `Error` / *dynamic*
    - A: `Couldn't add note` / *dynamic*
    - B: `Note didn't save` / *dynamic*

### `src/components/compliance/ComplianceUploadDialog.tsx`
89. L91 ❌ `Invalid file type` / `Please upload a PDF, JPG, or PNG file.`
    - A: `PDF or image only` / `Use a PDF, JPG, or PNG file.`
    - B: `Wrong file type` / `Certificates need to be a PDF, JPG, or PNG.`
90. L100 ❌ `File too large` / `Maximum file size is 10MB.`
    - A: `File too large` / `Keep certificates under 10MB.`
    - B: `Too big to upload` / `Cap is 10MB — try compressing the PDF.`
91. L169 ❌ `Error` / *dynamic*
    - A: `AI scan failed` / *dynamic*
    - B: `Couldn't read certificate` / *dynamic*
92. L233 ✅ `Compliance record created` | `Document saved` (dynamic)
    - A: `Compliance record created` | `Certificate saved`
    - B: `New compliance record on file` | `Certificate is on the record`

---

## BATCH 8 — Compliance + Comms + Tax + Empty States (12 strings)

93. `ComplianceUploadDialog.tsx:246` ❌ `Error saving document` / `Please try again.`
    - A: `Couldn't save certificate` / `Try again in a moment.`
    - B: `Certificate didn't save` / `Give it another go.`

### `src/components/communications/LogCommunication.tsx`
94. L105 ❌ `Content is required`
    - A: `Add a message` / `Write what was said before logging it.`
    - B: `Nothing to log` / `Pop the message in first.`
95. L127 ✅ `Communication logged`
    - A: `Logged`
    - B: `Conversation on the record`
96. L131 ❌ `Error` / *dynamic*
    - A: `Couldn't log it` / *dynamic*
    - B: `Log didn't save` / *dynamic*

### `src/pages/Tax.tsx`
97. L60 ✅ `SA105 CSV exported`
    - A: `SA105 CSV exported`
    - B: `SA105 ready for HMRC`
98. L75 ✅ `Expense added`
    - A: `Expense added`
    - B: `Expense on the books`
99. L348 ✅ `Deleted`
    - A: `Expense removed`
    - B: `Expense gone from the books`

### EMPTY STATES

100. `src/components/dashboard/DashboardTable.tsx:31` default prop `'No data available'`
    - A: title `Nothing here yet` / desc `Data will appear once there's activity to show.`
    - B: title `Quiet for now` / desc `As soon as there's activity, it'll show up in this table.`
101. `src/components/dashboard/MetricDetailsSheet.tsx:196` fallback `'No data available'`
    - A: title `Nothing to show yet` / desc `This metric has no underlying records to break down.`
    - B: title `No breakdown yet` / desc `Once data feeds this metric, you'll see the detail here.`
102. `src/components/property-detail/PropertyStatusBar.tsx` compliance label `'No data'`
    - A: `Not checked`
    - B: `Awaiting first cert`
103. `src/components/property-detail/PropertyStatusBar.tsx` rent label `'No data'`
    - A: `Not set`
    - B: `No rent recorded`

---

## Picks log

(David's picks recorded here as we go.)
