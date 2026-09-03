import { CATEGORIES } from '../categories'
import { todayISO } from '../dates'

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name)

/**
 * Single extraction prompt shared by every provider. The model must return
 * ONLY a JSON object in this shape, with all descriptive text in English
 * (receipts are frequently in Spanish or other languages).
 */
export function receiptPrompt(): string {
  return `You are a receipt parser for an expense tracker. Read the attached photo of a receipt and return ONLY a single JSON object — no markdown, no commentary.

Shape:
{
  "merchant": string,        // shop/business name exactly as printed (do NOT translate proper nouns); "" if unreadable
  "date": string,            // purchase date as "YYYY-MM-DD"; "" if not visible
  "total": number,           // grand total actually paid, as a plain number (no currency symbol); 0 if unreadable
  "category": string,        // best fit from this list ONLY: ${CATEGORY_NAMES.join(', ')}
  "lineItems": [             // one entry per purchased item; [] if the receipt has no itemisation
    {
      "name": string,        // item description, TRANSLATED TO ENGLISH
      "qty": number,         // quantity (default 1)
      "unitPrice": number,   // price per unit as a plain number
      "lineTotal": number    // qty * unitPrice as printed
    }
  ]
}

Rules:
- Translate every "name" and any descriptive text to English. Keep "merchant" as printed.
- Numbers only for amounts — strip currency symbols and thousands separators, use a dot for decimals.
- If the receipt shows a date like DD/MM/YYYY, convert it to YYYY-MM-DD. Today is ${todayISO()}; the date is never in the future.
- "category" MUST be one of the listed values, verbatim. Use "Other" if nothing fits.
- Output valid JSON and nothing else.`
}
