
# Automatic Property Geocoding - Implementation Status

## Current State Analysis

The automatic geocoding system is **already fully implemented** and ready to use. Here's what's in place:

### Backend Infrastructure
- **Edge Function**: `geocode-address` is deployed and functional
  - Uses Google Geocoding API (UK-biased)
  - Extracts structured address components (town, county, postcode)
  - Determines confidence level (exact/approximate/unknown)
  - API key `GOOGLE_MAPS_API_KEY` is configured

### Frontend Hooks
- **`useGeocoding`**: Core geocoding operations
  - `geocodeAddress(address)` - Calls edge function
  - `geocodeProperty(property)` - Builds address string and geocodes
  - `updatePropertyGeocode()` - Saves results to database
  - `markGeocodeFailed()` - Records errors

- **`useBackfillGeocoding`**: Batch processing
  - Queries properties where `geocode_status = NOT_STARTED/FAILED` or `latitude IS NULL`
  - Processes in batches of 10 with 200ms rate limiting
  - Tracks progress (processed, succeeded, failed)
  - Shows failure list with links to edit

### UI Components
- **`MissingLocationsBanner`**: Shows on Dashboard Map
  - Displays count of properties missing coordinates
  - "Backfill Locations" button triggers geocoding
  - Shows real-time progress during processing

- **`BackfillButton`**: Reusable component
  - Compact mode for inline use
  - Full card mode with progress bar and failure details

---

## What Works Right Now

1. Navigate to **Dashboard > Map**
2. If properties lack coordinates, you'll see a yellow banner: "X properties missing map location"
3. Click **"Backfill Locations"** button
4. The system will:
   - Query all properties needing geocoding
   - Process them in batches (10 at a time, 200ms delay)
   - Update each property with lat/lng, place_id, formatted_address
   - Show real-time progress
   - List any failures with edit links

---

## Enhancements to Make It More Visible

To ensure users can easily access the backfill feature, I recommend these improvements:

### 1. Add Location Settings Tab
Add a "Locations" tab to the Settings page with:
- Full `BackfillButton` component showing detailed progress
- Statistics: Total properties, geocoded, pending, failed
- List of properties with geocoding errors (with retry option)

### 2. Add One-Click Auto-Trigger Option
Consider auto-triggering geocoding when:
- User clicks "Backfill Locations" banner button (already works)
- After bulk import completes (hook into import success)
- Via a scheduled background job (future enhancement)

### 3. Improve Progress Visibility
- Add toast notification when backfill starts
- Show completion summary with success/failure counts
- Add "Retry Failed" button for quick re-processing

---

## Implementation Steps

### Step 1: Add Location Settings Tab (Settings Page)
Add a new tab called "Locations" that includes:
- BackfillButton with full card UI
- Statistics cards showing geocoding status
- Table of failed/pending properties

### Step 2: Enhance Import Flow
After property import completes, show a prompt:
- "X properties were imported. Would you like to geocode them now?"
- Button to trigger backfill for newly imported properties

### Step 3: Add Toast Notifications
- Toast when geocoding starts: "Geocoding X properties..."
- Toast on completion: "Successfully geocoded X properties"
- Error toast if all fail

---

## Technical Details

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add "Locations" tab with BackfillButton |
| `src/hooks/useGeocoding.ts` | Add toast notifications |
| `src/components/geocoding/BackfillButton.tsx` | Add statistics display |
| `src/pages/Settings.tsx` | Hook into import completion |

### New Components
| Component | Purpose |
|-----------|---------|
| `LocationSettingsTab` | Full geocoding management UI |
| `GeocodeStatsCards` | Show geocoding statistics |
| `FailedGeocodeList` | Table of failed properties |

---

## Summary

The core geocoding infrastructure is complete and functional. The enhancements above will make the feature more discoverable and provide better feedback to users. The main work is adding the Settings tab UI and improving notifications.

**Estimated effort**: Small - mostly UI additions to existing functionality
